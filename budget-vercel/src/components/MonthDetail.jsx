'use client';

import { useState, useEffect } from 'react';
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

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatMonthHeading = (monthStr) => {
  const [year, month] = monthStr.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const formatShortDate = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatDayOnly = (dateStr) => {
  const day = parseInt(dateStr.split('-')[2]);
  return day.toString();
};

export default function MonthDetail({ month, selectedAccount, onBack }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    loadData();
  }, [month, selectedAccount]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month });
      if (selectedAccount) {
        params.set('account_ids', String(selectedAccount));
      }
      const res = await fetch(`/api/analytics/monthly-breakdown?${params}`);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to load monthly breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-text-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-text-tertiary">
        <p>Failed to load data for {formatMonthHeading(month)}.</p>
        <button
          onClick={onBack}
          className="mt-4 text-text-primary underline hover:no-underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Prepare category chart data — show expenses as positive values for the bar chart
  const categoryChartData = (data.category_breakdown || [])
    .filter(c => c.total < 0)
    .slice(0, 10)
    .map(c => ({
      category: c.category,
      amount: Math.abs(c.total),
    }));

  // Daily spending data
  const dailyData = data.daily_spending || [];

  // Top transactions
  const topTransactions = data.top_transactions || [];

  return (
    <div className="space-y-8">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-text-primary">{formatMonthHeading(month)}</h1>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Income */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-tertiary text-sm font-medium">Income</p>
              <p className="text-2xl font-bold mt-1 text-positive">
                {formatCurrency(data.income)}
              </p>
            </div>
            <div className="p-3 bg-background rounded-full">
              <svg className="w-6 h-6 text-positive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-tertiary text-sm font-medium">Expenses</p>
              <p className="text-2xl font-bold mt-1 text-negative">
                {formatCurrency(data.expenses)}
              </p>
            </div>
            <div className="p-3 bg-background rounded-full">
              <svg className="w-6 h-6 text-negative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Net */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-tertiary text-sm font-medium">Net Cash Flow</p>
              <p className={`text-2xl font-bold mt-1 ${data.net >= 0 ? 'text-positive' : 'text-negative'}`}>
                {formatCurrency(data.net)}
              </p>
            </div>
            <div className="p-3 bg-background rounded-full">
              <svg className="w-6 h-6 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by Category — Horizontal Bar Chart */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-bold text-text-primary mb-4">Spending by Category</h2>
          {categoryChartData.length > 0 ? (
            <div style={{ height: Math.max(250, categoryChartData.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryChartData}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `$${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? 'k' : ''}`}
                    tick={{ fill: '#737373', fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={120}
                    tick={{ fill: '#525252', fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E5E5',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#171717', fontWeight: 600 }}
                  />
                  <Bar
                    dataKey="amount"
                    name="Spending"
                    fill="#171717"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-text-tertiary">
              No expense data for this month
            </div>
          )}
        </div>

        {/* Daily Spending — Cumulative Line Chart */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-bold text-text-primary mb-4">Daily Spending</h2>
          {dailyData.length > 0 ? (
            <div className="h-64" style={{ height: Math.max(250, categoryChartData.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDayOnly}
                    tick={{ fill: '#737373', fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? 'k' : ''}`}
                    tick={{ fill: '#737373', fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(value),
                      name === 'cumulative' ? 'Cumulative' : 'Daily',
                    ]}
                    labelFormatter={(label) => formatShortDate(label)}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E5E5',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name="cumulative"
                    stroke="#171717"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: '#171717' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-text-tertiary">
              No spending data for this month
            </div>
          )}
        </div>
      </div>

      {/* Top Transactions Table */}
      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">Top Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-background border-b border-border">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Category
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-text-tertiary">
                    No transactions found for this month
                  </td>
                </tr>
              ) : (
                topTransactions.map((t, idx) => (
                  <tr key={idx} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                      {formatShortDate(t.date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-primary max-w-md truncate">
                      {t.description}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                      t.amount >= 0 ? 'text-positive' : 'text-negative'
                    }`}>
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {t.category}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
