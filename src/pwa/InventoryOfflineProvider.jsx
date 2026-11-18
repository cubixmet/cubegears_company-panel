import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import apiClient from '../api/apiClient';
import { USE_MOCK_API } from '../api/apiConfig';
import { useAuth } from '../hooks/useAuth';
import { inventoryStore, prepareInventorySnapshot, syncErrorKind } from './inventoryStore';
import { inventoryScope, offlineSessionDeadline, scopeKey } from './session';
import { useOffline } from './connectivity';

const InventoryOfflineContext = createContext(null);
const empty = { records: [] };
const changed = 'cubixgear:inventory-offline-changed';

function publish(key) {
  window.dispatchEvent(new CustomEvent(changed, { detail: key }));
  // The storage event carries only a change signal. Records stay in IndexedDB.
  try { localStorage.setItem(changed, crypto.randomUUID()); } catch { /* Local updates still work. */ }
}

function verifiedScope(key) {
  try {
    const user = JSON.parse(localStorage.getItem('auth_user'));
    return scopeKey(inventoryScope(user)) === key && offlineSessionDeadline(user) > Date.now();
  } catch {
    return false;
  }
}

async function syncWithLease(key, run) {
  const owner = crypto.randomUUID();
  const acquire = (data) => {
    if (data.lease?.owner !== owner && data.lease?.expires > Date.now()) return data;
    return { ...data, lease: { owner, expires: Date.now() + 90_000 } };
  };
  const lease = await inventoryStore(key, acquire);
  if (lease.lease.owner !== owner) return;
  try {
    await run(async () => (await inventoryStore(key, acquire)).lease.owner === owner);
  } finally {
    await inventoryStore(key, data => data.lease?.owner !== owner ? data : { ...data, lease: null });
  }
}

