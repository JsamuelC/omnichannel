const { MergeTemplate, Contact, Conversation, DocumentRequest } = require('../models');
const mergeService = require('../services/mergeService');
const logger = require('../config/logger');

const companyFilter = (req) =>
  req.companyFilter || (req.user?.role === 'superadmin' ? {} : { company_id: req.user?.company_id });

class MergeTemplateController {

  async list(req, res) {
    try {
      const where = { ...companyFilter(req) };
      if (req.query.activo !== undefined) where.activo = req.query.activo === 'true';
      if (req.query.canal && req.query.canal !== 'all') {
        const { Op } = require('sequelize');
        where.canal = { [Op.in]: [req.query.canal, 'all'] };
      }
      if (req.query.auto_merge !== undefined) where.auto_merge = req.query.auto_merge === 'true';
      const templates = await MergeTemplate.findAll({ where, order: [['created_at', 'DESC']] });
      res.json({ success: true, data: templates });
    } catch (error) {
      logger.error('Error listando plantillas:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getOne(req, res) {
    try {
      const template = await MergeTemplate.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!template) return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });
      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('Error obteniendo plantilla:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const { nombre, descripcion, canal, contenido, variable_mapping, auto_merge } = req.body;
      if (!nombre?.trim()) return res.status(400).json({ success: false, message: 'El nombre es obligatorio.' });
      if (!contenido?.trim()) return res.status(400).json({ success: false, message: 'El contenido es obligatorio.' });

      const variables = mergeService.extractVariables(contenido);
      const mapping = variable_mapping || mergeService.suggestMapping(variables);

      const template = await MergeTemplate.create({
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || '',
        canal: canal || 'all',
        contenido: contenido.trim(),
        variables,
        variable_mapping: mapping,
        source_type: auto_merge ? 'auto' : 'manual',
        auto_merge: Boolean(auto_merge),
        created_by: req.user?.id,
        company_id: req.user?.role === 'superadmin' ? null : req.user?.company_id,
      });
      logger.info(`Plantilla creada: ${template.nombre} por ${req.user?.email} [auto_merge=${template.auto_merge}]`);
      res.status(201).json({ success: true, data: template });
    } catch (error) {
      logger.error('Error creando plantilla:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const template = await MergeTemplate.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!template) return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });

      const updates = {};
      if (req.body.nombre !== undefined) updates.nombre = req.body.nombre.trim();
      if (req.body.descripcion !== undefined) updates.descripcion = req.body.descripcion.trim();
      if (req.body.canal !== undefined) updates.canal = req.body.canal;
      if (req.body.contenido !== undefined) {
        updates.contenido = req.body.contenido.trim();
        updates.variables = mergeService.extractVariables(updates.contenido);
        if (req.body.variable_mapping) {
          updates.variable_mapping = req.body.variable_mapping;
        } else {
          updates.variable_mapping = mergeService.suggestMapping(updates.variables);
        }
      }
      if (req.body.variable_mapping !== undefined && !updates.variable_mapping) {
        updates.variable_mapping = req.body.variable_mapping;
      }
      if (req.body.auto_merge !== undefined) {
        updates.auto_merge = Boolean(req.body.auto_merge);
        updates.source_type = req.body.auto_merge ? 'auto' : 'manual';
      }
      if (req.body.activo !== undefined) updates.activo = Boolean(req.body.activo);

      await template.update(updates);
      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('Error actualizando plantilla:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async remove(req, res) {
    try {
      const template = await MergeTemplate.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!template) return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });
      await template.destroy();
      res.json({ success: true, message: 'Plantilla eliminada.' });
    } catch (error) {
      logger.error('Error eliminando plantilla:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async toggleActive(req, res) {
    try {
      const template = await MergeTemplate.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!template) return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });
      await template.update({ activo: !template.activo });
      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('Error toggling plantilla:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getVariables(req, res) {
    try {
      const { contenido } = req.body;
      if (!contenido) return res.status(400).json({ success: false, message: 'Contenido requerido.' });
      const variables = mergeService.extractVariables(contenido);
      const suggestedMapping = mergeService.suggestMapping(variables);
      res.json({ success: true, data: { variables, suggestedMapping } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async merge(req, res) {
    try {
      const template = await MergeTemplate.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!template) return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });

      const { datos } = req.body;
      if (!datos || typeof datos !== 'object')
        return res.status(400).json({ success: false, message: 'Se requiere un objeto "datos".' });

      const validacion = mergeService.validate(template.contenido, datos);
      const { resultado, variablesSinValor } = mergeService.merge(template.contenido, datos);
      res.json({ success: true, data: { resultado, validacion, variablesSinValor } });
    } catch (error) {
      logger.error('Error en merge:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async preview(req, res) {
    try {
      const { contenido, datos } = req.body;
      if (!contenido) return res.status(400).json({ success: false, message: 'Contenido requerido.' });

      const datosPreview = datos || {};
      const variables = mergeService.extractVariables(contenido);
      const validacion = mergeService.validate(contenido, datosPreview);
      const { resultado, variablesSinValor } = mergeService.merge(contenido, datosPreview);
      res.json({ success: true, data: { resultado, variables, validacion, variablesSinValor } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async useInConversation(req, res) {
    try {
      const template = await MergeTemplate.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!template) return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });

      const conversation = await Conversation.findByPk(req.params.conversationId, {
        include: [{ model: Contact, as: 'contact' }],
      });
      if (!conversation) return res.status(404).json({ success: false, message: 'Conversación no encontrada.' });

      const contact = conversation.contact;

      let collectedFields = {};
      try {
        const docReq = await DocumentRequest.findOne({
          where: { jid: contact?.whatsapp_id || contact?.phone || '', status: ['ready', 'collecting'] },
          order: [['updated_at', 'DESC']],
        });
        if (docReq) collectedFields = docReq.collected_fields || {};
      } catch (_) {}

      const mapping = template.variable_mapping || mergeService.suggestMapping(template.variables || []);
      const autoData = mergeService.resolveAllData({
        contact,
        conversation,
        collectedFields,
        mapping,
      });

      const manualData = req.body.datos || {};
      const datos = { ...autoData, ...manualData };

      const { resultado, variablesSinValor } = mergeService.merge(template.contenido, datos);
      const variables = mergeService.extractVariables(template.contenido);

      res.json({
        success: true,
        data: {
          resultado,
          variablesSinValor,
          variables,
          datosResueltos: datos,
          mapping,
        },
      });
    } catch (error) {
      logger.error('Error en useInConversation:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async autoMergeForConversation(req, res) {
    try {
      const { conversationId } = req.params;

      const conversation = await Conversation.findByPk(conversationId, {
        include: [{ model: Contact, as: 'contact' }],
      });
      if (!conversation) return res.status(404).json({ success: false, message: 'Conversación no encontrada.' });

      const contact = conversation.contact;
      const companyId = conversation.company_id;

      const { Op } = require('sequelize');
      const templates = await MergeTemplate.findAll({
        where: {
          auto_merge: true,
          activo: true,
          ...(companyId ? { company_id: { [Op.in]: [companyId, null] } } : {}),
          canal: { [Op.in]: [conversation.channel || 'all', 'all'] },
        },
      });

      if (!templates.length) {
        return res.json({ success: true, data: { results: [], message: 'No hay plantillas auto-merge activas.' } });
      }

      let collectedFields = {};
      try {
        const docReq = await DocumentRequest.findOne({
          where: { jid: contact?.whatsapp_id || contact?.phone || '', status: ['ready', 'collecting'] },
          order: [['updated_at', 'DESC']],
        });
        if (docReq) collectedFields = docReq.collected_fields || {};
      } catch (_) {}

      const results = [];
      for (const tpl of templates) {
        const result = await mergeService.autoMerge(tpl, { contact, conversation, collectedFields });
        results.push({
          templateId: tpl.id,
          templateNombre: tpl.nombre,
          ...result,
        });
      }

      res.json({ success: true, data: { results } });
    } catch (error) {
      logger.error('Error en autoMergeForConversation:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async detectAndMap(req, res) {
    try {
      const { contenido } = req.body;
      if (!contenido?.trim()) return res.status(400).json({ success: false, message: 'Contenido requerido.' });

      const variables = mergeService.extractVariables(contenido);
      const suggestedMapping = mergeService.suggestMapping(variables);

      const sources = {
        contact: ['name', 'phone', 'email'],
        system: ['date', 'time'],
        chatbot: variables.filter(v => {
          const m = suggestedMapping[v];
          return m && m.source === 'chatbot';
        }),
        conversation: ['metadata'],
      };

      res.json({
        success: true,
        data: {
          variables,
          suggestedMapping,
          sources,
          totalVariables: variables.length,
          autoResolvable: variables.filter(v => suggestedMapping[v]?.source !== 'chatbot').length,
          requiresChatbot: variables.filter(v => suggestedMapping[v]?.source === 'chatbot').length,
        },
      });
    } catch (error) {
      logger.error('Error en detectAndMap:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateMapping(req, res) {
    try {
      const template = await MergeTemplate.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!template) return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });

      const { variable_mapping } = req.body;
      if (!variable_mapping || typeof variable_mapping !== 'object') {
        return res.status(400).json({ success: false, message: 'Se requiere un objeto "variable_mapping".' });
      }

      await template.update({ variable_mapping });
      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('Error actualizando mapping:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new MergeTemplateController();
