import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../services/api';

// Icons as simple SVG components
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const ListIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);

const WalletIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const SlidersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);

const UploadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const navItems = [
  { path: '/', label: 'Dashboard', icon: HomeIcon },
  { path: '/transactions', label: 'Transactions', icon: ListIcon },
  { path: '/accounts', label: 'Accounts', icon: WalletIcon },
  { path: '/budgets', label: 'Budget Settings', icon: SlidersIcon },
];

export default function Sidebar({ selectedAccount, onAccountChange, onUploadClick }) {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await api.getAccounts();
      setAccounts(response.data.accounts);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-tiffany text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-tiffany-dark">
        <h1 className="text-2xl font-bold">BudgetCSV</h1>
        <p className="text-tiffany-100 text-sm mt-1">Personal Finance</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-3">
          {navItems.map(({ path, label, icon: Icon }) => (
            <li key={path}>
              <NavLink
                to={path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-white text-tiffany font-medium'
                      : 'hover:bg-tiffany-dark'
                  }`
                }
              >
                <Icon />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Upload Button */}
        <div className="px-3 mt-6">
          <button
            onClick={onUploadClick}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-tiffany font-medium rounded-lg hover:bg-tiffany-50 transition-colors"
          >
            <UploadIcon />
            <span>Upload CSV</span>
          </button>
        </div>
      </nav>

      {/* Account Toggler */}
      <div className="p-4 border-t border-tiffany-dark">
        <label className="block text-tiffany-100 text-sm mb-2">
          Filter by Account
        </label>
        <select
          value={selectedAccount || ''}
          onChange={(e) => onAccountChange(e.target.value || null)}
          className="w-full px-3 py-2 bg-white text-charcoal rounded-lg border-2 border-transparent focus:border-tiffany-dark focus:outline-none"
        >
          <option value="">All Accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
