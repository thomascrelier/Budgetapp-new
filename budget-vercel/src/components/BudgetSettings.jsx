'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';

const EMPTY_FORM = { category_name: '', monthly_limit: '', alert_threshold: '80' };

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

// One source of truth for a budget's state. The server derives `status` from the budget's own alert
// threshold; the old client also recolored at a fixed 75%, so a card could read "On track" in amber.
const TONES = {
  exceeded: { label: 'Over budget', text: 'text-negative', pill: 'bg-negative/10 text-negative', bar: 'bg-negative' },
  warning: { label: 'Approaching limit', text: 'text-warning', pill: 'bg-warning/10 text-warning', bar: 'bg-warning' },
  on_track: { label: 'On track', text: 'text-positive', pill: 'bg-positive/10 text-positive', bar: 'bg-accent' },
};
const toneFor = (budget) => TONES[budget.status] || TONES.on_track;

function validate(form) {
  const errors = {};
  if (!form.category_name) errors.category_name = 'Choose a category.';
  const limit = Number(form.monthly_limit);
  if (form.monthly_limit === '' || !Number.isFinite(limit) || limit <= 0) {
    errors.monthly_limit = 'Enter a monthly limit above $0.';
  }
  const threshold = Number(form.alert_threshold);
  if (form.alert_threshold === '' || !Number.isInteger(threshold) || threshold < 1 || threshold > 100) {
    errors.alert_threshold = 'Enter a whole number from 1 to 100.';
  }
  return errors;
}

