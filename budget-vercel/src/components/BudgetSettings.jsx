'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

const DEFAULT_CATEGORIES = [
  'Groceries',
  'Dining',
  'Transportation',
  'Utilities',
  'Entertainment',
  'Shopping',
  'Healthcare',
  'Rent',
  'Insurance',
  'Other',
];

export default function BudgetSettings({ selectedAccount }) {
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [budgetStatus, setBudgetStatus] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category_name: '',
    monthly_limit: 0,
    alert_threshold: 80,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedAccount]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [budgetsRes, statusRes] = await Promise.all([
        api.getBudgets(),
        api.getBudgetStatus(null, selectedAccount),
      ]);
      setBudgets(budgetsRes.budgets || []);
      setBudgetStatus(statusRes.budgets || []);
    } catch (err) {
      console.error('Failed to load budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const data = await api.createBudget(formData);
      if (data.error) {
        setError(data.error);
      } else {
        setShowForm(false);
        setFormData({ category_name: '', monthly_limit: 0, alert_threshold: 80 });
        loadData();
      }
    } catch (err) {
      setError(err.message || 'Failed to create budget');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status, percentage) => {
    if (status === 'exceeded' || percentage >= 100) return 'text-negative';
    if (status === 'warning' || percentage >= 75) return 'text-warning';
    return 'text-positive';
  };

  const getProgressColor = (status, percentage) => {
    if (status === 'exceeded' || percentage >= 100) return 'bg-negative';
    if (status === 'warning' || percentage >= 75) return 'bg-warning';
    return 'bg-text-primary';
  };

  // Get unused categories
  const usedCategories = budgets.map(b => b.category_name);
  const availableCategories = DEFAULT_CATEGORIES.filter(c => !usedCategories.includes(c));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Budget Settings</h1>
          <p className="text-text-tertiary mt-1">Set spending limits by category</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-text-primary text-white rounded-lg font-medium hover:bg-neutral-800 transition-colors"
        >
          Add Budget
        </button>
      </div>

      {/* Budget Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-text-primary border-t-transparent"></div>
        </div>
      ) : budgetStatus.length === 0 ? (
        <div className="bg-surface rounded-xl shadow-sm border border-border p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-text-primary">No budgets set</h3>
          <p className="mt-2 text-text-tertiary">Create your first budget to start tracking spending.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 px-4 py-2 bg-text-primary text-white rounded-lg font-medium hover:bg-neutral-800 transition-colors"
          >
            Create Budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgetStatus.map((budget) => (
            <div key={budget.category_name} className="bg-surface rounded-xl shadow-sm border border-border p-4 md:p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-text-primary">{budget.category_name}</h3>
                  <p className={`text-sm mt-1 ${getStatusColor(budget.status, budget.percentage_used)}`}>
                    {budget.status === 'exceeded' ? 'Over budget!' :
                     budget.status === 'warning' ? 'Approaching limit' : 'On track'}
                  </p>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  budget.status === 'exceeded' ? 'bg-red-100 text-negative' :
                  budget.status === 'warning' ? 'bg-amber-100 text-warning' : 'bg-green-100 text-positive'
                }`}>
                  {budget.percentage_used.toFixed(0)}%
                </div>
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-tertiary">Spent</span>
                  <span className="font-medium text-text-primary">{formatCurrency(budget.spent)} / {formatCurrency(budget.monthly_limit)}</span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full">
                  <div
                    className={`h-full rounded-full transition-all ${getProgressColor(budget.status, budget.percentage_used)}`}
                    style={{ width: `${Math.min(budget.percentage_used, 100)}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-text-tertiary">Remaining</span>
                  <span className={budget.remaining >= 0 ? 'text-positive' : 'text-negative'}>
                    {formatCurrency(budget.remaining)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-text-tertiary">Alert at</span>
                  <span className="text-text-secondary">{budget.alert_threshold}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Budget Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-surface rounded-xl shadow-xl w-full max-w-md mx-4 p-4 md:p-6">
            <h2 className="text-lg font-bold text-text-primary mb-4">Create Budget</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Category
                </label>
                <select
                  value={formData.category_name}
                  onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-text-primary"
                >
                  <option value="">Select a category</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Monthly Limit
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.monthly_limit}
                    onChange={(e) => setFormData({ ...formData, monthly_limit: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full pl-8 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-text-primary"
                    placeholder="500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Alert Threshold (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.alert_threshold}
                  onChange={(e) => setFormData({ ...formData, alert_threshold: parseInt(e.target.value) || 80 })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-text-primary"
                />
                <p className="text-xs text-text-muted mt-1">You'll be alerted when spending reaches this percentage</p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formData.category_name || !formData.monthly_limit}
                  className="px-4 py-2 bg-text-primary text-white rounded-lg font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Creating...' : 'Create Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
