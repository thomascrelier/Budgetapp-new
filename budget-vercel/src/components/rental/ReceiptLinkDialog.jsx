'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import {
  DocumentIcon, NewTabHint, fieldClass, primaryBtn, secondaryBtn, shortDate, size, thumbnailUrl,
} from './taxShared';

const groupLabel = (p) => {
  if (!p || p.kind === 'none') return 'Other';
  if (p.kind === 'line') return `${p.code} ${p.label}`;
  if (p.kind === 'capital') return 'Capital items';
  return 'Needs review';
};
const groupOrder = (p) => (p?.kind === 'line' ? `0${p.code}` : p?.kind === 'capital' ? '1' : p?.kind === 'review' ? '2' : '3');

function optionText(t, { suggested, hasReceipt }) {
  const extra = [suggested && 'suggested', hasReceipt && 'has a receipt'].filter(Boolean).join(', ');
  return `${shortDate(t.date)} · ${t.description} · ${size(t)}${extra ? ` (${extra})` : ''}`;
}

// Link a receipt to one of the year's T776 transactions, unlink it, or open it in Drive.
// `candidates`: [{ txn, placement }]. `withReceipt`: ids of transactions that already have another receipt.
export default function ReceiptLinkDialog({ file, year, candidates, candidatesReady, withReceipt, placements, onClose, onChanged }) {
  const dialogRef = useRef(null);
  const [selected, setSelected] = useState(String(file.transaction_id ?? file.suggested_transaction_id ?? ''));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [thumbFailed, setThumbFailed] = useState(false);
  const busyRef = useRef(null);
  busyRef.current = busy;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = `receipt-dialog-title-${file.id}`;
  const descId = `receipt-dialog-desc-${file.id}`;

  // The linked transaction may sit outside this year's T776 (another year, or since excluded): keep it selectable.
  const options = candidates.slice();
  if (file.transaction && !options.some((o) => o.txn.id === file.transaction.id)) {
    options.push({ txn: file.transaction, placement: placements.get(file.transaction.id) || { kind: 'none' } });
  }
  const groups = new Map();
  for (const o of [...options].sort((a, b) => groupOrder(a.placement).localeCompare(groupOrder(b.placement))
    || String(a.txn.date).localeCompare(String(b.txn.date)))) {
    const label = groupLabel(o.placement);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(o.txn);
  }

  const close = () => { if (!busyRef.current) onCloseRef.current(); };

  // Escape closes, Tab stays inside. Focus returns to the tile (TaxView keeps the opener).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll('select, input, a[href], button:not([disabled])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const link = async (e) => {
    e.preventDefault();
    if (busy) return;
    const id = Number(selected);
    if (!id) { setError('Choose the transaction this receipt is for.'); dialogRef.current?.querySelector('select')?.focus(); return; }
    setBusy('link');
    setError(null);
    try {
      await api.linkReceipt({ drive_file_id: file.id, file_name: file.name, mime_type: file.mimeType, transaction_id: id });
      const txn = options.find((o) => o.txn.id === id)?.txn;
      setBusy(null);
      busyRef.current = null;
      onChanged(`Linked ${file.name} to ${txn ? txn.description : 'the transaction'}.`);
    } catch (err) {
      setError(`Couldn't link the receipt: ${err.message}. Try again.`);
      setBusy(null);
    }
  };

  const unlink = async () => {
    if (busy) return;
    setBusy('unlink');
    setError(null);
    try {
      await api.unlinkReceipt(file.id);
      setBusy(null);
      busyRef.current = null;
      onChanged(`Unlinked ${file.name}.`);
    } catch (err) {
      setError(`Couldn't unlink the receipt: ${err.message}. Try again.`);
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={close} aria-hidden="true" />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative glass-card rounded-xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 md:p-6"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      >
        <h2 id={titleId} className="text-lg font-semibold text-text-primary break-words">{file.name}</h2>
        <p id={descId} className="mt-1 text-sm text-text-tertiary">
          {file.transaction ? 'Linked to the transaction below. Change it or unlink.' : `Pick the ${year} transaction this receipt is for.`}
          {file.folder ? ` In the “${file.folder}” folder.` : ''}
        </p>

        <div className="mt-4 rounded-lg overflow-hidden bg-surface-hover text-text-muted flex items-center justify-center h-40 sm:h-56">
          {thumbFailed ? (
            <DocumentIcon className="w-10 h-10" />
          ) : (
            <img
              src={thumbnailUrl(file.id, 640)}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setThumbFailed(true)}
              className="h-full w-full object-contain"
            />
          )}
        </div>

        <form onSubmit={link} noValidate className="mt-4 space-y-4">
          <div>
            <label htmlFor={`receipt-txn-${file.id}`} className="block text-sm font-medium text-text-secondary mb-2">Transaction</label>
            <select
              id={`receipt-txn-${file.id}`}
              autoFocus
              value={selected}
              onChange={(e) => { setSelected(e.target.value); setError(null); }}
              aria-describedby={options.length === 0 ? `receipt-txn-hint-${file.id}` : undefined}
              className={`${fieldClass} border-border`}
            >
              <option value="">Choose a transaction</option>
              {[...groups].map(([label, txns]) => (
                <optgroup key={label} label={label}>
                  {txns.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {optionText(t, {
                        suggested: t.id === file.suggested_transaction_id,
                        hasReceipt: withReceipt.has(t.id) && t.id !== file.transaction_id,
                      })}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {options.length === 0 && (
              <p id={`receipt-txn-hint-${file.id}`} className="text-xs text-text-muted mt-1">
                {candidatesReady
                  ? `No expenses on the ${year} T776 yet. Tag a transaction below, or switch the tax year.`
                  : `The ${year} transactions are still loading. Close this and try again in a moment.`}
              </p>
            )}
          </div>

          {error && <div role="alert" className="p-3 bg-negative/10 border border-negative/30 rounded-lg text-sm text-negative">{error}</div>}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {file.webViewLink ? (
              <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className={secondaryBtn}>
                Open in Drive<NewTabHint />
              </a>
            ) : <span />}
            <div className="flex flex-wrap gap-2">
              {file.transaction_id !== null && file.transaction_id !== undefined && (
                <button type="button" onClick={unlink} disabled={Boolean(busy)} aria-busy={busy === 'unlink' || undefined} className={secondaryBtn}>
                  {busy === 'unlink' ? 'Unlinking…' : 'Unlink'}
                </button>
              )}
              <button type="button" onClick={close} disabled={Boolean(busy)} className="min-h-11 px-4 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40">
                Cancel
              </button>
              <button type="submit" disabled={Boolean(busy)} aria-busy={busy === 'link' || undefined} className={primaryBtn}>
                {busy === 'link' ? 'Linking…' : 'Link'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
