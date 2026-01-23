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
import KpiCard from '../components/KpiCard';
import BudgetProgressBar from '../components/BudgetProgressBar';

export default function Dashboard({ selectedAccount }) {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [cashFlow, setCashFlow] = useState([]);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [budgetStatus, setBudgetStatus] = useState([]);

  useEffect(() => {
    loadData();
  }, [selectedAccount]);

  const loadData = async () => {
    setLoading(true);
    try {
      const accountIds = selectedAccount || null;

      const [dashboardRes, cashFlowRes, balanceRes, budgetRes] = await Promise.all([
        api.getDashboard(accountIds),
        api.getCashFlow(6, accountIds),
        api.getBalanceHistory(30, selectedAccount),
        api.getBudgetStatus(null, accountIds),
      ]);

      setDashboard(dashboardRes.data);
      setCashFlow(cashFlowRes.data.data || []);
      setBalanceHistory(balanceRes.data.data || []);
      setBudgetStatus(budgetRes.data.budgets || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
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

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-tiffany border-t-transparent"></div>
      </div>
    );
  }

  const kpis = dashboard?.kpis || {};

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-charcoal">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your financial health</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard
          title="Total Balance"
          value={kpis.total_balance}
          type="default"
          icon={
            <svg className="w-6 h-6 text-tiffany" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <KpiCard
          title="Month-to-Date Spending"
          value={kpis.monthly_spending}
          type="expense"
          icon={
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          }
        />
        <KpiCard
          title="Net Cash Flow"
          value={kpis.net_cash_flow}
          type="dynamic"
          subtitle="This month"
          icon={
            <svg className="w-6 h-6 text-tiffany" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
      </div>

      {/* Middle Row: Cash Flow Chart + Budget Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Bar Chart */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-bold text-charcoal mb-4">Cash Flow</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fill: '#718096', fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(v) => `$${v/1000}k`}
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
                <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Budget Progress */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-bold text-charcoal mb-4">Budget Progress</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {budgetStatus.length > 0 ? (
              budgetStatus.map((budget) => (
                <BudgetProgressBar
                  key={budget.category_name}
                  category={budget.category_name}
                  spent={budget.spent}
                  limit={budget.monthly_limit}
                  percentage={budget.percentage_used}
                  status={budget.status}
                />
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No budgets set up yet.</p>
                <p className="text-sm mt-1">Go to Budget Settings to create one.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Balance History */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-bold text-charcoal mb-4">Balance History (Last 30 Days)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={balanceHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: '#718096', fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                tick={{ fill: '#718096', fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="balance"
                name="Balance"
                stroke="#0ABAB5"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: '#0ABAB5' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Budget Alerts */}
      {dashboard?.budget_alerts?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-red-700 mb-3 flex items-center gap-2">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Budget Alerts
          </h2>
          <ul className="space-y-2">
            {dashboard.budget_alerts.map((alert) => (
              <li key={alert.category_name} className="flex items-center justify-between text-sm">
                <span className="font-medium text-red-800">{alert.category_name}</span>
                <span className="text-red-600">
                  {alert.percentage_used.toFixed(0)}% used ({formatCurrency(alert.spent)} / {formatCurrency(alert.monthly_limit)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
