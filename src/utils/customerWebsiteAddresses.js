// Browser-only local development addresses must never replace production URLs
// in a built/deployed Company Panel. Django owns the unique workshop label.
const validLabel = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;

export function isLocalCustomerWebsiteDevelopment(isDev, hostname) {
  return Boolean(isDev && (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^[a-z0-9-]+\.localhost$/.test(hostname || '')
  ));
}

export function localCustomerWebsiteOrigin(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value).trim());
    if (url.protocol === 'http:' && url.port !== '0' && ['localhost', '127.0.0.1'].includes(url.hostname) &&
        !url.username && !url.password && !url.search && !url.hash && url.pathname === '/') {
      return url.origin;
    }
  } catch { /* An invalid origin cannot be used for local links. */ }
  return '';
}

export function customerWebsiteDevParams(isDev, hostname, configuredOrigin) {
  const origin = isLocalCustomerWebsiteDevelopment(isDev, hostname)
    ? localCustomerWebsiteOrigin(configuredOrigin) : '';
  return origin ? { customerWebsiteDevOrigin: origin } : {};
}

export function trackingUrlWithDevPort(value, configuredOrigin) {
  const origin = localCustomerWebsiteOrigin(configuredOrigin);
  if (!value || !origin) return value;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' || url.username || url.password ||
        !isLocalCustomerWebsiteDevelopment(true, url.hostname) || !url.pathname.startsWith('/access/')) {
      return value;
    }
    // Older local APIs can return a stale port. Keep the issued workshop host and token.
    const port = new URL(origin).port;
    if (url.port === port) return value;
    url.port = port;
    return url.href;
  } catch {
    return value;
  }
}

export function customerWebsiteAddresses({
  subdomain = '',
  subdomainLabel = '',
  wildcardReady = false,
  localDevelopment = false,
  localOrigin = '',
} = {}) {
  const label = String(subdomainLabel).trim();
  // Local Customer Website origin comes from Vite development configuration,
  // never from a fixed runtime port or an arbitrary remote hostname.
  const origin = localDevelopment ? localCustomerWebsiteOrigin(localOrigin) : '';
  const localPort = origin ? new URL(origin).port : '';
  const localSuffix = origin ? '.localhost' + (localPort ? ':' + localPort : '') : '';
  const localUrl = localSuffix && validLabel.test(label)
    ? 'http://' + label + localSuffix + '/' : '';
  const productionHost = subdomain;
  const productionUrl = productionHost ? 'https://' + productionHost + '/' : '';
  const productionReady = Boolean(productionHost && wildcardReady);
  const suffix = localUrl
    ? localSuffix
    : label && subdomain.startsWith(label + '.')
      ? '.' + subdomain.slice(label.length + 1)
      : '.your-platform-domain';

  return {
    displayUrl: localUrl || productionUrl,
    productionUrl,
    localUrl,
    suffix,
    isLocalPreview: Boolean(localUrl),
    canOpen: Boolean(localUrl || productionReady),
  };
}
