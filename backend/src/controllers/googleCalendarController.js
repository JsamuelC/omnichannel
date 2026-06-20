// backend/src/controllers/googleCalendarController.js
const Company     = require('../models/Company');
const gcalService = require('../services/googleCalendarService');
const logger      = require('../config/logger');

async function resolveCompanyId(req) {
  if (req.user.company_id) return req.user.company_id;
  if (req.user.role === 'superadmin') {
    const first = await Company.findOne({ order: [['created_at', 'ASC']], attributes: ['id'] });
    return first?.id || null;
  }
  return null;
}

class GoogleCalendarController {

  async connect(req, res) {
    try {
      const companyId = await resolveCompanyId(req);
      if (!companyId) return res.status(403).json({ success: false, message: 'Se requiere empresa' });

      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ success: false, message: 'Google Calendar no configurado (faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)' });
      }

      const authUrl = gcalService.getAuthUrl(companyId);
      res.json({ success: true, data: { url: authUrl } });
    } catch (err) {
      logger.error('GCal connect error:', err);
      const front = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${front}/calendar?gcal=error`);
    }
  }

  async callback(req, res) {
    const front = process.env.FRONTEND_URL || 'http://localhost:5173';
    try {
      const { code, state: companyId, error } = req.query;
      if (error) throw new Error(error);
      if (!code || !companyId) throw new Error('Parámetros inválidos');

      const company = await Company.findByPk(companyId);
      if (!company) throw new Error('Empresa no encontrada');

      const tokens  = await gcalService.exchangeCode(code);
      const info    = await gcalService.getUserInfo(tokens.access_token);

      await company.update({
        google_calendar_tokens: {
          ...tokens,
          email:        info.email,
          display_name: info.name,
          timezone:     'America/Santo_Domingo',
          connected_at: new Date().toISOString(),
        },
      });

      res.redirect(`${front}/calendar?gcal=connected`);
    } catch (err) {
      logger.error('GCal callback error:', err);
      res.redirect(`${front}/calendar?gcal=error`);
    }
  }

  async status(req, res) {
    try {
      const companyId = await resolveCompanyId(req);
      const company = companyId ? await Company.findByPk(companyId) : null;
      if (!company) return res.json({ success: true, data: { connected: false } });

      const tokens = company.google_calendar_tokens;
      res.json({
        success: true,
        data: {
          connected:    !!tokens?.access_token,
          email:        tokens?.email || null,
          display_name: tokens?.display_name || null,
          connected_at: tokens?.connected_at || null,
        },
      });
    } catch (err) {
      logger.error('GCal status error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async disconnect(req, res) {
    try {
      const companyId = await resolveCompanyId(req);
      const company = companyId ? await Company.findByPk(companyId) : null;
      if (!company) return res.status(404).json({ success: false, message: 'Empresa no encontrada' });

      await company.update({ google_calendar_tokens: null });
      res.json({ success: true, message: 'Google Calendar desconectado' });
    } catch (err) {
      logger.error('GCal disconnect error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getEvents(req, res) {
    try {
      const companyId = await resolveCompanyId(req);
      const company = companyId ? await Company.findByPk(companyId) : null;
      if (!company?.google_calendar_tokens?.access_token) {
        return res.json({ success: true, data: [] });
      }

      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'startDate y endDate requeridos' });
      }

      const events = await gcalService.getCalendarEvents(company, startDate, endDate);
      res.json({ success: true, data: events });
    } catch (err) {
      logger.error('GCal getEvents error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new GoogleCalendarController();
