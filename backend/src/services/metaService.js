// backend/src/services/metaService.js
// Servicio para comunicarse con las APIs de WhatsApp, Messenger e Instagram

const axios = require('axios');
const logger = require('../config/logger');

const META_API_VERSION = 'v18.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

class MetaService {
  constructor() {
    this.whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.whatsappPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.messengerToken = process.env.MESSENGER_ACCESS_TOKEN;
    this.instagramToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  }

  // ============================================
  // WHATSAPP
  // ============================================

  /**
   * Envía un mensaje de texto por WhatsApp
   * @param {string} to - Número de teléfono del destinatario (con código de país)
   * @param {string} text - Texto del mensaje
   */
  async sendWhatsAppMessage(to, text) {
    try {
      const response = await axios.post(
        `${META_BASE_URL}/${this.whatsappPhoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: { preview_url: false, body: text }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.whatsappToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`✅ WhatsApp enviado a ${to}: ${response.data.messages?.[0]?.id}`);
      return response.data;
    } catch (error) {
      const errData = error.response?.data || error.message;
      logger.error('❌ Error enviando WhatsApp:', JSON.stringify(errData));
      throw new Error(`WhatsApp API error: ${JSON.stringify(errData)}`);
    }
  }

  /**
   * Envía un mensaje de plantilla (template) por WhatsApp
   * Estas son las plantillas aprobadas por Meta para mensajes masivos
   */
  async sendWhatsAppTemplate(to, templateName, language = 'es', components = []) {
    try {
      const response = await axios.post(
        `${META_BASE_URL}/${this.whatsappPhoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: language },
            components
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.whatsappToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      logger.error('❌ Error enviando template WhatsApp:', error.response?.data);
      throw error;
    }
  }

  /**
   * Marca un mensaje de WhatsApp como leído
   */
  async markWhatsAppAsRead(messageId) {
    try {
      await axios.post(
        `${META_BASE_URL}/${this.whatsappPhoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.whatsappToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      // No lanzar error aquí - no es crítico
      logger.warn('⚠️  No se pudo marcar como leído:', error.message);
    }
  }

  // ============================================
  // MESSENGER
  // ============================================

  /**
   * Envía un mensaje por Facebook Messenger
   * @param {string} recipientId - PSID del usuario de Facebook
   * @param {string} text - Texto del mensaje
   */
  async sendMessengerMessage(recipientId, text) {
    try {
      const response = await axios.post(
        `${META_BASE_URL}/me/messages`,
        {
          recipient: { id: recipientId },
          message: { text },
          messaging_type: 'RESPONSE'
        },
        {
          params: { access_token: this.messengerToken },
          headers: { 'Content-Type': 'application/json' }
        }
      );

      logger.info(`✅ Messenger enviado a ${recipientId}`);
      return response.data;
    } catch (error) {
      logger.error('❌ Error enviando Messenger:', error.response?.data);
      throw error;
    }
  }

  // ============================================
  // INSTAGRAM
  // ============================================

  /**
   * Envía un mensaje directo por Instagram
   * @param {string} recipientId - IG-Scoped ID del usuario
   * @param {string} text - Texto del mensaje
   */
  async sendInstagramMessage(recipientId, text) {
    try {
      const response = await axios.post(
        `${META_BASE_URL}/me/messages`,
        {
          recipient: { id: recipientId },
          message: { text },
          messaging_type: 'RESPONSE'
        },
        {
          params: { access_token: this.instagramToken },
          headers: { 'Content-Type': 'application/json' }
        }
      );

      logger.info(`✅ Instagram DM enviado a ${recipientId}`);
      return response.data;
    } catch (error) {
      logger.error('❌ Error enviando Instagram DM:', error.response?.data);
      throw error;
    }
  }

  // ============================================
  // MÉTODO UNIFICADO
  // ============================================

  /**
   * Envía un mensaje a cualquier canal según el tipo
   * @param {string} channel - 'whatsapp' | 'messenger' | 'instagram'
   * @param {string} recipientId - ID del destinatario en el canal
   * @param {string} text - Texto del mensaje
   */
  async sendMessage(channel, recipientId, text) {
    switch (channel) {
      case 'whatsapp':
        return this.sendWhatsAppMessage(recipientId, text);
      case 'messenger':
        return this.sendMessengerMessage(recipientId, text);
      case 'instagram':
        return this.sendInstagramMessage(recipientId, text);
      default:
        throw new Error(`Canal no soportado: ${channel}`);
    }
  }

  // ============================================
  // VERIFICACIÓN DE WEBHOOK
  // ============================================

  /**
   * Verifica la firma HMAC-SHA256 de Meta en el webhook
   * CRÍTICO: Sin esto, cualquiera podría enviarte peticiones falsas
   */
  verifySignature(rawBody, signature) {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.META_APP_SECRET)
      .update(rawBody, 'utf8')
      .digest('hex');
    
    return `sha256=${expectedSignature}` === signature;
  }
}

// Exportamos una única instancia (singleton)
module.exports = new MetaService();
