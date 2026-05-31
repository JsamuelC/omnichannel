// backend/src/middleware/auth.js
// ─────────────────────────────────────────────────────────────
// Autenticación JWT + Autorización RBAC para Tecnossync
// Roles: admin | agent
// ─────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../config/logger');

// ──────────────────────────────────────
// 1. Verificar JWT y cargar req.user
// ──────────────────────────────────────
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token de acceso requerido' });
    }

    const token = authHeader.split(' ')[1];

    // Verificación estricta: lanza si expirado o inválido
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'tecnossync'
      });
    } catch (err) {
      const msg =
        err.name === 'TokenExpiredError'  ? 'Sesión expirada. Vuelve a iniciar sesión.' :
        err.name === 'JsonWebTokenError'  ? 'Token inválido.'                            :
        err.name === 'NotBeforeError'     ? 'Token aún no válido.'                       :
                                            'Error de autenticación.';
      return res.status(401).json({ success: false, message: msg });
    }

    // Recargar usuario desde DB en cada petición → detecta cuentas desactivadas al vuelo
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user)            return res.status(401).json({ success: false, message: 'Usuario no encontrado.' });
    if (!user.is_active)  return res.status(403).json({ success: false, message: 'Cuenta desactivada. Contacta al administrador.' });

    req.user = user;
    next();
  } catch (error) {
    logger.error('Error inesperado en middleware auth:', error);
    res.status(500).json({ success: false, message: 'Error interno de autenticación.' });
  }
};

// ──────────────────────────────────────
// 2. Verificar rol (RBAC simple)
//    Uso: requireRole('admin') | requireRole('admin', 'agent')
// ──────────────────────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
  }
  if (!roles.includes(req.user.role)) {
    logger.warn(`🚫 Acceso denegado: ${req.user.email} (${req.user.role}) intentó ${req.method} ${req.path}`);
    return res.status(403).json({
      success: false,
      message: `Acción restringida. Se requiere rol: ${roles.join(' o ')}.`
    });
  }
  next();
};

// ──────────────────────────────────────
// 3. Filtro de conversaciones por agente
//    Los agentes (role='agent') SOLO pueden acceder a conversaciones
//    que les están asignadas. Los admins ven todo.
//    Inyecta req.conversationFilter para usarlo en los queries.
// ──────────────────────────────────────
const scopeConversations = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Autenticación requerida.' });

  if (req.user.role === 'agent') {
    // El agente solo ve SUS conversaciones asignadas
    req.conversationFilter = { assigned_agent_id: req.user.id };
  } else {
    // admin ve todo
    req.conversationFilter = {};
  }
  next();
};

// ──────────────────────────────────────
// 4. Verificar que el agente tenga acceso a UNA conversación concreta
//    Uso: en GET /conversations/:id y sus sub-rutas
// ──────────────────────────────────────
const requireConversationAccess = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Autenticación requerida.' });

  // Admin: acceso irrestricto
  if (req.user.role === 'admin') return next();

  // Agente: verificar que la conversación le esté asignada
  try {
    const { Conversation } = require('../models');
    const conv = await Conversation.findOne({
      where: {
        id: req.params.id,
        assigned_agent_id: req.user.id
      }
    });

    if (!conv) {
      logger.warn(`🚫 Agente ${req.user.id} intentó acceder a conversación ${req.params.id} sin asignación`);
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta conversación.'
      });
    }

    req.conversation = conv; // cache para el controlador
    next();
  } catch (error) {
    logger.error('Error en requireConversationAccess:', error);
    res.status(500).json({ success: false, message: 'Error verificando acceso.' });
  }
};

module.exports = { auth, requireRole, scopeConversations, requireConversationAccess };
