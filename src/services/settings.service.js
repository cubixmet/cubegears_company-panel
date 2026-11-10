import { USE_MOCK_API } from '../api/apiConfig';
import { API_ENDPOINTS } from '../api/endpoints';
import apiClient from '../api/apiClient';

const COMPANY_EDITABLE_SETTINGS = new Set([
  'name', 'phone', 'email', 'gstNo', 'address',
  'currency', 'timezone', 'dateFormat',
]);

const editablePayload = (category, data) => {
  if (category !== 'company') return data;
  // GET /settings/company contains the read-only company.logo URL.
  // It must never be echoed back into the settings PUT payload.
  return Object.fromEntries(
    Object.entries(data || {}).filter(([key]) => COMPANY_EDITABLE_SETTINGS.has(key)),
  );
};

const STORAGE_KEY = 'cubixgear:settings';
const defaults = {
  company: { name: 'CubixGear Garage', phone: '9876543210', email: 'admin@cubixgear.com', gstNo: '', address: '', currency: 'INR', timezone: 'Asia/Kolkata', dateFormat: 'DD/MM/YYYY' },
  operations: { workingStart: '09:00', workingEnd: '18:30', bookingSlotMinutes: 30, bookingCapacity: 4, jobPrefix: 'JOB-', deliveryCreditAllowed: false },
  billing: { invoicePrefix: 'INV-', defaultTaxRate: 18, paymentTermsDays: 0, rounding: true },
  inventory: { defaultMinimumStock: 5, defaultReorderQty: 10, lowStockAlerts: true, negativeStock: false },
  attendance: { graceMinutes: 15, overtimeAfterMinutes: 540, locationRequired: false, correctionApproval: true },
  payroll: { payrollDay: 30, overtimeMultiplier: 1.5, managerApproval: true },
  notifications: { jobCreated: true, jobAssigned: true, jobStatus: true, jobReady: true, lowStock: true, overdueInvoice: true, leaveDecision: true, email: false, whatsapp: false, browserPush: true },
  security: { sessionHours: 12, requireStrongPassword: true, auditExports: true, twoFactor: false },
  integrations: { razorpayEnabled: false, whatsappEnabled: false, emailEnabled: false, webhookUrl: '' }
};

const readMock = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { ...value, ...(saved[key] || {}) }]));
  } catch {
    return structuredClone(defaults);
  }
};

const writeMock = (all) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return all;
};

export const getSettings = async (category = 'company') => {
  if (USE_MOCK_API) return readMock()[category] || {};
  return apiClient.get(`${API_ENDPOINTS.SETTINGS}/${category}`);
};

export const getAllSettings = async () => {
  if (USE_MOCK_API) return readMock();
  return apiClient.get(API_ENDPOINTS.SETTINGS);
};

export const updateSettings = async (category, data) => {
  const payload = editablePayload(category, data);
  if (USE_MOCK_API) {
    const all = readMock();
    all[category] = { ...(all[category] || {}), ...payload };
    writeMock(all);
    return all[category];
  }
  return apiClient.put(`${API_ENDPOINTS.SETTINGS}/${category}`, payload);
};


/** Upload a real image to Django's existing Company.logo_image ImageField.
 * No application-side file size cap: backend/infrastructure limits still apply. */
export const uploadCompanyLogo = async (file) => {
  if (!file) throw new Error('Choose a logo image.');
  if (USE_MOCK_API) throw new Error('Company logo upload requires the Django backend.');
  const body = new FormData();
  body.append('logo_image', file, file.name);
  // Let the browser set multipart/form-data and its boundary automatically.
  return apiClient.patch('/company/me', body, { headers: { 'Content-Type': undefined } });
};

/** Private image streaming: does not expose a raw public media URL. */
export const getCompanyLogo = async () => {
  if (USE_MOCK_API) return null;
  return apiClient.get('/company/logo', { responseType: 'blob' });
};

export const settingsService = {
  getSettings, getAllSettings, updateSettings,
  uploadCompanyLogo, getCompanyLogo,
};

