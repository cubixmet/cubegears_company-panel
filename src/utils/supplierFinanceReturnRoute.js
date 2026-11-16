/** Safe in-app return flow for configuring a supplier's Finance debit source. */
const SUPPLIER_RETURN_PATH = /^\/suppliers\/[0-9a-f-]{36}(?:\?[^#]*)?#supplier-(?:pay-now|ledger)$/i;
const SUPPLIER_ROUTE = /^\/suppliers\/[0-9a-f-]{36}$/i;

export function supplierFinanceSetupRoute(location, channel = 'Bank', returnHash = '#supplier-pay-now') {
  const pathname = String(location?.pathname || '');
  const route = SUPPLIER_ROUTE.test(pathname) ? pathname : '/suppliers';
  const query = String(location?.search || '');
  const returnTo = route === '/suppliers'
    ? ''
    : route + query + (returnHash === '#supplier-ledger' ? returnHash : '#supplier-pay-now');
  const params = new URLSearchParams();
  if (returnTo) params.set('returnTo', returnTo);
  params.set('channel', channel === 'Cash' ? 'Cash' : 'Bank');
  return '/finance/accounts?' + params.toString();
}

export function supplierFinanceReturnContext(search) {
  const params = new URLSearchParams(String(search || ''));
  const requestedReturn = params.get('returnTo') || '';
  return {
    returnTo: SUPPLIER_RETURN_PATH.test(requestedReturn) ? requestedReturn : '',
    channel: ['Cash', 'Bank'].includes(params.get('channel')) ? params.get('channel') : '',
  };
}

export function matchesFinancePaymentChannel(account, channel) {
  if (!channel) return true;
  if (channel === 'Cash') return account?.kind === 'Cash';
  return ['Bank', 'UPI', 'Wallet'].includes(account?.kind);
}
