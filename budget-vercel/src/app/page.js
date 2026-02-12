'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import UploadModal from '@/components/UploadModal';
import api from '@/lib/api';
import Dashboard from '@/components/Dashboard';
import Transactions from '@/components/Transactions';
import Accounts from '@/components/Accounts';
import BudgetSettings from '@/components/BudgetSettings';
import RentalProperty from '@/components/RentalProperty';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
        return <Dashboard key={refreshKey} selectedAccount={selectedAccount} />;
      case 'rental-property':
        return <RentalProperty key={refreshKey} />;
      case 'transactions':
        return <Transactions key={refreshKey} selectedAccount={selectedAccount} />;
      case 'accounts':
        return <Accounts key={refreshKey} onAccountCreated={() => setRefreshKey((prev) => prev + 1)} />;
      case 'budgets':
        return <BudgetSettings key={refreshKey} selectedAccount={selectedAccount} />;
      default:
        return <Dashboard key={refreshKey} selectedAccount={selectedAccount} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        selectedAccount={selectedAccount}
        onAccountChange={setSelectedAccount}
        onUploadClick={() => setIsUploadModalOpen(true)}
        onRefreshClick={handleRefreshData}
        user={session?.user}
      />

      <main className="ml-64 p-8">
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
