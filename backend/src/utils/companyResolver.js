const Company = require('../models/Company');
const logger  = require('../config/logger');

async function resolveCompanyFilter(req) {
  if (req.companyFilter && Object.keys(req.companyFilter).length > 0) return req.companyFilter;

  if (req.user?.role === 'superadmin') {
    const explicit = req.query?.company_id || req.body?.company_id;
    if (explicit) return { company_id: explicit };
    // Superadmin without explicit company_id: block rather than leak all data
    logger.warn('resolveCompanyFilter: superadmin request without company_id — returning null guard');
    return { company_id: null };
  }

  if (req.user?.company_id) return { company_id: req.user.company_id };

  return { company_id: null };
}

async function resolveCompanyId(req) {
  if (req.user?.role === 'superadmin') {
    const explicit = req.query?.company_id || req.body?.company_id;
    if (explicit) return explicit;
    return null;
  }
  if (req.user?.company_id) return req.user.company_id;
  return null;
}

module.exports = { resolveCompanyFilter, resolveCompanyId };
