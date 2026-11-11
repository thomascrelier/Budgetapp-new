'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { formatMoney } from './AnimatedNumber';

const BAR_EASE = [0.16, 1, 0.3, 1];

function ChangeBadge({ change, currentSpend }) {
  if (change === 0) {
    if (!(currentSpend > 0)) return null;
    return (
      <span className="tabular rounded-full bg-surface-hover px-1.5 py-0.5 text-xs font-medium text-text-muted">
        0%<span className="sr-only"> change vs last month</span>
      </span>
    );
  }
  const isDown = change < 0;
  return (
    <span
      className={`tabular inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
        isDown ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'
      }`}
    >
      <svg aria-hidden="true" className={`h-3 w-3 ${isDown ? '' : 'rotate-180'}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2.5v7M3 6.5l3 3 3-3" />
      </svg>
      <span className="sr-only">{isDown ? 'Down' : 'Up'} </span>
      {Math.abs(change)}%
      <span className="sr-only"> vs last month</span>
    </span>
  );
}

function CategoryTrend({ data, months }) {
  const maxAmount = Math.max(...data.months.map((m) => m.amount), 1);

  return (
    <li className="border-b border-border/60 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium text-text-primary">{data.category}</span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="tabular text-sm font-medium text-text-primary">{formatMoney(data.current_spend)}</span>
          <ChangeBadge change={data.change_percent} currentSpend={data.current_spend} />
        </div>
      </div>

      <ul className="space-y-1" aria-label={`${data.category}, monthly spend`}>
        {data.months.map((m, i) => {
          const width = (m.amount / maxAmount) * 100;
          const isCurrent = i === data.months.length - 1;
          return (
            <li key={m.month} className="flex items-center gap-2">
              <span className={`w-8 shrink-0 text-xs ${isCurrent ? 'font-medium text-text-secondary' : 'text-text-muted'}`}>
                {months?.[i]?.label ?? m.month}
              </span>
              <div aria-hidden="true" className="h-3 flex-1 overflow-hidden rounded-sm bg-surface-hover">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.max(width, 1) / 100 }}
                  transition={{ duration: 0.9, ease: BAR_EASE }}
                  className={`h-full w-full origin-left rounded-sm ${isCurrent ? 'bg-accent' : 'bg-text-muted/40'}`}
                />
              </div>
              <span className={`tabular w-16 shrink-0 text-right text-xs ${isCurrent ? 'text-text-secondary' : 'text-text-muted'}`}>
                {formatMoney(m.amount)}
              </span>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function Shell({ children, busy = false }) {
  return (
    <section className="glass-card rounded-xl p-6" aria-labelledby="spending-tracker-title" aria-busy={busy || undefined}>
      <h2 id="spending-tracker-title" className="text-lg font-semibold text-text-primary">Spending Tracker</h2>
      <p className="mb-4 mt-0.5 text-sm text-text-tertiary">3-month trend for key categories</p>
      {children}
    </section>
  );
}

export default function SpendingRiskTracker({ selectedAccount }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedAccount) {
        params.set('account_ids', String(selectedAccount));
      }
      const queryString = params.toString();
      const url = `/api/analytics/category-trends${queryString ? `?${queryString}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch spending trends: ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      console.error('Error loading spending trends:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedAccount]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  if (loading) {
    return (
      <Shell busy>
        <span className="sr-only" role="status">Loading spending trends</span>
        <div aria-hidden="true" className="animate-pulse space-y-5">
          {[0, 1, 2].map((row) => (
            <div key={row} className="space-y-2">
              <div className="flex justify-between">
                <div className="h-3.5 w-24 rounded bg-surface-hover" />
                <div className="h-3.5 w-14 rounded bg-surface-hover" />
              </div>
              {[0, 1, 2].map((bar) => (
                <div key={bar} className="h-3 rounded-sm bg-surface-hover" />
              ))}
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div role="alert" className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-text-secondary">Couldn&rsquo;t load spending trends.</p>
          <button
            type="button"
            onClick={fetchTrends}
            className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium text-text-primary transition-colors hover:border-border-dark hover:bg-surface-hover"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const categories = data?.categories ?? [];

  return (
    <Shell>
      {categories.length === 0 ? (
        <p className="flex min-h-48 items-center justify-center text-center text-sm text-text-tertiary">
          No spending in tracked categories over the last 3 months.
        </p>
      ) : (
        <ul>
          {categories.map((cat) => (
            <CategoryTrend key={cat.category} data={cat} months={data.months} />
          ))}
        </ul>
      )}
    </Shell>
  );
}
