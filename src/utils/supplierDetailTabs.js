/** Browser-hash tab deep links for a single supplier workspace. */
export const SUPPLIER_TAB_HASHES = Object.freeze({
  overview: '#supplier-profile',
  purchase: '#supplier-purchase-form',
  payments: '#supplier-pay-now',
  products: '#supplier-products',
  accounts: '#supplier-ledger',
  returns: '#supplier-returns',
});

export const supplierTabForHash = hash => {
  if (hash === '#supplier-purchase-form') return 'purchase';
  if (hash === '#supplier-pay-now') return 'payments';
  if (hash === '#supplier-products') return 'products';
  if (hash === '#supplier-ledger' || hash === '#supplier-transactions') return 'accounts';
  if (hash === '#supplier-returns') return 'returns';
  return 'overview';
};

export const allowedSupplierTab = (hash, tabs = []) => {
  const selected = supplierTabForHash(hash);
  return tabs.some(tab => tab.key === selected) ? selected : 'overview';
};
