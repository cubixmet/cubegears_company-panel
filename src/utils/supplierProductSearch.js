/** Stable helpers shared by supplier stock browsing and purchase forms. */
const searchableValues = item => [
  item?.partName, item?.name, item?.partNumber, item?.part_number,
  item?.sku, item?.barcode, item?.brand, item?.location, item?.rack,
  item?.hsnCode, item?.hsn_code,
];

export const matchesSupplierProduct = (item, query = '') => {
  const term = String(query || '').trim().toLocaleLowerCase();
  return !term || searchableValues(item)
    .some(value => String(value || '').toLocaleLowerCase().includes(term));
};

export const filterSupplierProducts = (items = [], query = '') =>
  (Array.isArray(items) ? items : []).filter(item => matchesSupplierProduct(item, query));

export const purchaseProductOptions = (loaded = [], remote = [], query = '', limit = 60) => {
  const term = String(query || '').trim().toLocaleLowerCase();
  const seen = new Set();
  const all = [...(Array.isArray(remote) ? remote : []),
    ...(Array.isArray(loaded) ? loaded : [])];
  return all.filter(item => {
    const id = String(item?.id || '');
    if (!id || seen.has(id) || !matchesSupplierProduct(item, term)) return false;
    seen.add(id);
    return true;
  }).sort((a, b) => {
    const aName = String(a.partName || a.name || '').toLocaleLowerCase();
    const bName = String(b.partName || b.name || '').toLocaleLowerCase();
    return Number(bName.startsWith(term)) - Number(aName.startsWith(term))
      || aName.localeCompare(bName);
  }).slice(0, Math.max(0, limit));
};
