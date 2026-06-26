const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('notifications', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  company_id: {
    type:      DataTypes.UUID,
    allowNull: true,
  },
  user_id: {
    type:      DataTypes.UUID,
    allowNull: true,
  },
  type: {
    type:      DataTypes.STRING(50),
    allowNull: false,
    comment:   'appointment, message, reminder, system',
  },
  title: {
    type:      DataTypes.STRING(200),
    allowNull: false,
  },
  body: {
    type:      DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type:         DataTypes.JSONB,
    defaultValue: {},
  },
  read: {
    type:         DataTypes.BOOLEAN,
    defaultValue: false,
  },
  read_at: {
    type:      DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName:   'notifications',
  timestamps:  true,
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['user_id'] },
    { fields: ['read'] },
    { fields: ['type'] },
    { fields: ['created_at'] },
  ],
});

module.exports = Notification;
