// backend/src/models/Conversation.js
// Conversación: agrupa los mensajes de un contacto en un canal específico

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Conversation = sequelize.define('conversations', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // Relaciones
  contact_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'contacts', key: 'id' },
    onDelete: 'CASCADE'
  },
  assigned_agent_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Usuario (agente) asignado. NULL = chatbot maneja'
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: true
  },

  // Canal de comunicación
  channel: {
    type: DataTypes.ENUM('whatsapp', 'messenger', 'instagram', 'web'),
    allowNull: false
  },

  // Estado de la conversación
  status: {
    type: DataTypes.ENUM('open', 'assigned', 'resolved', 'bot'),
    defaultValue: 'bot',
    comment: 'bot=manejado por IA, open=sin asignar, assigned=con agente, resolved=cerrado'
  },

  // Datos de la última interacción
  last_message_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  last_message_preview: {
    type: DataTypes.STRING(500),
    allowNull: true
  },

  // Contador para UI
  unread_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },

  // Prioridad para agentes
  priority: {
    type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
    defaultValue: 'normal'
  },

  // Identificador legible (CHAT-000001)
  ticket_id: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: true,
    comment: 'ID legible con formato CHAT-000001'
  },

  // Metadata adicional
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  indexes: [
    { fields: ['contact_id'] },
    { fields: ['channel'] },
    { fields: ['status'] },
    { fields: ['assigned_agent_id'] },
    { fields: ['last_message_at'] },
    { fields: ['company_id'] },
    { fields: ['ticket_id'], unique: true }
  ]
});

// Auto-generate ticket_id before creation
Conversation.addHook('afterCreate', async (conv) => {
  if (!conv.ticket_id) {
    try {
      const { sequelize } = require('../config/database');
      const [[{ nextval }]] = await sequelize.query(`SELECT nextval('conversation_ticket_seq')`);
      const ticketId = `CHAT-${String(nextval).padStart(6, '0')}`;
      await conv.update({ ticket_id: ticketId }, { hooks: false });
      conv.ticket_id = ticketId;
    } catch (e) {
      // Sequence may not exist yet during first migration
    }
  }
});

module.exports = Conversation;
