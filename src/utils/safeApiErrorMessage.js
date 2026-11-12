/** Never display untrusted HTML returned by Django error pages or reverse proxies. */
export const isHtmlResponse = (payload, contentType = '') => {
  if (String(contentType).toLowerCase().includes('text/html')) return true;
  return typeof payload === 'string' &&
    /<(?:!doctype\s+html|html|head|body|title|h[1-6]|script|div|p)\b/i.test(payload);
};

const plainText = (value) =>
  typeof value === 'string' && !isHtmlResponse(value) ? value.trim() : '';

export const safeApiErrorMessage = ({
  status, payload, responseType, firstFieldError, code, fallback,
} = {}) => {
  if (status === 401) return 'Your session has expired. Sign in again to continue.';
  if (status === 403) return 'You do not have permission to view or change this record.';
  if (status === 404) return 'The requested record was not found or is not available to your workshop.';
  if (status === 429) return 'Too many requests. Please try again shortly.';
  if (status >= 500) return 'The server could not complete this request. Please retry or contact support.';
  if (code === 'ECONNABORTED') return 'The API request timed out. Check the Django server and retry.';
  if (code === 'ERR_NETWORK') return 'Cannot connect to the CubixGear backend. Check your connection and retry.';
  if (isHtmlResponse(payload, responseType)) {
    return 'The server returned an unexpected response. Please retry or contact support.';
  }

  const known = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? [payload.message, payload.error, payload.detail, payload.non_field_errors]
    : [payload];
  const valid = [...known, firstFieldError, fallback].map(plainText).find(Boolean);
  return valid || 'Something went wrong. Please try again.';
};
