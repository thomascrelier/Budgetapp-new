'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import PageTransition from './PageTransition';

// Option values for the category select. Kept distinct from any real category name, and from each other:
// the old code used 'custom' for both "current unlisted category" and "+ Custom...", so picking Custom
// on a row with an unlisted category fired no change event.
const CURRENT_OPTION = '__current__';
const CUSTOM_OPTION = '__custom__';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(value);

const plural = (n, word) => `${n.toLocaleString('en-CA')} ${word}${n === 1 ? '' : 's'}`;

// Mobile: 44px targets and 16px text (iOS zooms into smaller inputs). Desktop: compact.
const controlClasses =
  'w-full min-h-11 md:min-h-9 px-3 border border-border rounded-lg bg-surface text-text-primary text-base md:text-sm transition-colors focus:border-accent-text disabled:opacity-60 disabled:cursor-wait';

const buttonSecondary =
  'min-h-11 md:min-h-9 px-3 text-sm border border-border rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

function CategoryControl({
  transaction,
  availableCategories,
  rowState,
  isEditing,
  customCategory,
  customError,
  onCustomChange,
  onChange,
  onCustomSubmit,
  onCustomCancel,
  idPrefix,
}) {
  const saving = rowState?.status === 'saving';
  const listed = availableCategories.includes(transaction.category);
  const label = `Category for ${transaction.description}`;
  const errorId = `${idPrefix}-cat-err-${transaction.id}`;

  return (
    <div className="space-y-1">
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customCategory}
            onChange={(e) => onCustomChange(e.target.value)}
            aria-label={`New category for ${transaction.description}`}
            aria-invalid={customError ? true : undefined}
            aria-describedby={customError ? errorId : undefined}
            placeholder="e.g. Pet care"
            disabled={saving}
            className={`${controlClasses} md:w-40 ${customError ? 'border-negative' : ''}`}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onCustomSubmit(); }
              if (e.key === 'Escape') { e.preventDefault(); onCustomCancel(); }
            }}
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={onCustomSubmit}
            disabled={saving}
            className="shrink-0 min-h-11 md:min-h-9 px-3 bg-accent text-on-accent rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {saving ? 'Saving…' : 'Save'}
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={onCustomCancel}
            disabled={saving}
            className="shrink-0 min-h-11 md:min-h-9 px-2 text-sm text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-40"
          >
            Cancel
          </motion.button>
        </div>
      ) : (
        <select
          value={listed ? transaction.category : CURRENT_OPTION}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          aria-busy={saving || undefined}
          aria-describedby={rowState?.status === 'error' ? errorId : undefined}
          disabled={saving}
          className={`${controlClasses} md:w-auto md:max-w-[14rem] text-text-secondary`}
        >
          {!listed && <option value={CURRENT_OPTION}>{transaction.category || 'Uncategorized'}</option>}
          {availableCategories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
          <option value={CUSTOM_OPTION}>+ Custom…</option>
        </select>
      )}
      {customError && isEditing && (
        <p id={errorId} className="text-xs text-negative">{customError}</p>
      )}
      {!isEditing && rowState?.status === 'saving' && (
        <p className="text-xs text-text-muted">Saving…</p>
      )}
      {!isEditing && rowState?.status === 'saved' && (
        <p className="text-xs text-positive">Saved</p>
      )}
      {rowState?.status === 'error' && (
        <p id={errorId} className="text-xs text-negative">{rowState.message}</p>
      )}
    </div>
  );
}

