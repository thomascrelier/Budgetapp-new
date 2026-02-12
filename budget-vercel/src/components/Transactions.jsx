'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

const CATEGORIES = [
  'Uncategorized',
  'Groceries',
  'Dining',
  'Transportation',
  'Utilities',
  'Entertainment',
  'Shopping',
  'Healthcare',
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

  useEffect(() => {
    loadTransactions();
  }, [selectedAccount, page]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        skip: page * limit,
        limit,
      };
      if (selectedAccount) {
        params.account_id = selectedAccount;
      }
      const data = await api.getTransactions(params);
      setTransactions(data.transactions || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
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

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Transactions</h1>
        <p className="text-text-tertiary mt-1">
          {total} transactions {selectedAccount && '(filtered)'}
        </p>
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
                {transactions.map((transaction) => (
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
                ))}
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
