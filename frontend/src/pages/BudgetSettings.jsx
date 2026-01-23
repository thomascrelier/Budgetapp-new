import { useState, useEffect } from 'react';
import api from '../services/api';
import BudgetProgressBar from '../components/BudgetProgressBar';

const CATEGORIES = [
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

export default function BudgetSettings({ selectedAccount }) {
  const [budgets, setBudgets] = useState([]);
  const [budgetStatus, setBudgetStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category_name: '',
    monthly_limit: '',
    alert_threshold: 75,
  });
  const [saving, setSaving] = useState(false);
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
      setBudgets(budgetsRes.data.budgets);
      setBudgetStatus(statusRes.data.budgets);
    } catch (err) {
      console.error('Failed to load budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.createBudget({
        category_name: formData.category_name,
        monthly_limit: parseFloat(formData.monthly_limit),
        alert_threshold: parseInt(formData.alert_threshold),
      });
      setShowForm(false);
      setFormData({ category_name: '', monthly_limit: '', alert_threshold: 75 });
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create budget');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete the budget for "${name}"?`)) {
      return;
    }

    try {
      await api.deleteBudget(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete budget:', err);
    }
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Get existing category names to filter out from form
  const existingCategories = budgets.map((b) => b.category_name);
  const availableCategories = CATEGORIES.filter((c) => !existingCategories.includes(c));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-charcoal">Budget Settings</h1>
          <p className="text-gray-500 mt-1">Set monthly spending limits by category</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={availableCategories.length === 0}
          className="px-4 py-2 bg-tiffany text-white font-medium rounded-lg hover:bg-tiffany-dark transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Budget
        </button>
      </div>

      {/* Create Budget Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-bold text-charcoal mb-4">Create New Budget</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Category
                </label>
                <select
                  value={formData.category_name}
                  onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany focus:border-transparent"
                >
                  <option value="">Select category...</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Monthly Limit ($)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={formData.monthly_limit}
                  onChange={(e) => setFormData({ ...formData, monthly_limit: e.target.value })}
                  required
                  placeholder="500"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Alert Threshold (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.alert_threshold}
                  onChange={(e) => setFormData({ ...formData, alert_threshold: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany focus:border-transparent"
                />
              </div>
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-tiffany text-white font-medium rounded-lg hover:bg-tiffany-dark transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Budget'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-100 text-charcoal font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Budget Status Overview */}
      {budgetStatus.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-bold text-charcoal mb-4">Current Month Progress</h2>
          <div className="space-y-4">
            {budgetStatus.map((status) => (
              <BudgetProgressBar
                key={status.category_name}
                category={status.category_name}
                spent={status.spent}
                limit={status.monthly_limit}
                percentage={status.percentage_used}
                status={status.status}
              />
            ))}
          </div>
        </div>
      )}

      {/* Budgets List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-charcoal">Budget Configuration</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-tiffany border-t-transparent"></div>
          </div>
        ) : budgets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-lg font-medium">No budgets configured</p>
            <p className="text-sm mt-1">Add a budget to start tracking your spending</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-tiffany-light">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-charcoal">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-charcoal">
                  Monthly Limit
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-charcoal">
                  Alert At
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-charcoal">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {budgets.map((budget) => (
                <tr key={budget.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-medium text-charcoal">{budget.category_name}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-tiffany font-semibold">
                      {formatCurrency(budget.monthly_limit)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-gray-600">{budget.alert_threshold}%</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(budget.id, budget.category_name)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
