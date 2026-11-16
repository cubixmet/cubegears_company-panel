const UUID_PATTERN = '[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
const UUID = new RegExp(`^${UUID_PATTERN}$`, 'i');
const EMBEDDED_UUID = new RegExp(UUID_PATTERN, 'gi');
const REFERENCE = /^ref-([0-9]{1,39})$/i;
const MAX_REFERENCE = (1n << 128n) - 1n;

export function recordReference(value) {
  const text = String(value ?? '');
  return UUID.test(text) ? `ref-${BigInt('0x' + text.replaceAll('-', ''))}` : text;
}

function internalRecordId(value) {
  const match = REFERENCE.exec(value);
  if (!match) return value;
  const number = BigInt(match[1]);
  if (number > MAX_REFERENCE) return value;
  const hex = number.toString(16).padStart(32, '0');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

export function recordLabel(value, fallback = '—') {
  const label = String(value ?? '').trim().replace(EMBEDDED_UUID, recordReference);
  return (REFERENCE.test(label) ? label.toUpperCase() : label) || fallback;
}

// Only app paths and complete record values change. Signed links, free-text
// search and external destinations keep the values supplied by their callers.
function translatePath(to, translate) {
  if (typeof to !== 'string') {
    const path = translatePath((to.pathname || '') + (to.search || '') + (to.hash || ''), translate);
    const match = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(path);
    return { ...to, pathname: to.pathname === undefined ? undefined : match[1], search: match[2] || '', hash: match[3] || '' };
  }
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(to)) return to;
  const [, pathname, search = '', hash = ''] = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(to);
  if (/^\/(?:set-password|reset-password|setup-password|magic-link)(?:\/|$)/.test(pathname)) return to;
  const visiblePath = pathname.split('/').map(translate).join('/');
  const params = new URLSearchParams(search);
  let changed = false;
  const pairs = [...params].map(([key, value]) => {
    const translated = key === 'next' && /^\/(?!\/)/.test(value) ? translatePath(value, translate)
      : /(?:^id$|Id$|_id$|^company$|^branch$|^technician$|^job$|^supplier$|^credit$|^credit_purchase$|^invoice$|^vehicle$|^customer$|^payment$|^expense$|^account$)/i.test(key)
        ? translate(value) : value;
    changed ||= translated !== value;
    return [key, translated];
  });
  const visibleHash = hash.startsWith('#') ? '#' + translate(hash.slice(1)) : hash;
  return visiblePath + (changed ? '?' + new URLSearchParams(pairs) : search) + visibleHash;
}

export const publicRecordPath = (to) => translatePath(to, recordReference);
export const internalRecordPath = (to) => translatePath(to, internalRecordId);
