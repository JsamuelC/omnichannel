// backend/src/controllers/userController.js
// ─────────────────────────────────────────────────────────────
// NUEVO: Gestión del equipo Tecnossync (solo admin)
// CRUD de los 5 empleados + cambio de contraseña propio
// ─────────────────────────────────────────────────────────────
const { User } = require('../models');
const bcrypt = require('bcryptjs');
const logger = require('../config/logger');

class UserController {

  // GET /users — Lista del equipo (excluye al propio admin si lo desea)
  async list(req, res) {
    try {
      const users = await User.findAll({
        attributes: { exclude: ['password_hash'] },
        order: [['created_at', 'ASC']]
      });
      res.json({ success: true, data: { users, total: users.length } });
    } catch (error) {
      logger.error('Error listing users:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /users — Crear empleado (admin lo crea con contraseña temporal)
  async create(req, res) {
    try {
      const { name, email, password, role = 'agent' } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Nombre, email y contraseña son requeridos.' });
      }

      const allowedRoles = ['admin', 'agent'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ success: false, message: `Rol inválido. Usa: ${allowedRoles.join(', ')}` });
      }

      const existing = await User.findOne({ where: { email: email.toLowerCase() } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Este email ya está registrado.' });
      }

      if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres.' });
      }

      const user = await User.create({
        name,
        email: email.toLowerCase(),
        password_hash: password, // el hook beforeCreate aplica bcrypt
        role
      });

      logger.info(`✅ Usuario creado: ${email} (${role}) por admin ${req.user.email}`);
      res.status(201).json({ success: true, data: user.toJSON() });
    } catch (error) {
      logger.error('Error creating user:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // PUT /users/:id — Editar nombre, email o rol
  async update(req, res) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

      const { name, email, role } = req.body;

      // No permitir cambiar el rol del único admin activo
      if (role && role !== 'admin' && user.role === 'admin') {
        const adminCount = await User.count({ where: { role: 'admin', is_active: true } });
        if (adminCount <= 1) {
          return res.status(400).json({ success: false, message: 'No puedes degradar al único administrador activo.' });
        }
      }

      const updates = {};
      if (name)  updates.name  = name;
      if (email) updates.email = email.toLowerCase();
      if (role && ['admin', 'agent'].includes(role)) updates.role = role;

      await user.update(updates);
      logger.info(`✏️  Usuario ${user.email} actualizado por ${req.user.email}`);
      res.json({ success: true, data: user.toJSON() });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // PATCH /users/:id/toggle — Activar/desactivar cuenta
  async toggleActive(req, res) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

      // Proteger al admin que hace la petición
      if (user.id === req.user.id) {
        return res.status(400).json({ success: false, message: 'No puedes desactivar tu propia cuenta.' });
      }

      await user.update({ is_active: !user.is_active });
      const status = user.is_active ? 'activada' : 'desactivada';
      logger.info(`🔄 Cuenta de ${user.email} ${status} por ${req.user.email}`);
      res.json({ success: true, data: user.toJSON(), message: `Cuenta ${status}.` });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // DELETE /users/:id — Eliminación lógica (desactiva en vez de borrar)
  async remove(req, res) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

      if (user.id === req.user.id) {
        return res.status(400).json({ success: false, message: 'No puedes eliminarte a ti mismo.' });
      }

      // Soft delete: desactivar en lugar de DROP para preservar historial
      await user.update({ is_active: false, email: `deleted_${Date.now()}_${user.email}` });
      logger.warn(`🗑️  Usuario ${req.params.id} (${user.email}) eliminado por ${req.user.email}`);
      res.json({ success: true, message: 'Usuario eliminado del sistema.' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // PATCH /users/:id/password — Cambio de contraseña
  // Admin puede cambiar la de cualquiera. Agente solo la suya.
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const targetId = req.params.id;

      // Solo admin puede cambiar contraseña de otros
      if (req.user.role !== 'admin' && req.user.id !== targetId) {
        return res.status(403).json({ success: false, message: 'Solo puedes cambiar tu propia contraseña.' });
      }

      const user = await User.findByPk(targetId);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

      // Si es el propio usuario (no admin), verificar contraseña actual
      if (req.user.id === targetId) {
        if (!currentPassword) {
          return res.status(400).json({ success: false, message: 'Debes proporcionar la contraseña actual.' });
        }
        const valid = await user.comparePassword(currentPassword);
        if (!valid) {
          return res.status(401).json({ success: false, message: 'Contraseña actual incorrecta.' });
        }
      }

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      }

      // El hook beforeUpdate aplica bcrypt automáticamente
      await user.update({ password_hash: newPassword });
      logger.info(`🔑 Contraseña de ${user.email} actualizada`);
      res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new UserController();
