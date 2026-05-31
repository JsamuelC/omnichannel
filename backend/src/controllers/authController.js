// backend/src/controllers/authController.js
// ─────────────────────────────────────────────────────────────
// Autenticación Tecnossync
// JWT firmado con issuer 'tecnossync' + expiry configurable
// El payload incluye role para que el frontend sepa los permisos
// ─────────────────────────────────────────────────────────────
const jwt  = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../config/logger');

/**
 * Genera un JWT con claims mínimos y seguros.
 * NUNCA incluir datos sensibles en el payload (email, contraseña, etc.)
 */
const generateToken = (user) =>
  jwt.sign(
    {
      id:   user.id,
      role: user.role      // evita un DB lookup extra en cada autorización
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',   // turno laboral
      issuer:    'tecnossync',
      algorithm: 'HS256'
    }
  );

class AuthController {

  // POST /auth/login
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email y contraseña requeridos.' });
      }

      // Búsqueda case-insensitive — siempre normalizar a minúsculas
      const user = await User.findOne({
        where: { email: email.toLowerCase().trim(), is_active: true }
      });

      // Mismo mensaje para usuario-no-existe y contraseña-incorrecta (evita enumerar usuarios)
      if (!user) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
      }

      const isValid = await user.comparePassword(password);
      if (!isValid) {
        logger.warn(`⚠️  Intento de login fallido para: ${email}`);
        return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
      }

      await user.update({ is_online: true });

      const token = generateToken(user);
      logger.info(`✅ Login: ${email} (${user.role})`);

      res.json({
        success: true,
        data: {
          token,
          user: {
            ...user.toJSON(),
            // Incluir permissions explícitos para el frontend
            permissions: buildPermissions(user.role)
          }
        }
      });
    } catch (error) {
      logger.error('Error en login:', error);
      res.status(500).json({ success: false, message: 'Error del servidor.' });
    }
  }

  // POST /auth/logout
  async logout(req, res) {
    try {
      if (req.user) {
        await User.update({ is_online: false }, { where: { id: req.user.id } });
        logger.info(`👋 Logout: ${req.user.email}`);
      }
      res.json({ success: true, message: 'Sesión cerrada.' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /auth/me
  async me(req, res) {
    res.json({
      success: true,
      data: {
        ...req.user.toJSON(),
        permissions: buildPermissions(req.user.role)
      }
    });
  }

  // POST /auth/register — PROTEGIDO: solo admin (ver routes/index.js)
  async register(req, res) {
    try {
      const { name, email, password, role = 'agent' } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Nombre, email y contraseña son requeridos.' });
      }

      if (!['admin', 'agent'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Rol inválido.' });
      }

      if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres.' });
      }

      const existing = await User.findOne({ where: { email: email.toLowerCase() } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email ya registrado.' });
      }

      const user  = await User.create({ name, email: email.toLowerCase(), password_hash: password, role });
      const token = generateToken(user);

      logger.info(`👤 Nuevo usuario creado: ${email} (${role}) por admin ${req.user?.email}`);
      res.status(201).json({ success: true, data: { token, user: user.toJSON() } });
    } catch (error) {
      logger.error('Error en registro:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

// ─────────────────────────────────────
// Mapa de permisos por rol
// El frontend lo usa para mostrar/ocultar secciones
// ─────────────────────────────────────
function buildPermissions(role) {
  const base = {
    canViewInbox:        true,
    canSendMessages:     true,
    canViewBotConfig:    false,
    canEditBotConfig:    false,
    canViewCampaigns:    false,
    canManageCampaigns:  false,
    canManageUsers:      false,
    canAssignConversations: false,
    canViewAllConversations: false,
  };

  if (role === 'admin') {
    return {
      ...base,
      canViewBotConfig:        true,
      canEditBotConfig:        true,
      canViewCampaigns:        true,
      canManageCampaigns:      true,
      canManageUsers:          true,
      canAssignConversations:  true,
      canViewAllConversations: true,
    };
  }

  return base; // agent
}

module.exports = new AuthController();
