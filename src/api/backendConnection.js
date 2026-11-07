import { API_CONFIG } from './apiConfig';

// Health requests bypass JWT interceptors: a temporary outage must never
// log a user out or cause an authentication redirect.
export async function checkBackendConnection(signal) {
  const baseUrl = String(API_CONFIG.baseURL || '/api/v1').replace(/\/+$/, '');
  const response = await fetch(baseUrl + '/ready/', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    cache: 'no-store',
    signal
  });

  if (response.status === 503) {
    const unavailable = new Error('The CubeGears database or a required backend service is unavailable.');
    unavailable.code = 'BACKEND_NOT_READY';
    throw unavailable;
  }
  if (!response.ok) {
    throw new Error('CubeGears API readiness check failed.');
  }

  const data = await response.json();
  if (data?.status !== 'ready' || data?.service !== 'cubegears-backend') {
    throw new Error('The configured URL is not a ready CubeGears backend.');
  }

  return {
    apiVersion: data.api_version || 'v1',
    requestId: response.headers.get('x-request-id') || data.request_id || null
  };
}
