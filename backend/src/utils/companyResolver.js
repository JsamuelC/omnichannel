const Company = require('../models/Company');
const logger  = require('../config/logger');

async function resolveCompanyFilter(req) {
  if (req.companyFilter && Object.keys(req.companyFilter).length > 0) return req.companyFilter;

  if (req.user?.role === 'superadmin') {
    const explicit = req.headers?.['x-company-id'] || req.query?.company_id || req.body?.company_id;
    if (explicit) return { company_id: explicit };
    // Fallback: empresa propia del superadmin (Tecnossync)
    if (req.user.company_id) return { company_id: req.user.company_id };
    logger.warn('resolveCompanyFilter: superadmin request without company_id — returning null guard');
    return { company_id: null };
  }

  if (req.user?.company_id) return { company_id: req.user.company_id };

  return { company_id: null };
}

async function resolveCompanyId(req) {
  if (req.user?.role === 'superadmin') {
    const explicit = req.headers?.['x-company-id'] || req.query?.company_id || req.body?.company_id;
    if (explicit) return explicit;
    // Fallback: empresa propia del superadmin (Tecnossync)
    return req.user.company_id || null;
  }
  if (req.user?.company_id) return req.user.company_id;
  return null;
}

module.exports = { resolveCompanyFilter, resolveCompanyId };
