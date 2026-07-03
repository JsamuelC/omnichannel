// backend/src/services/messageService.js
// ─────────────────────────────────────────────────────────────
// Servicio central de mensajes para Tecnossync
// CAMBIO RBAC: getConversations acepta `extraFilter` para que
// scopeConversations pueda inyectar { assigned_agent_id: userId }
// ─────────────────────────────────────────────────────────────
const { Op } = require('sequelize');
const { Contact, Conversation, Message, User } = require('../models');
const metaService    = require('./metaService');
const chatbotService = require('./chatbotService');
const logger         = require('../config/logger');

class MessageService {

  setSocketIO(io) {
    this.io = io;
  }

  // ──────────────────────────────────────────────────────────
  // MENSAJE ENTRANTE (desde Meta Webhook)
  // ──────────────────────────────────────────────────────────
  async processIncomingMessage({ channel, senderId, senderName, text, externalId, mediaUrl, contentType = 'text', timestamp }) {
    try {
      const contact      = await this.findOrCreateContact(channel, senderId, senderName);
      const conversation = await this.findOrCreateConversation(channel, contact);

      // Deduplicación — Meta puede enviar el mismo evento 2 veces
      if (externalId) {
        const existing = await Message.findOne({ where: { external_id: externalId } });
        if (existing) {
          logger.warn(`⚠️  Mensaje duplicado ignorado: ${externalId}`);
          return existing;
        }
      }

      const message = await Message.create({
        conversation_id: conversation.id,
        external_id:     externalId,
        direction:       'inbound',
        sender_type:     'contact',
        content_type:    contentType,
        content:         text,
        media_url:       mediaUrl,
        status:          'delivered',
        sent_at:         timestamp ? new Date(timestamp * 1000) : new Date()
      });

      await conversation.update({
        last_message_at:      new Date(),
        last_message_preview: text?.substring(0, 100) || `[${contentType}]`,
        unread_count:         conversation.unread_count + 1
      });

      if (this.io) {
        const cid = conversation.company_id;
        const payload = { message: message.toJSON(), conversation: conversation.toJSON(), contact: contact.toJSON() };
        if (cid) this.io.to(`agents:${cid}`).emit('message:new', payload);
        this.io.to('agents').emit('message:new', payload);
      }

      if (channel === 'whatsapp' && externalId) {
        metaService.markWhatsAppAsRead(externalId).catch(() => {});
      }

      // Crear notificación
      try {
        const notificationService = require('./notificationService');
        notificationService.notifyNewMessage(conversation, message, contact);
      } catch (_) {}

      if (text) {
        await this.triggerChatbot(conversation, message, contact);
      }

      return message;

    } catch (error) {
      logger.error('❌ Error procesando mensaje entrante:', error);
      throw error;
    }
  }

  // ──────────────────────────────────────────────────────────
  // MENSAJE SALIENTE (desde agente o bot)
  // ──────────────────────────────────────────────────────────
  async sendOutgoingMessage({ conversationId, text, senderType = 'agent', senderId = null }) {
    const conversation = await Conversation.findByPk(conversationId, {
      include: [{ model: Contact, as: 'contact' }]
    });

    if (!conversation) throw new Error('Conversación no encontrada');

    const contact     = conversation.contact;

    let externalId = null;

    if (conversation.channel === 'web') {
      // Canal web: no pasa por Meta, solo guarda el mensaje y emite por socket
    } else {
      const recipientId = this.getChannelId(contact, conversation.channel);
      if (!recipientId) throw new Error(`Contacto sin ID para canal ${conversation.channel}`);
      const metaResponse = await metaService.sendMessage(conversation.channel, recipientId, text);
      externalId = metaResponse?.messages?.[0]?.id || null;
    }

    const message = await Message.create({
      conversation_id: conversationId,
      external_id:     externalId,
      direction:       'outbound',
      sender_type:     senderType,
      sender_id:       senderId,
      content_type:    'text',
      content:         text,
      status:          'sent'
    });

    await conversation.update({
      last_message_at:      new Date(),
      last_message_preview: `Tú: ${text.substring(0, 80)}`
    });

    if (this.io) {
      const cid = conversation.company_id;
      const payload = { message: message.toJSON(), conversationId };
      if (cid) this.io.to(`agents:${cid}`).emit('message:sent', payload);
      this.io.to('agents').emit('message:sent', payload);
    }

    return message;
  }

