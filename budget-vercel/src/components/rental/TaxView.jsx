'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '@/lib/api';
import { MAX_RECEIPT_FILES, linkCandidates } from '@/lib/receipts';
import ReceiptTile from './ReceiptTile';
import ReceiptLinkDialog from './ReceiptLinkDialog';
import ReceiptsFolderSetup from './ReceiptsFolderSetup';
import { T776Table, CapitalList } from './T776Sections';
import {
  NewTabHint, PlacementPill, driveFolderUrl, placementMap, secondaryBtn, shortDate, size,
} from './taxShared';

const EMPTY = { loading: true, error: null, data: null };

// One loader per endpoint. Keeps the last good data while refreshing the same year; a stale response for a
// year no longer selected is dropped.
function useYearResource(fetcher, year) {
  const [state, setState] = useState(EMPTY);
  const seq = useRef(0);
  const load = useCallback(async () => {
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcher(year);
      if (n === seq.current) setState({ loading: false, error: null, data: { ...data, year } });
    } catch (err) {
      if (n === seq.current) setState((s) => ({ ...s, loading: false, error: err.message || 'Network error' }));
    }
  }, [fetcher, year]);
  useEffect(() => { load(); }, [load]);
  // Data from another year never shows under this year's heading.
  const data = state.data && state.data.year === year ? state.data : null;
  return { ...state, data, load };
}

function ErrorCard({ title, error, onRetry }) {
  return (
    <div role="alert" className="glass-card rounded-xl p-6 md:p-8 text-center">
      <p className="font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-sm text-text-tertiary">{error}.</p>
      <button type="button" onClick={onRetry} className={`${secondaryBtn} mt-4`}>Try again</button>
    </div>
  );
}

function TilesSkeleton() {
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="rounded-xl border border-border bg-surface p-2 space-y-2">
          <div className="aspect-[4/3] rounded-lg bg-surface-hover animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-surface-hover animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-surface-hover animate-pulse" />
        </li>
      ))}
    </ul>
  );
}

const files = (n) => `${n} file${n === 1 ? '' : 's'}`;
// Missing receipts shown before "Show all".
const MISSING_PREVIEW = 5;

