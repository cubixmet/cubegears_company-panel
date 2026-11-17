export function stockProductRoute(itemId, branchId, search) {
  const params = new URLSearchParams(search);
  params.delete('product');
  params.delete('productBranch');
  if (branchId) params.set('branch', branchId);
  else params.delete('branch');

  return {
    pathname: '/stock/products/' + encodeURIComponent(itemId),
    search: params.toString(),
  };
}
