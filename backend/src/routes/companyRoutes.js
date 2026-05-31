// backend/src/routes/company.js
const express = require('express');
const router = express.Router();
const { getCompany, updateCompany, updateLogo } = require('../controllers/companyController');

// Si tienes middleware de autenticación, agrégalo así:
// const { protect } = require('../middleware/auth');
// router.use(protect);

// GET  /api/company  → obtener datos de la empresa
router.get('/', getCompany);

// PUT  /api/company  → actualizar datos de la empresa
router.put('/', updateCompany);

// PUT  /api/company/logo  → subir logo (requiere multer)
// const multer = require('multer');
// const upload = multer({ dest: 'uploads/' });
// router.put('/logo', upload.single('logo'), updateLogo);

module.exports = router;