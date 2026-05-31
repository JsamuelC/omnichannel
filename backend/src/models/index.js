// backend/src/models/index.js
// Punto central de todos los modelos y sus asociaciones

const { sequelize }    = require('../config/database');
const Contact          = require('./Contact');
const Conversation     = require('./Conversation');
const Message          = require('./Message');
const BotConfig        = require('./BotConfig');
const User             = require('./User');
const Campaign         = require('./Campaign');
const PaymentVoucher   = require('./PaymentVoucher');
const VoucherAuditLog  = require('./VoucherAuditLog');
const WhatsappMessage  = require('./WhatsappMessage');
const WhatsappChat     = require('./WhatsappChat');
const Integration      = require('./Integration');
const BotFile          = require('./BotConfig');
const TransferCriteria = require('./TransferCriteria');
const WhatsappAccount  = require('./WhatsappAccount');

// ============================
// ASOCIACIONES ORIGINALES
// ============================

Contact.hasMany(Conversation, { foreignKey: 'contact_id', as: 'conversations' });
Conversation.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });

Conversation.hasMany(Message, { foreignKey: 'conversation_id', as: 'messages' });
Message.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' });

User.hasMany(Conversation, { foreignKey: 'assigned_agent_id', as: 'assigned_conversations' });
Conversation.belongsTo(User, { foreignKey: 'assigned_agent_id', as: 'assigned_agent' });

// ============================
// ASOCIACIONES COMPROBANTES
// ============================

Contact.hasMany(PaymentVoucher, { foreignKey: 'contact_id', as: 'vouchers' });
PaymentVoucher.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });

User.hasMany(PaymentVoucher, { foreignKey: 'verified_by', as: 'verified_vouchers' });
PaymentVoucher.belongsTo(User, { foreignKey: 'verified_by', as: 'verifier' });

PaymentVoucher.hasMany(VoucherAuditLog, { foreignKey: 'voucher_id', as: 'audit_logs' });
VoucherAuditLog.belongsTo(PaymentVoucher, { foreignKey: 'voucher_id', as: 'voucher' });

// ============================
// FUNCIÓN DE MIGRACIÓN
// ============================
const migrate = async () => {
  const logger = require('../config/logger');
  try {
    const alter = process.env.SEQUELIZE_ALTER === 'true';
    await sequelize.sync({ alter });
    logger.info('✅ Tablas sincronizadas con la base de datos');
  } catch (error) {
    logger.error('❌ Error en migración:', error);
    throw error;
  }
};
WhatsappChat.hasMany(WhatsappMessage, {
  foreignKey: 'session_id',
  sourceKey:  'session_id',
  as:         'messages',
  scope:      { } // sin scope, relación por session_id + jid se maneja en queries
});

module.exports = {
  sequelize,
  Contact,
  Conversation,
  Message,
  BotConfig,
  User,
  Campaign,
  PaymentVoucher,
  VoucherAuditLog,
  WhatsappMessage,
  WhatsappChat,
  Integration,
  BotFile,
  TransferCriteria,
  migrate
};
