import { useSyncExternalStore } from 'react';

// navigator.onLine only describes the device network link. A browser can
// report "online" even when the authenticated Django backend is unreachable.
// Keep this signal in memory; never persist reachability or credentials.
let backendUnavailable = false;
const changeEvent = 'cubixgear:backend-connectivity';
const recoveredEvent = 'cubixgear:backend-recovered';

export function reportBackendConnection(available) {
  const unavailable = available === false;
  if (unavailable === backendUnavailable) return;
  backendUnavailable = unavailable;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(changeEvent));
    if (!unavailable) window.dispatchEvent(new Event(recoveredEvent));
  }
}

export function offlineSnapshot() {
  return (typeof navigator !== 'undefined' && navigator.onLine === false) || backendUnavailable;
}

function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
    window.removeEventListener(changeEvent, callback);
  };
}

export function useOffline() {
  return useSyncExternalStore(subscribe, offlineSnapshot, () => false);
}
