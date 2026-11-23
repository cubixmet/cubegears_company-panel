import { useSyncExternalStore, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useOfflineInventory } from './InventoryOfflineProvider';
import './pwa.css';

const subscribers = new Set();
const display = window.matchMedia('(display-mode: standalone)');
const isStandalone = () => display.matches || navigator.standalone === true;
const apple = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let state = {
  prompt: null, installed: isStandalone(), update: null,
  checking: false, applying: false, reloadAvailable: false, updateMessage: '',
  installing: false, installMessage: '',
};
let edited = false;
let registrationPromise;
let activationTimer;

function publish(changes) {
  state = { ...state, ...changes };
  for (const subscriber of subscribers) subscriber();
}

function subscribe(subscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}
const read = () => state;

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  publish({ prompt: event, installMessage: '' });
});
window.addEventListener('appinstalled', () => publish({ installed: true, prompt: null, installing: false, installMessage: 'CubixGear has been installed.' }));
display.addEventListener?.('change', () => publish({ installed: isStandalone() }));
// Some screens use controlled inputs outside a <form>. Count edits
// conservatively so the update cannot silently discard an open draft.
document.addEventListener('input', () => { edited = true; }, true);
document.addEventListener('change', () => { edited = true; }, true);

function detectUpdate(registration) {
  const update = navigator.serviceWorker.controller ? registration.waiting : null;
  if (!state.applying && update !== state.update) publish({ update, updateMessage: '' });
  return update;
}

function waitForInstallation(worker) {
  if (!worker) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', check);
      if (error) reject(error);
      else resolve();
    };
    const check = () => {
      if (worker.state === 'redundant') finish(new Error('App update installation failed.'));
      if (['installed', 'activating', 'activated'].includes(worker.state)) finish();
    };
    const timer = setTimeout(() => finish(new Error('App update installation timed out.')), 12000);
    worker.addEventListener('statechange', check);
    check();
  });
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let controller = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const reload = state.applying;
    const next = navigator.serviceWorker.controller;
    const reloadAvailable = Boolean(controller && next && controller !== next);
    controller = next;
    clearTimeout(activationTimer);
    publish({ update: null, applying: false, reloadAvailable, updateMessage: '' });
    if (reload) window.location.reload();
  });
  registrationPromise = navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
    const detect = () => detectUpdate(registration);
    const watch = () => registration.installing?.addEventListener('statechange', detect);
    registration.addEventListener('updatefound', watch);
    watch();
    detect();
    const check = () => {
      if (!state.checking && navigator.onLine && document.visibilityState === 'visible') {
        void registration.update().catch(() => {});
      }
    };
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    setInterval(check, 60_000);
    return registration;
  }).catch(() => null);
}

function applyAppUpdate(update) {
  // The mobile navigation drawer contains the update action and has no edits to save.
  const editDialog = '[role="dialog"][aria-modal="true"]:not(#workspace-mobile-drawer)';
  if ((edited || document.querySelector(`input:focus, textarea:focus, ${editDialog}`)) &&
      !window.confirm('Reload to update the app? Save any unfinished edits first. Parts queued on this device will be kept.')) return;
  if (!update) {
    window.location.reload();
    return;
  }
  publish({ applying: true, updateMessage: '' });
  try {
    update.postMessage({ type: 'ACTIVATE_UPDATE' });
  } catch {
    publish({ update: null, applying: false, updateMessage: 'Could not apply the update. Try again.' });
    return;
  }
  activationTimer = setTimeout(() => {
    publish({ applying: false, updateMessage: 'Update is taking longer than expected. Try again.' });
  }, 12000);
}

