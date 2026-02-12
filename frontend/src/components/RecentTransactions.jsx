import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const truncate = (str, maxLength = 30) => {
  if (!str) return '';
  return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
};

export default function RecentTransactions({ selectedAccount, refreshKey }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, [selectedAccount, refreshKey]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        limit: 8,
        sort_by: 'date',
        sort_order: 'desc',
      };
      if (selectedAccount) {
        params.account_id = selectedAccount;
      }
      const res = await api.getTransactions(params);
      setTransactions(res.data.transactions || []);
    } catch (error) {
      console.error('Failed to load recent transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-charcoal">Recent Transactions</h2>
        <Link
          to="/transactions"
          className="text-sm text-primary hover:text-primary-dark font-medium"
        >
          View All
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-tiffany border-t-transparent"></div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-500">
          No recent transactions
        </div>
      ) : (
        <div>
          {transactions.map((txn, index) => {
            const amount = parseFloat(txn.amount);
            const isPositive = amount >= 0;

            return (
              <div
                key={txn.id}
                className={`flex items-center justify-between py-3 ${
                  index < transactions.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-charcoal truncate">
                    {truncate(txn.description)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(txn.date)}
                  </p>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <p
                    className={`text-sm font-semibold ${
                      isPositive ? 'text-emerald-600' : 'text-rose-500'
                    }`}
                  >
                    {isPositive ? '+' : ''}{formatCurrency(amount)}
                  </p>
                  {txn.category && (
                    <span className="inline-block bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-xs mt-1">
                      {txn.category}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
