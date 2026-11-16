import { estimateGstOptions } from './estimateGstRates.js';

// New catalogue entries created from the estimate use the same limits as
// their Django Service and StockItem models. No stock movements are recorded here.
const validPrice = (value) => {
  const input = String(value ?? '').trim();
  const amount = Number(input);
  return /^\d+(?:\.\d{1,2})?$/.test(input) && Number.isFinite(amount) &&
    amount >= 0 && amount <= 10000000;
};

// A common 18% starting preset for workshop quotes, never a mandatory rate.
// The user must check the applicable HSN/SAC and may choose any allowed preset.
export const defaultEstimateCatalogGst = (registered = false, mode = 'unknown', config = null) => {
  if (!registered) {
    return { taxRate: '0', taxChoice: '', taxTreatment: 'taxable', taxTreatmentConfirmed: false, hsnSac: '' };
  }
  const jurisdiction = mode === 'igst' ? 'igst' : 'cgst_sgst';
  const choice = estimateGstOptions('', jurisdiction, config)
    .find(option => option.taxMode === jurisdiction && Number(option.totalRate) === 18);
  return {
    taxRate: choice ? String(choice.totalRate) : '',
    taxChoice: choice?.value || '',
    taxTreatment: 'taxable',
    taxTreatmentConfirmed: false,
    hsnSac: '',
  };
};

const ZERO_PART_TREATMENTS = new Set(['nil_rated', 'exempt', 'non_gst']);
const ZERO_WORK_TREATMENTS = new Set(['nil_rated', 'exempt', 'non_gst', 'out_of_scope']);

export const validateEstimateCatalogDraft = (draft = {}, { registered = false } = {}) => {
  const errors = {};
  const isPart = draft.kind === 'part';
  const name = String(draft.name || '').trim();
  if (!name) errors.name = isPart ? 'Enter a part name.' : 'Enter a work / service name.';
  else if (name.length > (isPart ? 180 : 160)) errors.name = 'Name is too long.';

  if (!validPrice(draft.price)) {
    errors.price = isPart ? 'Enter a valid selling price (max 2 decimals).'
      : 'Enter a valid work rate (max 2 decimals).';
  }
  if (isPart) {
    const sku = String(draft.sku || '').trim();
    if (!sku) errors.sku = 'Enter a unique SKU / part number.';
    else if (sku.length > 80) errors.sku = 'SKU must be 80 characters or fewer.';
    if (!validPrice(draft.costPrice)) {
      errors.costPrice = 'Enter a valid purchase cost (max 2 decimals).';
    }
  }

  if (registered) {
    const rate = String(draft.taxRate ?? '').trim();
    const isNone = draft.taxChoice === 'none';
    if (!draft.taxChoice || !/^\d+(?:\.\d{1,2})?$/.test(rate)
        || !Number.isFinite(Number(rate)) || Number(rate) > 100
        || (isNone && Number(rate) !== 0)
        || (!isNone && Number(rate) === 0)) {
      errors.taxChoice = 'Select a valid GST rate, or choose None with a classification.';
    }
    if (isNone) {
      const treatments = isPart ? ZERO_PART_TREATMENTS : ZERO_WORK_TREATMENTS;
      if (!treatments.has(draft.taxTreatment)) {
        errors.taxTreatment = 'Select the applicable zero-GST classification.';
      }
      if (!String(draft.hsnSac || '').trim()) {
        errors.hsnSac = 'HSN / SAC is required for a zero-GST item.';
      }
      if (draft.taxTreatmentConfirmed !== true) {
        errors.taxTreatmentConfirmed = 'Confirm the zero-GST classification.';
      }
    }
  }
  if (String(draft.hsnSac || '').length > 20) {
    errors.hsnSac = 'HSN / SAC must be at most 20 characters.';
  }
  return errors;
};

// DecimalFields may be serialized as "0.00", but estimate zero-GST
// validation uses a canonical "0" representation for classifications.
export const normalizeEstimateTaxRate = (rate) =>
  rate === '' || rate == null || !Number.isFinite(Number(rate))
    ? '' : String(Number(rate));

export const buildEstimateCatalogSelection = (draft, created) => ({
  description: created?.partName || created?.name || String(draft.name).trim(),
  type: draft.kind === 'part' ? 'Part' : draft.workType || 'Labour',
  unitPrice: String(created?.sellingPrice ?? created?.price ?? draft.price),
  catalogId: created?.id ?? '',
  catalogCode: draft.kind === 'part' ? (created?.sku || draft.sku) : (created?.code || draft.code || ''),
  // Preserve the catalog's actual saved rate, not a second line-level tax.
  taxRate: normalizeEstimateTaxRate(draft.kind === 'part'
    ? created?.tax ?? draft.taxRate ?? ''
    : created?.taxRate ?? draft.taxRate ?? ''),
  taxChoice: draft.taxChoice || '',
  hsnSac: String(draft.kind === 'part'
    ? created?.hsnCode ?? draft.hsnSac ?? ''
    : created?.hsnSac ?? draft.hsnSac ?? ''),
  taxTreatment: draft.taxChoice === 'none' ? draft.taxTreatment : 'taxable',
  taxTreatmentConfirmed: draft.taxChoice === 'none' && draft.taxTreatmentConfirmed === true,
});
