import { offlineUserScope, offlineSessionDeadline, scopeKey } from './session.js';

// Browser-local read-through snapshots for previously visited pages only.
// Never cache API auth, entitlements, files or secrets. These are unencrypted
// browser-profile data: use trusted devices and sign out when finished.
const DB = 'cubixgear-offline-pages';
const STORE = 'responses';
const MAX_ITEMS = 80;
const MAX_BYTES = 400_000;
const TTL_MS = 6 * 60 * 60 * 1000;
const READ_MODULES = new Set([
  'dashboard', 'customers', 'vehicles', 'services', 'jobs', 'stock',
  'inventory', 'suppliers', 'employees', 'attendance', 'payroll',
  'invoices', 'payments', 'expenses', 'finance', 'gstr',
  'reports', 'notifications', 'settings', 'company', 'branches', 'roles',
  'staff', 'saas', 'account', 'e-way-bills',
]);
const PRIVATE_PATH = /\/(?:auth|login|refresh|logout|password|security|tokens?|keys?|files?|download|export|webhooks?|gateway|checkout|verify|access|entitlements|bank-accounts?|payslips?|statements?\/download|photos?\/file)(?:\/|$)/i;
let database;

export function offlineReadRequestKey(config) {
  if (String(config?.method || 'get').toLowerCase() !== 'get' ||
      (config.responseType && config.responseType !== 'json')) return '';
  const path = String(config?.url || '');
  if (!path.startsWith('/') || path.startsWith('//') ||
      PRIVATE_PATH.test(path) || /[?&](?:token|secret|password|code|key)=/i.test(path)) return '';
  const module = path.split(/[/?]/).filter(Boolean)[0];
  if (!READ_MODULES.has(module)) return '';

  // Axios's own serializer is used so page filters remain distinct.
  const root = String(config.baseURL || '').replace(/\/+$/, '');
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(config.params || {})) {
    if (/token|secret|password|code|key/i.test(name)) return '';
    if (value == null) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) params.append(name, String(item));
  }
  params.sort();
  return root + path + (params.size ? (path.includes('?') ? '&' : '?') + params.toString() : '');
}

function verified() {
  try {
    const user = JSON.parse(localStorage.getItem('auth_user') || 'null');
    const scope = scopeKey(offlineUserScope(user));
    const deadline = offlineSessionDeadline(user);
    return scope && deadline > Date.now() ? { scope, deadline } : null;
  } catch {
    return null;
  }
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Offline database unavailable.'));
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE);
        store.createIndex('updatedAt', 'updatedAt');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => { database = null; throw error; });
  }
  return database;
}

export async function readOfflineResponse(config) {
  const key = offlineReadRequestKey(config);
  const auth = verified();
  if (!key || !auth) return { found: false };
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(auth.scope + '\n' + key);
    req.onsuccess = () => {
      const record = req.result;
      resolve(record && record.expiresAt > Date.now() ? { found: true, data: record.data } : { found: false });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function rememberOfflineResponse(config, data) {
  const key = offlineReadRequestKey(config);
  const auth = verified();
  if (!key || !auth || data == null || typeof data !== 'object') return;
  let json;
  try { json = JSON.stringify(data); } catch { return; }
  if (!json || json.length > MAX_BYTES) return;
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.put({
      data: JSON.parse(json), updatedAt: Date.now(),
      expiresAt: Math.min(Date.now() + TTL_MS, auth.deadline),
    }, auth.scope + '\n' + key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  // Bound disk usage without reading or caching tokens.
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const request = store.count();
    request.onsuccess = () => {
      let excess = request.result - MAX_ITEMS;
      if (excess <= 0) return;
      const cursor = store.index('updatedAt').openCursor();
      cursor.onsuccess = () => {
        if (!cursor.result || excess <= 0) return;
        store.delete(cursor.result.primaryKey);
        excess--;
        cursor.result.continue();
      };
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearOfflineResponses() {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDatabase().catch(() => null);
  if (!db) return;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