// Tax tab, receipts first: the Drive folder's files matched to transactions, what's missing, then the T776
// (lines, mortgage interest, items to sort out) and the capital items.
export default function TaxView({ year }) {
  const receipts = useYearResource(api.getReceipts, year);
  const t776 = useYearResource(api.getT776, year);
  const [dialog, setDialog] = useState(null); // { file, opener }
  const [changingFolder, setChangingFolder] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [showAllMissing, setShowAllMissing] = useState(false);
  const [csv, setCsv] = useState({ busy: false, error: null });
  // Another year starts collapsed, without the last year's export error.
  useEffect(() => { setShowAllMissing(false); setCsv((c) => (c.error ? { ...c, error: null } : c)); }, [year]);

  const r = receipts.data;
  const t = t776.data;

  const loadReceipts = receipts.load;
  const loadT776 = t776.load;

  const placements = useMemo(() => placementMap(t), [t]);
  const candidates = useMemo(() => (t ? linkCandidates(t).map((txn) => ({ txn, placement: placements.get(txn.id) })) : []), [t, placements]);
  const candidateById = useMemo(() => new Map(candidates.map((c) => [c.txn.id, c.txn])), [candidates]);
  const receiptFor = useMemo(() => {
    const map = new Map();
    for (const f of r?.files || []) if (f.transaction_id !== null && !map.has(f.transaction_id)) map.set(f.transaction_id, f);
    return map;
  }, [r]);
  const missingIds = useMemo(() => new Set((r?.missing || []).map((x) => x.id)), [r]);

  // A tag change can move an item between lines, into Capital, or off the T776; both views depend on it.
  const refreshAll = useCallback(() => Promise.all([loadReceipts(), loadT776()]), [loadReceipts, loadT776]);

  const onTagSaved = useCallback(async ({ message }) => {
    setAnnouncement(message);
    await refreshAll();
  }, [refreshAll]);

  const onMortgageSaved = useCallback(async (message) => {
    setAnnouncement(message);
    await loadT776();
  }, [loadT776]);

  const closeDialog = useCallback(() => {
    const opener = dialog?.opener;
    setDialog(null);
    requestAnimationFrame(() => { if (opener?.isConnected) opener.focus(); });
  }, [dialog]);

  const onLinkChanged = useCallback(async (message) => {
    setAnnouncement(message);
    closeDialog();
    await loadReceipts();
  }, [closeDialog, loadReceipts]);

  // Fetch first so an error (no rental account, the sheet unreachable) is shown instead of downloaded.
  const exportCsv = async () => {
    if (csv.busy) return;
    setCsv({ busy: true, error: null });
    try {
      const blob = await api.getT776Csv(year);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `t776-${year}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setCsv({ busy: false, error: null });
      setAnnouncement(`T776 for ${year} exported.`);
    } catch (err) {
      setCsv({ busy: false, error: err.message || 'Network error' });
    }
  };

  const configured = Boolean(r?.folder_configured);
  const showSetup = r && (!configured || r.error || changingFolder);
  const unmatched = (r?.files || []).filter((f) => f.transaction_id === null).length;
  const refreshing = (receipts.loading && Boolean(r)) || (t776.loading && Boolean(t));

  return (
    <section aria-labelledby="tax-title" className="space-y-6">
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>

      {/* 1. Header: what this is, the folder in Drive, the CSV for the accountant. The tax year select sits in the page header. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="tax-title" className="text-xl font-semibold text-text-primary">Receipts and T776 for {year}</h2>
          <p className="text-sm text-text-tertiary mt-1">
            {!r ? `Loading ${year}…` : configured && !r.error
              ? `${files(r.files.length)} in Drive · ${unmatched} to match · ${r.missing.length} receipt${r.missing.length === 1 ? '' : 's'} missing`
              : `${r.missing.length} item${r.missing.length === 1 ? '' : 's'} that need a receipt`}
            {refreshing && ' · Updating…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {configured && (
            <a href={driveFolderUrl(r.folder_id)} target="_blank" rel="noopener noreferrer" className={secondaryBtn}>
              Receipts folder in Drive<NewTabHint />
            </a>
          )}
          <button type="button" onClick={exportCsv} disabled={csv.busy} aria-busy={csv.busy || undefined} className={secondaryBtn}>
            {csv.busy ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
        {csv.error && (
          <p role="alert" className="w-full text-sm text-negative">Couldn&rsquo;t export the CSV: {csv.error}.</p>
        )}
      </div>

      {receipts.error && !r && (
        <ErrorCard title={`Couldn’t load receipts for ${year}`} error={receipts.error} onRetry={receipts.load} />
      )}
      {receipts.error && r && (
        <p role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-negative/30 bg-negative/5 px-4 py-2 text-sm text-text-primary">
          <span>Couldn&rsquo;t refresh receipts: {receipts.error}.</span>
          <button type="button" onClick={receipts.load} className="min-h-11 px-3 font-medium text-accent-text hover:underline underline-offset-4">Try again</button>
        </p>
      )}

      {/* 2. Setup: no folder yet, Drive refused it, or the owner is changing it. */}
      {showSetup && (
        <ReceiptsFolderSetup
          key={`${r.folder_id}-${r.error}`}
          email={r.service_account_email}
          error={r.error}
          folderId={r.folder_id}
          onSaved={async () => { setChangingFolder(false); setAnnouncement('Receipts folder saved.'); await receipts.load(); }}
          onRetry={configured && r.error ? receipts.load : undefined}
          onCancel={configured && !r.error && changingFolder ? () => setChangingFolder(false) : undefined}
        />
      )}

      {/* 3. Receipt tiles. */}
      {!r && !receipts.error && (
        <div aria-busy="true">
          <span role="status" className="sr-only">Loading receipts for {year}</span>
          <TilesSkeleton />
        </div>
      )}
      {r && configured && !r.error && (
        <section aria-labelledby="tiles-title" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="tiles-title" className="text-lg font-semibold text-text-primary">Receipts in Drive</h3>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={loadReceipts} aria-busy={receipts.loading || undefined} className={secondaryBtn}>
                {receipts.loading ? 'Refreshing…' : 'Refresh'}
              </button>
              {!changingFolder && <button type="button" onClick={() => setChangingFolder(true)} className={secondaryBtn}>Change folder</button>}
            </div>
          </div>
          {r.truncated && (
            <p className="text-sm text-text-tertiary">
              Showing the first {MAX_RECEIPT_FILES.toLocaleString('en-CA')} files in this folder.
            </p>
          )}
          {r.files.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-text-primary">No receipts for {year} in the folder yet.</p>
              <p className="mt-1 text-sm text-text-tertiary">Add scans or PDFs to the Drive folder (or a “{year}” subfolder), then refresh.</p>
            </div>
          ) : (
            <ul className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 transition-opacity ${receipts.loading ? 'opacity-60' : ''}`}>
              {r.files.map((f) => (
                <ReceiptTile
                  key={f.id}
                  file={f}
                  placement={f.transaction_id !== null && t ? placements.get(f.transaction_id) || { kind: 'none' } : null}
                  suggestion={f.suggested_transaction_id !== null ? candidateById.get(f.suggested_transaction_id) || null : null}
                  onOpen={(file, opener) => setDialog({ file, opener })}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 4. Missing receipts. */}
      {r && (
        <section aria-labelledby="missing-title" className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-border/50">
            <h3 id="missing-title" className="text-lg font-semibold text-text-primary">
              Missing receipts {r.missing.length > 0 && <span className="text-text-tertiary font-normal">({r.missing.length})</span>}
            </h3>
            <p className="mt-1 text-sm text-text-tertiary">Capital items and other expenses of $50 or more with no receipt linked. Recurring bills (utilities, property tax, interest) are covered by your statements.</p>
          </div>
          {r.missing.length === 0 ? (
            <p className="px-4 md:px-6 py-6 text-positive">Every capital item and other expense of $50 or more in {year} has a receipt.</p>
          ) : (
            <ul id="missing-list" className="divide-y divide-border/50">
              {(showAllMissing ? r.missing : r.missing.slice(0, MISSING_PREVIEW)).map((x) => (
                <li key={x.id} className="px-4 md:px-6 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm text-text-primary break-words">{x.description}</p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                      <span className="tabular">{shortDate(x.date)}</span>
                      <PlacementPill placement={placements.get(x.id)} />
                    </p>
                  </div>
                  <p className="text-sm text-text-primary tabular whitespace-nowrap">{size(x)}</p>
                </li>
              ))}
            </ul>
          )}
          {r.missing.length > MISSING_PREVIEW && (
            <div className="px-4 md:px-6 py-3 border-t border-border/50">
              <button type="button" aria-expanded={showAllMissing} aria-controls="missing-list"
                onClick={() => setShowAllMissing((v) => !v)} className={secondaryBtn}>
                {showAllMissing ? 'Show fewer' : `Show all ${r.missing.length}`}
              </button>
            </div>
          )}
        </section>
      )}

      {/* 5 and 6. T776 lines with editable items, then capital items. */}
      {t776.error && !t && <ErrorCard title={`Couldn’t load the T776 for ${year}`} error={t776.error} onRetry={t776.load} />}
      {t776.error && t && (
        <p role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-negative/30 bg-negative/5 px-4 py-2 text-sm text-text-primary">
          <span>Couldn&rsquo;t refresh the T776: {t776.error}.</span>
          <button type="button" onClick={t776.load} className="min-h-11 px-3 font-medium text-accent-text hover:underline underline-offset-4">Try again</button>
        </p>
      )}
      {!t && !t776.error && (
        <div className="glass-card rounded-xl p-4 md:p-6 space-y-3" aria-busy="true">
          <span role="status" className="sr-only">Loading the T776 for {year}</span>
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-surface-hover animate-pulse" aria-hidden="true" />)}
        </div>
      )}
      {t && (
        <div className={`space-y-6 transition-opacity ${t776.loading ? 'opacity-60' : ''}`} aria-busy={t776.loading}>
          <T776Table key={year} data={t} year={year} receiptFor={receiptFor} missingIds={missingIds}
            onTagSaved={onTagSaved} onMortgageSaved={onMortgageSaved} />
          <CapitalList capital={t.capital} year={year} receiptFor={receiptFor} onTagSaved={onTagSaved} />
        </div>
      )}

      {dialog && (
        <ReceiptLinkDialog
          file={dialog.file}
          year={year}
          candidates={candidates}
          candidatesReady={Boolean(t)}
          placements={placements}
          withReceipt={new Set(receiptFor.keys())}
          onClose={closeDialog}
          onChanged={onLinkChanged}
        />
      )}
    </section>
  );
}
