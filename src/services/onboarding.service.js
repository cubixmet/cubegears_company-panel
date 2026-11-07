import apiClient from '../api/apiClient';

// Every operation uses the authenticated company's Django API and existing
// company/branch/settings records. No local-storage or mock setup state.
const ROOT = '/company/onboarding';

export const onboardingService = {
  get: () => apiClient.get(ROOT),
  saveStep: (step, data) => apiClient.patch(ROOT, { step, data }),
  complete: () => apiClient.post(ROOT + '/complete', {}),
};
