const envBaseUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  '';

const configuredBaseUrl = String(
  envBaseUrl ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8000/api/v1' : '')
).trim().replace(/\/+$/, '');

const explicitMockMode = import.meta.env.VITE_USE_MOCK_API;
const requestedMockMode =
  explicitMockMode == null
    ? null
    : String(explicitMockMode).toLowerCase() === 'true';

/*
 * CubixGear API runtime:
 * - Local development defaults to Django at http://127.0.0.1:8000/api/v1.
 * - Set VITE_API_URL for staging/production.
 * - Set VITE_USE_MOCK_API=true only when you explicitly want demo/mock data.
 */
export const USE_MOCK_API =
  !import.meta.env.PROD &&
  (requestedMockMode === true ||
    (!configuredBaseUrl && requestedMockMode !== false));

if (import.meta.env.PROD && !configuredBaseUrl && !USE_MOCK_API) {
  console.warn('[CubixGear] VITE_API_URL is missing. Real API mode has no backend URL.');
}

export const API_CONFIG = {
  baseURL: configuredBaseUrl || '/api/v1',
  timeout: Number(import.meta.env.VITE_API_TIMEOUT || 15000),
  withCredentials: String(import.meta.env.VITE_API_WITH_CREDENTIALS || 'false') === 'true',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
};

export const API_BASE_URL = API_CONFIG.baseURL;
