// API client for frontend use

const API_BASE = '/api';

// Resolves with the JSON body, or rejects with the API's `error` message (also for non-JSON failures).
async function request(url, options) {
  const res = await fetch(url, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  // A 200 may still carry `error` (the receipts route reports Drive problems that way): callers read it.
  if (!res.ok || !data) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

const jsonBody = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

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
    if (params.type) searchParams.set('type', params.type);
    if (params.search) searchParams.set('search', params.search);
    if (params.skip) searchParams.set('skip', params.skip);
    if (params.limit) searchParams.set('limit', params.limit);
    return fetch(`${API_BASE}/transactions?${searchParams}`).then(r => r.json());
  },
  updateTransaction: (id, fields) => fetch(`${API_BASE}/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  }).then(r => r.json()),
  updateCategory: (id, category) => api.updateTransaction(id, { category }),

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
  getBalanceHistory: (days = 30, accountIds) => {
    const searchParams = new URLSearchParams();
    searchParams.set('days', days);
    if (accountIds) searchParams.set('account_ids', accountIds);
    return fetch(`${API_BASE}/analytics/balance-history?${searchParams}`).then(r => r.json());
  },
  getRentalProperty: (year) => {
    const searchParams = new URLSearchParams();
    if (year) searchParams.set('year', year);
    return fetch(`${API_BASE}/analytics/rental-property?${searchParams}`).then(r => r.json());
  },

  // Settings
  getSettings: () => request(`${API_BASE}/settings`),
  saveSetting: (key, value) => request(`${API_BASE}/settings`, jsonBody('POST', { key, value })),

  // Tax (T776) and receipts. These reject with the API's error message.
  getT776: (year) => request(`${API_BASE}/rental/t776?year=${encodeURIComponent(year)}`),
  t776CsvUrl: (year) => `${API_BASE}/rental/t776?year=${encodeURIComponent(year)}&format=csv`,
  getReceipts: (year) => request(`${API_BASE}/receipts?year=${encodeURIComponent(year)}`),
  linkReceipt: (link) => request(`${API_BASE}/receipts/link`, jsonBody('POST', link)),
  unlinkReceipt: (driveFileId) => request(
    `${API_BASE}/receipts/link?drive_file_id=${encodeURIComponent(driveFileId)}`,
    { method: 'DELETE' },
  ),

  // Cache
  refreshData: () => fetch(`${API_BASE}/cache/refresh`, { method: 'POST' }).then(r => r.json()),

  // Import
  previewImport: async (file, accountId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (accountId) formData.append('account_id', accountId);
    return fetch(`${API_BASE}/import/preview`, { method: 'POST', body: formData }).then(r => r.json());
  },
  commitImport: (accountId, rows) => fetch(`${API_BASE}/import/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_id: accountId, rows }),
  }).then(r => r.json()),
};

export default api;
