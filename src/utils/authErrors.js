const toMessage = (value) => {
  if (Array.isArray(value)) return value.map(toMessage).filter(Boolean).join(' ');
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    return Object.values(value).map(toMessage).filter(Boolean).join(' ');
  }
  return '';
};

export const getAuthFieldErrors = (error) => {
  const payload = error?.data || error?.response?.data || {};
  const fields = {};

  // Both plain DRF field errors and wrapped { errors: {...} } responses
  // should appear next to the correct input, never as "[object Object]".
  for (const source of [payload, payload?.errors, payload?.data?.errors]) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    Object.entries(source).forEach(([key, value]) => {
      if (['message', 'error', 'detail', 'success', 'code', 'status', 'data', 'errors'].includes(key)) return;
      const message = toMessage(value);
      if (message) fields[key] = message;
    });
  }

  return fields;
};

export const getAuthErrorMessage = (
  error,
  fallback = 'Something went wrong. Please try again.',
) => {
  const fields = getAuthFieldErrors(error);
  return (
    error?.data?.message ||
    error?.data?.error ||
    error?.data?.detail ||
    fields.non_field_errors ||
    fields.nonFieldErrors ||
    Object.values(fields).find(Boolean) ||
    error?.message ||
    fallback
  );
};

export const getCredentialError = (error) => {
  const fields = getAuthFieldErrors(error);
  return (
    fields.non_field_errors ||
    fields.nonFieldErrors ||
    getAuthErrorMessage(error, 'Invalid email or password.')
  );
};
