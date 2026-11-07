import { USE_MOCK_API } from '../api/apiConfig';
import { API_ENDPOINTS } from '../api/endpoints';
import apiClient from '../api/apiClient';
import {
  getMockVehicles,
  getMockVehicleById,
  addMockVehicle,
  updateMockVehicle,
  deleteMockVehicle
} from '../mock/vehicles.mock';

const delay = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeVehicle = (vehicle = {}) => ({
  ...vehicle,
  id: vehicle.id,
  customerId: vehicle.customerId || '',
  customerName: vehicle.customerName || '',
  registration: vehicle.registration || vehicle.regNo || vehicle.licensePlate || '',
  regNo: vehicle.regNo || vehicle.registration || vehicle.licensePlate || '',
  licensePlate: vehicle.licensePlate || vehicle.regNo || vehicle.registration || '',
  make: vehicle.make || '',
  model: vehicle.model || '',
  variant: vehicle.variant || '',
  year: vehicle.year || '',
  fuelType: vehicle.fuelType || vehicle.fuel || vehicle.engineType || '',
  transmission: vehicle.transmission || '',
  color: vehicle.color || '',
  odometer: vehicle.odometer || vehicle.kilometres || '',
  kilometres: vehicle.kilometres || vehicle.odometer || '',
  vin: vehicle.vin || '',
  engineNo: vehicle.engineNo || '',
  lastServiceDate: vehicle.lastServiceDate || '',
  nextServiceDue: vehicle.nextServiceDue || '',
  insuranceExpiry: vehicle.insuranceExpiry || '',
  notes: vehicle.notes || '',
  status: vehicle.status || 'Active'
});

const toStorageShape = (data = {}) => ({
  ...data,
  licensePlate: data.licensePlate || data.regNo || data.registration || '',
  regNo: data.regNo || data.registration || data.licensePlate || '',
  registration: data.registration || data.regNo || data.licensePlate || '',
  kilometres: data.kilometres || data.odometer || '',
  odometer: data.odometer || data.kilometres || '',
  fuelType: data.fuelType || data.fuel || '',
  status: data.status || 'Active'
});

export const getVehicles = async (params) => {
  if (USE_MOCK_API) {
    await delay();
    let result = getMockVehicles().map(normalizeVehicle);
    if (params?.search) {
      const q = params.search.toLowerCase().replace(/\s+/g, '');
      result = result.filter((vehicle) =>
        [
          vehicle.make,
          vehicle.model,
          vehicle.registration,
          vehicle.vin,
          vehicle.customerName,
          vehicle.customerId
        ].some((value) => String(value || '').toLowerCase().replace(/\s+/g, '').includes(q))
      );
    }
    return result;
  }
  const result = await apiClient.get(API_ENDPOINTS.VEHICLES, { params });
  return Array.isArray(result) ? result.map(normalizeVehicle) : result;
};

export const getVehicleById = async (id) => {
  if (USE_MOCK_API) {
    await delay();
    const vehicle = getMockVehicleById(id);
    return vehicle ? normalizeVehicle(vehicle) : null;
  }
  const result = await apiClient.get(`${API_ENDPOINTS.VEHICLES}/${id}`);
  return normalizeVehicle(result);
};

export const createVehicle = async (data) => {
  const payload = toStorageShape(data);
  if (USE_MOCK_API) {
    await delay();
    return normalizeVehicle(addMockVehicle(payload));
  }
  const result = await apiClient.post(API_ENDPOINTS.VEHICLES, payload);
  return normalizeVehicle(result);
};

export const updateVehicle = async (id, data) => {
  const payload = toStorageShape(data);
  if (USE_MOCK_API) {
    await delay();
    return normalizeVehicle(updateMockVehicle(id, payload));
  }
  const result = await apiClient.patch(`${API_ENDPOINTS.VEHICLES}/${id}`, payload);
  return normalizeVehicle(result);
};

export const restoreVehicle = async (id) => {
  if (USE_MOCK_API) {
    await delay();
    return normalizeVehicle(updateMockVehicle(id, { status: 'Active' }));
  }
  return normalizeVehicle(await apiClient.post(`${API_ENDPOINTS.VEHICLES}/${id}/restore`, {}));
};

// DELETE is explicitly soft-archive on Django; keep the legacy method name
// for callers while preserving historic jobs, invoices and inspection photos.
export const archiveVehicle = async (id) => deleteVehicle(id);

export const deleteVehicle = async (id) => {
  if (USE_MOCK_API) {
    await delay();
    return deleteMockVehicle(id);
  }
  return apiClient.delete(`${API_ENDPOINTS.VEHICLES}/${id}`);
};

export const vehicleService = {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  archiveVehicle,
  restoreVehicle,
  getAll: getVehicles,
  getById: getVehicleById,
  create: createVehicle,
  update: updateVehicle,
  delete: deleteVehicle
};
