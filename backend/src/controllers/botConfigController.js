// backend/src/controllers/botConfigController.js
const { BotConfig } = require('../models');
const chatbotService = require('../services/chatbotService');
const logger = require('../config/logger');

class BotConfigController {

  async getAll(req, res) {
    try {
      const configs = await BotConfig.findAll({ order: [['created_at', 'DESC']] });
      res.json({ success: true, data: configs });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getOne(req, res) {
    try {
      const config = await BotConfig.findByPk(req.params.id);
      if (!config) return res.status(404).json({ success: false, message: 'Configuración no encontrada' });
      res.json({ success: true, data: config });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const config = await BotConfig.create(req.body);
      logger.info(`✅ BotConfig creado: ${config.id}`);
      res.status(201).json({ success: true, data: config });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const config = await BotConfig.findByPk(req.params.id);
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
      const config = await BotConfig.findByPk(req.params.id);
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
    const integration = await Integration.findOne({ where: { is_active: true } });
 
    if (!integration)
      return res.status(400).json({
        success: false,
        message: 'No hay integración de IA activa. Configúrala en Integraciones.'
      });
 
    const response = await chatbotService.generateResponse(
      systemPrompt,
      testMessage,
      integration.provider,
      integration.api_key,
      req.body.model || null
    );
 
    // El panel espera { respuesta }, el frontend viejo esperaba { data: { response } }
    res.json({
      success:   true,
      respuesta: response,           // para el nuevo panel JSX
      data:      { response, provider: integration.provider }  // retrocompatibilidad
    });
  } catch (err) {
    logger.error('Error en test bot:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}
 
// 2. AGREGA este método nuevo getActive() a la clase:
async getActive(req, res) {
  try {
    const config = await BotConfig.findOne({
      where: { is_active: true, channel: 'all' },
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
