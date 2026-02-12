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
} from 'recharts';
import api from '../services/api';
import SankeyDiagram from '../components/SankeyDiagram';

export default function CashFlow({ selectedAccount }) {
  const [loading, setLoading] = useState(true);
  const [cashFlow, setCashFlow] = useState([]);
  const [spendingData, setSpendingData] = useState({ categories: [], total: 0, month: '' });
  const [kpis, setKpis] = useState({ monthly_income: 0, monthly_spending: 0, net_cash_flow: 0 });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

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

  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const display = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, display });
    }
    return options;
  };

  const monthOptions = generateMonthOptions();

  useEffect(() => {
    loadData();
  }, [selectedAccount]);

  useEffect(() => {
    loadSpendingData();
  }, [selectedMonth, selectedAccount]);

  const loadData = async () => {
    setLoading(true);
    try {
      const accountIds = selectedAccount || null;

      const [cashFlowRes, spendingRes, dashboardRes] = await Promise.all([
        api.getCashFlow(12, accountIds),
        api.getSpendingByCategory(selectedMonth, accountIds),
        api.getDashboard(accountIds),
      ]);

      setCashFlow(cashFlowRes.data.data || []);
      setSpendingData({
        categories: spendingRes.data.categories || [],
        total: spendingRes.data.total || 0,
        month: spendingRes.data.month || '',
      });
      setKpis(dashboardRes.data.kpis || { monthly_income: 0, monthly_spending: 0, net_cash_flow: 0 });
    } catch (error) {
      console.error('Failed to load cash flow data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSpendingData = async () => {
    try {
      const accountIds = selectedAccount || null;
      const spendingRes = await api.getSpendingByCategory(selectedMonth, accountIds);
      setSpendingData({
        categories: spendingRes.data.categories || [],
        total: spendingRes.data.total || 0,
        month: spendingRes.data.month || '',
      });
    } catch (error) {
      console.error('Failed to load spending data:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-tiffany border-t-transparent"></div>
      </div>
    );
  }

  const netCashFlow = kpis.net_cash_flow || 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-charcoal">Cash Flow</h1>
          <p className="text-gray-500 mt-1">Visualize how your money flows from income to expenses</p>
        </div>
        <div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.display}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-500 text-sm">Income</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">
            {formatCurrency(kpis.monthly_income || 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-500 text-sm">Expenses</p>
          <p className="text-2xl font-bold mt-1 text-rose-500">
            {formatCurrency(kpis.monthly_spending || 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-500 text-sm">Net Cash Flow</p>
          <p className={`text-2xl font-bold mt-1 ${netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {formatCurrency(netCashFlow)}
          </p>
        </div>
      </div>

      {/* Sankey Diagram Section */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-bold text-charcoal mb-4">Money Flow</h2>
        <SankeyDiagram
          income={kpis.monthly_income}
          categories={spendingData.categories}
          month={selectedMonth}
        />
      </div>

      {/* Cash Flow History Chart */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-bold text-charcoal mb-4">Monthly Cash Flow</h2>
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
                tickFormatter={(v) => `$${v / 1000}k`}
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
    </div>
  );
}
