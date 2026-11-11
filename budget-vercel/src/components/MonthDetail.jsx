'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useChartTheme } from './ThemeProvider';
import PageTransition from './PageTransition';

const currency0 = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const formatCurrency = (value) => currency0.format(value || 0);
const formatSigned = (value) => `${value > 0 ? '+' : ''}${formatCurrency(value)}`;

const formatAxis = (v) => `$${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? 'k' : ''}`;

const formatMonthHeading = (monthStr) => {
  const [year, month] = monthStr.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
};

const formatShortDate = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

const formatDayOnly = (dateStr) => {
  const day = parseInt(dateStr.split('-')[2]);
  return day.toString();
};

// One authored moment: the three month figures settle in sequence. Charts and table arrive with the page.
const kpiVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const kpiItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const thClass = 'px-4 md:px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap';

export default function MonthDetail({ month, selectedAccount, onBack }) {
  const { gridColor, tickColor, tooltipStyle, accentColor } = useChartTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month });
      if (selectedAccount) {
        params.set('account_ids', String(selectedAccount));
      }
      const res = await fetch(`/api/analytics/monthly-breakdown?${params}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.error) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      setData(json);
    } catch (err) {
      console.error('Failed to load monthly breakdown:', err);
      setData(null);
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [month, selectedAccount]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const monthLabel = formatMonthHeading(month);

  const header = (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 inline-flex items-center gap-2 min-h-11 px-2 rounded-lg text-text-tertiary hover:text-accent-text transition-colors text-sm font-medium"
      >
        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>
      <h1 className="text-3xl font-semibold text-text-primary">{monthLabel}</h1>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true">
        {header}
        <span role="status" className="sr-only">Loading {monthLabel}</span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card rounded-xl p-6">
              <div className="h-4 w-20 rounded bg-surface-hover animate-pulse" />
              <div className="h-8 w-32 rounded bg-surface-hover animate-pulse mt-2" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-hidden="true">
          <div className="glass-card rounded-xl h-80 animate-pulse" />
          <div className="glass-card rounded-xl h-80 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-8">
        {header}
        <div role="alert" className="glass-card rounded-xl p-8 md:p-12 text-center">
          <p className="text-text-primary font-medium">Couldn&rsquo;t load data for {monthLabel}.</p>
          {error && <p className="text-text-tertiary text-sm mt-1">{error}</p>}
          <button
            type="button"
            onClick={loadData}
            className="mt-6 min-h-11 px-5 rounded-lg bg-accent text-on-accent font-medium hover:bg-accent-hover transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const categoryChartData = (data.category_breakdown || [])
    .filter(c => c.total < 0)
    .slice(0, 10)
    .map(c => ({ category: c.category, amount: Math.abs(c.total) }));

  const dailyData = data.daily_spending || [];
  const topTransactions = data.top_transactions || [];
  const monthTotal = dailyData.length ? dailyData[dailyData.length - 1].cumulative : 0;

  const categoryChartLabel = `Bar chart of spending by category for ${monthLabel}: ${categoryChartData
    .map(c => `${c.category} ${formatCurrency(c.amount)}`)
    .join(', ')}.`;
  const dailyChartLabel = `Line chart of cumulative spending through ${monthLabel}, reaching ${formatCurrency(monthTotal)} by ${dailyData.length ? formatShortDate(dailyData[dailyData.length - 1].date) : 'month end'}.`;

  const net = data.net || 0;
  const kpis = [
    {
      label: 'Income',
      value: formatCurrency(data.income),
      tone: 'text-positive',
      iconWrap: 'bg-positive/10 text-positive',
      icon: 'M7 11l5-5m0 0l5 5m-5-5v12',
    },
    {
      label: 'Expenses',
      value: formatCurrency(data.expenses),
      tone: 'text-negative',
      iconWrap: 'bg-negative/10 text-negative',
      icon: 'M17 13l-5 5m0 0l-5-5m5 5V6',
    },
    {
      label: 'Net Cash Flow',
      value: formatSigned(net),
      tone: net >= 0 ? 'text-positive' : 'text-negative',
      iconWrap: 'bg-surface-hover text-text-tertiary',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    },
  ];

  return (
    <PageTransition>
    <div className="space-y-8">
      {header}

      {/* KPI Row */}
      <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4" variants={kpiVariants} initial="hidden" animate="visible">
        {kpis.map((kpi) => (
          <motion.div key={kpi.label} className="glass-card rounded-xl p-4 md:p-6" variants={kpiItemVariants}>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-text-tertiary text-sm font-medium">{kpi.label}</p>
                <p className={`text-2xl font-display tabular mt-1 ${kpi.tone}`}>{kpi.value}</p>
              </div>
              <div aria-hidden="true" className={`p-3 rounded-full shrink-0 ${kpi.iconWrap}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={kpi.icon} />
                </svg>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="glass-card rounded-xl p-4 md:p-6 min-w-0" aria-labelledby="category-chart-heading">
          <h2 id="category-chart-heading" className="text-lg font-semibold text-text-primary mb-4">Spending by Category</h2>
          {categoryChartData.length > 0 ? (
            <div style={{ height: Math.max(256, categoryChartData.length * 36) }} role="img" aria-label={categoryChartLabel}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" tickFormatter={formatAxis} tick={{ fill: tickColor, fontSize: 12 }} />
                  <YAxis type="category" dataKey="category" width={120} tick={{ fill: tickColor, fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={tooltipStyle} />
                  <Bar dataKey="amount" name="Spending" fill={accentColor} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-text-tertiary">No expense data for this month</div>
          )}
        </section>

        <section className="glass-card rounded-xl p-4 md:p-6 min-w-0" aria-labelledby="daily-chart-heading">
          <div className="mb-4">
            <h2 id="daily-chart-heading" className="text-lg font-semibold text-text-primary">Daily Spending</h2>
            <p className="text-text-muted text-sm mt-1">Running total through the month</p>
          </div>
          {dailyData.length > 0 ? (
            <div className="h-64" role="img" aria-label={dailyChartLabel}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDayOnly} tick={{ fill: tickColor, fontSize: 12 }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={formatAxis} tick={{ fill: tickColor, fontSize: 12 }} width={52} />
                  <Tooltip formatter={(value, name) => [formatCurrency(value), name === 'cumulative' ? 'Cumulative' : 'Daily']} labelFormatter={(label) => formatShortDate(label)} contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="cumulative" name="cumulative" stroke={accentColor} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: accentColor, stroke: tooltipStyle.backgroundColor, strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-text-tertiary">No spending data for this month</div>
          )}
        </section>
      </div>

      {/* Top Transactions */}
      <section className="glass-card rounded-xl overflow-hidden" aria-labelledby="top-tx-heading">
        <div className="px-4 md:px-6 py-4 border-b border-border/50">
          <h2 id="top-tx-heading" className="text-lg font-semibold text-text-primary">Top Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full tabular">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th scope="col" className={`${thClass} text-left`}>Date</th>
                <th scope="col" className={`${thClass} text-left`}>Description</th>
                <th scope="col" className={`${thClass} text-right`}>Amount</th>
                <th scope="col" className={`${thClass} text-left`}>Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {topTransactions.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-text-tertiary">No transactions found for this month</td></tr>
              ) : (
                topTransactions.map((t, idx) => (
                  <tr key={`${t.date}-${idx}`} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm text-text-secondary">{formatShortDate(t.date)}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-text-primary">
                      <span className="block max-w-[14rem] md:max-w-md truncate" title={t.description}>{t.description}</span>
                    </td>
                    <td className={`px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm font-display text-right ${t.amount >= 0 ? 'text-positive' : 'text-negative'}`}>{formatSigned(t.amount)}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm text-text-tertiary">{t.category}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
    </PageTransition>
  );
}