export function InventoryOfflineProvider({ children }) {
  const { user, isAuthenticated, loading, retrySession } = useAuth();
  const offline = useOffline();
  const key = !USE_MOCK_API && isAuthenticated && !loading ? scopeKey(inventoryScope(user)) : '';
  const [stored, setStored] = useState(null);
  const [storageError, setStorageError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const data = stored?.key === key ? stored.data : empty;
  const snapshot = data.snapshot?.expiresAt > Date.now() ? data.snapshot : null;

  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    let read = 0;
    let lastConfirmedRequestKey;
    const load = async () => {
      const attempt = ++read;
      try {
        const result = await inventoryStore(key);
        if (active && attempt === read) {
          setStored({ key, data: result });
          setStorageError('');
          // The persisted confirmation also refreshes Inventory in other tabs of this scope.
          if (result.lastConfirmedRequestKey && result.lastConfirmedRequestKey !== lastConfirmedRequestKey && verifiedScope(key)) {
            window.dispatchEvent(new Event('cubixgear:inventory-synced'));
          }
          lastConfirmedRequestKey = result.lastConfirmedRequestKey;
        }
      } catch {
        if (active) setStorageError('Offline storage is unavailable on this device.');
      }
    };
    const onChange = event => { if (event.detail === key || event.key === changed) void load(); };
    void load();
    window.addEventListener(changed, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      active = false;
      window.removeEventListener(changed, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [key]);

  const rememberInventory = useCallback(async (input) => {
    if (!key || !navigator.onLine || !verifiedScope(key)) return;
    const snapshot = prepareInventorySnapshot(input);
    await inventoryStore(key, data => ({ ...data, snapshot }));
    publish(key);
  }, [key]);

  const restrictInventory = useCallback(async (canView) => {
    if (!key) return;
    await inventoryStore(key, data => ({
      ...data,
      snapshot: canView && data.snapshot ? { ...data.snapshot, create: false } : null,
    }));
    publish(key);
  }, [key]);

  const enqueue = useCallback(async (payload) => {
    if (!key || !verifiedScope(key)) throw new Error('Sign in again to save offline.');
    const result = await inventoryStore(key, data => {
      if (!data.snapshot?.create || data.snapshot.expiresAt <= Date.now() ||
          !verifiedScope(key) || scopeKey(payload.offlineScope) !== key) return data;
      if (data.records.some(row => row.id === payload.requestKey)) return data;
      return { ...data, records: [...data.records, { id: payload.requestKey, payload, state: 'pending' }] };
    });
    if (!result.records.some(row => row.id === payload.requestKey)) {
      throw new Error('Open Inventory online with permission to add parts before saving offline.');
    }
    publish(key);
    if (!verifiedScope(key)) throw new Error('Sign in with the original account to view this saved part.');
  }, [key]);

  const remove = useCallback(async (id) => {
    if (!key || !verifiedScope(key)) return;
    await inventoryStore(key, data => ({
      ...data, records: data.records.filter(row => row.id !== id || row.state !== 'rejected'),
    }));
    publish(key);
  }, [key]);

  const sync = useCallback(async ({ manual = false } = {}) => {
    if (!key || !navigator.onLine) return;
    const run = async (renew = async () => true) => {
      const { records } = await inventoryStore(key);
      const pending = records.filter(row => row.state === 'pending');
      if (!pending.length) return;
      setSyncing(true);
      let synced = 0;
      let rejected = 0;
      const status = (message) => inventoryStore(key, data => ({
        ...data,
        lastSync: {
          message: [synced && `${synced} synced`, rejected && `${rejected} need attention`, message]
            .filter(Boolean).join(' · '),
          at: new Date().toISOString(),
        },
      }));
      const options = { timeout: 12000 };
      try {
        const profile = await apiClient.get('/auth/me', options);
        if (!verifiedScope(key)) return;
        if (scopeKey(inventoryScope(profile?.user || profile)) !== key) {
          await status('Sign in with the original account, workshop and branch.');
          retrySession();
          return;
        }
        for (const row of pending) {
          if (!navigator.onLine || !verifiedScope(key) || !await renew()) break;
          try {
            const part = await apiClient.post('/stock', row.payload, options);
            if (!part?.id) throw new Error('No confirmation from Django.');
          } catch (error) {
            const kind = syncErrorKind(error);
            if (kind === 'retry' || kind === 'signin') {
              await status(kind === 'signin' ? 'Sign in to resume sync.' : 'Connection interrupted. Pending sync.');
              return;
            }
            await inventoryStore(key, data => ({
              ...data, records: data.records.map(record => record.id === row.id
                ? { ...record, state: 'rejected', kind, message: error.message } : record),
            }));
            rejected += 1;
            continue;
          }
          await inventoryStore(key, data => ({
            ...data,
            records: data.records.filter(record => record.id !== row.id),
            lastConfirmedRequestKey: row.id,
          }));
          synced += 1;
        }
        if (synced || rejected) await status();
      } catch (error) {
        await status([401, 403].includes(error?.status)
          ? 'Sign in with the original account to resume sync.' : 'Connection interrupted. Pending sync.');
      } finally {
        setSyncing(false);
        publish(key);
      }
    };
    try {
      if (navigator.locks) {
        await navigator.locks.request('cubixgear-inventory-' + key, { ifAvailable: !manual }, lock => lock ? run() : undefined);
      } else {
        await syncWithLease(key, run);
      }
    } catch {
      setStorageError('Offline storage is unavailable on this device.');
    }
  }, [key, retrySession]);

  const hasPending = data.records.some(row => row.state === 'pending');
  useEffect(() => {
    if (!key || offline || !hasPending) return undefined;
    const run = () => { if (document.visibilityState === 'visible') void sync(); };
    run();
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', run);
    const timer = setInterval(run, 30000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', run);
    };
  }, [key, offline, hasPending, sync]);

  const value = useMemo(() => ({
    offline, key, scope: key ? JSON.parse(key) : null, snapshot, ready: !key || stored?.key === key || Boolean(storageError),
    records: data.records, lastSync: data.lastSync, syncing, storageError,
    rememberInventory, restrictInventory, enqueue, remove, sync,
  }), [offline, key, snapshot, stored, data, syncing, storageError, rememberInventory, restrictInventory, enqueue, remove, sync]);
  return <InventoryOfflineContext.Provider value={value}>{children}</InventoryOfflineContext.Provider>;
}

export const useOfflineInventory = () => useContext(InventoryOfflineContext);
