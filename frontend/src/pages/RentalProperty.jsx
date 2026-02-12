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
  Legend,
} from 'recharts';
import api from '../services/api';

export default function RentalProperty() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getRentalPropertyAnalytics();
      setData(response.data);
    } catch (err) {
      console.error('Failed to load rental property data:', err);
      if (err.response?.status === 404) {
        setError('Rental Property account not found. Please initialize default accounts first.');
      } else {
        setError('Failed to load rental property analytics.');
      }
    } finally {
      setLoading(false);
    }
  };

  const initializeAccounts = async () => {
    try {
      await api.initializeDefaultAccounts();
      loadData();
    } catch (err) {
      console.error('Failed to initialize accounts:', err);
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

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-charcoal">Rental Property</h1>
          <p className="text-gray-500 mt-1">Detailed analytics for your rental property</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-800 mb-4">{error}</p>
          <button
            onClick={initializeAccounts}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Initialize Default Accounts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-charcoal">Rental Property</h1>
        <p className="text-gray-500 mt-1">Detailed analytics for your rental property</p>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-primary">
          <p className="text-gray-500 text-sm">Current Balance</p>
          <p className={`text-2xl font-bold mt-1 ${parseFloat(data.current_balance) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {formatCurrency(data.current_balance)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
          <p className="text-gray-500 text-sm">Monthly Cash Flow</p>
          <p className={`text-2xl font-bold mt-1 ${parseFloat(data.monthly_cash_flow) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {formatCurrency(data.monthly_cash_flow)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm">YTD Cash Flow</p>
          <p className={`text-2xl font-bold mt-1 ${parseFloat(data.ytd_cash_flow) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {formatCurrency(data.ytd_cash_flow)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-accent">
          <p className="text-gray-500 text-sm">Account</p>
          <p className="text-xl font-semibold mt-1 text-charcoal">{data.account_name}</p>
        </div>
      </div>

      {/* Cash Flow Chart */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-bold text-charcoal mb-4">Cash Flow History (12 Months)</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.cash_flow_history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                tick={{ fill: '#718096', fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                tick={{ fill: '#718096', fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#34D399" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#FB7185" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Net Cash Flow Line Chart */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-bold text-charcoal mb-4">Net Cash Flow Trend</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.cash_flow_history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                tick={{ fill: '#718096', fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                tick={{ fill: '#718096', fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="net"
                name="Net Cash Flow"
                stroke="#818CF8"
                strokeWidth={3}
                dot={{ r: 4, fill: '#818CF8' }}
                activeDot={{ r: 6, fill: '#818CF8' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Utility Breakdown Table */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-bold text-charcoal mb-4">Utility Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Category</th>
                <th className="text-right py-3 px-4 text-gray-600 font-medium">This Month</th>
                <th className="text-right py-3 px-4 text-gray-600 font-medium">3-Month Avg</th>
                <th className="text-right py-3 px-4 text-gray-600 font-medium">12-Month Avg</th>
                <th className="text-right py-3 px-4 text-gray-600 font-medium">YoY Change</th>
              </tr>
            </thead>
            <tbody>
              {data.utility_breakdown.map((util) => (
                <tr key={util.category} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-charcoal">{util.category}</td>
                  <td className="py-3 px-4 text-right text-charcoal">
                    {formatCurrency(util.current_month)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {formatCurrency(util.rolling_avg_3m)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {formatCurrency(util.rolling_avg_12m)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {util.year_over_year_change !== null ? (
                      <span className={util.year_over_year_change > 0 ? 'text-rose-500' : 'text-emerald-600'}>
                        {util.year_over_year_change > 0 ? '+' : ''}{util.year_over_year_change.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Year over Year Comparison */}
      {data.year_over_year && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-bold text-charcoal mb-4">Year over Year Comparison</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Last Year */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-md font-semibold text-gray-600 mb-3">Last Year</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Income</span>
                  <span className="text-emerald-600 font-medium">
                    {formatCurrency(data.year_over_year.last_year.income)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Expenses</span>
                  <span className="text-rose-500 font-medium">
                    {formatCurrency(data.year_over_year.last_year.expenses)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="text-gray-700 font-medium">Net</span>
                  <span className={`font-bold ${data.year_over_year.last_year.net >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {formatCurrency(data.year_over_year.last_year.net)}
                  </span>
                </div>
              </div>
            </div>

            {/* This Year */}
            <div className="bg-primary-50 rounded-lg p-4 border border-primary-100">
              <h3 className="text-md font-semibold text-primary-700 mb-3">This Year</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Income</span>
                  <span className="text-emerald-600 font-medium">
                    {formatCurrency(data.year_over_year.this_year.income)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Expenses</span>
                  <span className="text-rose-500 font-medium">
                    {formatCurrency(data.year_over_year.this_year.expenses)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-primary-100 pt-2">
                  <span className="text-gray-700 font-medium">Net</span>
                  <span className={`font-bold ${data.year_over_year.this_year.net >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {formatCurrency(data.year_over_year.this_year.net)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
