import apiClient from '../api/apiClient';

const BASE = '/finance';

export const financeService = {
  getDashboard: (params = {}) => apiClient.get(`${BASE}/dashboard`, { params }),
  getPaymentActivity: (params = {}) => apiClient.get(`${BASE}/payment-activity`, { params }),

  // Accounts
  listAccounts: (params = {}) => apiClient.get(`${BASE}/accounts`, { params }),
  createAccount: (data) => apiClient.post(`${BASE}/accounts`, data),
  getAccount: (id) => apiClient.get(`${BASE}/accounts/${id}`),
  updateAccount: (id, data) => apiClient.patch(`${BASE}/accounts/${id}`, data),
  adjustBalance: (id, data) => apiClient.post(`${BASE}/accounts/${id}/adjust`, data),

  // Transfers
  listTransfers: () => apiClient.get(`${BASE}/transfers`),
  createTransfer: (data) => apiClient.post(`${BASE}/transfers`, data),

  // Ledger
  getLedger: (params = {}) => apiClient.get(`${BASE}/ledger`, { params }),
  // Download via the JWT-aware API client. window.open() omits Authorization.
  exportLedgerCSV: async (params = {}) => {
    const blob = await apiClient.get(`${BASE}/ledger`, {
      params: { ...params, export: 'csv' },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = 'cubegears-transactions.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  },

  exportLedgerPDF: async (params = {}) => {
    const blob = await apiClient.get(`${BASE}/ledger`, {
      params: { ...params, export: 'pdf' }, responseType: 'blob',
    });
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = 'cubegears-transactions.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  },

  // Part 14: audited accounting projection (no direct bank-balance edits).
  getChart: () => apiClient.get(`${BASE}/chart`),
  getJournals: () => apiClient.get(`${BASE}/journals`),
  postJournal: (payload) => apiClient.post(`${BASE}/journals`, payload),
  getStatement: (report, params = {}) => apiClient.get(
    `${BASE}/statements/${encodeURIComponent(report)}`, { params },
  ),
  getReconciliations: () => apiClient.get(`${BASE}/bank-reconciliations`),
  getReconciliationCandidates: (params = {}) => apiClient.get(
    `${BASE}/bank-reconciliations/candidates`, { params },
  ),
  reconcileBank: (payload) => apiClient.post(`${BASE}/bank-reconciliations`, payload),

  // Reports
  getReports: (params = {}) => apiClient.get(`${BASE}/reports`, { params }),
};

