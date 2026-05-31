// backend/src/routes/index.js
// ─────────────────────────────────────────────────────────────
// Todas las rutas de Tecnossync con RBAC aplicado
// ─────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();

const webhookController   = require('../controllers/webhookController');
const messageController   = require('../controllers/messageController');
const authController      = require('../controllers/authController');
const botConfigController = require('../controllers/botConfigController');
const campaignController  = require('../controllers/campaignController');
const userController      = require('../controllers/userController');
const statsController     = require('../controllers/statsController');
const companyRoutes       = require('./companyRoutes');
const voucherRoutes       = require('./voucherRoutes');
const whatsappRoutes      = require('./whatsappRoutes');
const whatsappAccountRoutes = require('./whatsappAccountRoutes');
const integrationController = require('../controllers/integrationController');
const { controller: botFileController, upload: botFileUpload } = require('../controllers/botFileController');
const transferCriteriaController = require('../controllers/transferCriteriaController');

const {
  auth,
  requireRole,
  scopeConversations,
  requireConversationAccess
} = require('../middleware/auth');

// ─────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'Tecnossync', timestamp: new Date().toISOString(), version: '2.0.0' });
});
router.get('/stats', auth, requireRole('admin'), statsController.getDashboard.bind(statsController));

// ─────────────────────────────────────
// AUTENTICACIÓN
// ─────────────────────────────────────
router.post('/auth/login',  authController.login.bind(authController));
router.post('/auth/logout', auth, authController.logout.bind(authController));
router.get ('/auth/me',     auth, authController.me.bind(authController));

// Registro SOLO por admin (el admin crea las cuentas del equipo)
router.post('/auth/register', auth, requireRole('admin'), authController.register.bind(authController));

// ─────────────────────────────────────
// GESTIÓN DE USUARIOS (solo admin)
// ─────────────────────────────────────
router.get   ('/users',              auth, requireRole('admin'), userController.list.bind(userController));
router.post  ('/users',              auth, requireRole('admin'), userController.create.bind(userController));
router.put   ('/users/:id',          auth, requireRole('admin'), userController.update.bind(userController));
router.patch ('/users/:id/toggle',   auth, requireRole('admin'), userController.toggleActive.bind(userController));
router.delete('/users/:id',          auth, requireRole('admin'), userController.remove.bind(userController));
router.patch ('/users/:id/password', auth, userController.changePassword.bind(userController));

// ─────────────────────────────────────
// WEBHOOKS META (sin auth — validados por HMAC)
// ─────────────────────────────────────
router.get ('/webhook/:channel', webhookController.verify.bind(webhookController));
router.post('/webhook/:channel', webhookController.receive.bind(webhookController));
router.use('/whatsapp-accounts', whatsappAccountRoutes);


// ─────────────────────────────────────
// ARCHIVOS DEL BOT
// ─────────────────────────────────────
router.get   ('/bot-configs/active', auth, botConfigController.getActive.bind(botConfigController));  // ← AQUÍ PRIMERO
router.get   ('/bot-configs',      auth, botConfigController.getAll.bind(botConfigController));
router.get   ('/bot-configs/:id',  auth, botConfigController.getOne.bind(botConfigController));
router.post  ('/bot-configs',      auth, requireRole('admin'), botConfigController.create.bind(botConfigController));
router.put   ('/bot-configs/:id',  auth, requireRole('admin'), botConfigController.update.bind(botConfigController));
router.delete('/bot-configs/:id',  auth, requireRole('admin'), botConfigController.delete.bind(botConfigController));
router.post  ('/bot-configs/test', auth, botConfigController.test.bind(botConfigController));
// ─────────────────────────────────────
// CRITERIOS DE TRANSFERENCIA
// ─────────────────────────────────────
router.get   ('/transfer-criteria',      auth, requireRole('admin'), transferCriteriaController.getAll.bind(transferCriteriaController));
router.post  ('/transfer-criteria',      auth, requireRole('admin'), transferCriteriaController.create.bind(transferCriteriaController));
router.put   ('/transfer-criteria/:id',  auth, requireRole('admin'), transferCriteriaController.update.bind(transferCriteriaController));
router.delete('/transfer-criteria/:id',  auth, requireRole('admin'), transferCriteriaController.remove.bind(transferCriteriaController));

