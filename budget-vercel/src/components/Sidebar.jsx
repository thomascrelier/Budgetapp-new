'use client';

import { signOut } from 'next-auth/react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
  { id: 'rental-property', label: 'Rental Property', icon: BuildingIcon },
  { id: 'transactions', label: 'Transactions', icon: ListIcon },
  { id: 'budgets', label: 'Budget Settings', icon: SlidersIcon },
];

function HomeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

export default function Sidebar({ currentPage, onPageChange, onUploadClick, onRefreshClick, user, isOpen, onToggle }) {
  const handleNavClick = (pageId) => {
    onPageChange(pageId);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      onToggle?.();
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" onClick={onToggle} />
      )}

      <div className={`fixed left-0 top-0 h-full w-64 flex flex-col z-40 transform transition-transform duration-300 md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`} style={{
        background: 'linear-gradient(180deg, #12121E 0%, #0E0E18 100%)',
        borderRight: '1px solid rgba(42, 42, 60, 0.5)',
      }}>
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <span className="font-display text-accent text-xl">$</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary tracking-tight">Budget</h1>
              <p className="text-xs text-text-muted tracking-widest uppercase">Tracker</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-hover/50'
                }`}
              >
                <Icon />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border/50 space-y-2">
          <button onClick={onUploadClick} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-background rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors">
            <UploadIcon />
            Upload CSV
          </button>
          <button onClick={onRefreshClick} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-text-tertiary border border-border rounded-lg text-sm font-medium hover:bg-surface-hover hover:text-text-secondary transition-colors">
            <RefreshIcon />
            Refresh Data
          </button>
        </div>

        {user && (
          <div className="p-4 border-t border-border/50">
            <div className="flex items-center gap-3">
              {user.image ? (
                <img src={user.image} alt={user.name || 'User'} className="w-9 h-9 rounded-full ring-2 ring-border" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-surface-hover flex items-center justify-center ring-2 ring-border">
                  <span className="text-sm font-medium text-text-secondary">{user.name?.charAt(0) || user.email?.charAt(0) || '?'}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
                <p className="text-xs text-text-muted truncate">{user.email}</p>
              </div>
            </div>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary hover:bg-surface-hover rounded-lg transition-colors">
              <LogoutIcon />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </>
  );
}
