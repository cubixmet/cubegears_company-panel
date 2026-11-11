import apiClient from '../api/apiClient';
import { USE_MOCK_API } from '../api/apiConfig';
import { stockService } from './stock.service';
import { stockMockItems, stockSuppliersMock } from '../mock/stock.mock';

// Small catalogue adapter shared by Simple Stock and Inventory.
// Advanced management screens and their mock fixtures are removed.
const rows = (value) => Array.isArray(value) ? value : (value?.results || []);
const number = (value) => Number(value) || 0;

const toPart = (item) => ({
  ...item,
  partName: item.partName || item.name || '',
  partNumber: item.partNumber ?? item.part_number ?? '',
  onHand: number(item.onHand),
  reserved: number(item.reserved),
  branchOnHand: number(item.branchOnHand ?? item.onHand),
  branchAvailable: number(item.branchAvailable ?? item.available ?? (number(item.onHand) - number(item.reserved))),
  available: number(item.branchAvailable ?? item.available ?? (number(item.onHand) - number(item.reserved))),
  costPrice: number(item.costPrice ?? item.cost),
  sellingPrice: number(item.sellingPrice ?? item.price),
  tax: number(item.tax),
  zeroTaxClassification: item.zeroTaxClassification || item.gst_zero_classification || '',
  hsnCode: item.hsnCode || item.hsn_code || '',
  minimumStock: number(item.minimumStock ?? item.minimum),
});

const mockCategories = () => [...new Set(stockMockItems.map((item) => item.category).filter(Boolean))]
  .map((name) => ({ id: name, name }));

const resolveCategoryId = async (value) => {
  if (!value) return null;
  const categories = rows(await apiClient.get('/stock/categories'));
  return categories.find((item) =>
    String(item.id) === String(value) ||
    item.name?.toLowerCase() === String(value).toLowerCase()
  )?.id || null;
};

const resolveSupplierId = async (value) => {
  if (!value) return null;
  const suppliers = rows(await apiClient.get('/stock/suppliers'));
  return suppliers.find((item) =>
    String(item.id) === String(value) ||
    item.name?.toLowerCase() === String(value).toLowerCase()
  )?.id || null;
};

const productPayload = async (payload, { creating = false } = {}) => {
  const part = {
    partName: payload.partName || payload.name || '',
    ...(payload.sku?.trim() ? { sku: payload.sku.trim() } : {}),
    partNumber: payload.partNumber?.trim() || '',
    barcode: payload.barcode || '',
    brand: payload.brand || '',
    category: await resolveCategoryId(payload.category),
    unit: payload.unit || 'Piece',
    costPrice: number(payload.costPrice ?? payload.cost),
    sellingPrice: number(payload.sellingPrice ?? payload.price),
    minimumStock: number(payload.minimumStock ?? payload.minimum),
    reorderLevel: number(payload.reorderLevel ?? payload.minimumStock ?? payload.minimum),
    compatibleVehicle: payload.compatibleVehicle || 'Universal',
    location: payload.location || payload.rack || '',
    supplier: await resolveSupplierId(payload.supplier),
    tax: number(payload.tax),
    zeroTaxClassification: number(payload.tax) === 0 ? (payload.zeroTaxClassification || '') : '',
    hsnCode: payload.hsnCode || '',
    status: payload.status || 'Active',
  };
  // Quantity may only change through recorded stock movements.
  if (creating) {
    // An initial quantity is recorded atomically by StockItemViewSet.perform_create.
    // This is opening stock, NOT a supplier purchase bill or payable.
    part.onHand = number(payload.stockQuantity);
    part.reserved = 0;
  }
  return part;
};

export const stockCatalogService = {
  getItems: async (search = '') => {
    const items = await stockService.getStockItems(search ? { search } : {});
    return rows(items).map(toPart);
  },
  getItem: async (id) => {
    const item = await stockService.getStockItemById(id);
    return item ? toPart(item) : null;
  },
  createItem: async (payload) => {
    if (USE_MOCK_API) {
      if (!payload.partName?.trim()) {
        throw new Error('Part Name is required.');
      }
      let sku = payload.sku?.trim() || '';
      if (!sku) {
        let next = 1;
        do { sku = 'CG-PRT-' + String(next++).padStart(6, '0'); }
        while (stockMockItems.some((item) => item.sku?.toLowerCase() === sku.toLowerCase()));
      }
      if (stockMockItems.some((item) => item.sku?.toLowerCase() === sku.toLowerCase())) {
        throw new Error('A part with this SKU already exists.');
      }
      const item = {
        id: 'STK-' + Date.now(),
        partName: payload.partName.trim(),
        sku,
        partNumber: payload.partNumber?.trim() || '',
        brand: payload.brand || '',
        supplier: payload.supplier || null,
        category: payload.category || '',
        unit: payload.unit || 'Piece',
        onHand: number(payload.stockQuantity),
        reserved: 0,
        costPrice: number(payload.costPrice),
        sellingPrice: number(payload.sellingPrice),
        tax: number(payload.tax),
        zeroTaxClassification: number(payload.tax) === 0 ? (payload.zeroTaxClassification || '') : '',
        hsnCode: payload.hsnCode || '',
        minimumStock: number(payload.minimumStock),
        location: payload.location || '',
        status: 'Active',
      };
      stockMockItems.unshift(item);
      return toPart(item);
    }
    const part = await apiClient.post('/stock', await productPayload(payload, { creating: true }));
    return toPart(part);
  },
  updateItem: async (id, payload) => {
    if (USE_MOCK_API) {
      const item = stockMockItems.find((entry) => String(entry.id) === String(id));
      if (!item) throw new Error('Part not found.');
      const { onHand, reserved, available, ...changes } = payload;
      Object.assign(item, changes);
      return toPart(item);
    }
    const part = await apiClient.patch('/stock/' + id, await productPayload(payload));
    return toPart(part);
  },
  deleteItem: async (id) => {
    if (USE_MOCK_API) {
      const index = stockMockItems.findIndex((item) => String(item.id) === String(id));
      if (index < 0) throw new Error('Part not found.');
      stockMockItems.splice(index, 1);
      return;
    }
    return apiClient.delete('/stock/' + id);
  },
  getRackLocations: async (search = '') => {
    if (USE_MOCK_API) {
      return [...new Set(stockMockItems.map((item) => (item.location || item.rack || '').trim())
        .filter(Boolean))].filter((rack) => rack.toLowerCase().includes(search.toLowerCase()));
    }
    return rows(await apiClient.get('/stock/items/rack-locations', { params: { q: search } }));
  },
  getCategories: async () => USE_MOCK_API ? mockCategories() : rows(await apiClient.get('/stock/categories')),
  getSuppliers: async () => USE_MOCK_API ? [...stockSuppliersMock] : rows(await apiClient.get('/stock/suppliers')),
  getStockDashboard: stockService.getStockDashboard,
  getLedger: stockService.getMovementLedger,
  stockIn: stockService.receiveStock,
  stockOut: stockService.issueStock,
};

export default stockCatalogService;
