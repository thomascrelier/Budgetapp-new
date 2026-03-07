'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function UploadModal({ isOpen, onClose, onSuccess }) {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
      setSelectedFile(null);
      setResult(null);
      setError(null);
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    try {
      const data = await api.getAccounts();
      setAccounts(data.accounts || []);
      if (data.accounts?.length > 0) setSelectedAccount(data.accounts[0].id);
    } catch (err) {
      setError('Failed to load accounts');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setResult(null); setError(null); }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedAccount) return;
    setUploading(true); setError(null); setResult(null);
    try {
      const data = await api.uploadCSV(selectedFile, selectedAccount);
      if (data.error) { setError(data.error); }
      else { setResult(data); onSuccess?.(); }
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  const inputClasses = 'w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-border/50">
          <h2 className="text-lg font-semibold text-text-primary">Upload CSV</h2>
          <p className="text-sm text-text-tertiary mt-1">Import transactions from a CSV file</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Select Account</label>
            <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className={inputClasses}>
              {accounts.map((account) => (<option key={account.id} value={account.id}>{account.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">CSV File</label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent/40 transition-colors">
              <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="csv-upload" />
              <label htmlFor="csv-upload" className="cursor-pointer">
                {selectedFile ? (
                  <div>
                    <p className="font-medium text-text-primary">{selectedFile.name}</p>
                    <p className="text-sm text-text-muted mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <svg className="w-10 h-10 mx-auto text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mt-2 text-sm text-text-secondary">Click to select a CSV file</p>
                  </div>
                )}
              </label>
            </div>
          </div>
          {result && (
            <div className="p-4 bg-positive/10 border border-positive/20 rounded-lg">
              <p className="font-medium text-positive">Upload Successful!</p>
              <p className="text-sm text-positive/80 mt-1">
                {result.created} transactions imported
                {result.skipped_duplicates > 0 && ` (${result.skipped_duplicates} duplicates skipped)`}
              </p>
            </div>
          )}
          {error && (
            <div className="p-4 bg-negative/10 border border-negative/20 rounded-lg">
              <p className="font-medium text-negative">Upload Failed</p>
              <p className="text-sm text-negative/80 mt-1">{error}</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button onClick={handleUpload} disabled={!selectedFile || uploading} className="px-4 py-2 bg-accent text-background rounded-lg font-semibold hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm">
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
