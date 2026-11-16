// Finance presents only two payment channels. Historical UPI/Wallet records
// remain bank-linked digital accounts; no account or ledger entry is migrated.
export const FINANCE_CHANNELS = Object.freeze(['Cash', 'Bank']);
export const accountChannel = kind => String(kind || '').trim().toLowerCase() === 'cash'
  ? 'Cash' : ['bank', 'upi', 'wallet'].includes(String(kind || '').trim().toLowerCase())
    ? 'Bank' : null;
export const isFinanceAccount = account => Boolean(account && account.isActive !== false &&
  accountChannel(account.kind));

export const financeAccountsForChannel = (accounts, channel) =>
  (Array.isArray(accounts) ? accounts : []).filter(account =>
    isFinanceAccount(account) && accountChannel(account.kind) === channel
  );

/** Default source for a supplier payment channel.
 * Finance's explicit preferred account wins; a sole active account is safe
 * to infer. Never guess among several Bank/UPI accounts.
 */
export const defaultFinanceAccountId = (accounts, channel) => {
  const matching = financeAccountsForChannel(accounts, channel);
  const preferred = matching.filter(account => account.isDefaultPayment === true);
  if (preferred.length === 1) return String(preferred[0].id);
  if (preferred.length > 1) return '';
  if (matching.length === 1) return String(matching[0].id);
  return '';

};

export const assertFinanceAccount = (accounts, accountId, channel) => {
  if (!FINANCE_CHANNELS.includes(channel)) throw new Error('Choose Cash or Bank.');
  const match = (Array.isArray(accounts) ? accounts : []).find(
    item => String(item.id) === String(accountId)
  );
  if (!match || !isFinanceAccount(match)) throw new Error('Choose an active Cash or Bank account.');
  if (accountChannel(match.kind) !== channel) {
    throw new Error('The selected account does not match the Cash / Bank payment method.');
  }
  return match;
};

// The selected payment method is a channel, not a GST classification.
// GST belongs to the taxable invoice or purchase line; settling a bill never
// recalculates, charges or posts GST a second time.
