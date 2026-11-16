/**
 * UI-only summaries for saved billing records.
 * Never add raw payment rows to invoice.paid: receipts are already applied.
 * Draft/cancelled/void documents do not constitute issued workshop revenue.
 */
const unissued = new Set(['draft', 'cancelled', 'canceled', 'void', 'voided', 'deleted', 'pending']);

export const isIssuedBillingDocument = (document) => {
  const status = String(document?.status || '').trim().toLowerCase();
  return Boolean(status) && !unissued.has(status);
};

const amount = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
};

export const billingDirectorySummary = (documents, kind, calculateTotals) => {
  const rows = Array.isArray(documents) ? documents : [];
  const issued = rows.filter(isIssuedBillingDocument);
  const draftCount = rows.filter(doc => String(doc.status || '').toLowerCase() === 'draft').length;
  const totals = issued.reduce((sum, doc) => {
    const calc = calculateTotals(doc) || {};
    sum.issuedValue += amount(calc.total);
    if (kind !== 'estimate') {
      sum.received += amount(calc.paid);
      sum.outstanding += amount(calc.balance);
    }
    return sum;
  }, { issuedValue: 0, received: 0, outstanding: 0 });

  return {
    totalCount: rows.length,
    issuedCount: issued.length,
    draftCount,
    ...totals,
  };
};

/** Sort/filter in the UI without mutating backend response objects. */
export const filterBillingDirectory = (documents, {
  query = '', status = 'All', from = '', to = '', sort = 'newest',
} = {}) => {
  const search = String(query).trim().toLowerCase();
  const dateKey = doc => String(doc.date || doc.createdAt || doc.created_at || '').slice(0,10);
  const matched = (Array.isArray(documents) ? documents : []).filter(doc => {
    if (status !== 'All' && doc.status !== status) return false;
    const date = dateKey(doc);
    if ((from && (!date || date < from)) || (to && (!date || date > to))) return false;
    return !search || [
      doc.number, doc.id, doc.customer?.name, doc.customer?.phone,
      doc.vehicle?.registration, doc.transportation?.vehicleNo, doc.jobCardNo,
    ].some(value => String(value || '').toLowerCase().includes(search));
  });
  return matched.sort((a,b) => {
    const av = dateKey(a), bv = dateKey(b);
    if (sort === 'oldest') return av.localeCompare(bv);
    if (sort === 'number') return String(a.number || a.id || '').localeCompare(String(b.number || b.id || ''), undefined, {numeric:true});
    return bv.localeCompare(av);
  });
};
