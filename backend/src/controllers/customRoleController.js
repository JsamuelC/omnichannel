// backend/src/controllers/customRoleController.js
const { CustomRole, User } = require('../models');
const logger = require('../config/logger');

class CustomRoleController {
  // GET /custom-roles — admin-only (ver nota en routes/index.js). El operador
  // resuelve su propia visibilidad vía custom_permissions en /auth/me, nunca
  // necesita ver la lista completa de roles de la empresa.
  async list(req, res) {
    try {
      const roles = await CustomRole.findAll({
        where: req.companyFilter,
        order: [['created_at', 'ASC']],
      });
      res.json({ success: true, data: roles });
    } catch (error) {
      logger.error('Error listing custom roles:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /custom-roles
  async create(req, res) {
    try {
      const { name, description, base_role = 'agent', permissions } = req.body;
      if (!name?.trim())
        return res.status(400).json({ success: false, message: 'El nombre del rol es requerido.' });

      const company_id = req.user.role === 'superadmin' ? req.body.company_id : req.user.company_id;
      if (!company_id)
        return res.status(400).json({ success: false, message: 'Se requiere company_id.' });

      if (!['agent', 'supervisor', 'admin'].includes(base_role))
        return res.status(400).json({ success: false, message: 'base_role inválido.' });

      const role = await CustomRole.create({
        company_id,
        name: name.trim(),
        description: description || null,
        base_role,
        permissions: { ...CustomRole.DEFAULT_PERMISSIONS, ...(permissions || {}) },
      });

      logger.info(`Rol personalizado creado: "${role.name}" (empresa ${company_id}) por ${req.user.email}`);
      res.status(201).json({ success: true, data: role });
    } catch (error) {
      logger.error('Error creating custom role:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // PUT /custom-roles/:id
  async update(req, res) {
    try {
      const role = await this._findInScope(req.params.id, req);
      if (!role) return res.status(404).json({ success: false, message: 'Rol no encontrado.' });

      const { name, description, permissions, is_active } = req.body;
      const updates = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description || null;
      if (is_active !== undefined) updates.is_active = !!is_active;
      if (permissions !== undefined) {
        updates.permissions = { ...role.permissions, ...permissions };
      }

      await role.update(updates);
      res.json({ success: true, data: role });
    } catch (error) {
      logger.error('Error updating custom role:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // DELETE /custom-roles/:id — desasigna a todos los usuarios que lo tuvieran (vuelven al default)
  async remove(req, res) {
    try {
      const role = await this._findInScope(req.params.id, req);
      if (!role) return res.status(404).json({ success: false, message: 'Rol no encontrado.' });

      await User.update({ custom_role_id: null }, { where: { custom_role_id: role.id } });
      await role.destroy();

      logger.warn(`Rol personalizado "${role.name}" eliminado por ${req.user.email} — usuarios reasignados a comportamiento por defecto`);
      res.json({ success: true, message: 'Rol eliminado. Los usuarios que lo tenían asignado vuelven al comportamiento por defecto de su rol base.' });
    } catch (error) {
      logger.error('Error deleting custom role:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async _findInScope(id, req) {
    const where = { id, ...req.companyFilter };
    return CustomRole.findOne({ where });
  }
}

module.exports = new CustomRoleController();
