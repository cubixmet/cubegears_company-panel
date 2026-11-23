import { offlineUserScope, offlineSessionDeadline, scopeKey } from './session.js';

const STORAGE_KEY = 'cubixgear:verified-feature-access:v1';

const identity = (user) => scopeKey(offlineUserScope(user));

// This is a copy of server-authorized permissions, not a new permission grant.
// Access is limited to the original user/company/branch and JWT expiry.
export function rememberFeatureAccess(user, access) {
  const key = identity(user);
  const deadline = offlineSessionDeadline(user);
  if (!key || deadline <= Date.now() || access?.unavailable ||
      !Array.isArray(access.permissions) || !Array.isArray(access.modules)) return;
  const labelExpiry = access.labelOnly && access.nextLabelExpiryAt
    ? Date.parse(access.nextLabelExpiryAt) : Infinity;
  const expiresAt = Math.min(deadline, Number.isFinite(labelExpiry) ? labelExpiry : Infinity);
  if (expiresAt <= Date.now()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      key, expiresAt, access: {
        ...access, loading: false, unavailable: false,
      },
    }));
  } catch { /* Offline browsing still works without persisted permissions. */ }
}

export function readFeatureAccess(user) {
  try {
    const key = identity(user);
    if (!key || offlineSessionDeadline(user) <= Date.now()) return null;
    const record = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!record || record.key !== key || record.expiresAt <= Date.now()) return null;
    if (String(record.access?.companyId) !== String(user?.company?.id)) return null;
    if (!Array.isArray(record.access?.permissions) || !Array.isArray(record.access?.modules)) return null;
    return { ...record.access, userKey: String(user.id) + ':' + String(user.companyId || user.company?.id || '') };
  } catch {
    return null;
  }
}

export function forgetFeatureAccess() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore blocked storage */ }
}


/**
 * An unreachable API is not the same as permission denial. Only a transient
 * network/server failure may fall back to an already verified, unexpired
 * tenant+branch permission snapshot. Server 401/403/404 and malformed
 * entitlement responses must remain blocked.
 */
export function offlineAccessAfterFailure(user, error) {
  const status = Number(error?.status ?? error?.response?.status ?? 0);
  const code = error?.code || error?.cause?.code;
  const network = !status && ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT', 'ERR_CONNECTION_REFUSED'].includes(code);
  const temporary = network || [408, 425, 429, 502, 503, 504].includes(status) ||
    (status >= 500 && status <= 599);
  return temporary ? readFeatureAccess(user) : null;
}
