// backend/src/routes/companyRoutes.js
const express  = require('express');
const router   = express.Router();
const {
  getCompany, updateCompany, updateLogo,
  listCompanies, createCompany, deleteCompany
} = require('../controllers/companyController');
const { auth, requireRole, requireSuperAdmin } = require('../middleware/auth');

// GET  /api/company          → admin/agent ve su empresa
// GET  /api/company?company_id=X → superadmin puede ver cualquiera
router.get('/', auth, requireRole('admin', 'agent', 'supervisor'), getCompany);

// PUT  /api/company          → admin actualiza su empresa
router.put('/', auth, requireRole('admin'), updateCompany);

// ── Superadmin: gestión de todas las empresas ─────────────────────────────
// GET  /api/company/all      → listar todas
router.get('/all',         auth, requireSuperAdmin, listCompanies);

// POST /api/company/create   → crear empresa + admin inicial
router.post('/create',     auth, requireSuperAdmin, createCompany);

// DELETE /api/company/:id    → eliminar empresa
router.delete('/:id',      auth, requireSuperAdmin, deleteCompany);

module.exports = router;
