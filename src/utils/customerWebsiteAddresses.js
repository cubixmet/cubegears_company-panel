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
} = {}) {
  const label = String(subdomainLabel).trim();
  const localUrl = localDevelopment && validLabel.test(label)
    ? 'http://' + label + '.localhost:5174/'
    : '';
  const productionHost = subdomain;
  const productionUrl = productionHost ? 'https://' + productionHost + '/' : '';
  const productionReady = Boolean(productionHost && wildcardReady);
  const suffix = localUrl
    ? '.localhost:5174'
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
