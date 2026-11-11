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
  let localPort = null;
  if (localDevelopment && localOrigin) {
    try {
      const url = new URL(String(localOrigin));
      if (url.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(url.hostname) &&
          !url.username && !url.password && !url.search && !url.hash &&
          url.pathname === '/') {
        localPort = url.port;
      }
    } catch { /* Bad or missing development config has no local preview. */ }
  }
  const localSuffix = localPort !== null
    ? '.localhost' + (localPort ? ':' + localPort : '') : '';
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
