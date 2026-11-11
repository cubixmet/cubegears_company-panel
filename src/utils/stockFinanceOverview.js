// Catalog GST classification is only a product reference. Never convert it
// into supplier ITC, a GSTR entry, or a cash/bank movement without a posted
// purchase invoice and the existing Finance/GSTR verification workflows.
export const stockGstReview = (items = []) => {
  const records = Array.isArray(items) ? items : [];
  const needingHsn = [];
  const needingZeroClassification = [];
  for (const item of records) {
    const rate = Number(item.tax);
    const name = item.partName || item.name || item.sku || 'Unnamed part';
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) continue;
    if (rate > 0 && !String(item.hsnCode || item.hsn_code || '').trim()) {
      needingHsn.push({ id: item.id, name });
    }
    if (rate === 0 && !String(item.zeroTaxClassification || item.gst_zero_classification || '').trim()) {
      needingZeroClassification.push({ id: item.id, name });
    }
  }
  return {
    total: records.length,
    missingHsn: needingHsn.length,
    missingZeroClassification: needingZeroClassification.length,
    needsReview: needingHsn.length + needingZeroClassification.length,
    examples: [...needingHsn, ...needingZeroClassification].slice(0, 5),
  };
};

const money = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export const stockSupplierFinanceTotals = (balances = []) => {
  const records = Array.isArray(balances) ? balances : [];
  return records.reduce((result, row) => {
    const outstanding = money(row.outstanding);
    const advance = money(row.availableAdvance);
    const debitCredit = money(row.availableDebitCredit);
    result.outstanding += outstanding;
    result.overdue += money(row.overdue);
    result.availableCredits += advance + debitCredit;
    result.netExposure += money(row.netExposureAfterAvailableCredits ?? (outstanding - advance - debitCredit));
    if (outstanding > 0) result.suppliersWithDue += 1;
    return result;
  }, { outstanding: 0, overdue: 0, availableCredits: 0, netExposure: 0, suppliersWithDue: 0 });
};
