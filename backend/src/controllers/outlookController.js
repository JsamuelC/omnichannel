const Company     = require('../models/Company');
const { Appointment } = require('../models');
const outlook     = require('../services/outlookService');
const logger      = require('../config/logger');

async function resolveCompanyId(req) {
  if (req.user.company_id) return req.user.company_id;
  if (req.user.role === 'superadmin') {
    const first = await Company.findOne({ order: [['created_at', 'ASC']], attributes: ['id'] });
    return first?.id || null;
  }
  return null;
}

// GET /api/outlook/connect
exports.connect = async (req, res) => {
  const companyId = await resolveCompanyId(req);
  const state = Buffer.from(JSON.stringify({
    companyId,
    userId: req.user.id,
  })).toString('base64');

  const url = outlook.getAuthUrl(state);
  res.json({ success: true, data: { url } });
};

// GET /api/outlook/callback
exports.callback = async (req, res) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.warn('Outlook OAuth error:', error);
      return res.redirect(`${FRONTEND_URL}/calendar?outlook=error&msg=${encodeURIComponent(error)}`);
    }

    const { companyId } = JSON.parse(Buffer.from(state, 'base64').toString());
    const tokens   = await outlook.exchangeCode(code);
    const userInfo = await outlook.getUserInfo(tokens.access_token);

    const company = await Company.findByPk(companyId);
    if (!company) return res.redirect(`${FRONTEND_URL}/calendar?outlook=error&msg=empresa_no_encontrada`);

    await company.update({
      outlook_tokens: {
        ...tokens,
        email:        userInfo.mail || userInfo.userPrincipalName,
        display_name: userInfo.displayName,
        connected_at: new Date().toISOString(),
      },
    });

    logger.info(`✅ Outlook conectado para empresa ${companyId}: ${userInfo.mail}`);
    res.redirect(`${FRONTEND_URL}/calendar?outlook=connected`);
  } catch (err) {
    logger.error('Error en callback Outlook:', err.message);
    res.redirect(`${FRONTEND_URL}/calendar?outlook=error&msg=${encodeURIComponent(err.message)}`);
  }
};

// DELETE /api/outlook/disconnect
exports.disconnect = async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req);
    const company = companyId ? await Company.findByPk(companyId) : null;
    if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada' });

    await company.update({ outlook_tokens: null });
    res.json({ success: true, message: 'Cuenta de Outlook desconectada' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/outlook/status
exports.status = async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req);
    const company = companyId ? await Company.findByPk(companyId, { attributes: ['outlook_tokens'] }) : null;
    const tokens = company?.outlook_tokens;
    if (!tokens?.access_token) {
      return res.json({ success: true, data: { connected: false } });
    }
    res.json({
      success: true,
      data: {
        connected:    true,
        email:        tokens.email,
        display_name: tokens.display_name,
        connected_at: tokens.connected_at,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/outlook/events?start=YYYY-MM-DD&end=YYYY-MM-DD
exports.getEvents = async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req);
    const company = companyId ? await Company.findByPk(companyId) : null;
    if (!company?.outlook_tokens?.access_token) {
      return res.json({ success: true, data: [] });
    }

    const start = req.query.start || new Date().toISOString().slice(0, 10);
    const end   = req.query.end   || start;

    const events = await outlook.getCalendarEvents(company, start, end);
    res.json({ success: true, data: events });
  } catch (err) {
    logger.error('Error obteniendo eventos Outlook:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
