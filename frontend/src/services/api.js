import axios from 'axios';

// Use environment variable for production, fallback to localhost for development
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Accounts
  getAccounts: () => client.get('/accounts/'),
  createAccount: (data) => client.post('/accounts/', data),
  updateAccount: (id, data) => client.put(`/accounts/${id}`, data),
  deleteAccount: (id) => client.delete(`/accounts/${id}`),
  getAccountBalance: (id) => client.get(`/accounts/${id}/balance`),

  // Transactions
  getTransactions: (params = {}) => client.get('/transactions/', { params }),
  updateTransaction: (id, data) => client.put(`/transactions/${id}`, data),
  updateCategory: (id, category) => client.patch(`/transactions/${id}/category`, { category }),
  toggleVerify: (id) => client.patch(`/transactions/${id}/verify`),
  deleteTransaction: (id) => client.delete(`/transactions/${id}`),
  getCategories: () => client.get('/transactions/categories'),

  // Budgets
  getBudgets: () => client.get('/budgets/'),
  createBudget: (data) => client.post('/budgets/', data),
  updateBudget: (id, data) => client.put(`/budgets/${id}`, data),
  deleteBudget: (id) => client.delete(`/budgets/${id}`),
  getBudgetStatus: (month = null, accountIds = null) => {
    const params = {};
    if (month) params.month = month;
    if (accountIds) params.account_ids = accountIds;
    return client.get('/budgets/status', { params });
  },

  // Analytics
  getDashboard: (accountIds = null) => {
    const params = {};
    if (accountIds) params.account_ids = accountIds;
    return client.get('/analytics/dashboard', { params });
  },
  getCashFlow: (months = 6, accountIds = null) => {
    const params = { months };
    if (accountIds) params.account_ids = accountIds;
    return client.get('/analytics/cash-flow', { params });
  },
  getBalanceHistory: (days = 30, accountId = null) => {
    const params = { days };
    if (accountId) params.account_id = accountId;
    return client.get('/analytics/balance-history', { params });
  },
  getSpendingByCategory: (month = null, accountIds = null) => {
    const params = {};
    if (month) params.month = month;
    if (accountIds) params.account_ids = accountIds;
    return client.get('/analytics/spending-by-category', { params });
  },
  getRentalPropertyAnalytics: () => client.get('/analytics/rental-property'),
  initializeDefaultAccounts: () => client.post('/accounts/initialize-defaults'),

  // Upload
  uploadCSV: async (file, accountId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('account_id', accountId);
    return client.post('/upload/csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  previewCSV: async (file, accountId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('account_id', accountId);
    return client.post('/upload/csv/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  deleteBatch: (batchId) => client.delete(`/upload/batch/${batchId}`),
};

export default api;
