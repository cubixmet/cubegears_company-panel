import {
  gstrLinkForInvoice,
  financePaymentHistoryLink,
  invoiceOutstandingAmount,
  isPostedInvoice,
} from './invoiceFinanceLinks.js';

const asNumber = value => {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

// Invoice totals and tax are owned by Django. Job estimates, repair costs,
// and GST rate previews must never become a second tax ledger.
export const jobInvoiceGST = invoice => {
  if (!invoice || invoice.invoiceType !== 'gst') return null;
  const cgst = asNumber(invoice.cgst);
  const sgst = asNumber(invoice.sgst);
  const igst = asNumber(invoice.igst);
  const taxable = asNumber(invoice.taxable);
  if ([cgst, sgst, igst, taxable].some(value => value == null)) return null;
  return {
    cgst, sgst, igst, taxable,
    tax: Number((cgst + sgst + igst).toFixed(2)),
    mode: invoice.taxMode || invoice.tax_mode || '',
  };
};

export const jobInvoiceFor = (invoices, job) => {
  if (!job) return null;
  const related = (Array.isArray(invoices) ? invoices : [])
    .filter(invoice => (invoice.kind || 'invoice') === 'invoice')
    .filter(invoice =>
      String(invoice.jobId || invoice.job_id || invoice.sourceJobId || invoice.source_job_id || invoice.job || '') === String(job.id)
      || (job.jobNumber && String(invoice.jobCardNo || invoice.job_card_no || '') === String(job.jobNumber))
    ).sort((left, right) => String(right.createdAt || right.created_at || right.date || '')
      .localeCompare(String(left.createdAt || left.created_at || left.date || '')));
  return related.find(invoice => invoice.status !== 'Cancelled') || null;
};

export const jobInvoiceFinance = invoice => {
  if (!invoice) return { posted: false, outstanding: null, paymentUrl: '', historyUrl: '', gstrUrl: '' };
  const posted = isPostedInvoice(invoice);
  const outstanding = posted ? invoiceOutstandingAmount(invoice, {}) : null;
  return {
    posted,
    outstanding,
    paymentUrl: posted && outstanding > 0 && invoice.id
      ? '/finance/payments/new?invoiceId=' + encodeURIComponent(invoice.id) : '',
    historyUrl: invoice.number ? financePaymentHistoryLink(invoice) : '',
    gstrUrl: gstrLinkForInvoice(invoice),
  };
};
