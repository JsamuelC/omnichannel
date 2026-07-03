const { Contact, Conversation, Message, BotConfig } = require('../models');
const Company        = require('../models/Company');
const logger         = require('../config/logger');
const chatbotService = require('../services/chatbotService');
const { v4: uuid }   = require('uuid');

// POST /api/widget/init — inicia sesión anónima del visitante
exports.init = async (req, res) => {
  try {
    const { company_id, visitor_name, visitor_email, visitor_phone, session_id, form_data } = req.body;

    if (!company_id) return res.status(400).json({ success: false, error: 'company_id requerido' });

    const company = await Company.findByPk(company_id, { attributes: ['id', 'nombre'] });
    if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada' });

    const webId = session_id || `web_${uuid()}`;
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;

    const [contact] = await Contact.findOrCreate({
      where: { web_id: webId },
      defaults: {
        web_id:     webId,
        name:       visitor_name || 'Visitante web',
        email:      visitor_email || null,
        phone:      visitor_phone || null,
        company_id: company_id,
      },
    });

    const updates = {};
    if (visitor_name && visitor_name !== contact.name)   updates.name  = visitor_name;
    if (visitor_email && visitor_email !== contact.email) updates.email = visitor_email;
    if (visitor_phone && visitor_phone !== contact.phone) updates.phone = visitor_phone;
    if (Object.keys(updates).length) await contact.update(updates);

    // Guardar IP y datos del formulario en metadata de la conversación

    const [conversation, convCreated] = await Conversation.findOrCreate({
      where: { contact_id: contact.id, channel: 'web', status: ['open', 'bot', 'assigned'] },
      defaults: {
        contact_id: contact.id,
        channel:    'web',
        status:     'bot',
        company_id: company_id,
        metadata:   { client_ip: clientIp, form_data: form_data || null },
      },
    });

    if (!convCreated && clientIp) {
      const meta = conversation.metadata || {};
      meta.client_ip = clientIp;
      if (form_data) meta.form_data = form_data;
      await conversation.update({ metadata: meta });
    }

    // Emitir a agentes para que la bandeja se actualice en tiempo real
    const io = req.app.get('io');
    if (io) {
      const fullConv = await Conversation.findByPk(conversation.id, {
        include: [{ model: Contact, as: 'contact' }]
      });
      if (fullConv) {
        io.to('agents').emit(convCreated ? 'conversation:new' : 'conversation:updated', { conversation: fullConv.toJSON() });
      }
    }

    res.json({
      success: true,
      data: {
        session_id:      webId,
        conversation_id: conversation.id,
        contact_id:      contact.id,
        company_name:    company.nombre,
      },
    });
  } catch (err) {
    logger.error('Widget init error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/widget/message — visitante envía un mensaje
exports.sendMessage = async (req, res) => {
  try {
    const { conversation_id, session_id, text } = req.body;
    if (!conversation_id || !text?.trim()) {
      return res.status(400).json({ success: false, error: 'conversation_id y text son requeridos' });
    }

    const conversation = await Conversation.findByPk(conversation_id, {
      include: [{ model: Contact, as: 'contact' }],
    });
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversación no encontrada' });

    const message = await Message.create({
      conversation_id,
      direction:    'inbound',
      sender_type:  'contact',
      content_type: 'text',
      content:      text.trim(),
      status:       'delivered',
    });

    await conversation.update({
      last_message_at:      new Date(),
      last_message_preview: text.trim().substring(0, 80),
    });

    // Emitir a agentes via socket (incluir contact para que la bandeja muestre nombre)
    const io = req.app.get('io');
    if (io) {
      io.to('agents').emit('message:new', {
        message:      message.toJSON(),
        conversation: conversation.toJSON(),
        contact:      conversation.contact?.toJSON() || null,
      });
    }

    // Respuesta del bot si la conversación está en modo bot
    let botReply = null;
    const botConfig = await BotConfig.findOne({
      where: { is_active: true, company_id: conversation.company_id },
      order: [['created_at', 'DESC']]
    });
    const widgetRealtime = botConfig?.widget_realtime_responses !== false;

    if (conversation.status === 'bot' && widgetRealtime) {
      try {
        // Verificar si el bot tiene habilitadas respuestas en tiempo real para el widget
        const botConfig = await BotConfig.findOne({
          where: {
            company_id: conversation.company_id,
            is_active: true,
            channel: ['web', 'all']
          },
          order: [['channel', 'ASC']] // prioriza config específica 'web' sobre 'all'
        });

        const realtimeEnabled = botConfig ? botConfig.widget_realtime_response !== false : true;

        if (realtimeEnabled) {
          const result = await chatbotService.handleMessage(conversation, message, io);
          const botText     = result ? (typeof result === 'string' ? result : result.text)   : null;
          const catalogFile = result && typeof result === 'object' ? result.catalogFile      : null;
          const handoff     = result && typeof result === 'object' ? result.handoff || false : false;

          if (botText) {
            await new Promise(r => setTimeout(r, 800));
            const botMsg = await Message.create({
              conversation_id,
              direction:    'outbound',
              sender_type:  'bot',
              content_type: 'text',
              content:      botText,
              status:       'sent',
            });

            await conversation.update({
              last_message_at:      new Date(),
              last_message_preview: `Bot: ${botText.substring(0, 80)}`,
            });

            if (io) {
              io.to('agents').emit('message:sent', { message: botMsg.toJSON(), conversationId: conversation_id });
            }

            botReply = botMsg.toJSON();
          }

          // Evaluar reglas de flujo (notify_human es la única acción que aplica al
          // widget hoy — apply_label/disable_bot/send_message dependen de WhatsappChat)
          try {
            await chatbotService.evaluateFlowRules({
              sessionId:   null,
              jid:         conversation.contact?.web_id || `contact_${conversation.contact_id}`,
              userMessage: text.trim(),
              botText,
              catalogFile,
              handoff,
              chatRecord:  { company_id: conversation.company_id, contact_name: conversation.contact?.name },
              sock:        null,
            }, io);
          } catch (ruleErr) {
            logger.warn('⚠️  Error evaluando reglas de flujo (widget):', ruleErr.message);
          }
        }
      } catch (botErr) {
        logger.warn('Widget bot error:', botErr.message);
      }
    }

    res.json({ success: true, data: { message: message.toJSON(), botReply } });
  } catch (err) {
    logger.error('Widget sendMessage error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/widget/messages/:conversationId — obtener historial
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await Message.findAll({
      where: { conversation_id: conversationId },
      order: [['created_at', 'ASC']],
      limit: 50,
    });
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/widget/poll/:conversationId?after=ISO_DATE — mensajes nuevos para el visitante
exports.poll = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { after } = req.query;
    const { Op } = require('sequelize');

    const where = {
      conversation_id: conversationId,
      direction: 'outbound',
    };
    if (after) {
      where.created_at = { [Op.gt]: new Date(after) };
    }

    const messages = await Message.findAll({
      where,
      order: [['created_at', 'ASC']],
      limit: 20,
    });
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/widget/config/:companyId — config pública del widget
exports.getConfig = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.companyId, {
      attributes: ['id', 'nombre', 'horarios'],
    });
    if (!company) return res.status(404).json({ success: false, error: 'No encontrada' });

    res.json({
      success: true,
      data: {
        company_id:   company.id,
        company_name: company.nombre,
        horarios:     company.horarios,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
