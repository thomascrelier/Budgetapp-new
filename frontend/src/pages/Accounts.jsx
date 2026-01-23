import { useState, useEffect } from 'react';
import api from '../services/api';

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'investment', label: 'Investment' },
];

export default function Accounts({ onAccountCreated }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    account_type: 'checking',
    initial_balance: '0',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const response = await api.getAccounts();
      setAccounts(response.data.accounts);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.createAccount({
        name: formData.name,
        account_type: formData.account_type,
        initial_balance: parseFloat(formData.initial_balance) || 0,
      });
      setShowForm(false);
      setFormData({ name: '', account_type: 'checking', initial_balance: '0' });
      loadAccounts();
      if (onAccountCreated) onAccountCreated();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will also delete all associated transactions.`)) {
      return;
    }

    try {
      await api.deleteAccount(id);
      loadAccounts();
      if (onAccountCreated) onAccountCreated();
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const getAccountTypeLabel = (type) => {
    const found = ACCOUNT_TYPES.find((t) => t.value === type);
    return found ? found.label : type;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-charcoal">Accounts</h1>
          <p className="text-gray-500 mt-1">Manage your financial accounts</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-tiffany text-white font-medium rounded-lg hover:bg-tiffany-dark transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Account
        </button>
      </div>

      {/* Create Account Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-bold text-charcoal mb-4">Create New Account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Chase Checking"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Account Type
                </label>
                <select
                  value={formData.account_type}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany focus:border-transparent"
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Initial Balance
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.initial_balance}
                  onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany focus:border-transparent"
                />
              </div>
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-tiffany text-white font-medium rounded-lg hover:bg-tiffany-dark transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Account'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-100 text-charcoal font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Accounts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-tiffany border-t-transparent"></div>
          </div>
        ) : accounts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p className="text-lg font-medium">No accounts yet</p>
            <p className="text-sm mt-1">Create an account to get started</p>
          </div>
        ) : (
          accounts.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded-xl shadow-md p-6 border-l-4 border-l-tiffany card-hover"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-charcoal">{account.name}</h3>
                  <span className="text-sm text-gray-500">
                    {getAccountTypeLabel(account.account_type)}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(account.id, account.name)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Initial Balance:</span>
                  <span className="font-medium">{formatCurrency(account.initial_balance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Current Balance:</span>
                  <span className={`font-bold text-lg ${parseFloat(account.current_balance) >= 0 ? 'text-tiffany' : 'text-red-500'}`}>
                    {formatCurrency(account.current_balance)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