// ─────────────────────────────────────
// CONVERSACIONES
// ─────────────────────────────────────
router.get('/conversations',
  auth, scopeConversations,
  messageController.getConversations.bind(messageController));

router.get('/conversations/:id',
  auth, requireConversationAccess,
  messageController.getConversation.bind(messageController));

router.get('/conversations/:id/messages',
  auth, requireConversationAccess,
  messageController.getMessages.bind(messageController));

router.post('/conversations/:id/messages',
  auth, requireConversationAccess,
  messageController.sendMessage.bind(messageController));

router.post('/conversations/:id/assign',
  auth, requireRole('admin'),
  messageController.assignConversation.bind(messageController));

router.post('/conversations/:id/resolve',
  auth, requireConversationAccess,
  messageController.resolveConversation.bind(messageController));

// ─────────────────────────────────────
// CONFIGURACIÓN DEL BOT
// ─────────────────────────────────────
router.get   ('/bot-configs',      auth, botConfigController.getAll.bind(botConfigController));
router.get   ('/bot-configs/:id',  auth, botConfigController.getOne.bind(botConfigController));
router.post  ('/bot-configs',      auth, requireRole('admin'), botConfigController.create.bind(botConfigController));
router.put   ('/bot-configs/:id',  auth, requireRole('admin'), botConfigController.update.bind(botConfigController));
router.delete('/bot-configs/:id',  auth, requireRole('admin'), botConfigController.delete.bind(botConfigController));
router.post  ('/bot-configs/test', auth, botConfigController.test.bind(botConfigController));

// ─────────────────────────────────────
// CAMPAÑAS MASIVAS — solo admin
// ─────────────────────────────────────
router.get   ('/campaigns',             auth, requireRole('admin'), campaignController.getAll.bind(campaignController));
router.get   ('/campaigns/:id',         auth, requireRole('admin'), campaignController.getOne.bind(campaignController));
router.post  ('/campaigns',             auth, requireRole('admin'), campaignController.create.bind(campaignController));
router.post  ('/campaigns/:id/launch',  auth, requireRole('admin'), campaignController.launch.bind(campaignController));
router.post  ('/campaigns/:id/pause',   auth, requireRole('admin'), campaignController.pause.bind(campaignController));
router.delete('/campaigns/:id',         auth, requireRole('admin'), campaignController.delete.bind(campaignController));

// ─────────────────────────────────────
// INTEGRACIONES CON PLATAFORMAS EXTERNAS
// ─────────────────────────────────────

router.get   ('/integrations/active',       auth, integrationController.getActive.bind(integrationController));
router.post  ('/integrations/test',         auth, requireRole('admin'), integrationController.test.bind(integrationController));
router.get   ('/integrations',              auth, requireRole('admin'), integrationController.getAll.bind(integrationController));
router.post  ('/integrations',              auth, requireRole('admin'), integrationController.create.bind(integrationController));
router.patch ('/integrations/:id/activate', auth, requireRole('admin'), integrationController.setActive.bind(integrationController));
router.delete('/integrations/:id',          auth, requireRole('admin'), integrationController.remove.bind(integrationController));

// ─────────────────────────────────────
// CONTACTOS — ambos roles (lectura)
// ─────────────────────────────────────
const { Contact } = require('../models');
const { Op }      = require('sequelize');

router.get('/contacts', auth, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const where = search ? {
      [Op.or]: [
        { name:  { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ]
    } : {};

    const { count, rows } = await Contact.findAndCountAll({
      where,
      limit:  +limit,
      offset: (+page - 1) * +limit,
      order:  [['created_at', 'DESC']]
    });

    res.json({ success: true, data: { contacts: rows, total: count } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/contacts/:id', auth, async (req, res) => {
  try {
    const { Contact } = require('../models');
    const contact = await Contact.findByPk(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'No encontrado' });
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Actualizar un contacto
router.patch('/contacts/:id', auth, async (req, res) => {
  try {
    const { Contact } = require('../models');
    const contact = await Contact.findByPk(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'No encontrado' });
    await contact.update(req.body);
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// ─────────────────────────────────────
// COMPROBANTES DE PAGO
// ─────────────────────────────────────
router.use('/vouchers', voucherRoutes);
console.log('✅ WhatsApp routes cargadas');
router.use('/whatsapp', whatsappRoutes);
// ─────────────────────────────────────
// EMPRESA
// ─────────────────────────────────────
router.use('/company', companyRoutes);

module.exports = router;
