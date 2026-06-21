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

  // Identificador legible único (CHAT-000001)
  ticket_number: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: true,
    comment: 'ID legible con formato CHAT-000001'
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
    { fields: ['ticket_number'], unique: true }
  ]
});

// Auto-generar ticket_number antes de crear
Conversation.beforeCreate(async (conv) => {
  if (!conv.ticket_number) {
    try {
      const [result] = await sequelize.query(
        `SELECT MAX(CAST(SUBSTRING(ticket_number FROM 6) AS INTEGER)) AS max_num FROM conversations WHERE ticket_number IS NOT NULL`
      );
      const next = (result[0]?.max_num || 0) + 1;
      conv.ticket_number = 'CHAT-' + String(next).padStart(6, '0');
    } catch {
      conv.ticket_number = 'CHAT-' + String(Date.now()).slice(-6);
    }
  }
});

module.exports = Conversation;
