'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import UploadModal from '@/components/UploadModal';
import api from '@/lib/api';
import Dashboard from '@/components/Dashboard';
import Transactions from '@/components/Transactions';
import BudgetSettings from '@/components/BudgetSettings';
import RentalProperty from '@/components/RentalProperty';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const handleUploadSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // Errors propagate to the Sidebar, which shows the failed state.
  const handleRefreshData = async () => {
    await api.refreshData();
    setRefreshKey((prev) => prev + 1);
  };

  const handlePageChange = (pageId) => {
    setCurrentPage(pageId);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  // Loading, and the brief moment before the unauthenticated redirect lands.
  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" role="status">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-accent border-t-transparent" aria-hidden="true"></div>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard key={refreshKey} />;
      case 'rental-property':
        return <RentalProperty key={refreshKey} />;
      case 'transactions':
        return <Transactions key={refreshKey} />;
      case 'budgets':
        return <BudgetSettings key={refreshKey} />;
      default:
        return <Dashboard key={refreshKey} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-surface focus:text-text-primary focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-surface border-b border-border flex items-center px-2 z-20">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation"
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
          className="w-11 h-11 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="flex-1 text-center font-semibold text-text-primary">Budget Tracker</span>
        <span className="w-11 h-11 flex items-center justify-center">
          {session.user?.image && (
            <img
              src={session.user.image}
              alt=""
              width={32}
              height={32}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full ring-2 ring-border bg-surface-hover"
            />
          )}
        </span>
      </header>

      <Sidebar
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onUploadClick={() => {
          setSidebarOpen(false);
          setIsUploadModalOpen(true);
        }}
        onRefreshClick={handleRefreshData}
        user={session.user}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((open) => !open)}
        onClose={() => setSidebarOpen(false)}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="px-4 pb-8 pt-[4.5rem] md:ml-64 md:p-8 focus:outline-none"
      >
        {renderPage()}
      </main>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
