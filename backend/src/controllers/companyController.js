// backend/src/controllers/companyController.js
const Company = require('../models/Company');

// GET /api/company
// Devuelve los datos de la empresa (siempre hay 1 sola fila)
const getCompany = async (req, res) => {
  try {
    let company = await Company.findOne();

    // Si no existe aún, creamos un registro vacío
    if (!company) {
      company = await Company.create({ nombre: 'Mi Empresa' });
    }

    res.json({ success: true, data: company });
  } catch (error) {
    console.error('Error al obtener empresa:', error);
    res.status(500).json({ success: false, message: 'Error al obtener los datos de la empresa' });
  }
};

// PUT /api/company
// Actualiza los datos de la empresa
const updateCompany = async (req, res) => {
  try {
    const {
      nombre,
      sitio_web,
      telefono,
      telefono_secundario,
      email,
      fax,
      direccion,
      ciudad,
      pais,
      descripcion,
    } = req.body;

    let company = await Company.findOne();

    if (!company) {
      company = await Company.create({ nombre: nombre || 'Mi Empresa' });
    }

    await company.update({
      nombre,
      sitio_web,
      telefono,
      telefono_secundario,
      email,
      fax,
      direccion,
      ciudad,
      pais,
      descripcion,
    });

    res.json({ success: true, data: company, message: 'Empresa actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar empresa:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar los datos de la empresa' });
  }
};

// PUT /api/company/logo
// Actualiza solo el logo (si usas multer para subir archivos)
const updateLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se recibió ningún archivo' });
    }

    const logo_url = `/uploads/${req.file.filename}`;
    let company = await Company.findOne();

    if (!company) {
      company = await Company.create({ nombre: 'Mi Empresa', logo_url });
    } else {
      await company.update({ logo_url });
    }

    res.json({ success: true, data: { logo_url }, message: 'Logo actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar logo:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar el logo' });
  }
};

module.exports = { getCompany, updateCompany, updateLogo };