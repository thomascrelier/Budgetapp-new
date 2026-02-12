'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
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
import api from '@/lib/api';

const COLORS = ['#171717', '#525252', '#737373', '#A3A3A3', '#D4D4D4', '#E5E5E5', '#404040', '#262626'];

export default function RentalProperty() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-text-primary border-t-transparent"></div>
      </div>
    );
  }

  const { monthly_data = [], utility_breakdown = [], annual_summary = {} } = data || {};

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Rental Property</h1>
          <p className="text-text-tertiary mt-1">Analytics for your rental property account</p>
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
        </div>
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <p className="text-text-tertiary text-sm">Annual Expenses</p>
          <p className="text-2xl font-bold text-negative mt-1">
            {formatCurrency(annual_summary.total_expenses || 0)}
          </p>
        </div>
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <p className="text-text-tertiary text-sm">Net Income</p>
          <p className={`text-2xl font-bold mt-1 ${
            (annual_summary.net_income || 0) >= 0 ? 'text-positive' : 'text-negative'
          }`}>
            {formatCurrency(annual_summary.net_income || 0)}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Income vs Expenses */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-bold text-text-primary mb-4">Monthly Income vs Expenses</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly_data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E5E5',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#22C55E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Utility Breakdown Pie Chart */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-bold text-text-primary mb-4">Expense Breakdown</h2>
          {utility_breakdown.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={utility_breakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="total"
                    nameKey="category"
                    label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {utility_breakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E5E5',
                      borderRadius: '8px',
                    }}
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

      {/* Utility Details Table */}
      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">Expense Details</h2>
        </div>
        {utility_breakdown.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Total Spent
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Monthly Average
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Transactions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {utility_breakdown.map((item, index) => (
                  <tr key={item.category} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium text-text-primary">{item.category}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-text-primary font-medium">
                      {formatCurrency(item.total)}
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
            No expense data available for {year}
          </div>
        )}
      </div>
    </div>
  );
}