export default function Transactions() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [customCategory, setCustomCategory] = useState('');
  const [customError, setCustomError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  // Per-row save state: { [id]: { status: 'saving' | 'saved' | 'error', message? } }
  const [rowStates, setRowStates] = useState({});
  const [announcement, setAnnouncement] = useState('');
  const limit = 50;

  const [accounts, setAccounts] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [filterAccount, setFilterAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterAmountType, setFilterAmountType] = useState('');
  const searchTimeout = useRef(null);
  const requestId = useRef(0);
  const savedTimers = useRef({});

  useEffect(() => {
    api.getAccounts()
      .then(data => {
        setAccounts((data.accounts || []).sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(err => console.error('Failed to load accounts:', err));
  }, []);

  useEffect(() => {
    setPage(0);
  }, [filterAccount, filterCategory, filterSearch, filterStartDate, filterEndDate, filterAmountType]);

  useEffect(() => {
    loadTransactions();
  }, [filterAccount, filterCategory, filterSearch, filterStartDate, filterEndDate, filterAmountType, page]);

  useEffect(() => () => {
    clearTimeout(searchTimeout.current);
    Object.values(savedTimers.current).forEach(clearTimeout);
  }, []);

  const loadTransactions = async () => {
    // Filters change faster than the API answers; only the latest request may write state.
    const thisRequest = ++requestId.current;
    setLoading(true);
    setLoadError(null);
    try {
      const params = { skip: page * limit, limit };
      if (filterAccount) params.account_id = filterAccount;
      if (filterCategory) params.category = filterCategory;
      if (filterSearch) params.search = filterSearch;
      if (filterStartDate) params.start_date = filterStartDate;
      if (filterEndDate) params.end_date = filterEndDate;

      const data = await api.getTransactions(params);
      if (thisRequest !== requestId.current) return;
      if (data.error) throw new Error(data.error);
      let txns = data.transactions || [];

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
      if (thisRequest !== requestId.current) return;
      console.error('Failed to load transactions:', error);
      setLoadError(error.message || 'Network error');
    } finally {
      if (thisRequest === requestId.current) setLoading(false);
    }
  };

  const handleSearchInput = (value) => {
    setSearchInput(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setFilterSearch(value.trim());
    }, 300);
  };

  const setRowState = (id, state) => {
    setRowStates(prev => {
      const next = { ...prev };
      if (state) next[id] = state; else delete next[id];
      return next;
    });
  };

  // The API resolves with { error } on 4xx/5xx instead of rejecting, so both paths are checked.
  // Pessimistic: the row only changes once the sheet has accepted it.
  const saveCategory = async (transaction, category) => {
    const id = transaction.id;
    if (rowStates[id]?.status === 'saving') return false;
    clearTimeout(savedTimers.current[id]);
    setRowState(id, { status: 'saving' });
    try {
      const data = await api.updateCategory(id, category);
      if (data?.error) throw new Error(data.error);
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, category } : t));
      setRowState(id, { status: 'saved' });
      setAnnouncement(`${transaction.description} moved to ${category}`);
      savedTimers.current[id] = setTimeout(() => setRowState(id, null), 2000);
      return true;
    } catch (error) {
      console.error('Failed to update category:', error);
      const message = `Couldn't save "${category}": ${error.message || 'network error'}. Try again.`;
      setRowState(id, { status: 'error', message });
      setAnnouncement(message);
      return false;
    }
  };

  const handleCategoryChange = (transaction, value) => {
    if (value === CURRENT_OPTION) return;
    if (value === CUSTOM_OPTION) {
      setEditingId(transaction.id);
      setCustomCategory('');
      setCustomError(null);
      setRowState(transaction.id, null);
      return;
    }
    saveCategory(transaction, value);
  };

  const handleCustomCategorySubmit = async (transaction) => {
    const name = customCategory.trim();
    if (!name) {
      setCustomError('Type a category name, or press Escape to cancel.');
      return;
    }
    setCustomError(null);
    const ok = await saveCategory(transaction, name);
    if (ok) {
      setEditingId(null);
      setCustomCategory('');
    }
  };

  const cancelCustom = () => {
    setEditingId(null);
    setCustomCategory('');
    setCustomError(null);
  };

  const hasActiveFilters = filterAccount || filterCategory || filterSearch || filterStartDate || filterEndDate || filterAmountType;
  const dateRangeInvalid = filterStartDate && filterEndDate && filterStartDate > filterEndDate;

  const clearFilters = () => {
    clearTimeout(searchTimeout.current);
    setSearchInput('');
    setFilterAccount('');
    setFilterCategory('');
    setFilterSearch('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterAmountType('');
  };

  const totalPages = Math.ceil(total / limit);
  const firstLoad = loading && transactions.length === 0 && !loadError;

  const categoryProps = (transaction, idPrefix) => ({
    idPrefix,
    transaction,
    availableCategories,
    rowState: rowStates[transaction.id],
    isEditing: editingId === transaction.id,
    customCategory,
    customError,
    onCustomChange: (v) => { setCustomCategory(v); if (customError) setCustomError(null); },
    onChange: (v) => handleCategoryChange(transaction, v),
    onCustomSubmit: () => handleCustomCategorySubmit(transaction),
    onCustomCancel: cancelCustom,
  });

  const amountClass = (amount) => (amount >= 0 ? 'text-positive' : 'text-negative');

  const labelClasses = 'block text-xs font-medium text-text-muted mb-1';

  return (
    <PageTransition>
    <div className="space-y-6">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>

      {/* Page Header */}
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">Transactions</h1>
          <p className="text-text-tertiary mt-1 tabular">
            {plural(total, 'transaction')}{hasActiveFilters ? ' (filtered)' : ''}
          </p>
        </div>
        {hasActiveFilters && (
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={clearFilters} className={buttonSecondary}>
            Clear filters
          </motion.button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-xl p-4" role="search" aria-label="Filter transactions">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label htmlFor="txn-search" className={labelClasses}>Search</label>
            <input id="txn-search" type="search" placeholder="Description" value={searchInput} onChange={(e) => handleSearchInput(e.target.value)} className={controlClasses} />
          </div>
          <div>
            <label htmlFor="txn-account" className={labelClasses}>Account</label>
            <select id="txn-account" value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className={controlClasses}>
              <option value="">All accounts</option>
              {accounts.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>
          </div>
          <div>
            <label htmlFor="txn-category" className={labelClasses}>Category</label>
            <select id="txn-category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={controlClasses}>
              <option value="">All categories</option>
              {availableCategories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
            </select>
          </div>
          <div>
            <label htmlFor="txn-from" className={labelClasses}>From</label>
            <input id="txn-from" type="date" value={filterStartDate} max={filterEndDate || undefined} onChange={(e) => setFilterStartDate(e.target.value)} aria-invalid={dateRangeInvalid || undefined} aria-describedby={dateRangeInvalid ? 'txn-date-err' : undefined} className={`${controlClasses} tabular`} />
          </div>
          <div>
            <label htmlFor="txn-to" className={labelClasses}>To</label>
            <input id="txn-to" type="date" value={filterEndDate} min={filterStartDate || undefined} onChange={(e) => setFilterEndDate(e.target.value)} aria-invalid={dateRangeInvalid || undefined} aria-describedby={dateRangeInvalid ? 'txn-date-err' : undefined} className={`${controlClasses} tabular`} />
          </div>
          <div>
            <label htmlFor="txn-amount" className={labelClasses}>Amount</label>
            <select id="txn-amount" value={filterAmountType} onChange={(e) => setFilterAmountType(e.target.value)} className={controlClasses}>
              <option value="">All</option>
              <option value="income">Income only</option>
              <option value="expense">Expenses only</option>
            </select>
          </div>
        </div>
        {dateRangeInvalid && (
          <p id="txn-date-err" className="mt-3 text-sm text-negative">
            &ldquo;From&rdquo; is after &ldquo;To&rdquo;, so nothing can match. Swap the dates or clear one.
          </p>
        )}
      </div>

      {/* Transactions */}
      <div className="glass-card rounded-xl overflow-hidden" aria-busy={loading || undefined}>
        {firstLoad ? (
          <div className="flex items-center justify-center h-64" role="status">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" aria-hidden="true"></div>
            <span className="sr-only">Loading transactions</span>
          </div>
        ) : loadError ? (
          <div className="px-6 py-12 text-center" role="alert">
            <p className="text-text-primary font-medium">Couldn&rsquo;t load transactions</p>
            <p className="mt-1 text-sm text-text-tertiary">{loadError}. Check your connection and try again.</p>
            <button type="button" onClick={loadTransactions} className={`${buttonSecondary} mt-4`}>Retry</button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            {hasActiveFilters ? (
              <>
                <p className="text-text-primary font-medium">No transactions match these filters</p>
                <p className="mt-1 text-sm text-text-tertiary">Widen the date range or clear a filter.</p>
                <button type="button" onClick={clearFilters} className={`${buttonSecondary} mt-4`}>Clear filters</button>
              </>
            ) : (
              <>
                <p className="text-text-primary font-medium">No transactions yet</p>
                <p className="mt-1 text-sm text-text-tertiary">Upload a bank statement and they&rsquo;ll appear here.</p>
              </>
            )}
          </div>
        ) : (
          <div className={`transition-opacity duration-150 ${loading ? 'opacity-50' : ''}`}>
            {/* Mobile: stacked rows */}
            <ul className="md:hidden divide-y divide-border">
              {transactions.map((transaction) => (
                <li key={transaction.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm text-text-primary break-words">{transaction.description}</p>
                    <p className={`shrink-0 text-sm font-medium tabular text-right ${amountClass(transaction.amount)}`}>
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>
                  <p className="text-xs text-text-muted tabular">
                    {transaction.date} · {transaction.account_name}
                  </p>
                  <CategoryControl {...categoryProps(transaction, 'm')} />
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <table className="hidden md:table w-full">
              <caption className="sr-only">Transactions, page {page + 1} of {Math.max(totalPages, 1)}</caption>
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Account</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Description</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Amount</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-surface-hover/60 transition-colors align-top">
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-text-secondary tabular">{transaction.date}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-text-tertiary">{transaction.account_name}</td>
                    <td className="px-6 py-3 text-sm text-text-primary max-w-md truncate" title={transaction.description}>{transaction.description}</td>
                    <td className={`px-6 py-3 whitespace-nowrap text-sm font-medium tabular text-right ${amountClass(transaction.amount)}`}>
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-6 py-2 text-sm">
                      <CategoryControl {...categoryProps(transaction, 'd')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && !loadError && (
          <nav aria-label="Pagination" className="px-4 md:px-6 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-tertiary tabular">
              Showing {(page * limit + 1).toLocaleString('en-CA')} to {Math.min((page + 1) * limit, total).toLocaleString('en-CA')} of {total.toLocaleString('en-CA')}
            </p>
            <div className="flex gap-2">
              <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0 || loading} className={buttonSecondary}>Previous</motion.button>
              <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1 || loading} className={buttonSecondary}>Next</motion.button>
            </div>
          </nav>
        )}
      </div>
    </div>
    </PageTransition>
  );
}
