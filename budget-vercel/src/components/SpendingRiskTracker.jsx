'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const LEVEL_COLORS = {
  elevated: {
    dot: 'bg-yellow-500',
    bar: 'bg-yellow-500',
    badge: 'bg-yellow-100 text-yellow-800',
    line: '#EAB308',
  },
  high: {
    dot: 'bg-orange-500',
    bar: 'bg-orange-500',
    badge: 'bg-orange-100 text-orange-800',
    line: '#F97316',
  },
  critical: {
    dot: 'bg-red-500',
    bar: 'bg-red-500',
    badge: 'bg-red-100 text-red-800',
    line: '#EF4444',
  },
};

function Sparkline({ data, color }) {
  const chartData = data.map((value, i) => ({ v: value }));
  return (
    <ResponsiveContainer width="100%" height={24}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function RiskItem({ risk }) {
  const colors = LEVEL_COLORS[risk.level] || LEVEL_COLORS.elevated;

  // Progress bar width: current / avg as percentage, capped at 200%
  const progressPct = Math.min((risk.current_spend / risk.avg_spend) * 100, 200);
  // Scale to fit: 200% of avg = 100% of bar width
  const barWidth = (progressPct / 200) * 100;

  return (
    <div className="py-3 border-b border-border last:border-b-0">
      {/* Row 1: Category name + risk dot + delta badge */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${colors.dot} flex-shrink-0`} />
          <span className="text-sm font-medium text-text-primary">{risk.category}</span>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
          +{risk.delta_percent}%
        </span>
      </div>

      {/* Row 2: Spend text */}
      <p className="text-xs text-text-tertiary mb-1.5 ml-4">
        {formatCurrency(risk.current_spend)} this month &middot; avg {formatCurrency(risk.avg_spend)}
      </p>

      {/* Row 3: Progress bar + sparkline */}
      <div className="flex items-center gap-3 ml-4">
        {/* Progress bar */}
        <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        {/* Sparkline */}
        <div className="w-16 flex-shrink-0">
          <Sparkline data={risk.monthly_history} color={colors.line} />
        </div>
      </div>
    </div>
  );
}

export default function SpendingRiskTracker({ selectedAccount }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRisks();
  }, [selectedAccount]);

  const fetchRisks = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedAccount) {
        params.set('account_ids', String(selectedAccount));
      }
      const queryString = params.toString();
      const url = `/api/analytics/spending-risks${queryString ? `?${queryString}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch spending risks: ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error loading spending risks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
        <h2 className="text-lg font-bold text-text-primary mb-1">Spending Risks</h2>
        <p className="text-xs text-text-tertiary mb-4">Compared to your 3-month average</p>
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-text-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
        <h2 className="text-lg font-bold text-text-primary mb-1">Spending Risks</h2>
        <p className="text-xs text-text-tertiary mb-4">Compared to your 3-month average</p>
        <div className="flex items-center justify-center h-48">
          <p className="text-sm text-negative">Failed to load spending data.</p>
        </div>
      </div>
    );
  }

  const risks = data?.risks || [];
  const onTrackCount = data?.on_track_count || 0;
  const hasRisks = risks.length > 0;

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
      <h2 className="text-lg font-bold text-text-primary mb-1">Spending Risks</h2>
      <p className="text-xs text-text-tertiary mb-4">Compared to your 3-month average</p>

      {hasRisks ? (
        <>
          <div className="max-h-64 overflow-y-auto">
            {risks.map((risk) => (
              <RiskItem key={risk.category} risk={risk} />
            ))}
          </div>

          {/* On-track summary */}
          {onTrackCount > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-sm text-positive flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {onTrackCount} {onTrackCount === 1 ? 'category' : 'categories'} on track
              </p>
            </div>
          )}
        </>
      ) : (
        /* Empty state: all on track */
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-positive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-text-primary">All spending on track this month</p>
          {onTrackCount > 0 && (
            <p className="text-xs text-text-tertiary mt-1">
              {onTrackCount} {onTrackCount === 1 ? 'category' : 'categories'} within normal range
            </p>
          )}
        </div>
      )}
    </div>
  );
}
