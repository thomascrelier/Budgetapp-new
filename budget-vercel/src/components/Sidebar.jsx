'use client';

import { signOut } from 'next-auth/react';
import { useTheme } from './ThemeProvider';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
  { id: 'rental-property', label: 'Rental Property', icon: BuildingIcon },
  { id: 'transactions', label: 'Transactions', icon: ListIcon },
  { id: 'budgets', label: 'Budget Settings', icon: SlidersIcon },
];

function HomeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

const sidebarGradientStyle = {
  background: `linear-gradient(180deg, var(--sidebar-from) 0%, var(--sidebar-to) 100%)`,
  borderRight: `1px solid var(--sidebar-border)`,
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

export default function Sidebar({ currentPage, onPageChange, onUploadClick, onRefreshClick, user, isOpen, onToggle, onClose }) {
  const { theme, toggleTheme } = useTheme();
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [refreshState, setRefreshState] = useState('idle'); // idle | refreshing | error

  const close = useCallback(() => {
    if (onClose) onClose();
    else onToggle?.();
  }, [onClose, onToggle]);

  // Mobile drawer: focus into the drawer, trap Tab, close on Escape, lock page scroll.
  useEffect(() => {
    if (!isOpen || !isMobile()) return;
    const previouslyFocused = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || !drawerRef.current) return;
      const nodes = Array.from(drawerRef.current.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [isOpen, close]);

  const handleNavClick = (pageId) => {
    onPageChange(pageId);
    if (isMobile()) close();
  };

  const handleRefresh = async () => {
    if (refreshState === 'refreshing') return;
    setRefreshState('refreshing');
    try {
      await onRefreshClick?.();
      setRefreshState('idle');
    } catch {
      setRefreshState('error');
    }
  };

  const refreshing = refreshState === 'refreshing';

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" onClick={close} aria-hidden="true" />
      )}

      <aside
        id="app-sidebar"
        ref={drawerRef}
        aria-label="Sidebar"
        className={`fixed left-0 top-0 h-full w-64 flex flex-col z-40 overflow-y-auto overscroll-contain transform transition-[transform,visibility] duration-300 ease-out md:translate-x-0 md:visible ${
          isOpen ? 'translate-x-0 visible' : '-translate-x-full invisible'
        }`}
        style={sidebarGradientStyle}
      >
        <div className="px-6 py-5 md:py-6 border-b border-border/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center" aria-hidden="true">
              <span className="font-display text-accent-text text-xl">$</span>
            </div>
            <div>
              <p className="text-lg font-semibold text-text-primary tracking-tight leading-tight">Budget</p>
              <p className="text-xs text-text-muted tracking-widest uppercase">Tracker</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="Close navigation"
            className="md:hidden -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 p-3 space-y-0.5">
          <LayoutGroup>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative w-full min-h-11 flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'text-accent-text'
                      : 'text-text-tertiary hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-accent/10 rounded-lg"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <Icon />
                    <span className="text-sm font-medium">{item.label}</span>
                  </span>
                </button>
              );
            })}
          </LayoutGroup>
        </nav>

        <div className="p-3 border-t border-border/50 space-y-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={onUploadClick}
            className="w-full min-h-11 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-on-accent rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            <UploadIcon />
            Upload CSV
          </motion.button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
            className="w-full min-h-11 flex items-center justify-center gap-2 px-4 py-2 text-text-tertiary border border-border rounded-lg text-sm font-medium hover:bg-surface-hover hover:text-text-primary disabled:cursor-wait disabled:hover:bg-transparent transition-colors"
          >
            <span className={refreshing ? 'animate-spin' : undefined}>
              <RefreshIcon />
            </span>
            {refreshing ? 'Refreshing…' : 'Refresh Data'}
          </button>
          <p role="status" className={refreshState === 'error' ? 'px-1 text-xs text-negative' : 'sr-only'}>
            {refreshState === 'error' ? 'Refresh failed. Try again.' : ''}
          </p>
        </div>

        {user && (
          <div className="p-4 border-t border-border/50">
            <div className="flex items-center gap-3">
              {user.image ? (
                <img
                  src={user.image}
                  alt=""
                  width={36}
                  height={36}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full ring-2 ring-border bg-surface-hover"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-surface-hover flex items-center justify-center ring-2 ring-border" aria-hidden="true">
                  <span className="text-sm font-medium text-text-secondary">{user.name?.charAt(0) || user.email?.charAt(0) || '?'}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
                <p className="text-xs text-text-muted truncate">{user.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full min-h-11 md:min-h-10 flex items-center gap-3 px-3 py-2 mt-3 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors duration-200"
            >
              <motion.span
                className="flex"
                aria-hidden="true"
                animate={{ rotate: theme === 'dark' ? 0 : 180 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </motion.span>
              <span className="text-sm">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full min-h-11 md:min-h-9 mt-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
            >
              <LogoutIcon />
              Sign Out
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}
