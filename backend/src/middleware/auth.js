// backend/src/middleware/auth.js
const jwt    = require('jsonwebtoken');
const { User } = require('../models');
const logger   = require('../config/logger');

// ── 1. Verificar JWT y cargar req.user ───────────────────────────────────────
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'Token de acceso requerido' });

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'tecnossync' });
    } catch (err) {
      const msg =
        err.name === 'TokenExpiredError' ? 'Sesión expirada. Vuelve a iniciar sesión.' :
        err.name === 'JsonWebTokenError' ? 'Token inválido.'                           :
                                           'Error de autenticación.';
      return res.status(401).json({ success: false, message: msg });
    }

    const user = await User.findByPk(decoded.id, { attributes: { exclude: ['password_hash', 'reset_token', 'reset_token_expires'] } });
    if (!user)           return res.status(401).json({ success: false, message: 'Usuario no encontrado.' });
    if (!user.is_active) return res.status(403).json({ success: false, message: 'Cuenta desactivada. Contacta al administrador.' });

    req.user = user;
    next();
  } catch (error) {
    logger.error('Error en middleware auth:', error);
    res.status(500).json({ success: false, message: 'Error interno de autenticación.' });
  }
};

// ── 2. Verificar rol ─────────────────────────────────────────────────────────
// superadmin siempre pasa (es el único que está por encima de todos)
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
  if (req.user.role === 'superadmin') return next(); // superadmin bypasses all role checks
  if (!roles.includes(req.user.role)) {
    logger.warn(`🚫 Acceso denegado: ${req.user.email} (${req.user.role}) → ${req.method} ${req.path}`);
    return res.status(403).json({ success: false, message: `Acción restringida. Se requiere: ${roles.join(' o ')}.` });
  }
  next();
};

// ── 3. Solo superadmin ───────────────────────────────────────────────────────
const requireSuperAdmin = (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
  if (req.user.role !== 'superadmin')
    return res.status(403).json({ success: false, message: 'Acción reservada para superadmin.' });
  next();
};

// ── 4. Filtro de empresa (multi-tenant) ──────────────────────────────────────
// Inyecta req.companyFilter:
//   superadmin → usa x-company-id header si viene; sin él usa su propio company_id (Tecnossync)
//   admin/agent → { company_id: req.user.company_id }
const companyScope = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
  if (req.user.role === 'superadmin') {
    // El frontend envía x-company-id cuando el superadmin gestiona otra empresa
    const explicitId = req.headers['x-company-id'] || req.query?.company_id || req.body?.company_id;
    // Sin empresa explícita, usar la propia del superadmin (nunca null para evitar ver todo)
    req.companyFilter = { company_id: explicitId || req.user.company_id || null };
  } else {
    req.companyFilter = { company_id: req.user.company_id };
  }
  next();
};

// ── 5. Filtro de conversaciones por agente + empresa ─────────────────────────
const scopeConversations = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Autenticación requerida.' });

  let companyFilter;
  if (req.user.role === 'superadmin') {
    const explicitId = req.headers['x-company-id'] || req.query?.company_id || req.body?.company_id;
    companyFilter = { company_id: explicitId || req.user.company_id || null };
  } else {
    companyFilter = { company_id: req.user.company_id };
  }

  if (req.user.role === 'agent') {
    req.conversationFilter = { ...companyFilter, assigned_agent_id: req.user.id };
  } else {
    req.conversationFilter = companyFilter;
  }
  next();
};

// ── 6. Acceso a una conversación concreta ────────────────────────────────────
const requireConversationAccess = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
  if (req.user.role === 'admin' || req.user.role === 'superadmin') return next();

  try {
    const { Conversation } = require('../models');
    const { Op } = require('sequelize');
    const companyFilter = { company_id: req.user.company_id };

    // Un agente puede ver sus propias conversaciones asignadas y las que
    // todavía no tienen agente (p.ej. una escalada del bot que llegó por
    // notificación, antes de que alguien la tome)
    const conv = await Conversation.findOne({
      where: {
        id: req.params.id,
        [Op.or]: [{ assigned_agent_id: req.user.id }, { assigned_agent_id: null }],
        ...companyFilter,
      }
    });

    if (!conv) {
      logger.warn(`🚫 Agente ${req.user.id} intentó acceder a conversación ${req.params.id}`);
      return res.status(403).json({ success: false, message: 'No tienes acceso a esta conversación.' });
    }

    req.conversation = conv;
    next();
  } catch (error) {
    logger.error('Error en requireConversationAccess:', error);
    res.status(500).json({ success: false, message: 'Error verificando acceso.' });
  }
};

// ── 7. Feature Flag: bloquea si la empresa no tiene el módulo activo ────────────
// superadmin siempre pasa (gestiona el sistema completo)
const requireFeature = (featureName) => async (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: 'Autenticación requerida.' });

  if (req.user.role === 'superadmin') return next();

  if (!req.user.company_id)
    return res.status(403).json({ success: false, message: 'Usuario sin empresa asignada.' });

  try {
    let company = req._cachedCompany;
    if (!company) {
      const Company = require('../models/Company');
      company = await Company.findByPk(req.user.company_id, {
        attributes: ['id', 'active_features'],
      });
      req._cachedCompany = company;
    }

    if (!company)
      return res.status(403).json({ success: false, message: 'Empresa no encontrada.' });

    const features = company.active_features || {};
    if (features[featureName] !== true) {
      logger.warn(`Feature bloqueada: "${featureName}" para empresa ${req.user.company_id} (${req.user.email})`);
      return res.status(403).json({
        success: false,
        message: `El módulo "${featureName}" no está habilitado para tu empresa.`,
        feature: featureName,
      });
    }
    next();
  } catch (error) {
    logger.error('Error en requireFeature:', error);
    res.status(500).json({ success: false, message: 'Error verificando permisos del módulo.' });
  }
};

// ── 8. Permiso de rol personalizado (capa OPCIONAL adicional) ──────────────────
// Se coloca SIEMPRE después de requireRole/requireFeature en la cadena de una
// ruta, nunca antes ni en su lugar — solo puede restringir, nunca conceder más
// de lo que esas dos ya permiten. Si el usuario no tiene custom_role_id, deja
// pasar sin tocar nada (fail-open = comportamiento actual de siempre).
const requireCustomPermission = (permissionKey) => async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
  if (req.user.role === 'superadmin') return next();
  if (!req.user.custom_role_id) return next(); // sin rol personalizado asignado -> sin restricción adicional

  try {
    const CustomRole = require('../models/CustomRole');
    const role = await CustomRole.findOne({
      where: { id: req.user.custom_role_id, company_id: req.user.company_id, is_active: true },
    });
    if (!role) return next(); // rol borrado/desactivado -> fail-open

    const perms = { ...CustomRole.DEFAULT_PERMISSIONS, ...role.permissions };
    if (perms[permissionKey] === false) {
      logger.warn(`🚫 Permiso de rol personalizado denegado: "${permissionKey}" para ${req.user.email} (rol: ${role.name})`);
      return res.status(403).json({
        success: false,
        message: `Tu rol "${role.name}" no tiene acceso a esta sección.`,
        permission: permissionKey,
      });
    }
    next();
  } catch (error) {
    logger.error('Error en requireCustomPermission:', error);
    next(); // fail-open ante error inesperado — esta capa solo resta privilegios, nunca debe bloquear por un bug propio
  }
};

module.exports = { auth, requireRole, requireSuperAdmin, companyScope, scopeConversations, requireConversationAccess, requireFeature, requireCustomPermission };
