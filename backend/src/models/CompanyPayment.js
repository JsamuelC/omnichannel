const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CompanyPayment = sequelize.define('company_payments', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  company_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  amount: {
    type:      DataTypes.DECIMAL(14, 2),
    allowNull: false,
  },
  currency: {
    type:         DataTypes.STRING(3),
    allowNull:    false,
    defaultValue: 'USD',
  },
  payment_method: {
    type:      DataTypes.ENUM('bank_transfer', 'cash', 'card', 'mobile_payment', 'check', 'paypal', 'other'),
    allowNull: false,
  },
  reference_number: {
    type:      DataTypes.STRING(100),
    allowNull: true,
  },
  payment_date: {
    type:      DataTypes.DATEONLY,
    allowNull: false,
  },
  period_covered: {
    type:      DataTypes.STRING(100),
    allowNull: true,
  },
  notes: {
    type:      DataTypes.TEXT,
    allowNull: true,
  },
  receipt_path: {
    type:      DataTypes.STRING(500),
    allowNull: true,
  },
  receipt_filename: {
    type:      DataTypes.STRING(255),
    allowNull: true,
  },
  recorded_by: {
    type:      DataTypes.UUID,
    allowNull: true,
  },
  status: {
    type:         DataTypes.ENUM('confirmed', 'pending', 'refunded'),
    allowNull:    false,
    defaultValue: 'confirmed',
  },
}, {
  tableName:  'company_payments',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['payment_date'] },
    { fields: ['status'] },
    { fields: ['company_id', 'payment_date'] },
  ],
});

module.exports = CompanyPayment;
