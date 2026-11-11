import {
  invoiceChoiceFromTotalRate, invoiceLineTaxChoices, invoiceTotalRateFromChoice,
} from './invoiceTaxUi.js';

// The same ten component labels used by invoices, e-way bills and estimates.
export const GST_TAX_DROPDOWN_CHOICES = invoiceLineTaxChoices('unknown');

export const gstChoiceForSavedRate = value => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (!Number.isFinite(Number(text))) return 'custom';
  if (Number(text) === 0) return 'none';
  const inferred = invoiceChoiceFromTotalRate(text, 'unknown');
  return inferred?.startsWith('saved:') || !inferred ? 'custom' : inferred;
};

export const gstTotalFromSelection = selection =>
  selection === 'none' ? '0' :
    selection === 'custom' || !selection ? '' : invoiceTotalRateFromChoice(selection);
