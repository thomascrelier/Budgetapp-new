import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import UploadModal from './components/UploadModal';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Accounts from './pages/Accounts';
import BudgetSettings from './pages/BudgetSettings';
import RentalProperty from './pages/RentalProperty';
import CashFlow from './pages/CashFlow';

export default function App() {
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = () => {
    // Trigger refresh of data in child components
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-offwhite">
      <Sidebar
        selectedAccount={selectedAccount}
        onAccountChange={setSelectedAccount}
        onUploadClick={() => setIsUploadModalOpen(true)}
      />

      {/* Main Content */}
      <main className="ml-64 p-8">
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                key={refreshKey}
                selectedAccount={selectedAccount}
              />
            }
          />
          <Route
            path="/cash-flow"
            element={
              <CashFlow
                key={refreshKey}
                selectedAccount={selectedAccount}
              />
            }
          />
          <Route
            path="/rental-property"
            element={
              <RentalProperty key={refreshKey} />
            }
          />
          <Route
            path="/transactions"
            element={
              <Transactions
                key={refreshKey}
                selectedAccount={selectedAccount}
              />
            }
          />
          <Route
            path="/accounts"
            element={
              <Accounts
                key={refreshKey}
                onAccountCreated={() => setRefreshKey((prev) => prev + 1)}
              />
            }
          />
          <Route
            path="/budgets"
            element={
              <BudgetSettings
                key={refreshKey}
                selectedAccount={selectedAccount}
              />
            }
          />
        </Routes>
      </main>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
