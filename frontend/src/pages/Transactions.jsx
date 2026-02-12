import { useState, useEffect } from 'react';
import api from '../services/api';

const DEFAULT_CATEGORIES = [
  'Uncategorized',
  'Groceries',
  'Dining',
  'Transportation',
  'Entertainment',
  'Shopping',
  'Utilities',
  'Healthcare',
  'Housing',
  'Income',
  'Savings',
  'Other',
];

export default function Transactions({ selectedAccount }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [editingCategory, setEditingCategory] = useState(null);
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customCategories, setCustomCategories] = useState(() => {
    const saved = localStorage.getItem('customCategories');
    return saved ? JSON.parse(saved) : [];
  });

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];
  const limit = 50;

  useEffect(() => {
    loadTransactions();
  }, [selectedAccount, page, sortBy, sortOrder]);

  useEffect(() => {
    localStorage.setItem('customCategories', JSON.stringify(customCategories));
  }, [customCategories]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (selectedAccount) {
        params.account_id = selectedAccount;
      }

      const response = await api.getTransactions(params);
      setTransactions(response.data.transactions);
      setTotalPages(response.data.total_pages);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleCategoryChange = async (transactionId, newCategory) => {
    if (newCategory === '__custom__') {
      setShowCustomInput(true);
      return;
    }
    try {
      await api.updateCategory(transactionId, newCategory);
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId ? { ...t, category: newCategory } : t
        )
      );
      setEditingCategory(null);
      setShowCustomInput(false);
      setCustomCategory('');
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const handleCustomCategorySubmit = async (transactionId) => {
    if (!customCategory.trim()) return;

    const newCat = customCategory.trim();
    if (!customCategories.includes(newCat) && !DEFAULT_CATEGORIES.includes(newCat)) {
      setCustomCategories((prev) => [...prev, newCat]);
    }

    await handleCategoryChange(transactionId, newCat);
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const SortIcon = ({ field }) => {
    if (sortBy !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-charcoal">Transactions</h1>
          <p className="text-gray-500 mt-1">
            {total} transaction{total !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-primary-light">
              <tr>
                <th
                  className="px-6 py-4 text-left text-sm font-semibold text-charcoal cursor-pointer hover:bg-primary-100 transition-colors"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-2">
                    Date
                    <SortIcon field="date" />
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-left text-sm font-semibold text-charcoal cursor-pointer hover:bg-primary-100 transition-colors"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center gap-2">
                    Description
                    <SortIcon field="description" />
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-right text-sm font-semibold text-charcoal cursor-pointer hover:bg-primary-100 transition-colors"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Amount
                    <SortIcon field="amount" />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-charcoal">
                  Category
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No transactions found. Upload a CSV to get started!
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => {
                  const isExpense = parseFloat(transaction.amount) < 0;
                  return (
                    <tr
                      key={transaction.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-charcoal font-medium truncate block max-w-xs">
                          {transaction.description}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`text-sm font-semibold ${
                            isExpense ? 'text-accent' : 'text-green-600'
                          }`}
                        >
                          {formatCurrency(transaction.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {editingCategory === transaction.id ? (
                          <div className="flex flex-col gap-2">
                            {showCustomInput ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  autoFocus
                                  value={customCategory}
                                  onChange={(e) => setCustomCategory(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleCustomCategorySubmit(transaction.id);
                                    } else if (e.key === 'Escape') {
                                      setShowCustomInput(false);
                                      setCustomCategory('');
                                      setEditingCategory(null);
                                    }
                                  }}
                                  placeholder="Type category name..."
                                  className="px-3 py-1.5 text-sm border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent w-40"
                                />
                                <button
                                  onClick={() => handleCustomCategorySubmit(transaction.id)}
                                  className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setShowCustomInput(false);
                                    setCustomCategory('');
                                  }}
                                  className="px-3 py-1.5 text-sm bg-gray-200 text-charcoal rounded-lg hover:bg-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <select
                                autoFocus
                                value={transaction.category || 'Uncategorized'}
                                onChange={(e) =>
                                  handleCategoryChange(transaction.id, e.target.value)
                                }
                                onBlur={() => {
                                  if (!showCustomInput) {
                                    setEditingCategory(null);
                                  }
                                }}
                                className="px-3 py-1.5 text-sm border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                              >
                                {allCategories.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                                <option value="__custom__">+ Add custom category...</option>
                              </select>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingCategory(transaction.id)}
                            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-primary-light text-charcoal rounded-lg transition-colors flex items-center gap-1"
                          >
                            {transaction.category || 'Uncategorized'}
                            <svg
                              className="w-3 h-3 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm font-medium text-charcoal bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