  // ──────────────────────────────────────────────────────────
  // CHATBOT
  // ──────────────────────────────────────────────────────────
  async triggerChatbot(conversation, incomingMessage, contact) {
    try {
      const result = await chatbotService.handleMessage(conversation, incomingMessage, this.io);

      const botText     = result ? (typeof result === 'string' ? result : result.text)         : null;
      const catalogFile = result && typeof result === 'object'  ? result.catalogFile            : null;
      const handoff     = result && typeof result === 'object'  ? result.handoff || false       : false;

      if (botText) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.sendOutgoingMessage({
          conversationId: conversation.id,
          text:           botText,
          senderType:     'bot'
        });
      }

      // Enviar archivo adjunto por Meta si el catálogo lo tiene
      if (catalogFile && conversation.channel === 'whatsapp') {
        try {
          const metaService = require('./metaService');
          const recipientId = contact?.whatsapp_id || contact?.phone;
          if (recipientId) {
            await new Promise(resolve => setTimeout(resolve, 600));
            await metaService.sendWhatsAppDocument(recipientId, catalogFile);
            logger.info(`📎 Archivo de catálogo enviado a ${recipientId}: ${catalogFile.nombre}`);
          }
        } catch (fileErr) {
          logger.warn('⚠️  No se pudo enviar archivo de catálogo por Meta:', fileErr.message);
        }
      }

      // Evaluar reglas de flujo para el pipeline omnichannel
      try {
        await chatbotService.evaluateFlowRules({
          sessionId:   null,
          jid:         contact?.whatsapp_id || contact?.phone || `contact_${contact?.id}`,
          userMessage: incomingMessage.content,
          botText,
          catalogFile,
          handoff,
          chatRecord:  { company_id: conversation.company_id, contact_name: contact?.name },
          sock:        null
        }, this.io);
      } catch (ruleErr) {
        logger.warn('⚠️  Error evaluando reglas de flujo (omnichannel):', ruleErr.message);
      }
    } catch (error) {
      logger.error('❌ Error en chatbot trigger:', error);
    }
  }

  // ──────────────────────────────────────────────────────────
  // CONTACTOS
  // ──────────────────────────────────────────────────────────
  async findOrCreateContact(channel, externalId, name) {
    const channelField = `${channel}_id`;

    let contact = await Contact.findOne({ where: { [channelField]: externalId } });

    if (!contact) {
      contact = await Contact.create({
        [channelField]: externalId,
        name:  name || `Usuario ${channel}`,
        phone: channel === 'whatsapp' ? externalId : null
      });
      logger.info(`👤 Nuevo contacto creado: ${contact.id} (${channel})`);
    } else if (name && !contact.name) {
      await contact.update({ name });
    }

    return contact;
  }

  // ──────────────────────────────────────────────────────────
  // CONVERSACIONES
  // ──────────────────────────────────────────────────────────
  async findOrCreateConversation(channel, contact) {
    let conversation = await Conversation.findOne({
      where: {
        contact_id: contact.id,
        channel,
        status: { [Op.in]: ['open', 'bot', 'assigned'] }
      },
      order: [['updated_at', 'DESC']]
    });

    if (!conversation) {
      conversation = await Conversation.create({
        contact_id: contact.id,
        channel,
        status: 'bot',
        company_id: contact.company_id || null
      });
      logger.info(`💬 Nueva conversación: ${conversation.id} / ${conversation.ticket_number} (${channel})`);

      // Round-robin: asignar automáticamente si está configurado
      if (contact.company_id) {
        try {
          const Company = require('../models/Company');
          const company = await Company.findByPk(contact.company_id, { attributes: ['routing_config'] });
          if (company?.routing_config?.mode === 'round_robin') {
            const { assignRoundRobin } = require('./routingService');
            await assignRoundRobin(contact.company_id, conversation.id);
            await conversation.reload();
          }
        } catch (_) {}
      }
    }

    return conversation;
  }

  getChannelId(contact, channel) {
    return {
      whatsapp:  contact.whatsapp_id,
      messenger: contact.messenger_id,
      instagram: contact.instagram_id,
      web:       contact.web_id
    }[channel];
  }

  // ──────────────────────────────────────────────────────────
  // GET CONVERSATIONS — RBAC: acepta extraFilter
  //
  //   admin  → extraFilter = {}                → ve todo
  //   agent  → extraFilter = { assigned_agent_id: id } → solo sus chats
  // ──────────────────────────────────────────────────────────
  async getConversations({ page = 1, limit = 20, status, channel, search, extraFilter = {} }) {
    // Construir cláusula WHERE combinando el scope de rol y los filtros UI
    const where = { ...extraFilter };

    if (status === 'active') {
      where.status = { [Op.in]: ['bot', 'open', 'assigned'] };
    } else if (status) {
      where.status = status;
    }
    if (channel) where.channel = channel;

    // Búsqueda por ticket_number (CHAT-) o ID de conversación (#)
    if (search && (search.toUpperCase().startsWith('CHAT-') || search.startsWith('#'))) {
      const term = search.startsWith('#') ? search.slice(1) : search;
      where[Op.or] = [
        { ticket_number: { [Op.iLike]: `%${term}%` } },
        { id: { [Op.iLike]: `${term.toLowerCase()}%` } }
      ];
      search = null;
    }

    // Para búsqueda por nombre de contacto usamos required: true en el include
    const include = [
      {
        model:    Contact,
        as:       'contact',
        required: !!search,
        where: search ? {
          [Op.or]: [
            { name:  { [Op.iLike]: `%${search}%` } },
            { phone: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } }
          ]
        } : undefined
      },
      {
        model:      User,
        as:         'assigned_agent',
        required:   false,
        attributes: ['id', 'name', 'avatar_url', 'role']
      }
    ];

    const { count, rows } = await Conversation.findAndCountAll({
      where,
      include,
      order:    [['last_message_at', 'DESC NULLS LAST']],
      limit:    +limit,
      offset:   (+page - 1) * +limit,
      subQuery: false   // evita subquery incorrecta con LIMIT+JOINS
    });

    return {
      conversations: rows,
      total: count,
      pages: Math.ceil(count / +limit),
      page:  +page
    };
  }

  // ──────────────────────────────────────────────────────────
  // GET MESSAGES
  // ──────────────────────────────────────────────────────────
  async getMessages(conversationId, { page = 1, limit = 50 }) {
    const { count, rows } = await Message.findAndCountAll({
      where:  { conversation_id: conversationId },
      order:  [['created_at', 'DESC']],
      limit:  +limit,
      offset: (+page - 1) * +limit
    });

    return {
      messages: rows.reverse(),   // más recientes al final para el scroll
      total:    count,
      pages:    Math.ceil(count / +limit)
    };
  }
}

module.exports = new MessageService();
