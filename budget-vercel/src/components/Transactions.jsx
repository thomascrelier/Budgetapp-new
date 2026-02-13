'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';

const CATEGORIES = [
  'Uncategorized',
  'Groceries',
  'Dining',
  'Transportation',
  'Utilities',
  'Entertainment',
  'Shopping',
  'Pharmacy',
  'Medical',
  'Therapy',
  'Veterinary',
  'Income',
  'Rental Income',
  'Rent',
  'Electricity',
  'Gas',
  'Water',
  'Internet',
  'Insurance',
  'Property Tax',
  'Maintenance',
  'HOA',
  'Transfer',
  'Other',
];

export default function Transactions({ selectedAccount }) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [customCategory, setCustomCategory] = useState('');
  const [editingId, setEditingId] = useState(null);
  const limit = 50;

  // Filter state
  const [accounts, setAccounts] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [filterAccount, setFilterAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterAmountType, setFilterAmountType] = useState(''); // '', 'income', 'expense'
  const searchTimeout = useRef(null);

  // Load accounts list on mount
  useEffect(() => {
    api.getAccounts().then(data => {
      setAccounts((data.accounts || []).sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, []);

  // Sync parent selectedAccount into filter
  useEffect(() => {
    setFilterAccount(selectedAccount ? String(selectedAccount) : '');
  }, [selectedAccount]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [filterAccount, filterCategory, filterSearch, filterStartDate, filterEndDate, filterAmountType]);

  useEffect(() => {
    loadTransactions();
  }, [filterAccount, filterCategory, filterSearch, filterStartDate, filterEndDate, filterAmountType, page]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        skip: page * limit,
        limit,
      };
      if (filterAccount) params.account_id = filterAccount;
      if (filterCategory) params.category = filterCategory;
      if (filterSearch) params.search = filterSearch;
      if (filterStartDate) params.start_date = filterStartDate;
      if (filterEndDate) params.end_date = filterEndDate;

      const data = await api.getTransactions(params);
      let txns = data.transactions || [];

      // Client-side amount type filter
      if (filterAmountType === 'income') {
        txns = txns.filter(t => t.amount > 0);
      } else if (filterAmountType === 'expense') {
        txns = txns.filter(t => t.amount < 0);
      }

      setTransactions(txns);
      setTotal(data.total || 0);
      if (data.categories) {
        setAvailableCategories(data.categories);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchInput = (value) => {
    // Debounce search input
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setFilterSearch(value);
    }, 300);
  };

  const handleCategoryChange = async (id, category) => {
    if (category === 'custom') {
      setEditingId(id);
      setCustomCategory('');
      return;
    }

    try {
      await api.updateCategory(id, category);
      setTransactions(transactions.map(t =>
        t.id === id ? { ...t, category } : t
      ));
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const handleCustomCategorySubmit = async (id) => {
    if (!customCategory.trim()) return;

    try {
      await api.updateCategory(id, customCategory.trim());
      setTransactions(transactions.map(t =>
        t.id === id ? { ...t, category: customCategory.trim() } : t
      ));
      setEditingId(null);
      setCustomCategory('');
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const hasActiveFilters = filterAccount || filterCategory || filterSearch || filterStartDate || filterEndDate || filterAmountType;

  const clearFilters = () => {
    setFilterAccount('');
    setFilterCategory('');
    setFilterSearch('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterAmountType('');
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Transactions</h1>
          <p className="text-text-tertiary mt-1">
            {total} transactions{hasActiveFilters ? ' (filtered)' : ''}
          </p>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface-hover transition-colors text-text-secondary"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-surface rounded-xl shadow-sm border border-border p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-text-tertiary mb-1">Search</label>
            <input
              type="text"
              placeholder="Description..."
              defaultValue={filterSearch}
              onChange={(e) => handleSearchInput(e.target.value)}
              className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-text-primary"
            />
          </div>

          {/* Account */}
          <div>
            <label className="block text-xs font-medium text-text-tertiary mb-1">Account</label>
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-text-primary"
            >
              <option value="">All accounts</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-text-tertiary mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-text-primary"
            >
              <option value="">All categories</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-text-tertiary mb-1">From</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-text-primary"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-medium text-text-tertiary mb-1">To</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-text-primary"
            />
          </div>

          {/* Amount Type */}
          <div>
            <label className="block text-xs font-medium text-text-tertiary mb-1">Amount</label>
            <select
              value={filterAmountType}
              onChange={(e) => setFilterAmountType(e.target.value)}
              className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-text-primary"
            >
              <option value="">All</option>
              <option value="income">Income only</option>
              <option value="expense">Expenses only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-text-primary border-t-transparent"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-text-tertiary">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-surface-hover transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                        {transaction.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                        {transaction.account_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-text-primary max-w-md truncate">
                        {transaction.description}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                        transaction.amount >= 0 ? 'text-positive' : 'text-negative'
                      }`}>
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {editingId === transaction.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={customCategory}
                              onChange={(e) => setCustomCategory(e.target.value)}
                              placeholder="Enter category"
                              className="px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-text-primary"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCustomCategorySubmit(transaction.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                            <button
                              onClick={() => handleCustomCategorySubmit(transaction.id)}
                              className="px-2 py-1 bg-text-primary text-white rounded text-xs hover:bg-neutral-800"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 text-text-tertiary hover:text-text-primary text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <select
                            value={CATEGORIES.includes(transaction.category) ? transaction.category : 'custom'}
                            onChange={(e) => handleCategoryChange(transaction.id, e.target.value)}
                            className="px-2 py-1 border border-border rounded bg-surface focus:outline-none focus:ring-2 focus:ring-text-primary text-sm"
                          >
                            {!CATEGORIES.includes(transaction.category) && (
                              <option value="custom">{transaction.category}</option>
                            )}
                            {CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                            <option value="custom">+ Custom...</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <p className="text-sm text-text-tertiary">
              Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1 border border-border rounded text-sm hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 border border-border rounded text-sm hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
