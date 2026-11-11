'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function UploadModal({ isOpen, onClose, onSuccess }) {
  const [accounts, setAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState('idle'); // idle | loading | ready | error
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
      setSelectedFile(null);
      setResult(null);
      setError(null);
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    setAccountsStatus('loading');
    try {
      const data = await api.getAccounts();
      const list = data.accounts || [];
      setAccounts(list);
      setSelectedAccount(list.length > 0 ? list[0].id : '');
      setAccountsStatus('ready');
    } catch (err) {
      setAccountsStatus('error');
    }
  };

  // While an upload is in flight, closing would hide its outcome; keep the dialog until it settles.
  const requestClose = useCallback(() => {
    if (!uploading) onClose?.();
  }, [uploading, onClose]);

  // Dialog behavior: initial focus, Tab trap, Escape, scroll lock, focus return.
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Focus the dialog itself so its title is announced; Tab then moves to the first field.
    const focusFirst = requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      cancelAnimationFrame(focusFirst);
      document.body.style.overflow = overflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, requestClose]);

  // The Upload button unmounts on success; keep keyboard focus inside the dialog.
  useEffect(() => {
    if (result) closeButtonRef.current?.focus();
  }, [result]);

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

  const accountsLoading = accountsStatus === 'loading';
  const noAccounts = accountsStatus === 'ready' && accounts.length === 0;
  const canUpload = Boolean(selectedFile && selectedAccount) && !uploading;

  const inputClasses = 'w-full min-h-11 px-3 py-2 border border-border rounded-lg bg-surface text-text-primary focus:border-accent-text disabled:opacity-60 disabled:cursor-not-allowed transition-colors';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={requestClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-modal-title"
            aria-describedby="upload-modal-description"
            tabIndex={-1}
            className="relative glass-card rounded-xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto focus:outline-none"
            style={{ boxShadow: '0 24px 64px var(--shadow-heavy)' }}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className="px-6 py-4 border-b border-border/50">
              <h2 id="upload-modal-title" className="text-lg font-semibold text-text-primary">Upload CSV</h2>
              <p id="upload-modal-description" className="text-sm text-text-tertiary mt-1">Import transactions from a CSV file</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="upload-account" className="block text-sm font-medium text-text-secondary mb-2">Select Account</label>
                <select
                  id="upload-account"
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  disabled={accountsLoading || noAccounts || accountsStatus === 'error' || uploading}
                  aria-describedby={noAccounts || accountsStatus === 'error' ? 'upload-account-hint' : undefined}
                  className={inputClasses}
                >
                  {accountsLoading && <option value="">Loading accounts…</option>}
                  {noAccounts && <option value="">No accounts</option>}
                  {accountsStatus === 'error' && <option value="">Unavailable</option>}
                  {accounts.map((account) => (<option key={account.id} value={account.id}>{account.name}</option>))}
                </select>
                {noAccounts && (
                  <p id="upload-account-hint" className="mt-2 text-sm text-text-tertiary">Add an account before importing transactions.</p>
                )}
                {accountsStatus === 'error' && (
                  <p id="upload-account-hint" role="alert" className="mt-2 text-sm text-negative">
                    Failed to load accounts.{' '}
                    <button type="button" onClick={loadAccounts} className="underline underline-offset-2 font-medium hover:text-text-primary">
                      Try again
                    </button>
                  </p>
                )}
              </div>
              <div>
                <span id="upload-file-label" className="block text-sm font-medium text-text-secondary mb-2">CSV File</span>
                <label
                  htmlFor="csv-upload"
                  className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors [&:has(:focus-visible)]:outline [&:has(:focus-visible)]:outline-2 [&:has(:focus-visible)]:outline-offset-2 [&:has(:focus-visible)]:outline-[var(--focus-ring)] ${
                    selectedFile ? 'border-accent/50 bg-accent/5' : 'border-border hover:border-accent/50 hover:bg-surface-hover'
                  } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="sr-only"
                    id="csv-upload"
                    aria-labelledby="upload-file-label"
                    aria-describedby="csv-upload-status"
                  />
                  {selectedFile ? (
                    <span id="csv-upload-status" className="block">
                      <span className="block font-medium text-text-primary break-all">{selectedFile.name}</span>
                      <span className="block text-sm text-text-muted mt-1">
                        <span className="tabular">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                        <span aria-hidden="true"> · </span>
                        <span className="text-accent-text font-medium">Choose a different file</span>
                      </span>
                    </span>
                  ) : (
                    <span id="csv-upload-status" className="block">
                      <svg className="w-10 h-10 mx-auto text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="block mt-2 text-sm text-text-secondary">Click to select a CSV file</span>
                    </span>
                  )}
                </label>
              </div>
              {result && (
                <div role="status" className="p-4 bg-positive/10 border border-positive/20 rounded-lg">
                  <p className="font-medium text-positive">Upload Successful!</p>
                  <p className="text-sm text-text-secondary mt-1">
                    <span className="tabular">{result.created}</span> transactions imported
                    {result.skipped_duplicates > 0 && <> (<span className="tabular">{result.skipped_duplicates}</span> duplicates skipped)</>}
                  </p>
                </div>
              )}
              {error && (
                <div role="alert" className="p-4 bg-negative/10 border border-negative/20 rounded-lg">
                  <p className="font-medium text-negative">Upload Failed</p>
                  <p className="text-sm text-text-secondary mt-1 break-words">{error}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border/50 flex justify-end gap-3">
              <motion.button
                ref={closeButtonRef}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={requestClose}
                disabled={uploading}
                className="min-h-11 md:min-h-10 px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {result ? 'Close' : 'Cancel'}
              </motion.button>
              {!result && (
                <motion.button
                  type="button"
                  whileTap={canUpload ? { scale: 0.97 } : undefined}
                  onClick={handleUpload}
                  disabled={!canUpload}
                  aria-busy={uploading}
                  className="min-h-11 md:min-h-10 inline-flex items-center gap-2 px-4 py-2 bg-accent text-on-accent rounded-lg font-semibold hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent transition-colors text-sm"
                >
                  {uploading && (
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />
                  )}
                  {uploading ? 'Uploading…' : 'Upload'}
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