export default function BudgetSettings() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [budgetStatus, setBudgetStatus] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const submittingRef = useRef(false);
  submittingRef.current = submitting;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [budgetsRes, statusRes, txnRes] = await Promise.all([
        api.getBudgets(),
        api.getBudgetStatus(),
        api.getTransactions({ limit: 1 }),
      ]);
      const apiError = budgetsRes.error || statusRes.error;
      if (apiError) throw new Error(apiError);
      setBudgets(budgetsRes.budgets || []);
      setBudgetStatus(statusRes.budgets || []);
      if (txnRes.categories) setAllCategories(txnRes.categories);
    } catch (err) {
      console.error('Failed to load budgets:', err);
      setLoadError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const openForm = (e) => {
    returnFocusRef.current = e?.currentTarget || null;
    setFormData(EMPTY_FORM);
    setFieldErrors({});
    setError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    if (submittingRef.current) return;
    setShowForm(false);
  };

  // Dialog: Escape closes, Tab stays inside, focus returns to the button that opened it.
  useEffect(() => {
    if (!showForm) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeForm(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll('select, input, button:not([disabled])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      returnFocusRef.current?.focus?.();
    };
  }, [showForm]);

  const updateField = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const errors = validate(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      const firstInvalid = dialogRef.current?.querySelector(`[name="${Object.keys(errors)[0]}"]`);
      firstInvalid?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload = {
      category_name: formData.category_name,
      monthly_limit: parseFloat(formData.monthly_limit),
      alert_threshold: parseInt(formData.alert_threshold, 10),
    };
    try {
      const data = await api.createBudget(payload);
      if (data.error) {
        setError(`Couldn't create the budget: ${data.error}`);
      } else {
        setShowForm(false);
        setFormData(EMPTY_FORM);
        setAnnouncement(`Budget for ${payload.category_name} created: ${formatCurrency(payload.monthly_limit)} a month.`);
        loadData();
      }
    } catch (err) {
      setError(`Couldn't create the budget: ${err.message || 'network error'}. Check your connection and try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  const usedCategories = budgets.map(b => b.category_name);
  const availableCategories = allCategories.filter(c => !usedCategories.includes(c));

  const inputClasses = 'w-full min-h-11 px-3 border rounded-lg bg-surface text-text-primary text-base md:text-sm transition-colors focus:border-accent-text';
  const fieldBorder = (name) => (fieldErrors[name] ? 'border-negative' : 'border-border');
  const primaryButton = 'min-h-11 px-4 bg-accent text-on-accent rounded-lg font-semibold hover:bg-accent-hover transition-colors text-sm disabled:opacity-60 disabled:cursor-wait';
  const errId = (name) => `budget-${name}-error`;
  const describe = (name, hintId) => [fieldErrors[name] ? errId(name) : null, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-6">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>

      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">Budget Settings</h1>
          <p className="text-text-tertiary mt-1">Set spending limits by category</p>
        </div>
        {!loadError && budgetStatus.length > 0 && (
          <button type="button" onClick={openForm} className={primaryButton}>
            Add Budget
          </button>
        )}
      </div>

      {loading && budgetStatus.length === 0 ? (
        <div className="flex items-center justify-center h-64" role="status">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" aria-hidden="true"></div>
          <span className="sr-only">Loading budgets</span>
        </div>
      ) : loadError ? (
        <div className="glass-card rounded-xl p-8 md:p-12 text-center" role="alert">
          <h2 className="text-lg font-medium text-text-primary">Couldn&rsquo;t load budgets</h2>
          <p className="mt-2 text-text-tertiary">{loadError}. Check your connection and try again.</p>
          <button type="button" onClick={loadData} className="mt-4 min-h-11 px-4 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors">
            Retry
          </button>
        </div>
      ) : budgetStatus.length === 0 ? (
        <div className="glass-card rounded-xl p-8 md:p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h2 className="mt-4 text-lg font-medium text-text-primary">No budgets set</h2>
          <p className="mt-2 text-text-tertiary">Create your first budget to start tracking spending.</p>
          <button type="button" onClick={openForm} className={`${primaryButton} mt-4`}>
            Create Budget
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgetStatus.map((budget) => {
            const tone = toneFor(budget);
            const pct = Math.round(budget.percentage_used);
            const over = budget.spent - budget.monthly_limit;
            return (
              <li key={budget.category_name} className="glass-card rounded-xl p-4 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-text-primary break-words">{budget.category_name}</h2>
                    <p className={`text-sm mt-1 ${tone.text}`}>{tone.label}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-semibold tabular ${tone.pill}`}>
                    {pct}%
                  </span>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between gap-3 text-sm mb-2">
                    <span className="text-text-tertiary">Spent</span>
                    <span className="font-medium text-text-primary tabular text-right">
                      {formatCurrency(budget.spent)} <span className="text-text-muted">/ {formatCurrency(budget.monthly_limit)}</span>
                    </span>
                  </div>
                  <div
                    className="h-2 bg-surface-hover rounded-full overflow-hidden"
                    role="progressbar"
                    aria-label={`${budget.category_name}: ${pct}% of monthly limit used`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(pct, 100)}
                    aria-valuetext={`${pct}% used, ${tone.label.toLowerCase()}`}
                  >
                    <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${tone.bar}`} style={{ width: `${Math.min(budget.percentage_used, 100)}%` }} />
                  </div>
                </div>
                <dl className="mt-4 pt-4 border-t border-border text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-tertiary">{over > 0 ? 'Over by' : 'Remaining'}</dt>
                    <dd className={`tabular ${over > 0 ? 'text-negative font-medium' : 'text-positive'}`}>
                      {formatCurrency(over > 0 ? over : budget.remaining)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 mt-1">
                    <dt className="text-text-tertiary">Alert at</dt>
                    <dd className="text-text-secondary tabular">{budget.alert_threshold}%</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeForm}
              aria-hidden="true"
            />
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-budget-title"
              className="relative glass-card rounded-xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 md:p-6"
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            >
              <h2 id="create-budget-title" className="text-lg font-semibold text-text-primary mb-4">Create Budget</h2>
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label htmlFor="budget-category" className="block text-sm font-medium text-text-secondary mb-2">Category</label>
                  <select
                    id="budget-category"
                    name="category_name"
                    autoFocus
                    value={formData.category_name}
                    onChange={(e) => updateField('category_name', e.target.value)}
                    aria-invalid={fieldErrors.category_name ? true : undefined}
                    aria-describedby={describe('category_name', availableCategories.length === 0 ? 'budget-category-hint' : null)}
                    className={`${inputClasses} ${fieldBorder('category_name')}`}
                  >
                    <option value="">Select a category</option>
                    {availableCategories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                  {availableCategories.length === 0 && (
                    <p id="budget-category-hint" className="text-xs text-text-muted mt-1">Every category already has a budget.</p>
                  )}
                  {fieldErrors.category_name && <p id={errId('category_name')} className="text-xs text-negative mt-1">{fieldErrors.category_name}</p>}
                </div>
                <div>
                  <label htmlFor="budget-limit" className="block text-sm font-medium text-text-secondary mb-2">Monthly Limit</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" aria-hidden="true">$</span>
                    <input
                      id="budget-limit"
                      name="monthly_limit"
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="1"
                      value={formData.monthly_limit}
                      onChange={(e) => updateField('monthly_limit', e.target.value)}
                      aria-invalid={fieldErrors.monthly_limit ? true : undefined}
                      aria-describedby={describe('monthly_limit')}
                      className={`${inputClasses} ${fieldBorder('monthly_limit')} pl-7 tabular`}
                      placeholder="500"
                    />
                  </div>
                  {fieldErrors.monthly_limit && <p id={errId('monthly_limit')} className="text-xs text-negative mt-1">{fieldErrors.monthly_limit}</p>}
                </div>
                <div>
                  <label htmlFor="budget-threshold" className="block text-sm font-medium text-text-secondary mb-2">Alert Threshold (%)</label>
                  <input
                    id="budget-threshold"
                    name="alert_threshold"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="100"
                    step="1"
                    value={formData.alert_threshold}
                    onChange={(e) => updateField('alert_threshold', e.target.value)}
                    aria-invalid={fieldErrors.alert_threshold ? true : undefined}
                    aria-describedby={describe('alert_threshold', 'budget-threshold-hint')}
                    className={`${inputClasses} ${fieldBorder('alert_threshold')} tabular`}
                  />
                  {fieldErrors.alert_threshold && <p id={errId('alert_threshold')} className="text-xs text-negative mt-1">{fieldErrors.alert_threshold}</p>}
                  <p id="budget-threshold-hint" className="text-xs text-text-muted mt-1">You'll be alerted when spending reaches this percentage</p>
                </div>
                {error && (
                  <div role="alert" className="p-3 bg-negative/10 border border-negative/30 rounded-lg text-sm text-negative">{error}</div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={closeForm} disabled={submitting} className="min-h-11 px-4 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40">Cancel</motion.button>
                  <motion.button type="submit" whileTap={{ scale: 0.97 }} disabled={submitting} aria-busy={submitting || undefined} className={primaryButton}>
                    {submitting ? 'Creating…' : 'Create Budget'}
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
