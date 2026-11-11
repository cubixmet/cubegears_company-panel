const display = (value, fallback = '') => {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') return String(value.name || value.number || value.id || fallback);
  return fallback;
};

export const normalizePaymentRow = (row = {}) => ({
  ...row,
  // Never use a UPI/bank transaction reference as a workshop receipt number.
  receiptNo: display(row.receiptNo || row.receipt_no, '') || display(row.id, '—'),
  date: row.date || row.paymentDate || row.payment_date || '',
  customer: display(row.customerName || row.customer_name || row.customer, 'Customer'),
  invoice: display(row.invoiceNo || row.invoice_no || row.invoice, ''),
  method: display(row.method || row.paymentMethod || row.payment_method, 'Cash'),
  amount: Number(row.amount || 0),
  reference: display(row.reference || row.transactionRef || row.transaction_ref, ''),
  status: display(row.status, 'Completed'),
});

export const paymentStatusClass = (status = '') =>
  'is-' + String(status || 'Completed').toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const formatPaymentDate = (value) => {
  if (!value) return '—';
  const text = String(value);
  const date = new Date(text.length === 10 ? text + 'T00:00:00' : text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

// Backend invoices have canonical balance and customerId; mock billing documents
// use calculated totals and may have no persistent customer UUID.
export const invoiceOutstanding = (invoice, calculateTotals) => {
  if (!invoice) return 0;
  const balance = invoice.balance;
  if (balance != null && balance !== '') return Math.max(0, Number(balance) || 0);
  if (invoice.total != null && invoice.total !== '') {
    return Math.max(0, Number(invoice.total || 0) - Number(invoice.paid || 0));
  }
  return Math.max(0, Number(calculateTotals(invoice).balance) || 0);
};

export const payableInvoices = (invoices = [], calculateTotals) => invoices.filter(
  (row) => row.kind === 'invoice' &&
    ['finalized', 'issued', 'partially paid', 'overdue'].includes(String(row.status || '').toLowerCase()) &&
    invoiceOutstanding(row, calculateTotals) > 0
);

export const makePaymentPayload = (form, selectedInvoice, outstanding, mockMode = false) => {
  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error('Enter a valid payment amount greater than zero.');
  if (Math.abs(Math.round(amount * 100) / 100 - amount) > 0.000001)
    throw new Error('Payment amount cannot contain more than two decimal places.');
  if (!form.date) throw new Error('Payment date is required.');
  const base = {
    date: form.date,
    amount: amount.toFixed(2),
    method: form.method,
    reference: String(form.reference || '').trim(),
    status: 'Completed',
    ...(form.accountId ? { account: form.accountId } : {}),
    ...(form.requestKey ? { idempotency_key: form.requestKey } : {}),
  };

  if (form.direction === 'OUT') {
    if (mockMode) throw new Error('Outgoing payments require the live backend API.');
    if (!form.accountId) throw new Error('Choose the account to debit.');
    if (!String(form.category || '').trim()) throw new Error('Enter a payment category.');
    return {
      ...base,
      direction: 'OUT',
      category: String(form.category).trim(),
      notes: String(form.notes || '').trim(),
    };
  }
  if (form.receiptKind === 'advance') {
    if (mockMode) throw new Error('Customer advances require the live backend API.');
    if (!form.customerId) throw new Error('Select an existing customer for the advance.');
    if (!form.accountId) throw new Error('Choose the receiving cash/UPI/bank account.');
    if (!form.requestKey) throw new Error('The advance request must have a unique receipt key.');
    return {
      ...base,
      direction: 'IN',
      customer: form.customerId,
      invoice: null,
      category: 'Customer Advance',
      notes: String(form.notes || '').trim(),
    };
  }
  if (!selectedInvoice) throw new Error('Select an invoice with an outstanding balance.');
  if (amount > outstanding + 0.000001)
    throw new Error('Amount exceeds the outstanding invoice balance.');
  if (!mockMode && !selectedInvoice.customerId)
    throw new Error('Invoice has no linked customer ID. Check its customer record.');
  if (!mockMode && !form.accountId)
    throw new Error('Choose the receiving cash/UPI/bank account.');

  return mockMode
    ? { ...base, customer: selectedInvoice.customer?.name || selectedInvoice.customerName || 'Customer',
        invoice: selectedInvoice.number || selectedInvoice.id }
    : { ...base, ...(form.direction ? { direction: 'IN' } : {}), customer: selectedInvoice.customerId, invoice: selectedInvoice.id };
};
