import axios from 'axios';
import { API_CONFIG } from './apiConfig';

export const apiClient = axios.create(API_CONFIG);

let refreshPromise = null;

// Public authentication endpoints must not receive stale JWTs or trigger a
// session redirect when the backend returns a login/recovery validation error.
const isPublicAuthRequest = (url) =>
  /\/auth\/(?:login|refresh|forgot-password|reset-password|setup-password|logout|magic-link(?:\/verify)?)(?:\/|\?|$)/.test(String(url || ''));

const clearAuth = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_refresh_token');
  localStorage.removeItem('auth_user');
};

const redirectToLogin = () => {
  if (window.location.pathname === '/login') return;

  const next = encodeURIComponent(
    `${window.location.pathname}${window.location.search}`
  );
  window.location.replace(`/login?next=${next}`);
};

const refreshAccessToken = async () => {
  const refresh = localStorage.getItem('auth_refresh_token');
  if (!refresh) throw new Error('No refresh token available.');

  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_CONFIG.baseURL}/auth/refresh`,
        { refresh },
        {
          timeout: API_CONFIG.timeout,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          }
        }
      )
      .then(({ data }) => {
        const access = data?.access;
        if (!access) throw new Error('Token refresh did not return an access token.');

        localStorage.setItem('auth_token', access);

        if (data?.refresh) {
          localStorage.setItem('auth_refresh_token', data.refresh);
        }

        return access;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');

    if (token && !isPublicAuthRequest(config.url)) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;
    const isAuthRequest = isPublicAuthRequest(originalRequest?.url);


    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._cubixgearRetried &&
      !isAuthRequest &&
      localStorage.getItem('auth_refresh_token')
    ) {
      originalRequest._cubixgearRetried = true;

      let access;
      try {
        access = await refreshAccessToken();
      } catch (refreshError) {
        // Invalid/revoked refresh credentials end the session. A temporary
        // API outage must NOT destroy a valid saved session on every page.
        if ([400, 401, 403].includes(refreshError?.response?.status)) {
          clearAuth();
          redirectToLogin();
          const expired = new Error('Your session expired. Please sign in again.');
          expired.status = 401;
          return Promise.reject(expired);
        }
        const unavailable = new Error('Unable to verify your session. Check the Django API connection and retry.');
        unavailable.status = 503;
        return Promise.reject(unavailable);
      }

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${access}`;
      // A failed *data* request after a successful refresh must keep its
      // own status (403/500/network error), not accidentally log the user out.
      return apiClient.request(originalRequest);
    } else if (status === 401 && !isAuthRequest) {
      clearAuth();
      redirectToLogin();
    }

    const payload = error?.response?.data;
    if (payload instanceof Error) return Promise.reject(payload);

    const fieldErrors = {};

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      Object.entries(payload).forEach(([key, value]) => {
        if (['message', 'error', 'detail'].includes(key)) return;

        if (Array.isArray(value)) {
          fieldErrors[key] = value.map(String).filter(Boolean).join(' ');
        } else if (typeof value === 'string') {
          fieldErrors[key] = value;
        }
      });
    }

    const firstFieldError = Object.values(fieldErrors)[0] || null;

    const message =
      payload?.message ||
      payload?.error ||
      payload?.detail ||
      fieldErrors.non_field_errors ||
      firstFieldError ||
      (error?.code === 'ECONNABORTED'
        ? 'The API request timed out. Check the Django server and retry.'
        : error?.code === 'ERR_NETWORK'
          ? 'Could not connect to CubeGears backend. Check that Django is running and the API URL is correct.'
          : error?.message) ||
      'Something went wrong. Please try again.';

    const normalized = new Error(message);
    normalized.requestId = error?.response?.headers?.['x-request-id'] || null;
    normalized.status = status;
    normalized.code = error?.code;
    normalized.data = payload;
    normalized.fieldErrors = fieldErrors;
    // DRF throttling includes Retry-After. Preserve the duration for UI
    // cooldowns; never automatically replay mutations such as purchases.
    const retryAfterHeader = error?.response?.headers?.['retry-after'];
    let retrySeconds = Number(retryAfterHeader);
    if (retryAfterHeader && !Number.isFinite(retrySeconds)) {
      retrySeconds = (Date.parse(retryAfterHeader) - Date.now()) / 1000;
    }
    if (status === 429 && Number.isFinite(retrySeconds) && retrySeconds > 0) {
      normalized.retryAfterSeconds = Math.ceil(retrySeconds);
    }

    return Promise.reject(normalized);
  }
);

export default apiClient;
