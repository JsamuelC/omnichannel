const Company = require('../models/Company');
const { User } = require('../models');
const logger   = require('../config/logger');

// Presets en memoria (editables en runtime por superadmin)
let PLAN_PRESETS = {
  free: {
    label: 'Gratuito', color: 'slate', icon: '·', price: 0, price_quarterly: 0, price_annual: 0,
    limits: { max_operators: 2, max_conversations_month: 200, max_storage_mb: 100, max_campaigns_month: 0, max_whatsapp_accounts: 1, max_merge_templates: 5, max_custom_modules: 1 },
  },
  basic: {
    label: 'Básico', color: 'indigo', icon: '◆', price: 49, price_quarterly: 42, price_annual: 39,
    limits: { max_operators: 5, max_conversations_month: 1000, max_storage_mb: 500, max_campaigns_month: 5, max_whatsapp_accounts: 2, max_merge_templates: 20, max_custom_modules: 3 },
  },
  pro: {
    label: 'Profesional', color: 'violet', icon: '◈', price: 99, price_quarterly: 89, price_annual: 79,
    limits: { max_operators: 15, max_conversations_month: 5000, max_storage_mb: 2000, max_campaigns_month: 20, max_whatsapp_accounts: 5, max_merge_templates: 100, max_custom_modules: 10 },
  },
  enterprise: {
    label: 'Empresarial', color: 'amber', icon: '★', price: 199, price_quarterly: 179, price_annual: 159,
    limits: { max_operators: -1, max_conversations_month: -1, max_storage_mb: -1, max_campaigns_month: -1, max_whatsapp_accounts: -1, max_merge_templates: -1, max_custom_modules: -1 },
  },
};

// GET /api/plans/presets
exports.getPresets = (req, res) => {
  res.json({ success: true, data: PLAN_PRESETS });
};

// PUT /api/plans/presets/:key — editar precio/nombre de un preset
exports.updatePreset = (req, res) => {
  const { key } = req.params;
  if (!PLAN_PRESETS[key]) return res.status(404).json({ success: false, error: 'Plan no encontrado' });
  const { label, price, price_quarterly, price_annual, limits, color, icon } = req.body;
  PLAN_PRESETS[key] = {
    ...PLAN_PRESETS[key],
    ...(label             !== undefined && { label }),
    ...(price             !== undefined && { price: Number(price) }),
    ...(price_quarterly   !== undefined && { price_quarterly: Number(price_quarterly) }),
    ...(price_annual      !== undefined && { price_annual: Number(price_annual) }),
    ...(color             !== undefined && { color }),
    ...(icon              !== undefined && { icon }),
    ...(limits            !== undefined && { limits: { ...PLAN_PRESETS[key].limits, ...limits } }),
  };
  logger.info(`📋 Preset "${key}" actualizado por superadmin`);
  res.json({ success: true, data: PLAN_PRESETS[key] });
};

// POST /api/plans/presets — crear nuevo plan
exports.createPreset = (req, res) => {
  const { key, label, price, price_quarterly, price_annual, limits, color, icon } = req.body;
  if (!key || !label) return res.status(400).json({ success: false, error: 'key y label son obligatorios' });
  if (PLAN_PRESETS[key]) return res.status(400).json({ success: false, error: 'Ya existe un plan con ese identificador' });
  PLAN_PRESETS[key] = {
    label,
    color:           color || 'slate',
    icon:            icon  || '◉',
    price:           Number(price)           || 0,
    price_quarterly: Number(price_quarterly) || 0,
    price_annual:    Number(price_annual)    || 0,
    limits: {
      max_operators:           limits?.max_operators           ?? 5,
      max_conversations_month: limits?.max_conversations_month ?? 1000,
      max_storage_mb:          limits?.max_storage_mb          ?? 500,
      max_campaigns_month:     limits?.max_campaigns_month     ?? 5,
      max_whatsapp_accounts:   limits?.max_whatsapp_accounts   ?? 2,
      max_merge_templates:     limits?.max_merge_templates     ?? 20,
      max_custom_modules:      limits?.max_custom_modules      ?? 3,
    },
  };
  logger.info(`📋 Nuevo plan "${key}" creado por superadmin`);
  res.json({ success: true, data: { key, ...PLAN_PRESETS[key] } });
};

