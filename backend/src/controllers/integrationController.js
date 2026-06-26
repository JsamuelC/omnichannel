// backend/src/controllers/integrationController.js
const { Integration } = require('../models');
const chatbotService  = require('../services/chatbotService');
const logger          = require('../config/logger');

async function resolveCompanyFilter(req) {
  if (req.companyFilter && Object.keys(req.companyFilter).length > 0) return req.companyFilter;
  if (req.user?.company_id) return { company_id: req.user.company_id };
  if (req.user?.role === 'superadmin') {
    const Company = require('../models/Company');
    const first = await Company.findOne({ order: [['created_at', 'ASC']], attributes: ['id'] });
    return first ? { company_id: first.id } : {};
  }
  return {};
}

async function resolveCompanyId(req) {
  if (req.user?.company_id) return req.user.company_id;
  if (req.user?.role === 'superadmin') {
    const Company = require('../models/Company');
    const first = await Company.findOne({ order: [['created_at', 'ASC']], attributes: ['id'] });
    return first?.id || null;
  }
  return null;
}

class IntegrationController {

  async getAll(req, res) {
    try {
      const filter = await resolveCompanyFilter(req);
      const integrations = await Integration.findAll({ where: filter, order: [['created_at', 'DESC']] });
      const safe = integrations.map(i => ({
        ...i.toJSON(),
        api_key: i.api_key ? `${i.api_key.slice(0, 6)}${'•'.repeat(20)}` : ''
      }));
      res.json({ success: true, data: safe });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async create(req, res) {
    try {
      const { provider, api_key, label } = req.body;
      if (!provider || !api_key)
        return res.status(400).json({ success: false, message: 'provider y api_key son requeridos' });

      const company_id = await resolveCompanyId(req);
      const filter = await resolveCompanyFilter(req);

      await Integration.update({ is_active: false }, { where: filter });
      const integration = await Integration.create({ provider, api_key, label, is_active: true, company_id });
      logger.info(`✅ Integración creada: ${provider}`);
      res.status(201).json({ success: true, data: { ...integration.toJSON(), api_key: `${api_key.slice(0,6)}${'•'.repeat(20)}` } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async setActive(req, res) {
    try {
      const filter = await resolveCompanyFilter(req);
      await Integration.update({ is_active: false }, { where: filter });
      const integration = await Integration.findOne({ where: { id: req.params.id, ...filter } });
      if (!integration) return res.status(404).json({ success: false, message: 'No encontrada' });
      await integration.update({ is_active: true });
      res.json({ success: true, data: integration });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async remove(req, res) {
    try {
      const filter = await resolveCompanyFilter(req);
      const integration = await Integration.findOne({ where: { id: req.params.id, ...filter } });
      if (!integration) return res.status(404).json({ success: false, message: 'No encontrada' });
      await integration.destroy();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async test(req, res) {
    try {
      const { provider, api_key, model, testMessage } = req.body;
      const response = await chatbotService.generateResponse(
        'Responde brevemente: eres un asistente de prueba.',
        testMessage || 'Hola, ¿funcionas correctamente?',
        provider,
        api_key,
        model
      );
      res.json({ success: true, data: { response } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getActive(req, res) {
    try {
      const filter = await resolveCompanyFilter(req);
      const integration = await Integration.findOne({ where: { is_active: true, ...filter } });
      if (!integration) return res.json({ success: true, data: null });
      res.json({ success: true, data: { ...integration.toJSON(), api_key: undefined } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new IntegrationController();
