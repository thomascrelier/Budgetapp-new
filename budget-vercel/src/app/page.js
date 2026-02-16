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

  const handleRefreshData = async () => {
    await api.refreshData();
    setRefreshKey((prev) => prev + 1);
  };

  // Show loading while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-text-primary border-t-transparent"></div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!session) {
    return null;
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
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-text-primary text-white flex items-center px-4 z-20">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="flex-1 text-center font-bold">Budget Tracker</span>
        {session?.user?.image && (
          <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
        )}
      </div>

      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onUploadClick={() => setIsUploadModalOpen(true)}
        onRefreshClick={handleRefreshData}
        user={session?.user}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <main className="ml-0 pt-16 p-4 md:ml-64 md:pt-0 md:p-8">
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
