/** Display-only product browsing. Never change catalogue stock or money. */
export const supplierProductStockQuantity = item => {
  const raw = item?.onHand ?? item?.on_hand ?? null;
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : null;
};

export const supplierProductStockStatus = item => {
  const quantity = supplierProductStockQuantity(item);
  return quantity === null ? 'unknown' : quantity > 0 ? 'in' : 'out';
};

const productName = item => String(item?.partName || item?.name || '').trim();

export const supplierProductStockSummary = items => {
  const result = { in: 0, out: 0, unknown: 0 };
  for (const item of Array.isArray(items) ? items : []) {
    result[supplierProductStockStatus(item)] += 1;
  }
  return result;
};

export const arrangeSupplierProducts = (items, availability = 'all', sort = 'name') =>
  (Array.isArray(items) ? items : [])
    .filter(item => availability === 'all' || supplierProductStockStatus(item) === availability)
    .slice()
    .sort((a, b) => {
      if (sort === 'stock') {
        const aStock = supplierProductStockQuantity(a);
        const bStock = supplierProductStockQuantity(b);
        if (aStock === null && bStock !== null) return 1;
        if (bStock === null && aStock !== null) return -1;
        if (aStock !== null && bStock !== null && aStock !== bStock) return aStock - bStock;
      }
      return productName(a).localeCompare(productName(b), undefined, { sensitivity: 'base', numeric: true })
        || String(a?.id || '').localeCompare(String(b?.id || ''));
    });
