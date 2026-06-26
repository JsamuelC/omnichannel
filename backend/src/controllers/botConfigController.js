// backend/src/controllers/botConfigController.js
const { BotConfig } = require('../models');
const chatbotService = require('../services/chatbotService');
const logger = require('../config/logger');

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

class BotConfigController {

  async getAll(req, res) {
    try {
      const filter = await resolveCompanyFilter(req);
      const configs = await BotConfig.findAll({ where: filter, order: [['created_at', 'DESC']] });
      res.json({ success: true, data: configs });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getOne(req, res) {
    try {
      const filter = await resolveCompanyFilter(req);
      const config = await BotConfig.findOne({ where: { id: req.params.id, ...filter } });
      if (!config) return res.status(404).json({ success: false, message: 'Configuración no encontrada' });
      res.json({ success: true, data: config });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const filter = await resolveCompanyFilter(req);
      const company_id = filter.company_id || req.body.company_id || null;
      const config = await BotConfig.create({ ...req.body, company_id });
      logger.info(`✅ BotConfig creado: ${config.id}`);
      res.status(201).json({ success: true, data: config });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const cf = await resolveCompanyFilter(req);
      const config = await BotConfig.findOne({ where: { id: req.params.id, ...cf } });
      if (!config) return res.status(404).json({ success: false, message: 'No encontrado' });
      
      await config.update(req.body);
      logger.info(`✅ BotConfig actualizado: ${config.id}`);
      res.json({ success: true, data: config });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const cf = await resolveCompanyFilter(req);
      const config = await BotConfig.findOne({ where: { id: req.params.id, ...cf } });
      if (!config) return res.status(404).json({ success: false, message: 'No encontrado' });
      
      await config.destroy();
      res.json({ success: true, message: 'Eliminado correctamente' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Probar el bot desde el panel de configuración
async test(req, res) {
  try {
    // El panel envía { instrucciones, mensaje }
    // También soporta { systemPrompt, testMessage } para retrocompatibilidad
    const systemPrompt = req.body.instrucciones || req.body.systemPrompt;
    const testMessage  = req.body.mensaje       || req.body.testMessage;
 
    if (!systemPrompt || !testMessage)
      return res.status(400).json({ success: false, message: 'Campos requeridos: instrucciones y mensaje' });
 
    const { Integration } = require('../models');
    const cfTest = await resolveCompanyFilter(req);
    const integration = await Integration.findOne({ where: { is_active: true, ...cfTest } });
 
    if (!integration)
      return res.status(400).json({
        success: false,
        message: 'No hay integración de IA activa. Configúrala en Integraciones.'
      });
 
    const resolvedPrompt = await chatbotService.resolvePromptCatalogs(systemPrompt);
    const rawResponse    = await chatbotService.callAI(
      integration.provider,
      integration.api_key,
      resolvedPrompt,
      [],
      testMessage,
      req.body.model || null,
      0.7
    );

    const { text: response, catalogFile } = await chatbotService.extractFileCommand(rawResponse);

    // El panel espera { respuesta }, el frontend viejo esperaba { data: { response } }
    res.json({
      success:   true,
      respuesta: response,
      archivo:   catalogFile,
      data:      { response, provider: integration.provider }
    });
  } catch (err) {
    logger.error('Error en test bot:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}
 
// 2. AGREGA este método nuevo getActive() a la clase:
async getActive(req, res) {
  try {
    const companyFilter = await resolveCompanyFilter(req);
    const config = await BotConfig.findOne({
      where: { is_active: true, channel: 'all', ...companyFilter },
      order: [['created_at', 'DESC']]
    });
 
    // Si no existe, devolver defaults vacíos (el panel arranca en blanco)
    if (!config) {
      return res.json({
        success: true,
        data: {
          id:            null,
          is_active:     true,
          system_prompt: '',
          name:          'Mi Asistente IA'
        }
      });
    }
 
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
}

module.exports = new BotConfigController();
