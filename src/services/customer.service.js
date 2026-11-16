import { USE_MOCK_API } from '../api/apiConfig';
import { API_ENDPOINTS } from '../api/endpoints';
import apiClient from '../api/apiClient';
import {
  getMockCustomers,
  getMockCustomerById,
  addMockCustomer,
  updateMockCustomer,
  archiveMockCustomer,
  checkDuplicateMockCustomer
} from '../mock/customers.mock';
import { getMockJobs } from '../mock/jobs.mock';
import { getMockVehicles } from '../mock/vehicles.mock';

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

// Match the Django CustomerSerializer fields for every entry point
// (directory modal, add page and customer profile) without dropping GSTIN.
const toCustomerPayload = (data = {}) => {
  const payload = { ...data };
  if (Object.prototype.hasOwnProperty.call(payload, 'gstNo')) {
    payload.gstin = payload.gstNo;
    delete payload.gstNo;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'customerType')) {
    const value = String(payload.customerType || '').toLowerCase();
    payload.customerType = value === 'individual' ? 'individual' : 'business';
  }
  // Single customer Phone is also the saved manual WhatsApp contact.
  // Never start an automatic notification or copy an old, separate number.
  // Partial updates without a phone must preserve the existing number.
  if (Object.prototype.hasOwnProperty.call(payload, 'phone')) {
    payload.whatsapp = String(payload.phone || '').trim();
  }
  // Messaging is managed by the separate consent/integration workflow.
  delete payload.sendWhatsappUpdate;
  return payload;
};

export const getCustomers = async (params = {}) => {
  if (USE_MOCK_API) {
    await delay();
    let result = getMockCustomers();
    
    if (params.search) {
      const q = params.search.toLowerCase();
      result = result.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.email && c.email.toLowerCase().includes(q)) || 
        (c.phone && c.phone.includes(q)) ||
        (c.whatsapp && c.whatsapp.includes(q)) ||
        (c.companyName && c.companyName.toLowerCase().includes(q))
      );
    }

    if (params.status && params.status !== 'All') {
      result = result.filter(c => c.status?.toLowerCase() === params.status.toLowerCase());
    }

    if (params.branch && params.branch !== 'All') {
      result = result.filter(c => c.branch === params.branch);
    }

    if (params.customerType && params.customerType !== 'All') {
      result = result.filter(c => c.customerType === params.customerType);
    }

    return Promise.resolve(result);
  }
  return apiClient.get(API_ENDPOINTS.CUSTOMERS, { params });
};

/** One tenant-scoped directory aggregate; the server masks counts and money by role.
 * Never calculate financial totals from unverified job history or cash receipts.
 */
export const getCustomerDirectorySummary = async () => {
  if (USE_MOCK_API) return null;
  return apiClient.get(`${API_ENDPOINTS.CUSTOMERS}/directory-summary`);
};

/** Tenant-scoped options, authorized by customers.view on Django. */
export const getCustomerBranches = async () => {
  if (USE_MOCK_API) return [];
  const rows = await apiClient.get(`${API_ENDPOINTS.CUSTOMERS}/branch-options`);
  return Array.isArray(rows) ? rows : [];
};

export const getCustomerById = async (id) => {
  if (USE_MOCK_API) {
    await delay();
    return Promise.resolve(getMockCustomerById(id));
  }
  return apiClient.get(`${API_ENDPOINTS.CUSTOMERS}/${id}`);
};

export const createCustomer = async (data) => {
  if (USE_MOCK_API) {
    await delay();
    return Promise.resolve(addMockCustomer(data));
  }
  return apiClient.post(API_ENDPOINTS.CUSTOMERS, toCustomerPayload(data));
};

export const updateCustomer = async (id, data) => {
  if (USE_MOCK_API) {
    await delay();
    return Promise.resolve(updateMockCustomer(id, data));
  }
  return apiClient.patch(`${API_ENDPOINTS.CUSTOMERS}/${id}`, toCustomerPayload(data));
};

export const restoreCustomer = async (id) => {
  if (USE_MOCK_API) {
    await delay();
    return updateMockCustomer(id, { status: 'active' });
  }
  return apiClient.post(`${API_ENDPOINTS.CUSTOMERS}/${id}/restore`, {});
};

export const archiveCustomer = async (id) => {
  if (USE_MOCK_API) {
    await delay();
    return Promise.resolve(archiveMockCustomer(id));
  }
  return apiClient.patch(`${API_ENDPOINTS.CUSTOMERS}/${id}/archive`);
};

export const checkDuplicateCustomer = async (payload) => {
  if (USE_MOCK_API) {
    await delay(100);
    return Promise.resolve(checkDuplicateMockCustomer(payload));
  }
  const result = await apiClient.post(`${API_ENDPOINTS.CUSTOMERS}/check-duplicate`, payload);
  // The Django response is { duplicate: boolean, customer: object|null }.
  // Returning the response envelope itself incorrectly marks every creation
  // as a duplicate, including { duplicate: false, customer: null }.
  return result?.duplicate === true && result?.customer?.id ? result.customer : null;
};

