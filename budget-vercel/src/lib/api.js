// API client for frontend use

const API_BASE = '/api';

export const api = {
  // Accounts
  getAccounts: () => fetch(`${API_BASE}/accounts`).then(r => r.json()),
  createAccount: (data) => fetch(`${API_BASE}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json()),
  initializeDefaultAccounts: () => fetch(`${API_BASE}/accounts/initialize-defaults`, {
    method: 'POST',
  }).then(r => r.json()),

  // Transactions
  getTransactions: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.account_id) searchParams.set('account_id', params.account_id);
    if (params.category) searchParams.set('category', params.category);
    if (params.start_date) searchParams.set('start_date', params.start_date);
    if (params.end_date) searchParams.set('end_date', params.end_date);
    if (params.search) searchParams.set('search', params.search);
    if (params.skip) searchParams.set('skip', params.skip);
    if (params.limit) searchParams.set('limit', params.limit);
    return fetch(`${API_BASE}/transactions?${searchParams}`).then(r => r.json());
  },
  updateCategory: (id, category) => fetch(`${API_BASE}/transactions/${id}/category`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category }),
  }).then(r => r.json()),

  // Budgets
  getBudgets: () => fetch(`${API_BASE}/budgets`).then(r => r.json()),
  createBudget: (data) => fetch(`${API_BASE}/budgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json()),
  getBudgetStatus: (month, accountIds) => {
    const searchParams = new URLSearchParams();
    if (month) searchParams.set('month', month);
    if (accountIds) searchParams.set('account_ids', accountIds);
    return fetch(`${API_BASE}/budgets/status?${searchParams}`).then(r => r.json());
  },

  // Analytics
  getDashboard: (accountIds) => {
    const searchParams = new URLSearchParams();
    if (accountIds) searchParams.set('account_ids', accountIds);
    return fetch(`${API_BASE}/analytics/dashboard?${searchParams}`).then(r => r.json());
  },
  getCashFlow: (months = 6, accountIds) => {
    const searchParams = new URLSearchParams();
    searchParams.set('months', months);
    if (accountIds) searchParams.set('account_ids', accountIds);
    return fetch(`${API_BASE}/analytics/cash-flow?${searchParams}`).then(r => r.json());
  },
  getBalanceHistory: (days = 30, accountId) => {
    const searchParams = new URLSearchParams();
    searchParams.set('days', days);
    if (accountId) searchParams.set('account_id', accountId);
    return fetch(`${API_BASE}/analytics/balance-history?${searchParams}`).then(r => r.json());
  },
  getRentalProperty: (year) => {
    const searchParams = new URLSearchParams();
    if (year) searchParams.set('year', year);
    return fetch(`${API_BASE}/analytics/rental-property?${searchParams}`).then(r => r.json());
  },

  // Cache
  refreshData: () => fetch(`${API_BASE}/cache/refresh`, { method: 'POST' }).then(r => r.json()),

  // Upload
  uploadCSV: async (file, accountId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('account_id', accountId);
    return fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    }).then(r => r.json());
  },
};

export default api;
