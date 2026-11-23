import axios from 'axios';
import { API_CONFIG } from './apiConfig';
import { forgetVerifiedSession } from '../pwa/session';
import { forgetFeatureAccess } from '../pwa/offlineAccess';
import { offlineSnapshot } from '../pwa/connectivity';
import {
  offlineReadRequestKey, readOfflineResponse, rememberOfflineResponse,
  clearOfflineResponses,
} from '../pwa/offlineReads';
import { safeApiErrorMessage, isHtmlResponse } from '../utils/safeApiErrorMessage';

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
  forgetVerifiedSession();
  forgetFeatureAccess();
  void clearOfflineResponses().catch(() => {});
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

  if (!refreshPromise || refreshPromise.token !== refresh) {
    const request = axios
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
        if (localStorage.getItem('auth_refresh_token') !== refresh) {
          throw new Error('Sign-in changed while refreshing the session.');
        }
        const access = data?.access;
        if (!access) throw new Error('Token refresh did not return an access token.');

        localStorage.setItem('auth_token', access);

        if (data?.refresh) {
          localStorage.setItem('auth_refresh_token', data.refresh);
        }

        return access;
      })
      .finally(() => {
        if (refreshPromise?.request === request) refreshPromise = null;
      });
    refreshPromise = { token: refresh, request };
  }

  return refreshPromise.request;
};

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    const method = String(config.method || 'get').toLowerCase();

    if (token && !isPublicAuthRequest(config.url)) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (offlineSnapshot() && !['get', 'head', 'options'].includes(method) &&
        !isPublicAuthRequest(config.url)) {
      const error = new Error('This action requires an internet connection. No changes were saved.');
      error.code = 'OFFLINE_WRITE_BLOCKED';
      return Promise.reject(error);
    }

    // A limited, device-local read-only copy of pages that this account
    // already visited online. Auth, permissions and binary files are excluded.
    if (offlineSnapshot() && offlineReadRequestKey(config)) {
      config.adapter = async request => {
        const cached = await readOfflineResponse(request).catch(() => ({ found: false }));
        if (!cached.found) {
          const error = new Error('This page has no saved offline data. Open it online once.');
          error.code = 'OFFLINE_CACHE_MISS';
          error.config = request;
          throw error;
        }
        request._cubixgearOfflineCache = true;
        return {
          data: cached.data,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          config: request,
        };
      };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => {
    if (!response.config?._cubixgearOfflineCache && offlineReadRequestKey(response.config)) {
      void rememberOfflineResponse(response.config, response.data).catch(() => {});
    }
    return response.data;
  },
  async (error) => {
    if (error?.code === 'OFFLINE_WRITE_BLOCKED' || error?.code === 'OFFLINE_CACHE_MISS') {
      return Promise.reject(error);
    }
    const responseStatus = error?.response?.status;
    if ((!responseStatus || [502, 503, 504].includes(responseStatus)) &&
        offlineReadRequestKey(error?.config)) {
      const cached = await readOfflineResponse(error.config).catch(() => ({ found: false }));
      if (cached.found) return cached.data;
    }
    const status = error?.response?.status;
    const originalRequest = error?.config;
    const isAuthRequest = isPublicAuthRequest(originalRequest?.url);
    const sentToken = originalRequest?.headers?.get?.('Authorization') || originalRequest?.headers?.Authorization;
    const currentToken = localStorage.getItem('auth_token');
    if (status === 401 && !isAuthRequest && sentToken !== `Bearer ${currentToken}`) {
      const expired = new Error('Sign-in changed. Retry with the current account.');
      expired.status = 401;
      return Promise.reject(expired);
    }

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._cubixgearRetried &&
      !isAuthRequest &&
      localStorage.getItem('auth_refresh_token')
    ) {
      originalRequest._cubixgearRetried = true;

      const refreshAtStart = localStorage.getItem('auth_refresh_token');
      let access;
      try {
        access = await refreshAccessToken();
      } catch (refreshError) {
        // Invalid/revoked refresh credentials end the session. A temporary
        // API outage must NOT destroy a valid saved session on every page.
        if ([400, 401, 403].includes(refreshError?.response?.status) &&
            localStorage.getItem('auth_refresh_token') === refreshAtStart) {
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

    const rawPayload = error?.response?.data;
    const responseType = error?.response?.headers?.get?.('content-type')
      || error?.response?.headers?.['content-type'] || '';
    const payload = isHtmlResponse(rawPayload, responseType) ? null : rawPayload;
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

    const message = safeApiErrorMessage({
      status, payload, responseType, firstFieldError,
      code: error?.code, fallback: error?.message,
    });

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
