// backend/src/controllers/messageController.js
// ─────────────────────────────────────────────────────────────
// Controlador de mensajes y conversaciones
// Usa req.conversationFilter inyectado por scopeConversations
// para que agentes solo vean sus conversaciones asignadas
// ─────────────────────────────────────────────────────────────
const messageService = require('../services/messageService');
const { Conversation, Message, Contact, User } = require('../models');
const logger = require('../config/logger');

class MessageController {

  // POST /conversations/new-whatsapp — crear conversación desde número de WhatsApp
  async createFromWhatsapp(req, res) {
    try {
      const { phone, name } = req.body;
      if (!phone?.trim()) {
        return res.status(400).json({ success: false, message: 'El número de teléfono es requerido.' });
      }

      const cleanPhone = phone.replace(/[^0-9]/g, '');
      if (cleanPhone.length < 7) {
        return res.status(400).json({ success: false, message: 'Número de teléfono inválido.' });
      }

      const companyId = req.user?.company_id;
      const { Op } = require('sequelize');

      // Buscar o crear el contacto
      let contact = await Contact.findOne({
        where: { whatsapp_id: cleanPhone, ...(companyId ? { company_id: companyId } : {}) }
      });

      if (!contact) {
        contact = await Contact.create({
          whatsapp_id: cleanPhone,
          name: name?.trim() || `WhatsApp ${cleanPhone}`,
          phone: cleanPhone,
          company_id: companyId || null,
        });
        logger.info(`👤 Contacto creado desde bandeja: ${contact.id} (${cleanPhone})`);
      }

      // Buscar conversación activa existente
      let conversation = await Conversation.findOne({
        where: {
          contact_id: contact.id,
          channel: 'whatsapp',
          status: { [Op.in]: ['open', 'bot', 'assigned'] }
        },
        include: [
          { model: Contact, as: 'contact' },
          { model: User, as: 'assigned_agent', attributes: ['id', 'name', 'avatar_url', 'role'] }
        ]
      });

      if (!conversation) {
        conversation = await Conversation.create({
          contact_id: contact.id,
          channel: 'whatsapp',
          status: 'open',
          company_id: companyId || null,
          assigned_agent_id: req.user.id,
        });
        await conversation.reload({
          include: [
            { model: Contact, as: 'contact' },
            { model: User, as: 'assigned_agent', attributes: ['id', 'name', 'avatar_url', 'role'] }
          ]
        });
        logger.info(`💬 Conversación WhatsApp creada desde bandeja: ${conversation.id}`);
      }

      res.json({ success: true, data: conversation });
    } catch (error) {
      logger.error('Error createFromWhatsapp:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /conversations
  async getConversations(req, res) {
    try {
      const { page = 1, limit = 20, status, channel, search } = req.query;

      // req.conversationFilter viene de scopeConversations:
      //   admin → {}
      //   agent → { assigned_agent_id: req.user.id }
      const scopeFilter = req.conversationFilter || {};

      const result = await messageService.getConversations({
        page: +page,
        limit: +limit,
        status,
        channel,
        search,
        extraFilter: scopeFilter        // nuevo parámetro que messageService debe respetar
      });

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error getConversations:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /conversations/:id
  async getConversation(req, res) {
    try {
      // Si requireConversationAccess ya cargó la conv, la reutilizamos
      const conversation = req.conversation || await Conversation.findByPk(req.params.id, {
        include: [
          { model: Contact, as: 'contact' },
          { model: User,    as: 'assigned_agent', attributes: ['id', 'name', 'avatar_url', 'role'] }
        ]
      });

      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversación no encontrada.' });
      }

      res.json({ success: true, data: conversation });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /conversations/:id/messages
  async getMessages(req, res) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const result = await messageService.getMessages(req.params.id, { page: +page, limit: +limit });

      // Resetear contador de no leídos
      await Conversation.update({ unread_count: 0 }, { where: { id: req.params.id } });

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /conversations/:id/messages
  async sendMessage(req, res) {
    try {
      const { text } = req.body;
      const conversationId = req.params.id;

      if (!text?.trim()) {
        return res.status(400).json({ success: false, message: 'El mensaje no puede estar vacío.' });
      }

      const message = await messageService.sendOutgoingMessage({
        conversationId,
        text:        text.trim(),
        senderType:  'agent',
        senderId:    req.user?.id
      });

      res.json({ success: true, data: message });
    } catch (error) {
      logger.error('Error sendMessage:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /conversations/:id/assign  (solo admin — ver routes)
  async assignConversation(req, res) {
    try {
      const { agentId } = req.body;

      const companyId = req.user?.company_id;
      if (agentId) {
        const agentWhere = { id: agentId, role: 'agent', is_active: true };
        if (companyId) agentWhere.company_id = companyId;
        const agent = await User.findOne({ where: agentWhere });
        if (!agent) {
          return res.status(400).json({ success: false, message: 'Agente no válido o inactivo.' });
        }
      }

      const conversation = await Conversation.findByPk(req.params.id);
      if (!conversation || (companyId && conversation.company_id !== companyId)) {
        return res.status(404).json({ success: false, message: 'Conversación no encontrada.' });
      }

      await conversation.update({
        assigned_agent_id: agentId || null,
        status: agentId ? 'assigned' : 'open'
      });

      const io = req.app.get('io');
      if (io) {
        io.to('agents').emit('conversation:assigned', {
          conversationId: conversation.id,
          agentId
        });
        // Notificar específicamente al agente asignado
        if (agentId) {
          io.to(`user:${agentId}`).emit('conversation:assigned_to_you', {
            conversationId: conversation.id
          });
        }
      }

      res.json({ success: true, data: conversation });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /conversations/from-phone
  async createFromPhone(req, res) {
    try {
      const { phone, name } = req.body;
      if (!phone?.trim()) {
        return res.status(400).json({ success: false, message: 'El número de teléfono es requerido.' });
      }

      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const companyId = req.user?.company_id || null;

      let contact = await Contact.findOne({ where: { whatsapp_id: cleanPhone } });
      if (!contact) {
        contact = await Contact.create({
          whatsapp_id: cleanPhone,
          name: name?.trim() || `+${cleanPhone}`,
          phone: cleanPhone,
          company_id: companyId,
        });
      }

      const { Op } = require('sequelize');
      let conversation = await Conversation.findOne({
        where: {
          contact_id: contact.id,
          channel: 'whatsapp',
          status: { [Op.in]: ['open', 'bot', 'assigned'] }
        },
        include: [
          { model: Contact, as: 'contact' },
          { model: User, as: 'assigned_agent', attributes: ['id', 'name', 'avatar_url', 'role'] }
        ],
        order: [['updated_at', 'DESC']]
      });

      if (!conversation) {
        conversation = await Conversation.create({
          contact_id: contact.id,
          channel: 'whatsapp',
          status: 'open',
          company_id: companyId,
          last_message_at: new Date(),
        });
        await conversation.reload({
          include: [
            { model: Contact, as: 'contact' },
            { model: User, as: 'assigned_agent', attributes: ['id', 'name', 'avatar_url', 'role'] }
          ]
        });
      }

      res.json({ success: true, data: conversation });
    } catch (error) {
      logger.error('Error createFromPhone:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /conversations/:id/resolve
  async resolveConversation(req, res) {
    try {
      const companyId = req.user?.company_id;
      const conversation = await Conversation.findByPk(req.params.id);
      if (!conversation || (companyId && conversation.company_id !== companyId)) {
        return res.status(404).json({ success: false, message: 'Conversación no encontrada.' });
      }

      await conversation.update({ status: 'resolved', assigned_agent_id: null });
      res.json({ success: true, data: conversation });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // DELETE /conversations/:id
  async deleteConversation(req, res) {
    try {
      const conversation = await Conversation.findByPk(req.params.id);
      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversación no encontrada.' });
      }

      const { Message } = require('../models');
      await Message.destroy({ where: { conversation_id: conversation.id } });
      await conversation.destroy();

      const io = req.app.get('io');
      if (io) io.to('agents').emit('conversation:deleted', { conversationId: conversation.id });

      res.json({ success: true, message: 'Conversación eliminada.' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new MessageController();
