const logger = require('../config/logger');
const Notification = require('../models/Notification');

let _io = null;

function setSocketIO(io) { _io = io; }

async function create({ companyId, userId, type, title, body, metadata }) {
  try {
    const notif = await Notification.create({
      company_id: companyId || null,
      user_id:    userId || null,
      type,
      title,
      body:     body || null,
      metadata: metadata || {},
    });

    if (_io) {
      const room = userId ? `user:${userId}` : 'agents';
      _io.to(room).emit('notification:new', notif.toJSON());
    }

    return notif;
  } catch (err) {
    logger.error('Error creando notificación:', err.message);
    return null;
  }
}

async function notifyAppointment(appointment, companyId) {
  return create({
    companyId,
    type:  'appointment',
    title: `Nueva cita agendada`,
    body:  `${appointment.contact_name} — ${appointment.date} a las ${appointment.start_time}`,
    metadata: {
      appointment_id: appointment.id,
      contact_name:   appointment.contact_name,
      contact_phone:  appointment.contact_phone,
      date:           appointment.date,
      start_time:     appointment.start_time,
    },
  });
}

async function notifyNewMessage(conversation, message, contact) {
  const channelLabel = { whatsapp: 'WhatsApp', messenger: 'Messenger', instagram: 'Instagram', web: 'Widget Web' };
  return create({
    companyId: conversation.company_id,
    type:  'message',
    title: `Nuevo mensaje de ${contact?.name || 'Cliente'}`,
    body:  `[${channelLabel[conversation.channel] || conversation.channel}] ${message.content?.substring(0, 80) || ''}`,
    metadata: {
      conversation_id: conversation.id,
      channel:         conversation.channel,
      contact_name:    contact?.name,
    },
  });
}

module.exports = { setSocketIO, create, notifyAppointment, notifyNewMessage };
