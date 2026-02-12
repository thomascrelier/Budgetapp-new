'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import dynamic from 'next/dynamic';
import api from '@/lib/api';

const SankeyChart = dynamic(() => import('./SankeyChart'), { ssr: false });

const COLORS = ['#171717', '#525252', '#737373', '#A3A3A3', '#D4D4D4', '#E5E5E5', '#404040', '#262626'];

const tooltipStyle = {
  backgroundColor: 'white',
  border: '1px solid #E5E5E5',
  borderRadius: '8px',
};

export default function RentalProperty() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    loadData();
  }, [year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await api.getRentalProperty(year);
      setData(result);
    } catch (error) {
      console.error('Failed to load rental property data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDelta = (dollars, percent) => {
    if (percent === null || percent === undefined) return 'New';
    const sign = dollars >= 0 ? '+' : '';
    return `${sign}${formatCurrency(dollars)} (${sign}${percent.toFixed(1)}%)`;
  };

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-text-primary border-t-transparent"></div>
      </div>
    );
  }

  const {
    year: dataYear,
    prev_year = year - 1,
    annual_summary = {},
    prev_annual_summary = {},
    t776_summary = [],
    monthly_data = [],
    prev_monthly_data = [],
    category_breakdown = [],
    t776_pie_data = [],
  } = data || {};

  // Merge monthly data for ComposedChart
  const mergedMonthlyData = monthly_data.map((m, i) => ({
    month_name: m.month_name,
    income: m.income,
    expenses: m.expenses,
    prev_income: prev_monthly_data[i]?.income || 0,
    prev_expenses: prev_monthly_data[i]?.expenses || 0,
  }));

  // YoY category data for horizontal bar chart (expenses only)
  const yoyCategoryData = category_breakdown
    .filter(c => !c.is_income)
    .map(c => ({
      category: c.category,
      [String(year)]: c.selected_year_total,
      [String(prev_year)]: c.prev_year_total,
    }));

  // Sankey data
  const sankeyData = useMemo(() => {
    if (!category_breakdown || category_breakdown.length === 0) return null;

    const incomeTotal = annual_summary.total_income || 0;
    const expenseCategories = category_breakdown.filter(c => !c.is_income && c.selected_year_total > 0);

    if (incomeTotal === 0 || expenseCategories.length === 0) return null;

    const totalExpenses = expenseCategories.reduce((sum, c) => sum + c.selected_year_total, 0);
    const surplus = Math.max(0, incomeTotal - totalExpenses);

    const nodes = [
      { name: 'Rental Income' },
      ...expenseCategories.map(c => ({ name: c.category })),
    ];
    if (surplus > 0) nodes.push({ name: 'Net Surplus' });

    const links = expenseCategories.map((c, i) => ({
      source: 0,
      target: i + 1,
      value: c.selected_year_total,
    }));
    if (surplus > 0) {
      links.push({ source: 0, target: nodes.length - 1, value: surplus });
    }

    return { nodes, links };
  }, [category_breakdown, annual_summary]);

  // Delta color helpers
  const incomeDeltaColor = (dollars) => dollars >= 0 ? 'text-positive' : 'text-negative';
  const expenseDeltaColor = (dollars) => dollars <= 0 ? 'text-positive' : 'text-negative';
  const groupDeltaColor = (group) => group.is_income ? incomeDeltaColor(group.delta_dollars) : expenseDeltaColor(group.delta_dollars);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Rental Property</h1>
          <p className="text-text-tertiary mt-1">Analytics & tax summary for your rental property</p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-text-primary"
        >
          {[2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Annual Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <p className="text-text-tertiary text-sm">Annual Income</p>
          <p className="text-2xl font-bold text-positive mt-1">
            {formatCurrency(annual_summary.total_income || 0)}
          </p>
          <p className="text-xs text-text-muted mt-2">
            vs {formatCurrency(prev_annual_summary.total_income || 0)} in {prev_year}
            {prev_annual_summary.total_income > 0 && (
              <span className={`ml-1 ${incomeDeltaColor((annual_summary.total_income || 0) - (prev_annual_summary.total_income || 0))}`}>
                {formatDelta(
                  (annual_summary.total_income || 0) - (prev_annual_summary.total_income || 0),
                  prev_annual_summary.total_income
                    ? (((annual_summary.total_income - prev_annual_summary.total_income) / prev_annual_summary.total_income) * 100)
                    : null
                )}
              </span>
            )}
          </p>
        </div>
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <p className="text-text-tertiary text-sm">Annual Expenses</p>
          <p className="text-2xl font-bold text-negative mt-1">
            {formatCurrency(annual_summary.total_expenses || 0)}
          </p>
          <p className="text-xs text-text-muted mt-2">
            vs {formatCurrency(prev_annual_summary.total_expenses || 0)} in {prev_year}
            {prev_annual_summary.total_expenses > 0 && (
              <span className={`ml-1 ${expenseDeltaColor((annual_summary.total_expenses || 0) - (prev_annual_summary.total_expenses || 0))}`}>
                {formatDelta(
                  (annual_summary.total_expenses || 0) - (prev_annual_summary.total_expenses || 0),
                  prev_annual_summary.total_expenses
                    ? (((annual_summary.total_expenses - prev_annual_summary.total_expenses) / prev_annual_summary.total_expenses) * 100)
                    : null
                )}
              </span>
            )}
          </p>
        </div>
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <p className="text-text-tertiary text-sm">Net Income</p>
          <p className={`text-2xl font-bold mt-1 ${
            (annual_summary.net_income || 0) >= 0 ? 'text-positive' : 'text-negative'
          }`}>
            {formatCurrency(annual_summary.net_income || 0)}
          </p>
          <p className="text-xs text-text-muted mt-2">
            vs {formatCurrency(prev_annual_summary.net_income || 0)} in {prev_year}
            {prev_annual_summary.net_income !== undefined && prev_annual_summary.net_income !== 0 && (
              <span className={`ml-1 ${incomeDeltaColor((annual_summary.net_income || 0) - (prev_annual_summary.net_income || 0))}`}>
                {formatDelta(
                  (annual_summary.net_income || 0) - (prev_annual_summary.net_income || 0),
                  prev_annual_summary.net_income
                    ? (((annual_summary.net_income - prev_annual_summary.net_income) / Math.abs(prev_annual_summary.net_income)) * 100)
                    : null
                )}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* T776 Tax Summary Table */}
      {t776_summary.length > 0 && (
        <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-bold text-text-primary">T776 Rental Income Tax Summary</h2>
            <p className="text-text-tertiary text-sm mt-1">CRA rental income form line groupings — click rows to expand</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    T776 Line
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    {year}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    {prev_year}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {t776_summary.map((group) => (
                  <React.Fragment key={group.group_name}>
                    <tr
                      className="hover:bg-surface-hover transition-colors cursor-pointer"
                      onClick={() => toggleGroup(group.group_name)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <svg
                            className={`w-4 h-4 text-text-tertiary transition-transform ${
                              expandedGroups[group.group_name] ? 'rotate-90' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="font-semibold text-text-primary">{group.group_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-text-primary">
                        {formatCurrency(group.selected_year_total)}
                      </td>
                      <td className="px-6 py-4 text-right text-text-secondary">
                        {formatCurrency(group.prev_year_total)}
                      </td>
                      <td className={`px-6 py-4 text-right text-sm ${groupDeltaColor(group)}`}>
                        {formatDelta(group.delta_dollars, group.delta_percent)}
                      </td>
                    </tr>
                    {expandedGroups[group.group_name] && group.children.map((child) => (
                      <tr key={child.category} className="bg-background/50">
                        <td className="px-6 py-3 pl-14 whitespace-nowrap text-text-secondary text-sm">
                          {child.category}
                        </td>
                        <td className="px-6 py-3 text-right text-text-secondary text-sm">
                          {formatCurrency(child.selected_year_total)}
                        </td>
                        <td className="px-6 py-3 text-right text-text-tertiary text-sm">
                          {formatCurrency(child.prev_year_total)}
                        </td>
                        <td className={`px-6 py-3 text-right text-xs ${groupDeltaColor(group)}`}>
                          {formatDelta(child.delta_dollars, child.delta_percent)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {/* Net Rental Income footer */}
                <tr className="border-t-2 border-text-primary bg-background">
                  <td className="px-6 py-4 font-bold text-text-primary">Net Rental Income</td>
                  <td className={`px-6 py-4 text-right font-bold ${
                    (annual_summary.net_income || 0) >= 0 ? 'text-positive' : 'text-negative'
                  }`}>
                    {formatCurrency(annual_summary.net_income || 0)}
                  </td>
                  <td className={`px-6 py-4 text-right font-bold ${
                    (prev_annual_summary.net_income || 0) >= 0 ? 'text-positive' : 'text-negative'
                  }`}>
                    {formatCurrency(prev_annual_summary.net_income || 0)}
                  </td>
                  <td className={`px-6 py-4 text-right font-bold ${
                    incomeDeltaColor((annual_summary.net_income || 0) - (prev_annual_summary.net_income || 0))
                  }`}>
                    {formatDelta(
                      (annual_summary.net_income || 0) - (prev_annual_summary.net_income || 0),
                      prev_annual_summary.net_income
                        ? (((annual_summary.net_income - prev_annual_summary.net_income) / Math.abs(prev_annual_summary.net_income)) * 100)
                        : null
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Income vs Expenses with previous year overlay */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-bold text-text-primary mb-4">Monthly Income vs Expenses</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={mergedMonthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis
                  dataKey="month_name"
                  tick={{ fill: '#737373', fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(v) => `$${v/1000}k`}
                  tick={{ fill: '#737373', fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value, name) => [formatCurrency(value), name]}
                  contentStyle={tooltipStyle}
                />
                <Legend />
                <Bar dataKey="income" name={`${year} Income`} fill="#22C55E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name={`${year} Expenses`} fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Line dataKey="prev_income" name={`${prev_year} Income`} stroke="#22C55E" strokeDasharray="5 5" dot={false} strokeWidth={2} />
                <Line dataKey="prev_expenses" name={`${prev_year} Expenses`} stroke="#EF4444" strokeDasharray="5 5" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Breakdown Pie Chart (T776 groupings) */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-bold text-text-primary mb-4">Expense Breakdown</h2>
          {t776_pie_data.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={t776_pie_data}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {t776_pie_data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-text-tertiary">
              No expense data for this year
            </div>
          )}
        </div>
      </div>

      {/* Income Flow (Sankey) */}
      {sankeyData && (
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-bold text-text-primary mb-4">Income Flow</h2>
          <SankeyChart data={sankeyData} width={800} height={400} />
        </div>
      )}

      {/* Year-over-Year Category Comparison */}
      {yoyCategoryData.length > 0 && (
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-bold text-text-primary mb-4">Year-over-Year Category Comparison</h2>
          <div style={{ height: Math.max(300, yoyCategoryData.length * 50) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={yoyCategoryData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 120, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fill: '#737373', fontSize: 12 }}
                />
                <YAxis
                  dataKey="category"
                  type="category"
                  tick={{ fill: '#737373', fontSize: 12 }}
                  width={110}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={tooltipStyle}
                />
                <Legend />
                <Bar dataKey={String(year)} name={String(year)} fill="#171717" radius={[0, 4, 4, 0]} />
                <Bar dataKey={String(prev_year)} name={String(prev_year)} fill="#D4D4D4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Expense Details Table */}
      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">Category Details</h2>
        </div>
        {category_breakdown.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    {year} Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    {prev_year} Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Change
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Monthly Avg
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Txns
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {category_breakdown.map((item, index) => (
                  <tr key={item.category} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium text-text-primary">{item.category}</span>
                        {item.is_income && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Income</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-text-primary font-medium">
                      {formatCurrency(item.selected_year_total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-text-secondary">
                      {formatCurrency(item.prev_year_total)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm ${
                      item.is_income
                        ? incomeDeltaColor(item.delta_dollars)
                        : expenseDeltaColor(item.delta_dollars)
                    }`}>
                      {formatDelta(item.delta_dollars, item.delta_percent)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-text-secondary">
                      {formatCurrency(item.monthly_avg)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-text-secondary">
                      {item.transaction_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-text-tertiary">
            No data available for {year}
          </div>
        )}
      </div>
    </div>
  );
}
