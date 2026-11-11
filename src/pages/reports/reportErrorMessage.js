/**
 * Human-readable troubleshooting for the workshop Reports page.
 * Keep status codes usable for support without exposing raw HTML error bodies.
 */
export const reportLoadErrorMessage = (error) => {
  switch (Number(error?.status)) {
    case 401:
      return 'Your login has expired. Sign in again to see the workshop report.';
    case 403:
      return 'You do not have permission to view reports. Ask the workshop owner to enable Reports View access.';
    case 404:
      return 'The reports service is missing on the running server. Ask your administrator to update the Django backend and restart it.';
    case 429:
      return 'Too many requests. Try again shortly.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'The reports service could not load your workshop data. Ask the administrator to check the server and try again.';
    default:
      return error?.message || 'The report could not load. Check your connection and try again.';
  }
};
