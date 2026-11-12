import apiClient from '../api/apiClient';
import { USE_MOCK_API } from '../api/apiConfig';
import { API_ENDPOINTS } from '../api/endpoints';

const BILLING_KEY = 'cubixgear-saas-billing';
const STORAGE_KEY = 'cubixgear-saas-storage';

const seedBilling = {
  plan: {
    id: 'growth',
    name: 'Growth Workshop',
    status: 'active',
    billingCycle: 'monthly',
    basePrice: 2499,
    includedStorageGb: 25,
    extraStorageRate: 15,
    includedSeats: 5,
    extraSeatRate: 199,
    nextBillingDate: '2026-10-01'
  },
  usage: {
    storageUsedGb: 18.4,
    seatsUsed: 4
  },
  paymentMethod: {
    type: 'UPI / Card',
    label: 'Primary billing method',
    status: 'ready'
  },
  invoices: [
    { id: 'SUB-INV-2026-009', period: 'September 2026', amount: 2949, status: 'paid', paidAt: '2026-09-01' },
    { id: 'SUB-INV-2026-008', period: 'August 2026', amount: 2949, status: 'paid', paidAt: '2026-08-01' },
    { id: 'SUB-INV-2026-007', period: 'July 2026', amount: 2949, status: 'paid', paidAt: '2026-07-01' }
  ]
};

const seedStorage = {
  quotaGb: 25,
  usedGb: 18.4,
  usedBytes: Math.round(18.4 * 1024 ** 3),
  fileCount: 4,
  quotaBytes: 25 * 1024 ** 3,
  settings: {
    enabled: true,
    autoCompress: true,
    keepOriginals: false,
    allowStaffUpload: true,
    allowStaffDelete: false,
    retentionDays: 0,
    maxFileMb: 20,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
  },
  files: [
    { id: 'MEDIA-1001', name: 'job-2048-front.webp', sizeMb: 3.8, category: 'Job Card', uploadedBy: 'Ajmal', uploadedAt: '2026-09-14T08:42:00Z', type: 'image/webp' },
    { id: 'MEDIA-1002', name: 'vehicle-inspection-2047.jpg', sizeMb: 5.2, category: 'Inspection', uploadedBy: 'Niyas', uploadedAt: '2026-09-13T10:12:00Z', type: 'image/jpeg' },
    { id: 'MEDIA-1003', name: 'invoice-proof-1981.png', sizeMb: 1.6, category: 'Invoice', uploadedBy: 'Admin', uploadedAt: '2026-09-12T06:30:00Z', type: 'image/png' },
    { id: 'MEDIA-1004', name: 'delivery-after-service.jpg', sizeMb: 4.9, category: 'Delivery', uploadedBy: 'Ajmal', uploadedAt: '2026-09-11T14:05:00Z', type: 'image/jpeg' }
  ]
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const read = (key, seed) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    localStorage.removeItem(key);
  }
  localStorage.setItem(key, JSON.stringify(seed));
  return clone(seed);
};

const write = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
  return clone(value);
};

const makeId = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export const calculateMonthlyEstimate = (billing) => {
  if (!billing?.billingDataAvailable && !USE_MOCK_API) return null;
  const { plan, usage } = billing;
  const extraStorageGb = Math.max(0, Number(usage.storageUsedGb || 0) - Number(plan.includedStorageGb || 0));
  const extraSeats = Math.max(0, Number(usage.seatsUsed || 0) - Number(plan.includedSeats || 0));
  const storageCharge = extraStorageGb * Number(plan.extraStorageRate || 0);
  const seatCharge = extraSeats * Number(plan.extraSeatRate || 0);
  const subtotal = Number(plan.basePrice || 0) + storageCharge + seatCharge;
  const tax = subtotal * 0.18; // Indicative subscription tax only; issued invoices are server-calculated.
  return {
    base: Number(plan.basePrice || 0),
    extraStorageGb,
    storageCharge,
    extraSeats,
    seatCharge,
    subtotal,
    tax,
    total: subtotal + tax
  };
};

export const getSubscriptionBilling = async () => {
  if (!USE_MOCK_API) return apiClient.get(API_ENDPOINTS.SAAS_BILLING);
  return read(BILLING_KEY, seedBilling);
};

export const getStorageAccount = async () => {
  if (!USE_MOCK_API) return apiClient.get(API_ENDPOINTS.MEDIA_STORAGE);
  const saved = read(STORAGE_KEY, seedStorage);
  const usedBytes = saved.usedBytes == null
    ? Math.round(Number(saved.usedGb || 0) * 1024 ** 3) : Number(saved.usedBytes);
  return {
    ...saved,
    usedBytes,
    fileCount: saved.files?.length || 0,
    settings: { ...seedStorage.settings, ...(saved.settings || {}) },
  };
};

export const uploadMediaFiles = async (files, category = 'General') => {
  if (!USE_MOCK_API) {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('files', file));
    form.append('category', category);
    await apiClient.post(`${API_ENDPOINTS.MEDIA_STORAGE}/files`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return getStorageAccount();
  }

  const account = await getStorageAccount();
  if (account.settings.enabled === false) throw new Error('Storage uploads are disabled for this workshop.');
  const additions = Array.from(files).map((file) => ({
    id: makeId('MEDIA'),
    name: file.name,
    sizeBytes: file.size,
    sizeMb: Number((file.size / (1024 * 1024)).toFixed(2)),
    category,
    uploadedBy: 'Current User',
    uploadedAt: new Date().toISOString(),
    type: file.type || 'application/octet-stream'
  }));
  account.files = [...additions, ...account.files];
  const addedBytes = additions.reduce((sum, file) => sum + file.sizeBytes, 0);
  account.usedBytes += addedBytes;
  account.usedGb = Number((account.usedBytes / 1024 ** 3).toFixed(3));
  account.fileCount = account.files.length;
  return write(STORAGE_KEY, account);
};

export const deleteMediaFiles = async (ids) => {
  if (!USE_MOCK_API) {
    await apiClient.post(`${API_ENDPOINTS.MEDIA_STORAGE}/files/delete`, { ids });
    return getStorageAccount();
  }

  const account = await getStorageAccount();
  const removed = account.files.filter((file) => ids.includes(file.id));
  const removedBytes = removed.reduce((sum, file) =>
    sum + (file.sizeBytes ?? Math.round(Number(file.sizeMb || 0) * 1024 ** 2)), 0);
  account.files = account.files.filter((file) => !ids.includes(file.id));
  account.usedBytes = Math.max(0, account.usedBytes - removedBytes);
  account.usedGb = Number((account.usedBytes / 1024 ** 3).toFixed(3));
  account.fileCount = account.files.length;
  return write(STORAGE_KEY, account);
};

export const updateStorageSettings = async (settings) => {
  if (!USE_MOCK_API) return apiClient.put(`${API_ENDPOINTS.MEDIA_STORAGE}/settings`, settings);
  const account = await getStorageAccount();
  account.settings = { ...account.settings, ...settings };
  return write(STORAGE_KEY, account);
};

// Seat usage is determined by active Django login accounts. Never permit
// a manually typed seat count to modify SaaS billing usage.

export const saasAccountService = {
  getSubscriptionBilling,
  getStorageAccount,
  uploadMediaFiles,
  deleteMediaFiles,
  updateStorageSettings,
  calculateMonthlyEstimate
};