async function updateApp() {
  if (state.checking || state.applying) return;
  if (state.update || state.reloadAvailable) {
    applyAppUpdate(state.update);
    return;
  }
  if (!navigator.onLine) {
    publish({ updateMessage: 'Go online to check for updates.' });
    return;
  }
  if (!registrationPromise) {
    publish({ updateMessage: 'App updates are available in the published Company Panel.' });
    return;
  }

  publish({ checking: true, updateMessage: '' });
  try {
    const registration = await registrationPromise;
    if (!registration) throw new Error('App update service is unavailable.');
    if (!detectUpdate(registration)) {
      if (!registration.installing) await registration.update();
      await waitForInstallation(registration.installing);
    }
    const update = detectUpdate(registration);
    publish({ checking: false });
    if (update || state.reloadAvailable) applyAppUpdate(update);
    else publish({ updateMessage: 'App is up to date.' });
  } catch {
    publish({ checking: false, updateMessage: 'Could not check for updates. Try again.' });
  }
}

function AppUpdateButton({ checking, applying }) {
  return <button type="button" className="cg-pwa-action" disabled={checking || applying} onClick={() => void updateApp()}>
    <RefreshCw size={16} aria-hidden="true" />
    {applying ? 'Updating…' : checking ? 'Checking…' : 'Update App'}
  </button>;
}

export function AppUpdateNotice() {
  const { update, checking, applying, updateMessage } = useSyncExternalStore(subscribe, read);
  if (!update) return null;
  return <aside className="cg-pwa-controls cg-pwa-update" aria-label="App update">
    <div role="status">{updateMessage || 'Update available'}</div>
    <AppUpdateButton checking={checking} applying={applying} />
  </aside>;
}

async function diagnoseInstallReadiness() {
  if (!window.isSecureContext) return 'Installation needs HTTPS.';
  if (!('serviceWorker' in navigator)) return 'This browser does not support service workers.';
  let response;
  try {
    response = await fetch('/manifest.webmanifest', { cache: 'no-store' });
    if (!response.ok) return 'Manifest request failed (HTTP ' + response.status + ').';
    const mime = response.headers.get('content-type') || '';
    if (!/json|webmanifest/i.test(mime)) return 'Manifest has the wrong content type: ' + mime;
    const manifest = await response.json();
    if (!manifest.id || !manifest.name || !manifest.start_url ||
        !Array.isArray(manifest.icons) || manifest.icons.length === 0) {
      return 'The production manifest is missing required install fields.';
    }
  } catch {
    return 'Could not load /manifest.webmanifest. Check your production deployment.';
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration?.active) return 'Service worker is not active. Check /sw.js under DevTools > Application.';
  } catch {
    return 'Unable to check service worker registration in this browser.';
  }
  return 'Manifest and service worker are present. If the browser does not offer Install, check DevTools > Application > Manifest and Issues. The app may already be installed.';
}

