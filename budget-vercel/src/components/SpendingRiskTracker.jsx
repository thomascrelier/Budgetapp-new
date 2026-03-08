'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

function CategoryTrend({ data, months, categoryIndex }) {
  const maxAmount = Math.max(...data.months.map(m => m.amount), 1);
  const change = data.change_percent;
  const isDown = change < 0;

  return (
    <div className="py-3 border-b border-border/50 last:border-b-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-primary">{data.category}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-display text-text-primary">
            {formatCurrency(data.current_spend)}
          </span>
          {change !== 0 && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
              isDown ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'
            }`}>
              {isDown ? '\u2193' : '\u2191'}{Math.abs(change)}%
            </span>
          )}
          {change === 0 && data.current_spend > 0 && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-surface-hover text-text-muted">
              --
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {data.months.map((m, i) => {
          const width = maxAmount > 0 ? (m.amount / maxAmount) * 100 : 0;
          const isCurrent = i === data.months.length - 1;
          return (
            <div key={m.month} className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted w-8 text-right flex-shrink-0">
                {months[i].label}
              </span>
              <div className="flex-1 h-4 bg-surface-hover rounded overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.max(width, 1)}%` }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 80, damping: 15, delay: categoryIndex * 0.05 + i * 0.03 }}
                  className={`h-full rounded ${
                    isCurrent ? 'bg-accent' : 'bg-text-muted/40'
                  }`}
                />
              </div>
              <span className="text-[10px] text-text-muted w-10 text-right flex-shrink-0">
                {formatCurrency(m.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SpendingRiskTracker({ selectedAccount }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTrends();
  }, [selectedAccount]);

  const fetchTrends = async () => {
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
  };

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-1">Spending Tracker</h2>
        <p className="text-xs text-text-muted mb-4">3-month trend for key categories</p>
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-1">Spending Tracker</h2>
        <p className="text-xs text-text-muted mb-4">3-month trend for key categories</p>
        <div className="flex items-center justify-center h-48">
          <p className="text-sm text-negative">Failed to load spending data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6">
      <h2 className="text-lg font-semibold text-text-primary mb-1">Spending Tracker</h2>
      <p className="text-xs text-text-muted mb-4">3-month trend for key categories</p>

      {data?.categories?.map((cat, index) => (
        <CategoryTrend key={cat.category} data={cat} months={data.months} categoryIndex={index} />
      ))}
    </div>
  );
}
