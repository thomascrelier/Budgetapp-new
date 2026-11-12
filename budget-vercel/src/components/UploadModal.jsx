'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { formatMoney } from '@/components/AnimatedNumber';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function UploadModal({ isOpen, onClose, onSuccess }) {
  const [accounts, setAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState('idle'); // idle | loading | ready | error
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [checkedOlder, setCheckedOlder] = useState(() => new Set());
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const requestId = useRef(0);
  const previewRef = useRef(null);

  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
      requestId.current += 1;
      setSelectedFile(null);
      setPreview(null);
      setSelectedAccount('');
      setCheckedOlder(new Set());
      setPreviewing(false);
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
      setAccountsStatus('ready');
    } catch (err) {
      setAccountsStatus('error');
    }
  };

  // While an upload is in flight, closing would hide its outcome; keep the dialog until it settles.
  const requestClose = useCallback(() => {
    if (!uploading && !previewing) onClose?.();
  }, [uploading, previewing, onClose]);

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

  // Buttons unmount between steps; keep keyboard focus inside the dialog.
  useEffect(() => {
    if (result) closeButtonRef.current?.focus();
  }, [result]);
  previewRef.current = preview;
  const hasPreview = Boolean(preview);
  useEffect(() => {
    if (hasPreview) dialogRef.current?.focus();
  }, [hasPreview]);

  // A failed re-preview must leave the select matching the plan on screen.
  const revertAccount = () => setSelectedAccount(previewRef.current?.account_id ?? '');

  const runPreview = async (file, accountId) => {
    const id = ++requestId.current;
    setPreviewing(true); setError(null);
    try {
      const data = await api.previewImport(file, accountId);
      if (id !== requestId.current) return;
      if (data.error) { revertAccount(); setError(data.error); return; }
      setPreview(data);
      setSelectedAccount(data.account_id ?? '');
      setCheckedOlder(new Set());
    } catch (err) {
      if (id === requestId.current) { revertAccount(); setError(err.message || 'Could not read the file'); }
    } finally {
      if (id === requestId.current) setPreviewing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setSelectedFile(file); setResult(null); setPreview(null);
    runPreview(file);
  };

  const handleAccountChange = (e) => {
    const value = e.target.value;
    setError(null);
    setSelectedAccount(value);
    if (value && selectedFile) runPreview(selectedFile, value);
  };

  const planMatchesAccount = Boolean(preview) && String(selectedAccount) === String(preview.account_id);
  const plan = planMatchesAccount ? preview.plan : null;
  const olderRows = plan?.older || [];
  const rowsToAdd = plan ? [...plan.new, ...olderRows.filter((_, i) => checkedOlder.has(i))] : [];
  const addCount = rowsToAdd.length;

  const toggleOlder = (i) => setCheckedOlder((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const handleCommit = async () => {
    if (!addCount || !selectedAccount || !planMatchesAccount) return;
    setUploading(true); setError(null);
    try {
      const data = await api.commitImport(selectedAccount, rowsToAdd.map(({ date, description, amount, category }) => ({ date, description, amount, category })));
      if (data.error) { setError(data.error); }
      else { setResult(data); onSuccess?.(); }
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  const accountsLoading = accountsStatus === 'loading';
  const noAccounts = accountsStatus === 'ready' && accounts.length === 0;
  const busy = uploading || previewing;
  const step = result ? 'done' : (preview ? 'review' : 'choose');
  const chosenAccount = accounts.find((a) => String(a.id) === String(selectedAccount));
  const accountName = preview?.account_name || chosenAccount?.name || '';
  const alreadyIn = preview?.detection?.find((d) => String(d.account_id) === String(selectedAccount))?.matched ?? 0;
  const totalRows = preview ? (preview.total_rows ?? ((plan?.new.length || 0) + (plan?.duplicates.length || 0) + olderRows.length)) : 0;
  const plural = (n, w) => `${n.toLocaleString('en-CA')} ${w}${n === 1 ? '' : 's'}`;

  const inputClasses = 'w-full min-h-11 px-3 py-2 border border-border rounded-lg bg-surface text-text-primary focus:border-accent-text disabled:opacity-60 disabled:cursor-not-allowed transition-colors';

  const dropZone = (
    <div>
      <span id="upload-file-label" className="block text-sm font-medium text-text-secondary mb-2">Bank export (CSV)</span>
      <label
        htmlFor="csv-upload"
        className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors [&:has(:focus-visible)]:outline [&:has(:focus-visible)]:outline-2 [&:has(:focus-visible)]:outline-offset-2 [&:has(:focus-visible)]:outline-[var(--focus-ring)] ${
          selectedFile ? 'border-accent/50 bg-accent/5' : 'border-border hover:border-accent/50 hover:bg-surface-hover'
        } ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          disabled={busy}
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
      {previewing && (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
          <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />
          Reading file…
        </p>
      )}
    </div>
  );

  const stat = (label, value) => (
    <div className="rounded-lg border border-border/60 px-3 py-2">
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className="tabular text-lg font-semibold text-text-primary">{value.toLocaleString('en-CA')}</dd>
    </div>
  );

  const amountCell = (amount) => (
    <span className={`tabular ${amount > 0 ? 'text-positive' : 'text-text-primary'}`}>{formatMoney(amount, { decimals: 2 })}</span>
  );

  const reviewBody = preview && (
    <>
      <div>
        <label htmlFor="upload-account" className="block text-sm font-medium text-text-secondary mb-2">Account</label>
        <select
          id="upload-account"
          value={selectedAccount}
          onChange={handleAccountChange}
          disabled={accountsLoading || noAccounts || accountsStatus === 'error' || busy}
          aria-describedby="upload-account-hint"
          className={inputClasses}
        >
          {!selectedAccount && <option value="">Choose an account…</option>}
          {accounts.map((account) => (<option key={account.id} value={account.id}>{account.name}</option>))}
        </select>
        <div id="upload-account-hint" className="mt-2 text-sm text-text-tertiary">
          {accountsStatus === 'error' && (
            <p role="alert" className="text-negative">
              Failed to load accounts.{' '}
              <button type="button" onClick={loadAccounts} className="underline underline-offset-2 font-medium hover:text-text-primary">Try again</button>
            </p>
          )}
          {noAccounts && <p>Add an account before importing transactions.</p>}
          {!selectedAccount && !noAccounts && accountsStatus !== 'error' && (
            <p>None of your accounts hold these transactions yet. Choose where they belong.</p>
          )}
          {selectedAccount && (
            <p><span className="tabular">{alreadyIn.toLocaleString('en-CA')}</span> of <span className="tabular">{totalRows.toLocaleString('en-CA')}</span> rows in this file are already in {accountName}.</p>
          )}
        </div>
      </div>

      {previewing && (
        <p role="status" className="flex items-center gap-2 text-sm text-text-secondary">
          <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />
          Checking {chosenAccount?.name || 'account'}…
        </p>
      )}

      {preview.errors?.length > 0 && (
        <details className="rounded-lg border border-border/60 px-3 py-2 text-sm">
          <summary className="cursor-pointer min-h-11 md:min-h-0 flex items-center text-text-secondary font-medium">
            {plural(preview.errors.length, 'row')} could not be read
          </summary>
          <ul className="mt-2 space-y-1 text-text-tertiary">
            {preview.errors.map((er, i) => (
              <li key={i}>Line <span className="tabular">{er.line}</span>: {er.reason}</li>
            ))}
          </ul>
          <p className="mt-2 text-text-tertiary">These rows are skipped. The rest can still be added.</p>
        </details>
      )}

      {plan && (
        <div className={previewing ? 'opacity-60' : ''}>
          {preview.message && (
            <p role="status" className="mb-3 p-3 rounded-lg bg-accent/10 border border-accent/30 text-sm text-text-primary">{preview.message}</p>
          )}
          <dl className="grid grid-cols-3 gap-2">
            {stat('New', plan.new.length)}
            {stat('Already imported', plan.duplicates.length)}
            {stat('Older', olderRows.length)}
          </dl>

          {plan.new.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-text-primary mb-2">New transactions</h3>
              <ul className="md:hidden divide-y divide-border border border-border/60 rounded-lg">
                {plan.new.map((r, i) => (
                  <li key={i} className="px-3 py-2 min-h-11">
                    <div className="flex justify-between gap-3">
                      <span className="text-sm text-text-primary break-words min-w-0">{r.description}</span>
                      {amountCell(r.amount)}
                    </div>
                    <div className="text-xs text-text-tertiary mt-0.5"><span className="tabular">{r.date}</span> · {r.category}</div>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block border border-border/60 rounded-lg max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">New transactions to add</caption>
                  <thead className="sticky top-0 bg-surface text-text-tertiary text-left">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Date</th>
                      <th scope="col" className="px-3 py-2 font-medium">Description</th>
                      <th scope="col" className="px-3 py-2 font-medium text-right">Amount</th>
                      <th scope="col" className="px-3 py-2 font-medium">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {plan.new.map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 tabular whitespace-nowrap">{r.date}</td>
                        <td className="px-3 py-2 break-words">{r.description}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{amountCell(r.amount)}</td>
                        <td className="px-3 py-2 text-text-secondary">{r.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            !preview.message && <p className="mt-4 text-sm text-text-tertiary">No new transactions in this file.</p>
          )}

          {olderRows.length > 0 && (
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold text-text-primary">Older than this account&apos;s latest activity</legend>
              <p className="text-sm text-text-tertiary mt-1 mb-2">These are not in {accountName} and are more than a week before its latest transaction. Tick any you want to add.</p>
              <ul className="divide-y divide-border border border-border/60 rounded-lg">
                {olderRows.map((r, i) => (
                  <li key={i}>
                    <label className="flex items-start gap-3 px-3 py-2 min-h-11 cursor-pointer hover:bg-surface-hover">
                      <input
                        type="checkbox"
                        checked={checkedOlder.has(i)}
                        onChange={() => toggleOlder(i)}
                        disabled={busy}
                        className="mt-1 w-4 h-4 accent-[var(--accent)]"
                      />
                      <span className="flex-1 min-w-0 text-sm">
                        <span className="flex justify-between gap-3">
                          <span className="text-text-primary break-words min-w-0">{r.description}</span>
                          {amountCell(r.amount)}
                        </span>
                        <span className="block text-xs text-text-tertiary"><span className="tabular">{r.date}</span> · {r.category}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
        </div>
      )}
    </>
  );

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
            className={`relative glass-card rounded-xl w-full ${step === 'review' ? 'max-w-3xl' : 'max-w-md'} max-h-[calc(100dvh-2rem)] overflow-y-auto focus:outline-none`}
            style={{ boxShadow: '0 24px 64px var(--shadow-heavy)' }}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className="px-6 py-4 border-b border-border/50">
              <h2 id="upload-modal-title" className="text-lg font-semibold text-text-primary">
                {step === 'choose' ? 'Import transactions' : step === 'review' ? 'Review import' : 'Import complete'}
              </h2>
              <p id="upload-modal-description" className="text-sm text-text-tertiary mt-1">
                {step === 'choose' && 'Step 1 of 2: choose your bank export. Nothing is added until you confirm.'}
                {step === 'review' && 'Step 2 of 2: check what will be added.'}
                {step === 'done' && 'Your transactions were added.'}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {step === 'choose' && dropZone}
              {step === 'review' && reviewBody}
              {result && (
                <div role="status" className="p-4 bg-positive/10 border border-positive/20 rounded-lg">
                  <p className="font-medium text-positive">Import successful</p>
                  <p className="text-sm text-text-secondary mt-1">
                    <span className="tabular">{result.created.toLocaleString('en-CA')}</span> {result.created === 1 ? 'transaction' : 'transactions'} added to {accountName}.
                  </p>
                </div>
              )}
              {error && (
                <div role="alert" className="p-4 bg-negative/10 border border-negative/20 rounded-lg">
                  <p className="font-medium text-negative">{step === 'review' ? 'Something went wrong' : 'Could not read the file'}</p>
                  <p className="text-sm text-text-secondary mt-1 break-words">{error}</p>
                  {step === 'review' && selectedAccount && selectedFile && !uploading && (
                    <button
                      type="button"
                      onClick={() => runPreview(selectedFile, selectedAccount)}
                      className="mt-2 min-h-11 md:min-h-0 text-sm underline underline-offset-2 font-medium text-text-secondary hover:text-text-primary"
                    >
                      Try again
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border/50 flex justify-end gap-3">
              {step === 'review' && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { requestId.current += 1; setPreview(null); setError(null); setSelectedAccount(''); }}
                  disabled={busy}
                  className="min-h-11 md:min-h-10 px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Back
                </motion.button>
              )}
              <motion.button
                ref={closeButtonRef}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={requestClose}
                disabled={busy}
                className="min-h-11 md:min-h-10 px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {result ? 'Close' : 'Cancel'}
              </motion.button>
              {step === 'review' && (
                <motion.button
                  type="button"
                  whileTap={addCount > 0 && !busy ? { scale: 0.97 } : undefined}
                  onClick={handleCommit}
                  disabled={addCount === 0 || busy || !selectedAccount || !planMatchesAccount}
                  aria-busy={uploading}
                  className="min-h-11 md:min-h-10 inline-flex items-center gap-2 px-4 py-2 bg-accent text-on-accent rounded-lg font-semibold hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent transition-colors text-sm"
                >
                  {uploading && (
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />
                  )}
                  {uploading ? 'Adding…' : `Add ${plural(addCount, 'transaction')}`}
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
