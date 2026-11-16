import { USE_MOCK_API } from '../api/apiConfig';
import apiClient from '../api/apiClient';
import { STARTER_VEHICLE_CATALOG, mergeVehicleCatalog } from '../utils/vehicleCatalog';

// Demo-only persistence for VITE_USE_MOCK_API=true. Real workshops are always
// written to the company-isolated Django database through the catalog API.
const mockKey = () => {
  let company = 'demo';
  try {
    const auth = JSON.parse(localStorage.getItem('auth_user') || 'null');
    company = auth?.companyId || auth?.company?.id || 'demo';
  } catch { /* malformed mock auth */ }
  return `cubixgear:mock:vehicle-catalog:${company}`;
};

const mockEntries = () => {
  try {
    const value = JSON.parse(localStorage.getItem(mockKey()) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export const vehicleCatalogService = {
  async getCatalog() {
    if (USE_MOCK_API) {
      return { makes: mergeVehicleCatalog(STARTER_VEHICLE_CATALOG, mockEntries()) };
    }
    return apiClient.get('/vehicle-catalog');
  },

  async addEntry(make, model = '') {
    if (USE_MOCK_API) {
      const entry = { make, models: model ? [model] : [] };
      const next = mergeVehicleCatalog(mockEntries(), [entry]);
      localStorage.setItem(mockKey(), JSON.stringify(next));
      return { make, model, created: true, demoOnly: true };
    }
    return apiClient.post('/vehicle-catalog', { make, model });
  },
};