export function InstallAppControls({ inDrawer = false }) {
  const {
    prompt, installed, installing, installMessage, checking, applying,
    update, reloadAvailable, updateMessage,
  } = useSyncExternalStore(subscribe, read);
  const [instructions, setInstructions] = useState(false);
  const [installDiagnostic, setInstallDiagnostic] = useState('');
  const appIcon = <img className="cg-pwa-app-icon" src="/app-icon-180.png" width="26" height="26" alt="" />;
  // Web Install API is a progressive enhancement. Chromium versions without
  // it still support the one-use beforeinstallprompt event.
  const supportsWebInstall = typeof navigator.install === 'function';

  const install = async () => {
    if (state.installing || state.installed) return;
    setInstructions(false);

    if (supportsWebInstall) {
      publish({ installing: true, installMessage: '' });
      try {
        // Must run synchronously from the user gesture, before any await.
        // The browser (not our page) asks for installation consent.
        await navigator.install();
        publish({
          installing: false, installed: true, prompt: null,
          installMessage: 'CubixGear was installed or opened.',
        });
      } catch (error) {
        const message = error?.name === 'DataError'
          ? 'The app manifest is invalid or unavailable. Check the production manifest and icons.'
          : error?.name === 'AbortError'
            ? 'Installation was canceled or blocked by your browser.'
            : 'Installation could not start. Check the browser install settings.';
        publish({ installing: false, installMessage: message });
      }
      return;
    }

    // No Chromium install event yet: only installation instructions are
    // possible. Never pretend that a browser install was successful.
    const deferred = state.prompt;
    if (!deferred) {
      setInstructions(true);
      setInstallDiagnostic('Checking production PWA configuration…');
      void diagnoseInstallReadiness().then(setInstallDiagnostic);
      return;
    }

    publish({ prompt: null, installing: true, installMessage: '' });
    try {
      // This one-use event also must be invoked directly on user click.
      await deferred.prompt();
      const choice = await deferred.userChoice;
      publish({
        installing: false,
        installMessage: choice?.outcome === 'accepted'
          ? 'Installation accepted.'
          : 'Installation was canceled. You can retry when the browser offers the prompt again.',
      });
    } catch {
      publish({
        installing: false,
        installMessage: 'Could not open the install prompt. Use your browser menu instead.',
      });
      setInstructions(true);
    }
  };

  return <section className={`cg-pwa-controls${inDrawer ? ' cg-pwa-drawer-install' : ''}`} aria-label="App installation">
    {installed
      ? <span className="cg-pwa-installed" role="status">{appIcon} App installed</span>
      : <button type="button" className="cg-pwa-action" disabled={installing}
          onClick={() => void install()}>
          {appIcon} {installing ? 'Opening install…' : (supportsWebInstall || prompt) ? 'Download App' : 'How to install'}
        </button>}
    <AppUpdateButton checking={checking} applying={applying} />
    {installMessage && <p role="status">{installMessage}</p>}
    {(updateMessage || update || reloadAvailable) && <p role="status">{updateMessage || 'Update available'}</p>}
    {!installed && instructions && installDiagnostic && <p role="status">{installDiagnostic}</p>}
    {!installed && instructions && <p role="status">{apple
      ? 'In Safari, tap Share, then Add to Home Screen. If shown, enable Open as Web App, then tap Add.'
      : 'In Chrome or Edge, open the browser menu and look for Install app or Install page as app. If it is missing, the app may already be installed or the browser has not recognized it as installable. Check the app manifest and service worker in DevTools.'}</p>}
  </section>;
}

const fix = {
  permission: 'Ask your workshop owner to restore stock access, then review the part in Inventory.',
  conflict: 'Check Inventory for the existing part before entering it again.',
  validation: 'Correct the part details in Add New Part, then remove this failed entry.',
};

export function InventorySyncControls() {
  const { offline, records, lastSync, syncing, sync, remove, storageError } = useOfflineInventory();
  const pending = records.filter(row => row.state === 'pending').length;
  if (!offline && !records.length && !lastSync && !storageError) return null;
  return <section className="cg-pwa-controls" aria-label="Offline Inventory and sync">
    {offline && <strong>Offline</strong>}
    <span role="status">{pending} Pending sync</span>
    <button type="button" className="settings-primary-button" disabled={offline || syncing || !pending}
      onClick={() => void sync({ manual: true })}>{syncing ? 'Syncing…' : 'Sync now'}</button>
    {storageError && <p role="alert">{storageError}</p>}
    {lastSync && <p role="status">Last sync <time dateTime={lastSync.at}>{new Date(lastSync.at).toLocaleString()}</time> · {lastSync.message}</p>}
    {records.length > 0 && <ul className="cg-pwa-queue">
      {records.map(row => <li key={row.id}>
        <strong>{row.payload.partName}</strong>
        <span>{row.payload.onHand} {row.payload.unit} opening quantity · {row.state === 'rejected' ? 'Needs attention' : 'Pending sync'}</span>
        {row.state === 'rejected' && <>
          <p>{row.message} {fix[row.kind]}</p>
          <button type="button" className="settings-primary-button" onClick={() => {
            if (window.confirm('Remove this failed entry from this device?')) void remove(row.id);
          }}>Remove failed entry</button>
        </>}
      </li>)}
    </ul>}
  </section>;
}
