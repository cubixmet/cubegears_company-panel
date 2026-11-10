import { USE_MOCK_API } from '../api/apiConfig';
import { API_ENDPOINTS } from '../api/endpoints';
import apiClient from '../api/apiClient';
import { expenseToApiPayload, normalizeExpense } from './expense.mapper';
import {
  getMockExpenses,
  addMockExpense,
  getMockExpenseById,
  updateMockExpense,
  deleteMockExpense
} from '../mock/expenses.mock';

const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

export const getExpenses = async (params) => {
  if (USE_MOCK_API) {
    await delay();
    let rows = getMockExpenses();
    const q = String(params?.search || '').trim().toLowerCase();
    if (q) {
      rows = rows.filter((expense) =>
        [
          expense.id,
          expense.title,
          expense.category,
          expense.vendor,
          expense.referenceNo,
          expense.paymentMethod
        ].some((value) => String(value || '').toLowerCase().includes(q))
      );
    }
    return rows.map(normalizeExpense);
  }
  const response = await apiClient.get(API_ENDPOINTS.EXPENSES, { params });
  const rows = Array.isArray(response) ? response : response?.results;
  if (!Array.isArray(rows)) throw new Error('Unexpected expense list response.');
  return rows.map(normalizeExpense);
};

export const getExpenseById = async (id) => {
  if (USE_MOCK_API) {
    await delay();
    const row = getMockExpenseById(id);
    return row ? normalizeExpense(row) : null;
  }
  const row = await apiClient.get(`${API_ENDPOINTS.EXPENSES}/${id}`);
  return row ? normalizeExpense(row) : null;
};

export const createExpense = async (data) => {
  const payload = expenseToApiPayload(data);
  if (USE_MOCK_API) {
    await delay();
    return normalizeExpense(addMockExpense(data));
  }
  const row = await apiClient.post(API_ENDPOINTS.EXPENSES, payload);
  return normalizeExpense(row);
};

export const updateExpense = async (id, data) => {
  const payload = expenseToApiPayload(data);
  if (USE_MOCK_API) {
    await delay();
    const row = updateMockExpense(id, data);
    return row ? normalizeExpense(row) : null;
  }
  const row = await apiClient.put(`${API_ENDPOINTS.EXPENSES}/${id}`, payload);
  return normalizeExpense(row);
};

export const deleteExpense = async (id) => {
  if (USE_MOCK_API) {
    await delay();
    return deleteMockExpense(id);
  }
  return apiClient.delete(`${API_ENDPOINTS.EXPENSES}/${id}`);
};

export const getExpenseBudgets = async (month) => {
  if (USE_MOCK_API) return [];
  const response = await apiClient.get(`${API_ENDPOINTS.EXPENSES}/budgets`, {
    params: { month },
  });
  const rows = Array.isArray(response) ? response : response?.results;
  if (!Array.isArray(rows)) throw new Error('Unable to load budget items.');
  return rows;
};

export const createExpenseBudget = async (values) => {
  if (USE_MOCK_API) throw new Error('Budget creation requires the live Django backend.');
  return apiClient.post(`${API_ENDPOINTS.EXPENSES}/budgets`, values);
};

export const updateExpenseBudget = async (id, values) => {
  if (USE_MOCK_API) throw new Error('Budget updates require the live Django backend.');
  return apiClient.patch(`${API_ENDPOINTS.EXPENSES}/budgets/${encodeURIComponent(id)}`, values);
};

export const expenseService = {
  getExpenses,
  getExpenseBudgets,
  createExpenseBudget,
  updateExpenseBudget,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  settleExpense: (id, data) => {
    if (USE_MOCK_API) throw new Error('Expense settlement requires the live backend.');
    return apiClient.post(`${API_ENDPOINTS.EXPENSES}/${id}/settle`, data);
  },
  reverseSettlement: (id, settlementId, reason) => {
    if (USE_MOCK_API) throw new Error('Expense reversal requires the live backend.');
    return apiClient.post(`${API_ENDPOINTS.EXPENSES}/${id}/settlements/${settlementId}/reverse`, { reason });
  },
  getAll: getExpenses,
  getById: getExpenseById,
  create: createExpense,
  update: updateExpense,
  delete: deleteExpense
};
