'use client';

import { useState, useEffect } from 'react';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

function CategoryTrend({ data, months }) {
  const maxAmount = Math.max(...data.months.map(m => m.amount), 1);
  const change = data.change_percent;
  const isDown = change < 0;

  return (
    <div className="py-3 border-b border-border last:border-b-0">
      {/* Header: category name + current spend + change */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-primary">{data.category}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-text-primary">
            {formatCurrency(data.current_spend)}
          </span>
          {change !== 0 && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
              isDown ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {isDown ? '\u2193' : '\u2191'}{Math.abs(change)}%
            </span>
          )}
          {change === 0 && data.current_spend > 0 && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
              --
            </span>
          )}
        </div>
      </div>

      {/* Monthly bars */}
      <div className="space-y-1">
        {data.months.map((m, i) => {
          const width = maxAmount > 0 ? (m.amount / maxAmount) * 100 : 0;
          const isCurrent = i === data.months.length - 1;
          return (
            <div key={m.month} className="flex items-center gap-2">
              <span className="text-[10px] text-text-tertiary w-8 text-right flex-shrink-0">
                {months[i].label}
              </span>
              <div className="flex-1 h-4 bg-background rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all duration-500 ${
                    isCurrent ? 'bg-text-primary' : 'bg-neutral-300'
                  }`}
                  style={{ width: `${Math.max(width, 1)}%` }}
                />
              </div>
              <span className="text-[10px] text-text-tertiary w-10 text-right flex-shrink-0">
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
      <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
        <h2 className="text-lg font-bold text-text-primary mb-1">Spending Tracker</h2>
        <p className="text-xs text-text-tertiary mb-4">3-month trend for key categories</p>
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-text-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
        <h2 className="text-lg font-bold text-text-primary mb-1">Spending Tracker</h2>
        <p className="text-xs text-text-tertiary mb-4">3-month trend for key categories</p>
        <div className="flex items-center justify-center h-48">
          <p className="text-sm text-negative">Failed to load spending data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
      <h2 className="text-lg font-bold text-text-primary mb-1">Spending Tracker</h2>
      <p className="text-xs text-text-tertiary mb-4">3-month trend for key categories</p>

      {data?.categories?.map((cat) => (
        <CategoryTrend key={cat.category} data={cat} months={data.months} />
      ))}
    </div>
  );
}
