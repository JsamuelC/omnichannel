const Company = require('../models/Company');

let _cachedFirstCompanyId = null;

async function getFirstCompanyId() {
  if (_cachedFirstCompanyId) return _cachedFirstCompanyId;
  const first = await Company.findOne({ order: [['created_at', 'ASC']], attributes: ['id'] });
  _cachedFirstCompanyId = first?.id || null;
  return _cachedFirstCompanyId;
}

async function resolveCompanyFilter(req) {
  if (req.companyFilter && Object.keys(req.companyFilter).length > 0) return req.companyFilter;
  if (req.user?.company_id) return { company_id: req.user.company_id };
  if (req.user?.role === 'superadmin') {
    const id = await getFirstCompanyId();
    return id ? { company_id: id } : {};
  }
  return {};
}

async function resolveCompanyId(req) {
  if (req.user?.company_id) return req.user.company_id;
  if (req.user?.role === 'superadmin') return await getFirstCompanyId();
  return null;
}

module.exports = { resolveCompanyFilter, resolveCompanyId };
