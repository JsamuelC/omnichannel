const CompanyPayment = require('../models/CompanyPayment');
const Company        = require('../models/Company');
const { User }       = require('../models');
const logger         = require('../config/logger');
const { sendPaymentConfirmation } = require('../services/emailService');
const path           = require('path');
const fs             = require('fs');
const multer         = require('multer');

const UPLOAD_DIR = process.env.PAYMENT_UPLOAD_DIR || path.join(__dirname, '../../uploads/payments');

function calcNextPaymentDate(fromDate, cycle) {
  const d = new Date(fromDate);
  if (cycle === 'annual')    d.setFullYear(d.getFullYear() + 1);
  else if (cycle === 'quarterly') d.setMonth(d.getMonth() + 3);
  else                        d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, new Date().getFullYear().toString());
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Tipo de archivo no permitido'), false);
  },
}).single('receipt');

exports.upload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(413).json({ success: false, error: 'Archivo muy grande (máx 10MB)' });
    }
    if (err) return res.status(415).json({ success: false, error: err.message });
    next();
  });
};

exports.list = async (req, res) => {
  try {
    const { company_id, page = 1, limit = 20 } = req.query;
    const where = {};
    if (company_id) where.company_id = company_id;

    const { count, rows } = await CompanyPayment.findAndCountAll({
      where,
      order: [['payment_date', 'DESC'], ['created_at', 'DESC']],
      limit:  +limit,
      offset: (+page - 1) * +limit,
    });

    res.json({ success: true, data: { payments: rows, total: count } });
  } catch (err) {
    logger.error('Error listando pagos:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { company_id, amount, currency, payment_method, reference_number,
            payment_date, period_covered, notes, status } = req.body;

    if (!company_id || !amount || !payment_method || !payment_date) {
      return res.status(400).json({ success: false, error: 'company_id, amount, payment_method y payment_date son obligatorios' });
    }

    const company = await Company.findByPk(company_id);
    if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada' });

    const payment = await CompanyPayment.create({
      company_id,
      amount:           Number(amount),
      currency:         currency || 'USD',
      payment_method,
      reference_number: reference_number || null,
      payment_date,
      period_covered:   period_covered || null,
      notes:            notes || null,
      receipt_path:     req.file ? req.file.path : null,
      receipt_filename: req.file ? req.file.originalname : null,
      recorded_by:      req.user.id,
      status:           status || 'confirmed',
    });

    logger.info(`💰 Pago registrado: $${amount} ${currency || 'USD'} para ${company.nombre} por ${req.user.email}`);

    // Enviar email de confirmación al correo de la empresa
    const companyEmail = company.email;
    if (companyEmail && (status || 'confirmed') === 'confirmed') {
      const billing = company.billing || {};
      const cycle   = billing.cycle || 'monthly';
      const nextDate = calcNextPaymentDate(payment_date, cycle);

      // Actualizar próximo pago en billing
      try {
        await company.update({
          billing: { ...billing, next_payment: nextDate, status: 'active', updated_at: new Date().toISOString() }
        });
      } catch (_) {}

      sendPaymentConfirmation({
        toEmail:          companyEmail,
        companyName:      company.nombre,
        amount,
        currency:         currency || 'USD',
        paymentMethod:    payment_method,
        referenceNumber:  reference_number,
        paymentDate:      payment_date,
        periodCovered:    period_covered,
        nextPaymentDate:  nextDate,
        nextAmount:       billing.price || amount,
      }).catch(() => {});
    }

    res.status(201).json({ success: true, data: payment });
  } catch (err) {
    logger.error('Error creando pago:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const payment = await CompanyPayment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ success: false, error: 'Pago no encontrado' });

    const { amount, currency, payment_method, reference_number,
            payment_date, period_covered, notes, status } = req.body;

    const updates = {};
    if (amount           !== undefined) updates.amount           = Number(amount);
    if (currency         !== undefined) updates.currency         = currency;
    if (payment_method   !== undefined) updates.payment_method   = payment_method;
    if (reference_number !== undefined) updates.reference_number = reference_number;
    if (payment_date     !== undefined) updates.payment_date     = payment_date;
    if (period_covered   !== undefined) updates.period_covered   = period_covered;
    if (notes            !== undefined) updates.notes            = notes;
    if (status           !== undefined) updates.status           = status;

    if (req.file) {
      if (payment.receipt_path) {
        try { fs.unlinkSync(payment.receipt_path); } catch (_) {}
      }
      updates.receipt_path     = req.file.path;
      updates.receipt_filename = req.file.originalname;
    }

    await payment.update(updates);
    res.json({ success: true, data: payment });
  } catch (err) {
    logger.error('Error actualizando pago:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const payment = await CompanyPayment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ success: false, error: 'Pago no encontrado' });

    if (payment.receipt_path) {
      try { fs.unlinkSync(payment.receipt_path); } catch (_) {}
    }

    await payment.destroy();
    res.json({ success: true, message: 'Pago eliminado' });
  } catch (err) {
    logger.error('Error eliminando pago:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getReceipt = async (req, res) => {
  try {
    const payment = await CompanyPayment.findByPk(req.params.id);
    if (!payment || !payment.receipt_path) {
      return res.status(404).json({ success: false, error: 'Comprobante no encontrado' });
    }
    if (!fs.existsSync(payment.receipt_path)) {
      return res.status(404).json({ success: false, error: 'Archivo no encontrado en disco' });
    }
    res.sendFile(path.resolve(payment.receipt_path));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
