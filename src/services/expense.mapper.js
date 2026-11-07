// Translate between the workshop UI and Django REST's snake_case Expense model.
// Keep the functions side-effect free so they can be tested without a browser.
export const localDate = (value = new Date()) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Django stores one description field. Keep the first paragraph as the
// expense title and subsequent paragraphs as optional notes, avoiding silent
// loss of notes until the backend gains a dedicated field.
export const splitDescription = (description = '') => {
  const text = String(description || '');
  const index = text.indexOf('\n\n');
  return index === -1
    ? { title: text, notes: '' }
    : { title: text.slice(0, index), notes: text.slice(index + 2) };
};

export const normalizeExpense = (row = {}) => {
  const parsed = splitDescription(row.description);
  const rawReceipt = row.receiptUrl || row.attachment || '';
  const receiptUrl = /^https?:\/\//i.test(rawReceipt) ? rawReceipt : '';
  return {
    ...row,
    title: row.title || parsed.title || row.category || 'Workshop Expense',
    notes: row.notes ?? parsed.notes,
    category: row.category || 'Miscellaneous',
    amount: Number(row.amount ?? 0),
    expenseDate: row.expenseDate || row.date || '',
    vendor: row.vendor || '',
    paymentMethod: row.paymentMethod || row.payment_method || 'Cash',
    referenceNo: row.referenceNo || row.reference || '',
    taxAmount: Number(row.taxAmount ?? row.tax ?? 0),
    receiptUrl,
    status: String(row.status || 'unpaid').toLowerCase(),
    accountId: row.accountId || row.account || '',
    paidAmount: Number(row.paidAmount ?? 0),
    balanceDue: Number(row.balanceDue ?? row.amount ?? 0),
  };
};

export const expenseToApiPayload = (values = {}) => {
  const title = String(values.title || '').trim();
  const notes = String(values.notes || '').trim();
  const amount = Number(values.amount);
  const tax = Number(values.taxAmount || 0);
  const expenseDate = String(values.expenseDate || '').trim();
  const receiptUrl = String(values.receiptUrl || '').trim();

  if (!title) throw new Error('Enter an expense title.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) throw new Error('Choose a valid expense date.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Expense amount must be greater than zero.');
  if (!Number.isFinite(tax) || tax < 0) throw new Error('Tax amount cannot be negative.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(values.amount).trim()) ||
      (String(values.taxAmount || '').trim() && !/^\d+(?:\.\d{1,2})?$/.test(String(values.taxAmount).trim()))) {
    throw new Error('Enter amounts with no more than two decimal places.');
  }
  if (receiptUrl && !/^https?:\/\/\S+$/i.test(receiptUrl)) {
    throw new Error('Receipt link must start with https:// or http://.');
  }

  return {
    date: expenseDate,
    category: values.category || 'Miscellaneous',
    vendor: String(values.vendor || '').trim(),
    description: notes ? `${title}\n\n${notes}` : title,
    amount: amount.toFixed(2),
    tax: tax.toFixed(2),
    payment_method: values.paymentMethod || 'Cash',
    reference: String(values.referenceNo || '').trim(),
    attachment: receiptUrl,
    status: values.status || 'approved',
    ...(values.accountId ? { account: values.accountId } : {}),
    ...(values.requestKey ? { idempotencyKey: values.requestKey } : {}),
  };
};
