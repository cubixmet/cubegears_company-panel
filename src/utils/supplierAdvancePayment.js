import { FINANCE_CHANNELS, defaultFinanceAccountId } from './financeCashBank.js';

export const advanceAmountError = value => {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    return 'Enter a valid advance amount (up to two decimal places).';
  }
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return 'Advance must be greater than ₹0.';
  if (amount > 9999999999.99) return 'Advance amount is too large.';
  return '';
};

export const validateSupplierAdvance = ({ amount, channel, accounts, accountsReady = true }) => {
  const error = advanceAmountError(amount);
  if (error) return { error, account: null };
  if (!FINANCE_CHANNELS.includes(channel)) {
    return { error: 'Choose Cash in Hand or Bank / UPI.', account: null };
  }
  if (!accountsReady) {
    return { error: 'Finance accounts are not loaded. Refresh accounts before submitting.', account: null };
  }
  const accountId = defaultFinanceAccountId(accounts, channel);
  const account = (Array.isArray(accounts) ? accounts : []).find(row => String(row.id) === accountId);
  if (!account) {
    return { error: 'Set an active Default Payment Account for ' + channel +
      ' in Finance > Accounts.', account: null };
  }
  if (account.recordedBalance != null && Number(account.recordedBalance) < Number(amount)) {
    return { error: 'Insufficient recorded balance in ' + account.name + '.', account };
  }
  return { error: '', account };
};

export const supplierAdvancePayload = ({ supplierId, amount, channel, date, reference, requestKey }) => ({
  supplierId,
  amount: Number(amount).toFixed(2),
  kind: 'Advance',
  method: channel,
  paidOn: date,
  reference: String(reference || '').trim(),
  idempotencyKey: requestKey,
  allocations: [],
});
