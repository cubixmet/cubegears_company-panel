import apiClient from '../api/apiClient';
import { USE_MOCK_API } from '../api/apiConfig';
import { STORAGE_PRICE_PER_GB_DAY, storageDayCharge } from './storagePricing';
import { storageBytes, BYTES_PER_GB } from '../utils/storageUnits';

const HISTORY_KEY = 'cubixgear-storage-usage-history';
const STORAGE_KEY = 'cubixgear-saas-storage';
const DAY_MS = 86400000;

const isoDay = (value = new Date()) => new Date(value).toISOString().slice(0, 10);
const clone = (value) => JSON.parse(JSON.stringify(value));

const readStorage = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
};

const filesAtDate = (files, day) => {
  const end = new Date(`${day}T23:59:59.999Z`).getTime();
  return (files || []).filter((file) => {
    const uploaded = new Date(file.uploadedAt || 0).getTime();
    return Number.isFinite(uploaded) && uploaded <= end;
  });
};

const seedHistory = (storage) => {
  const now = new Date();
  const currentGb = Number(storage.usedGb || 0);
  const files = storage.files || [];
  return Array.from({ length: 30 }, (_, index) => {
    const day = isoDay(new Date(now.getTime() - index * DAY_MS));
    const usedGb = Number(Math.max(0, currentGb - index * 0.18).toFixed(2));
    const dayFiles = filesAtDate(files, day);
    return {
      date: day,
      usedGb,
      usedBytes: Math.round(usedGb * BYTES_PER_GB),
      rate: STORAGE_PRICE_PER_GB_DAY,
      charge: storageDayCharge(usedGb),
      fileCount: dayFiles.length,
      files: clone(dayFiles),
      snapshotType: index === 0 ? 'live' : 'daily-close'
    };
  });
};

const readHistory = () => {
  const storage = readStorage();
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    localStorage.removeItem(HISTORY_KEY);
  }
  const seeded = seedHistory(storage);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(seeded));
  return seeded;
};

const writeHistory = (rows) => {
  const next = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return clone(next);
};

export const recordTodayStorageSnapshot = (storage) => {
  if (!USE_MOCK_API) return Promise.resolve(storage);
  const rows = readHistory();
  const date = isoDay();
  const snapshot = {
    date,
    usedGb: Number(Number(storage.usedGb || 0).toFixed(3)),
    usedBytes: storageBytes(storage),
    rate: STORAGE_PRICE_PER_GB_DAY,
    charge: storageDayCharge(storage.usedGb),
    fileCount: (storage.files || []).length,
    files: clone(storage.files || []),
    snapshotType: 'live'
  };
  writeHistory([snapshot, ...rows.filter((row) => row.date !== date)]);
  return Promise.resolve(snapshot);
};

export const getStorageHistory = async ({ from, to } = {}) => {
  if (!USE_MOCK_API) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return apiClient.get(`/saas/storage/history?${params.toString()}`);
  }
  const rows = readHistory();
  const storage = readStorage();
  await recordTodayStorageSnapshot(storage);
  const refreshed = readHistory();
  return refreshed.filter((row) => (!from || row.date >= from) && (!to || row.date <= to));
};

export const getStorageDay = async (date) => {
  if (!USE_MOCK_API) return apiClient.get(`/saas/storage/history/${date}`);
  const rows = readHistory();
  const storage = readStorage();
  if (date === isoDay()) await recordTodayStorageSnapshot(storage);
  return readHistory().find((row) => row.date === date) || rows.find((row) => row.date === date) || null;
};

export const summarizeStorageHistory = (rows = []) => {
  const totalCharge = rows.reduce((sum, row) => sum + Number(row.charge || 0), 0);
  const totalBytes = rows.reduce((sum, row) => sum + storageBytes(row), 0);
  const peakBytes = rows.reduce((max, row) => Math.max(max, storageBytes(row)), 0);
  return {
    days: rows.length,
    averageBytes: rows.length ? totalBytes / rows.length : 0,
    peakBytes,
    averageGb: rows.length ? totalBytes / rows.length / BYTES_PER_GB : 0,
    peakGb: peakBytes / BYTES_PER_GB,
    totalCharge
  };
};

export const getStorageEvents = async ({ from, to, limit = 50, offset = 0 } = {}) => {
  if (USE_MOCK_API) return { count: 0, results: [] };
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiClient.get(`/saas/storage/events?${params.toString()}`);
};

export const getStorageIntervalLogs = async ({ from, to, limit = 50, offset = 0 } = {}) => {
  if (USE_MOCK_API) return { count: 0, results: [] };
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiClient.get(`/saas/storage/interval-logs?${params.toString()}`);
};

export const storageHistoryService = {
  getStorageIntervalLogs,
  getStorageEvents,
  getStorageHistory,
  getStorageDay,
  recordTodayStorageSnapshot,
  summarizeStorageHistory
};
