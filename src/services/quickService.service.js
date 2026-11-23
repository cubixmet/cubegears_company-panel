import apiClient from '../api/apiClient';

const base = '/invoices/quick-services';

export const quickService = {
  list: () => apiClient.get(base),
  start: (payload) => apiClient.post(base, payload),
  preview: (id, payload = {}) => apiClient.post(`${base}/${id}/preview`, Array.isArray(payload) ? { items: payload } : payload),
  close: (id, payload) => apiClient.post(`${base}/${id}/close`, payload),
};
