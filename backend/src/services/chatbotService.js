// backend/src/services/chatbotService.js
const logger = require('../config/logger');
const { Message, BotConfig } = require('../models');

class ChatbotService {

  async callClaude(apiKey, systemPrompt, history, currentMessage, model, temperature = 0.7) {
    const Anthropic = require('@anthropic-ai/sdk');
    const client    = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
    const response  = await client.messages.create({
      model:       model || 'claude-sonnet-4-20250514',
      max_tokens:  1024,
      temperature,
      system:      systemPrompt,
      messages:    [...history, { role: 'user', content: currentMessage }]
    });
    return response.content[0]?.text || null;
  }

  async callOpenAI(apiKey, systemPrompt, history, currentMessage, model, temperature = 0.7) {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model:       model || 'gpt-4o-mini',
      max_tokens:  1024,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: currentMessage }
      ]
    });
    return response.choices[0]?.message?.content || null;
  }

  async callGemini(apiKey, systemPrompt, history, currentMessage, model, temperature = 0.7) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const client   = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY);
    const genModel = client.getGenerativeModel({
      model:             model || 'gemini-1.5-flash',
      systemInstruction: systemPrompt
    });
    const chat = genModel.startChat({
      history: history.map(m => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      generationConfig: { temperature, maxOutputTokens: 1024 }
    });
    const result = await chat.sendMessage(currentMessage);
    return result.response.text() || null;
  }

  async callAI(provider, apiKey, systemPrompt, history, currentMessage, model, temperature = 0.7) {
    switch (provider) {
      case 'openai':
        return this.callOpenAI(apiKey, systemPrompt, history, currentMessage, model, temperature);
      case 'gemini':
        return this.callGemini(apiKey, systemPrompt, history, currentMessage, model, temperature);
      case 'claude':
      default:
        return this.callClaude(apiKey, systemPrompt, history, currentMessage, model, temperature);
    }
  }

  async getActiveIntegration() {
    const { Integration } = require('../models');
    return Integration.findOne({ where: { is_active: true } });
  }

  async generateResponse(prompt, userMessage, provider, apiKey, model) {
    if (!provider || !apiKey) {
      const integration = await this.getActiveIntegration();
      if (!integration) throw new Error('No hay integración de IA activa');
      provider = integration.provider;
      apiKey   = integration.api_key;
      model    = model || null;
    }
    return this.callAI(provider, apiKey, prompt, [], userMessage, model, 0.7);
  }

  async handleMessage(conversation, incomingMessage, io) {
    try {
      if (conversation.assigned_agent_id) return null;

      const config = await this.getBotConfig(conversation.company_id, conversation.channel);
      if (!config || !config.is_active) return null;

      const messageText    = incomingMessage.content?.toLowerCase() || '';
      const shouldEscalate = this.checkEscalationKeywords(messageText, config.escalation_keywords);

      if (shouldEscalate) {
        await this.escalateToHuman(conversation, config, io);
        return config.escalation_message;
      }

      const integration = await this.getActiveIntegration();
      if (!integration) {
        logger.warn('No hay integración de IA activa — bot no responde');
        return null;
      }

      const history     = await this.buildConversationHistory(conversation.id, config.max_history_messages);
      const botResponse = await this.callAI(
        integration.provider,
        integration.api_key,
        config.system_prompt,
        history,
        incomingMessage.content,
        config.ai_model,
        config.ai_temperature
      );

      logger.info(`🤖 Bot (${integration.provider}) respondió en conversación ${conversation.id}`);
      return botResponse;

    } catch (error) {
      logger.error('❌ ChatbotService.handleMessage:', error);
      return null;
    }
  }

  async buildConversationHistory(conversationId, maxMessages = 20) {
    const messages = await Message.findAll({
      where: { conversation_id: conversationId },
      order: [['created_at', 'ASC']],
      limit: maxMessages
    });
    const history = messages
      .filter(m => m.content)
      .map(m => ({
        role:    m.sender_type === 'bot' || m.direction === 'outbound' ? 'assistant' : 'user',
        content: m.content
      }));
    return this.normalizeHistory(history);
  }

  normalizeHistory(history) {
    if (!history.length) return [];
    const normalized = [];
    let lastRole = null;
    for (const msg of history) {
      if (msg.role !== lastRole) {
        normalized.push(msg);
        lastRole = msg.role;
      } else {
        normalized[normalized.length - 1].content += '\n' + msg.content;
      }
    }
    if (normalized[0]?.role === 'assistant') normalized.shift();
    return normalized;
  }

  checkEscalationKeywords(text, keywords = []) {
    return keywords?.some(k => text.includes(k.toLowerCase())) || false;
  }

  async escalateToHuman(conversation, config, io) {
    await conversation.update({ status: 'open' });
    io?.to('agents').emit('conversation:escalated', {
      conversationId: conversation.id,
      channel:        conversation.channel,
      reason:         'keyword_trigger'
    });
    logger.info(`🔔 Conversación ${conversation.id} escalada a humano`);
  }

  async getBotConfig(companyId, channel) {
    return await BotConfig.findOne({
      where: { company_id: companyId || null, channel, is_active: true }
    }) || await BotConfig.findOne({
      where: { channel: 'all', is_active: true }
    });
  }

  async testBot(systemPrompt, testMessage) {
    const integration = await this.getActiveIntegration();
    if (!integration) throw new Error('No hay integración de IA activa. Configúrala en Integraciones.');
    return this.callAI(
      integration.provider,
      integration.api_key,
      systemPrompt,
      [],
      testMessage,
      null,
      0.7
    );
  }

  // ─── Verificar criterios de transferencia ─────────────────
  async checkTransfer(messageText, messageCount, quoteSent = false) {
    const { TransferCriteria } = require('../models');
    const criteria = await TransferCriteria.findAll({
      where: { is_active: true },
      order: [['priority', 'DESC']]
    });

    for (const c of criteria) {
      switch (c.type) {
        case 'keyword':
          if ((c.config.keywords || []).some(k => messageText.toLowerCase().includes(k.toLowerCase())))
            return { transfer: true, message: c.transfer_message, reason: c.name };
          break;
        case 'message_count':
          if (messageCount >= (c.config.message_limit || 10))
            return { transfer: true, message: c.transfer_message, reason: c.name };
          break;
        case 'date_urgency':
          const urgency = ['vence', 'vencimiento', 'expira', 'próximo', 'urgente', 'pronto'];
          if (urgency.some(w => messageText.toLowerCase().includes(w)))
            return { transfer: true, message: c.transfer_message, reason: c.name };
          break;
        case 'after_quote':
          if (quoteSent)
            return { transfer: true, message: c.transfer_message, reason: c.name };
          break;
      }
    }
    return { transfer: false };
  }

  // ─── Buscar archivo por reglas ────────────────────────────
  async findMatchingFile(messageText) {
    const { BotFile } = require('../models');
    const files = await BotFile.findAll({ where: { is_active: true } });

    for (const file of files) {
      const rules = file.trigger_rules || [];
      for (const rule of rules) {
        if (rule.type === 'keyword') {
          const match = (rule.values || []).some(k =>
            messageText.toLowerCase().includes(k.toLowerCase())
          );
          if (match) return file;
        }
      }
    }
    return null;
  }

  // ─── IA decide si enviar archivo ─────────────────────────
  async aiDecideFile(messageText) {
    const { BotFile } = require('../models');
    const files = await BotFile.findAll({
      where: { is_active: true, ai_can_send: true }
    });
    if (!files.length) return null;

    const fileList = files.map(f =>
      `ID: ${f.id} | Nombre: ${f.name} | Categoría: ${f.category}`
    ).join('\n');

    const decision = await this.generateResponse(
      `Dado el mensaje del cliente, decide si enviar alguno de estos archivos.
Responde SOLO con el ID del archivo si aplica, o "ninguno" si no aplica.
Archivos disponibles:\n${fileList}`,
      messageText
    );

    if (!decision || decision.trim() === 'ninguno') return null;
    const fileId = decision.trim().split('\n')[0].trim();
    return files.find(f => f.id === fileId) || null;
  }
}

module.exports = new ChatbotService();