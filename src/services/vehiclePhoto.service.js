import apiClient from '../api/apiClient';
import { USE_MOCK_API } from '../api/apiConfig';

const requireBackend = () => {
  if (USE_MOCK_API) throw new Error('Vehicle photo storage requires the Django backend.');
};

export const vehiclePhotoService = {
  listForVehicle: async (vehicleId) => {
    requireBackend();
    return apiClient.get(`/vehicles/${vehicleId}/photos`);
  },
  listForJob: async (jobId) => {
    requireBackend();
    return apiClient.get(`/jobs/${jobId}/inspection-photos`);
  },
  upload: async ({ vehicleId, jobId, file, category, phase, caption, notes, published = false }) => {
    requireBackend();
    if (!file) throw new Error('Capture a vehicle photo first.');
    const body = new FormData();
    body.append('image', file);
    body.append('category', category || 'additional');
    body.append('phase', phase || 'before');
    body.append('caption', caption || '');
    body.append('notes', notes || '');
    body.append('published', published ? 'true' : 'false');
    const endpoint = jobId
      ? `/jobs/${jobId}/inspection-photos`
      : `/vehicles/${vehicleId}/photos`;
    return apiClient.post(endpoint, body, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  setPublished: async (id, published) => {
    requireBackend();
    return apiClient.patch(`/vehicle-photos/${id}`, { published });
  },
  file: async (photoId) => {
    requireBackend();
    return apiClient.get(`/vehicle-photos/${photoId}/file`, { responseType: 'blob' });
  },
};