// DELETE /api/plans/presets/:key
exports.deletePreset = (req, res) => {
  const { key } = req.params;
  if (!PLAN_PRESETS[key]) return res.status(404).json({ success: false, error: 'Plan no encontrado' });
  if (['free', 'basic', 'pro', 'enterprise'].includes(key)) {
    return res.status(400).json({ success: false, error: 'No se pueden eliminar los planes predeterminados' });
  }
  delete PLAN_PRESETS[key];
  res.json({ success: true });
};

// GET /api/plans/company/:id
exports.getCompanyPlan = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id, {
      attributes: ['id', 'nombre', 'plan', 'plan_limits', 'billing'],
    });
    if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada' });
    const operatorCount = await User.count({ where: { company_id: company.id, is_active: true } });
    res.json({ success: true, data: { ...company.toJSON(), current_operators: operatorCount } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/plans/company/:id
exports.updateCompanyPlan = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada' });

    const { plan, plan_limits, billing } = req.body;
    const updates = {};

    if (plan) {
      updates.plan = plan;
      if (PLAN_PRESETS[plan] && !plan_limits) updates.plan_limits = PLAN_PRESETS[plan].limits;
    }
    if (plan_limits) updates.plan_limits = plan_limits;
    if (billing !== undefined) {
      updates.billing = billing ? {
        ...(company.billing || {}),
        ...billing,
        updated_at: new Date().toISOString(),
      } : null;
    }

    await company.update(updates);
    logger.info(`📋 Plan actualizado empresa ${company.nombre}: ${plan || company.plan}`);
    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/plans/billing-alerts
exports.getBillingAlerts = async (req, res) => {
  try {
    const companies = await Company.findAll({
      attributes: ['id', 'nombre', 'email', 'plan', 'billing'],
    });
    const today = new Date();
    const alerts = companies
      .filter(c => c.billing?.next_payment && c.billing?.status !== 'cancelled' && c.plan !== 'free')
      .map(c => {
        const due  = new Date(c.billing.next_payment);
        const diff = Math.ceil((due - today) / 86400000);
        const alertType = diff < 0 ? 'overdue' : diff <= 7 ? 'due_soon' : null;
        return alertType ? {
          id: c.id, nombre: c.nombre, email: c.email, plan: c.plan,
          next_payment: c.billing.next_payment, price: c.billing.price,
          currency: c.billing.currency || 'USD', days_until: diff,
          alert_type: alertType, status: c.billing.status,
        } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.days_until - b.days_until);
    res.json({ success: true, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/plans/overview  — incluye métricas por plan y ciclo
exports.getOverview = async (req, res) => {
  try {
    const companies = await Company.findAll({
      attributes: ['id', 'nombre', 'plan', 'billing', 'created_at'],
    });

    const byPlan    = {};
    const byStatus  = { active: 0, overdue: 0, trial: 0, cancelled: 0 };
    const byCycle   = { monthly: 0, quarterly: 0, annual: 0 };
    let mrr = 0, arr = 0, qrr = 0;
    let activeCount = 0;

    for (const c of companies) {
      byPlan[c.plan] = (byPlan[c.plan] || 0) + 1;

      const b = c.billing;
      if (!b) continue;

      if (b.status) byStatus[b.status] = (byStatus[b.status] || 0) + 1;
      if (b.cycle)  byCycle[b.cycle]   = (byCycle[b.cycle]  || 0) + 1;

      if (b.price && b.status === 'active') {
        const p = Number(b.price) || 0;
        activeCount++;
        if (b.cycle === 'annual')    { mrr += p / 12; arr += p; qrr += p / 4; }
        else if (b.cycle === 'quarterly') { mrr += p / 3; arr += p * 4; qrr += p; }
        else                         { mrr += p; arr += p * 12; qrr += p * 3; }
      }
    }

    // Métricas por plan con ingresos
    const planMetrics = {};
    for (const [planKey, count] of Object.entries(byPlan)) {
      const preset = PLAN_PRESETS[planKey];
      planMetrics[planKey] = {
        label:  preset?.label || planKey,
        color:  preset?.color || 'slate',
        count,
        pct:    companies.length ? Math.round((count / companies.length) * 100) : 0,
        price:  preset?.price || 0,
      };
    }

    res.json({
      success: true,
      data: {
        total:       companies.length,
        active:      activeCount,
        by_plan:     byPlan,
        plan_metrics: planMetrics,
        by_status:   byStatus,
        by_cycle:    byCycle,
        mrr:  Math.round(mrr  * 100) / 100,
        arr:  Math.round(arr  * 100) / 100,
        qrr:  Math.round(qrr  * 100) / 100,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
