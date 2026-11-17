export const isStockProductId = (value) => /^[A-Za-z0-9_-]{1,80}$/.test(value || '');

export function stockProductLocation(id, search, branchId) {
  const params = new URLSearchParams(search);
  params.delete('product');
  if (branchId) params.set('productBranch', branchId);
  else params.delete('productBranch');
  return { pathname: `/stock/products/${encodeURIComponent(id)}`, search: params.toString() };
}

export function stockInventoryLocation(search) {
  const params = new URLSearchParams(search);
  const hash = params.has('productBranch') ? '#branch-stock' : '#parts-products';
  params.delete('product');
  params.delete('productBranch');
  return { pathname: '/stock', search: params.toString(), hash };
}
