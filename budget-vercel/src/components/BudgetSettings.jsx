'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';

export default function BudgetSettings() {
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [budgetStatus, setBudgetStatus] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ category_name: '', monthly_limit: 0, alert_threshold: 80 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [budgetsRes, statusRes, txnRes] = await Promise.all([
        api.getBudgets(),
        api.getBudgetStatus(),
        api.getTransactions({ limit: 1 }),
      ]);
      setBudgets(budgetsRes.budgets || []);
      setBudgetStatus(statusRes.budgets || []);
      if (txnRes.categories) setAllCategories(txnRes.categories);
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
      if (data.error) { setError(data.error); }
      else { setShowForm(false); setFormData({ category_name: '', monthly_limit: 0, alert_threshold: 80 }); loadData(); }
    } catch (err) {
      setError(err.message || 'Failed to create budget');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const getStatusColor = (status, percentage) => {
    if (status === 'exceeded' || percentage >= 100) return 'text-negative';
    if (status === 'warning' || percentage >= 75) return 'text-warning';
    return 'text-positive';
  };

  const getProgressColor = (status, percentage) => {
    if (status === 'exceeded' || percentage >= 100) return 'bg-negative';
    if (status === 'warning' || percentage >= 75) return 'bg-warning';
    return 'bg-accent';
  };

  const usedCategories = budgets.map(b => b.category_name);
  const availableCategories = allCategories.filter(c => !usedCategories.includes(c));

  const inputClasses = 'w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">Budget Settings</h1>
          <p className="text-text-tertiary mt-1">Set spending limits by category</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-accent text-background rounded-lg font-semibold hover:bg-accent-hover transition-colors text-sm">
          Add Budget
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-accent border-t-transparent"></div>
        </div>
      ) : budgetStatus.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-text-primary">No budgets set</h3>
          <p className="mt-2 text-text-tertiary">Create your first budget to start tracking spending.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 px-4 py-2 bg-accent text-background rounded-lg font-semibold hover:bg-accent-hover transition-colors text-sm">
            Create Budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgetStatus.map((budget) => (
            <div key={budget.category_name} className="glass-card rounded-xl p-4 md:p-6 hover:shadow-lg hover:shadow-black/20 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-text-primary">{budget.category_name}</h3>
                  <p className={`text-sm mt-1 ${getStatusColor(budget.status, budget.percentage_used)}`}>
                    {budget.status === 'exceeded' ? 'Over budget!' : budget.status === 'warning' ? 'Approaching limit' : 'On track'}
                  </p>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  budget.status === 'exceeded' ? 'bg-negative/10 text-negative' :
                  budget.status === 'warning' ? 'bg-warning/10 text-warning' : 'bg-positive/10 text-positive'
                }`}>
                  {budget.percentage_used.toFixed(0)}%
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-tertiary">Spent</span>
                  <span className="font-medium text-text-primary">{formatCurrency(budget.spent)} / {formatCurrency(budget.monthly_limit)}</span>
                </div>
                <div className="h-2 bg-surface-hover rounded-full">
                  <div className={`h-full rounded-full transition-all ${getProgressColor(budget.status, budget.percentage_used)}`} style={{ width: `${Math.min(budget.percentage_used, 100)}%` }} />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex justify-between text-sm">
                  <span className="text-text-tertiary">Remaining</span>
                  <span className={budget.remaining >= 0 ? 'text-positive' : 'text-negative'}>{formatCurrency(budget.remaining)}</span>
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

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
            />
            <motion.div
              className="relative glass-card rounded-xl shadow-2xl w-full max-w-md mx-4 p-4 md:p-6"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <h2 className="text-lg font-semibold text-text-primary mb-4">Create Budget</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Category</label>
                  <select value={formData.category_name} onChange={(e) => setFormData({ ...formData, category_name: e.target.value })} required className={inputClasses}>
                    <option value="">Select a category</option>
                    {availableCategories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Monthly Limit</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">$</span>
                    <input type="number" min="0" step="1" value={formData.monthly_limit} onChange={(e) => setFormData({ ...formData, monthly_limit: parseFloat(e.target.value) || 0 })} required className={`${inputClasses} pl-8`} placeholder="500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Alert Threshold (%)</label>
                  <input type="number" min="0" max="100" value={formData.alert_threshold} onChange={(e) => setFormData({ ...formData, alert_threshold: parseInt(e.target.value) || 80 })} className={inputClasses} />
                  <p className="text-xs text-text-muted mt-1">You'll be alerted when spending reaches this percentage</p>
                </div>
                {error && (
                  <div className="p-3 bg-negative/10 border border-negative/20 rounded-lg text-sm text-negative">{error}</div>
                )}
                <div className="flex justify-end gap-3 pt-4">
                  <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => setShowForm(false)} className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors">Cancel</motion.button>
                  <motion.button type="submit" whileTap={{ scale: 0.97 }} disabled={submitting || !formData.category_name || !formData.monthly_limit} className="px-4 py-2 bg-accent text-background rounded-lg font-semibold hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm">
                    {submitting ? 'Creating...' : 'Create Budget'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
