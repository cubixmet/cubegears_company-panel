// Invoice financial totals come from the saved document / canonical payment
// ledger. Navigating to GSTR must not create or recalculate a tax record.
const INCLUDED_GSTR_STATUSES = new Set([
  'Finalized', 'Paid', 'Issued', 'Partially Paid', 'Overdue',
]);

export const isPostedInvoice = (invoice) =>
  invoice?.kind === 'invoice' &&
  Boolean(invoice.finalizedAt || invoice.finalized_at) &&
  INCLUDED_GSTR_STATUSES.has(invoice.status);

export const gstrLinkForInvoice = (invoice) => {
  if (!isPostedInvoice(invoice) || invoice.invoiceType !== 'gst') return '';
  const date = String(invoice.date || '').slice(0, 10);
  if (!/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(date)) return '';
  const invoiceNumber = String(invoice.number || '').trim();
  const params = new URLSearchParams({ tab: 'gstr1', period: date.slice(0, 7) });
  if (invoiceNumber) params.set('invoice', invoiceNumber);
  return '/gstr?' + params.toString();
};

export const financePaymentHistoryLink = (invoice) => {
  const number = String(invoice?.number || '').trim();
  return '/finance/payments' + (number ? '?invoice=' + encodeURIComponent(number) : '');
};

export const invoiceOutstandingAmount = (invoice, totals) => {
  // Prefer server-saved balance. Never create a receipt from a draft.
  const source = invoice?.balance !== undefined && invoice?.balance !== null && invoice?.balance !== ''
    ? invoice.balance : totals?.balance;
  const value = Number(source);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};
