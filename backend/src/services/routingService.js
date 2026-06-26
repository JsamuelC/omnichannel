const logger = require('../config/logger');
const { Op } = require('sequelize');

let _lastAssignedIndex = {};

async function assignRoundRobin(companyId, conversationId) {
  try {
    const { User, Conversation } = require('../models');
    const Company = require('../models/Company');

    const company = await Company.findByPk(companyId, { attributes: ['routing_config'] });
    const config = company?.routing_config || {};
    const allowedAgentIds = config.agents || [];

    const where = {
      company_id:   companyId,
      is_active:    true,
      availability: 'active',
      role:         { [Op.in]: ['agent', 'admin'] },
    };

    // Si hay agentes seleccionados, filtrar solo esos
    if (allowedAgentIds.length > 0) {
      where.id = { [Op.in]: allowedAgentIds };
    }

    const agents = await User.findAll({
      where,
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

    if (!agents.length) {
      logger.info(`📋 Routing: no hay agentes activos/seleccionados para empresa ${companyId}`);
      return null;
    }

    const key = companyId || 'default';
    const lastIdx = _lastAssignedIndex[key] || 0;
    const nextIdx = (lastIdx + 1) % agents.length;
    _lastAssignedIndex[key] = nextIdx;

    const agent = agents[nextIdx];

    await Conversation.update(
      { assigned_agent_id: agent.id, status: 'assigned' },
      { where: { id: conversationId } }
    );

    logger.info(`📋 Routing: chat ${conversationId} asignado a ${agent.name} (round-robin)`);

    // Notificar al agente
    const notificationService = require('./notificationService');
    notificationService.create({
      companyId,
      userId: agent.id,
      type: 'message',
      title: 'Chat asignado a ti',
      body: `Se te ha asignado una nueva conversación por round-robin.`,
      metadata: { conversation_id: conversationId },
    });

    return agent;
  } catch (err) {
    logger.error('Routing error:', err.message);
    return null;
  }
}

module.exports = { assignRoundRobin };
