import apiClient from '../api/apiClient';
import { USE_MOCK_API } from '../api/apiConfig';

const requireLive = () => {
  if (USE_MOCK_API) {
    throw new Error('Customer credits require the live CubeGears Payments and Finance APIs.');
  }
};

const customerPath = (id) => '/customers/' + encodeURIComponent(id);
const paymentPath = (id) => '/payments/' + encodeURIComponent(id);

export const customerCreditService = {
  async getLedger(customerId) {
    requireLive();
    if (!customerId) throw new Error('Select a customer.');
    return apiClient.get(customerPath(customerId) + '/ledger');
  },
  async listAdvances(customerId) {
    requireLive();
    return apiClient.get('/payments/advances', { params: { customerId } });
  },
  async applyAdvance(advanceId, invoiceId, amount, requestKey) {
    requireLive();
    return apiClient.post(paymentPath(advanceId) + '/apply-advance', {
      invoiceId, amount, idempotency_key: requestKey,
    });
  },
  async reverseApplication(advanceId, applicationId, reason) {
    requireLive();
    return apiClient.post(paymentPath(advanceId) + '/reverse-advance-application', {
      applicationId, reason,
    });
  },
  async refundAdvance(advanceId, { amount, accountId, method, reference, reason, requestKey }) {
    requireLive();
    return apiClient.post(paymentPath(advanceId) + '/refund-advance', {
      amount, accountId, method, reference, reason,
      idempotency_key: requestKey,
    });
  },
};
