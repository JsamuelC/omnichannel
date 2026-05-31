// backend/src/models/WhatsappChat.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WhatsappChat = sequelize.define('whatsapp_chats', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true
  },
  session_id: {
    type:      DataTypes.STRING,
    allowNull: false
  },
  jid: {
    type:      DataTypes.STRING,
    allowNull: false
  },
  // ── NUEVO: diferencia personal vs business ──────────────
  session_type: {
    type:         DataTypes.ENUM('personal', 'business'),
    allowNull:    false,
    defaultValue: 'personal',
    comment:      'personal = Baileys QR personal | business = WhatsApp Business del asesor'
  },
  contact_name: {
    type:      DataTypes.STRING,
    allowNull: true
  },
  bot_enabled: {
    type:         DataTypes.BOOLEAN,
    defaultValue: false
  },
  bot_prompt: {
    type:      DataTypes.TEXT,
    allowNull: true
  },
  unread_count: {
    type:         DataTypes.INTEGER,
    defaultValue: 0
  },
  last_message: {
    type:      DataTypes.TEXT,
    allowNull: true
  },
  last_message_at: {
    type:      DataTypes.BIGINT,
    allowNull: true
  }
}, {
  indexes: [
    { unique: true, fields: ['session_id', 'jid'] },
    { fields: ['session_id'] },
    { fields: ['session_type'] },
    { fields: ['bot_enabled'] },
    { fields: ['last_message_at'] }
  ]
});

module.exports = WhatsappChat;