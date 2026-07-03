const fs     = require('fs');
const path   = require('path');
const logger = require('../config/logger');

async function transcribeAudio(filePath) {
  try {
    const { Integration } = require('../models');
    const integration = await Integration.findOne({ where: { provider: 'openai', is_active: true } });

    if (!integration) {
      logger.warn('⚠️ No hay integración OpenAI activa para transcripción');
      return null;
    }

    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: integration.api_key });

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '../../', filePath);

    if (!fs.existsSync(absolutePath)) {
      logger.warn(`⚠️ Archivo de audio no encontrado: ${absolutePath}`);
      return null;
    }

    const response = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file:  fs.createReadStream(absolutePath),
      language: 'es',
    });

    const text = response.text?.trim();
    if (text) {
      logger.info(`🎤 Audio transcrito (${path.basename(filePath)}): "${text.substring(0, 80)}..."`);
    }
    return text || null;
  } catch (err) {
    logger.error('❌ Error transcribiendo audio:', err.message);
    return null;
  }
}

module.exports = { transcribeAudio };
