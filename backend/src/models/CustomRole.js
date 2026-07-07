// backend/src/models/CustomRole.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Permisos por defecto: TODO visible (= comportamiento actual de agent/supervisor).
// Crear un rol nuevo sin tocar ningún checkbox no oculta nada.
const DEFAULT_PERMISSIONS = {
  view_inbox:                     true,
  view_channel_whatsapp:          true,
  view_channel_whatsapp_business: true,
  view_channel_messenger:         true,
  view_channel_instagram:         true,
  view_channel_web:               true,
  view_all_conversations:         true,
  assign_conversations:           true,

  view_campaigns:      true,
  view_vouchers:       true,
  view_calendar:       true,
  view_templates:      true,
  view_dashboard:      true,
  view_custom_modules: true,

  view_config:              true,
  config_company_profile:   true,
  config_team_management:   true,
  config_labels:            true,
  config_info_panel:        true,
  config_import_contacts:   true,
  config_whatsapp_business: true,
  config_wa_sharing:        true,
  config_messenger:         true,
  config_instagram:         true,
  config_tiktok:            true,
  config_telegram:          true,
  config_bot_ai:            true,
  config_flow_rules:        true,
  config_bot_response:      true,
  config_chat_routing:      true,
  config_quick_messages:    true,
  config_reports:           true,
  config_modules:           true,
  config_integrations:      true,
  config_widgets:           true,
  config_plugins:           true,
};

const CustomRole = sequelize.define('custom_role', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  // Techo informativo/UI únicamente — nunca se usa para elevar privilegios.
  // El backend sigue evaluando requireRole/requireFeature sobre el ENUM real
  // (req.user.role); esto solo ayuda al admin a filtrar qué perfiles calzan
  // con qué rol base al asignarlos en TeamPanel.
  base_role: {
    type: DataTypes.ENUM('agent', 'supervisor', 'admin'),
    allowNull: false,
    defaultValue: 'agent',
  },
  permissions: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: DEFAULT_PERMISSIONS,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'custom_roles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

CustomRole.DEFAULT_PERMISSIONS = DEFAULT_PERMISSIONS;

module.exports = CustomRole;