export const getCustomerVehicles = async (customerId) => {
  if (USE_MOCK_API) {
    await delay();

    // Prefer the real vehicle master linked to this customer.
    const masterVehicles = getMockVehicles()
      .filter((vehicle) => String(vehicle.customerId) === String(customerId))
      .map((vehicle) => ({
        id: vehicle.id,
        regNo: vehicle.licensePlate || '',
        makeModel: [vehicle.make, vehicle.model].filter(Boolean).join(' '),
        vehicleType: vehicle.vehicleType || 'Car / SUV',
        fuelType: vehicle.fuelType || vehicle.engineType || '',
        transmission: vehicle.transmission || '',
        year: vehicle.year || '',
        color: vehicle.color || '',
        vin: vehicle.vin || '',
        kilometres: vehicle.kilometres || '',
        lastService: vehicle.lastServiceDate || ''
      }));

    if (masterVehicles.length) return masterVehicles;

    // Fall back to vehicle information captured in previous job cards.
    const jobs = getMockJobs().filter((job) => String(job.customerId) === String(customerId));
    const vehicleMap = {};

    jobs.forEach((job) => {
      if (job.vehicleReg && !vehicleMap[job.vehicleReg]) {
        vehicleMap[job.vehicleReg] = {
          id: job.vehicleId || `JOB-VEH-${job.vehicleReg}`,
          regNo: job.vehicleReg,
          makeModel: job.vehicleInfo || '',
          vehicleType: 'Car / SUV',
          fuelType: '',
          transmission: '',
          year: '',
          color: '',
          vin: job.vin || '',
          kilometres: job.kilometre || '',
          lastService: job.createdDate || ''
        };
      }
    });

    return Object.values(vehicleMap);
  }

  return apiClient.get(`${API_ENDPOINTS.CUSTOMERS}/${customerId}/vehicles`);
};

export const getCustomerJobs = async (customerId) => {
  if (USE_MOCK_API) {
    await delay();
    const jobs = getMockJobs().filter(j => j.customerId === customerId || j.customerName?.toLowerCase().includes('rahul'));
    return Promise.resolve(jobs);
  }
  return apiClient.get(`${API_ENDPOINTS.CUSTOMERS}/${customerId}/jobs`);
};

export const getCustomerInvoices = async (customerId) => {
  if (USE_MOCK_API) {
    await delay();
    const jobs = getMockJobs().filter(j => j.customerId === customerId || j.customerName?.toLowerCase().includes('rahul'));
    const invoices = jobs.map(j => ({
      invoiceNo: j.billing?.invoiceNumber || `INV-2026-${j.id.split('-')[1]}`,
      jobId: j.id,
      jobNumber: j.jobNumber,
      vehicle: j.vehicleReg,
      date: j.createdDate,
      totalAmount: j.billing?.invoiceTotal || 12500,
      paidAmount: j.billing?.paidAmount || 3000,
      balanceDue: j.billing?.outstandingBalance || 9500,
      status: j.paymentStatus || 'Partially Paid'
    }));
    return Promise.resolve(invoices);
  }
  return apiClient.get(`${API_ENDPOINTS.CUSTOMERS}/${customerId}/invoices`);
};

export const getCustomerPayments = async (customerId) => {
  if (USE_MOCK_API) {
    await delay();
    return Promise.resolve([
      {
        id: "PAY-901",
        date: "2026-09-14",
        invoiceNo: "INV-2026-092",
        method: "UPI / QR",
        amount: 3000,
        reference: "UPI/908123/APEX",
        recordedBy: "Rajesh V"
      }
    ]);
  }
  return apiClient.get(`${API_ENDPOINTS.CUSTOMERS}/${customerId}/payments`);
};

export const getCustomerActivity = async (customerId) => {
  if (USE_MOCK_API) {
    await delay();
    return Promise.resolve([
      { time: "2026-09-14 09:10 AM", type: "Job Created", desc: "Job Card JOB-00251 created for Toyota Innova 2.5V" },
      { time: "2026-09-14 10:50 AM", type: "Estimate Approved", desc: "Customer approved Estimate V1 (₹12,500) via WhatsApp" },
      { time: "2026-09-14 11:30 AM", type: "Payment Recorded", desc: "Advance payment of ₹3,000 received via UPI" },
      { time: "2026-01-15", type: "Customer Created", desc: "Customer profile created at Main Garage Branch" }
    ]);
  }
  return apiClient.get(`${API_ENDPOINTS.CUSTOMERS}/${customerId}/activity`);
};

export const addCustomerVehicle = async (customerId, payload) => {
  if (USE_MOCK_API) {
    await delay();
    const newVehicle = {
      id: `VEH-${Date.now()}`,
      regNo: payload.regNo,
      makeModel: `${payload.make || ''} ${payload.model || ''}`.trim(),
      vehicleType: payload.vehicleType || 'Car',
      fuelType: payload.fuelType || 'Petrol',
      transmission: payload.transmission || 'Manual',
      year: payload.year || '2022',
      color: payload.color || 'White',
      vin: payload.vin || 'VIN12345678',
      kilometres: payload.kilometres || '0 km',
      lastService: new Date().toISOString().split('T')[0]
    };
    return Promise.resolve(newVehicle);
  }
  return apiClient.post(`${API_ENDPOINTS.CUSTOMERS}/${customerId}/vehicles`, payload);
};

export const customerService = {
  getCustomers, getCustomerDirectorySummary, getCustomerBranches,
  getCustomerById,
  createCustomer,
  updateCustomer,
  archiveCustomer,
  restoreCustomer,
  checkDuplicateCustomer,
  getCustomerVehicles,
  getCustomerJobs,
  getCustomerInvoices,
  getCustomerPayments,
  getCustomerActivity,
  addCustomerVehicle,
  // Backward compatibility
  getAll: getCustomers,
  getById: getCustomerById,
  create: createCustomer,
  update: updateCustomer,
  delete: archiveCustomer
};
