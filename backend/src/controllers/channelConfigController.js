const Company = require('../models/Company');
const logger  = require('../config/logger');
const axios   = require('axios');

async function resolveCompanyId(req) {
  if (req.user.company_id) return req.user.company_id;
  if (req.user.role === 'superadmin') {
    const first = await Company.findOne({ order: [['created_at', 'ASC']], attributes: ['id'] });
    return first?.id || null;
  }
  return null;
}

// GET /api/channels/messenger/status
exports.messengerStatus = async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req);
    const company = companyId ? await Company.findByPk(companyId, { attributes: ['messenger_config'] }) : null;
    const cfg = company?.messenger_config;
    res.json({ success: true, data: {
      connected:  !!cfg?.page_access_token,
      page_name:  cfg?.page_name || null,
      page_id:    cfg?.page_id || null,
      connected_at: cfg?.connected_at || null,
    }});
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/channels/messenger/connect — guardar token de página
exports.messengerConnect = async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req);
    const company = companyId ? await Company.findByPk(companyId) : null;
    if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada' });

    const { page_access_token, page_id, page_name } = req.body;
    if (!page_access_token || !page_id) {
      return res.status(400).json({ success: false, error: 'page_access_token y page_id son requeridos' });
    }

    // Suscribir la página a webhooks de messenger
    try {
      await axios.post(`https://graph.facebook.com/v19.0/${page_id}/subscribed_apps`, null, {
        params: {
          subscribed_fields: 'messages,messaging_postbacks,messaging_optins',
          access_token: page_access_token,
        }
      });
    } catch (e) {
      logger.warn('Messenger subscribe error:', e.response?.data || e.message);
    }

    await company.update({
      messenger_config: {
        page_access_token,
        page_id,
        page_name: page_name || null,
        connected_at: new Date().toISOString(),
      }
    });

    logger.info(`✅ Messenger conectado para ${company.nombre}: página ${page_name || page_id}`);
    res.json({ success: true, message: 'Messenger conectado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/channels/messenger/disconnect
exports.messengerDisconnect = async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req);
    const company = companyId ? await Company.findByPk(companyId) : null;
    if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada' });
    await company.update({ messenger_config: null });
    res.json({ success: true, message: 'Messenger desconectado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/channels/instagram/status
exports.instagramStatus = async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req);
    const company = companyId ? await Company.findByPk(companyId, { attributes: ['instagram_config'] }) : null;
    const cfg = company?.instagram_config;
    res.json({ success: true, data: {
      connected:    !!cfg?.access_token,
      ig_username:  cfg?.ig_username || null,
      ig_id:        cfg?.ig_id || null,
      connected_at: cfg?.connected_at || null,
    }});
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/channels/instagram/connect
exports.instagramConnect = async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req);
    const company = companyId ? await Company.findByPk(companyId) : null;
    if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada' });

    const { access_token, ig_id, ig_username, page_id } = req.body;
    if (!access_token || !ig_id) {
      return res.status(400).json({ success: false, error: 'access_token y ig_id son requeridos' });
    }

    await company.update({
      instagram_config: {
        access_token,
        ig_id,
        ig_username: ig_username || null,
        page_id: page_id || null,
        connected_at: new Date().toISOString(),
      }
    });

    logger.info(`✅ Instagram conectado para ${company.nombre}: @${ig_username || ig_id}`);
    res.json({ success: true, message: 'Instagram conectado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/channels/instagram/disconnect
exports.instagramDisconnect = async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req);
    const company = companyId ? await Company.findByPk(companyId) : null;
    if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada' });
    await company.update({ instagram_config: null });
    res.json({ success: true, message: 'Instagram desconectado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/channels/pages — obtener páginas de Facebook del usuario
exports.getPages = async (req, res) => {
  try {
    const { user_token } = req.query;
    if (!user_token) return res.status(400).json({ success: false, error: 'user_token requerido' });

    const response = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: { access_token: user_token, fields: 'id,name,access_token,instagram_business_account{id,username}' }
    });

    const pages = (response.data?.data || []).map(p => ({
      page_id:          p.id,
      page_name:        p.name,
      page_access_token: p.access_token,
      instagram:        p.instagram_business_account ? {
        ig_id:       p.instagram_business_account.id,
        ig_username: p.instagram_business_account.username,
      } : null,
    }));

    res.json({ success: true, data: pages });
  } catch (err) {
    logger.error('getPages error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Error obteniendo páginas' });
  }
};
