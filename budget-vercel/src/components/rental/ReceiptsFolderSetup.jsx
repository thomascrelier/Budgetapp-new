'use client';

import { useRef, useState } from 'react';
import api from '@/lib/api';
import { extractFolderId } from '@/lib/receipts';
import { fieldClass, primaryBtn, secondaryBtn } from './taxShared';

// Connect the Drive folder that holds the receipts: share it with the service account, paste its link.
// Shown when no folder is set, when Drive refuses it (error), or when the owner chooses to change it.
export default function ReceiptsFolderSetup({ email, error, folderId, onSaved, onRetry, onCancel }) {
  const [value, setValue] = useState(folderId || '');
  const [fieldError, setFieldError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [copied, setCopied] = useState('');
  const emailRef = useRef(null);
  const inputRef = useRef(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied('Copied.');
    } catch {
      // Clipboard blocked: select the address so the owner can copy it by hand.
      const range = document.createRange();
      range.selectNodeContents(emailRef.current);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      setCopied('Selected. Press Ctrl+C or ⌘C to copy.');
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    const id = extractFolderId(value);
    if (!id) {
      setFieldError("Paste the folder's link from Drive (it contains /folders/), or its ID.");
      inputRef.current?.focus();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await api.saveSetting('receipts_folder_id', id);
      setSaving(false);
      await onSaved?.();
    } catch (err) {
      setSaving(false);
      setSaveError(`Couldn't save the folder: ${err.message}. Try again.`);
    }
  };

  const title = error ? 'The app can’t open your receipts folder' : 'Connect your receipts folder';

  return (
    <section className="glass-card rounded-xl p-4 md:p-6 space-y-4" aria-labelledby="receipts-setup-title">
      <div className="space-y-1">
        <h3 id="receipts-setup-title" className="text-lg font-semibold text-text-primary">{title}</h3>
        {!error && (
          <p className="text-sm text-text-tertiary">
            Show the receipts you keep in Google Drive here, matched to the year&rsquo;s transactions. The app only reads the folder.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-text-primary">{error}</p>
      )}

      <ol className="space-y-5 text-sm text-text-secondary">
        <li className="space-y-2">
          <p><span className="font-medium text-text-primary">1.</span> Share the folder with this address as Viewer</p>
          {email ? (
            <div className="flex flex-wrap items-center gap-2">
              <code ref={emailRef} className="min-w-0 break-all rounded-lg border border-border bg-surface-hover px-3 py-2 text-text-primary">{email}</code>
              <button type="button" onClick={copy} className={secondaryBtn} aria-label={`Copy ${email}`}>Copy</button>
              <span role="status" className="text-xs text-text-tertiary">{copied}</span>
            </div>
          ) : (
            <p className="text-warning">
              The app&rsquo;s service account address isn&rsquo;t available. Check that GOOGLE_CREDENTIALS_JSON is set in the deployment.
            </p>
          )}
          <p className="text-xs text-text-muted">In Drive: right-click the folder › Share, paste the address, choose Viewer, then Send.</p>
        </li>
        <li>
          <form onSubmit={save} noValidate className="space-y-2">
            <label htmlFor="receipts-folder" className="block">
              <span className="font-medium text-text-primary">2.</span> Paste the folder&rsquo;s link or ID
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                id="receipts-folder"
                value={value}
                onChange={(e) => { setValue(e.target.value); setFieldError(null); }}
                placeholder="https://drive.google.com/drive/folders/…"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? 'receipts-folder-error' : 'receipts-folder-hint'}
                className={`${fieldClass} flex-1 min-w-[14rem] ${fieldError ? 'border-negative' : 'border-border'}`}
              />
              <button type="submit" disabled={saving} aria-busy={saving || undefined} className={primaryBtn}>
                {saving ? 'Saving…' : 'Save folder'}
              </button>
            </div>
            {fieldError ? (
              <p id="receipts-folder-error" className="text-xs text-negative">{fieldError}</p>
            ) : (
              <p id="receipts-folder-hint" className="text-xs text-text-muted">Open the folder in Drive and copy the address bar. Subfolders (one level, such as one per year) are included.</p>
            )}
            {saveError && <p role="alert" className="text-xs text-negative">{saveError}</p>}
          </form>
        </li>
      </ol>

      {(onRetry || onCancel) && (
        <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
          {onRetry && <button type="button" onClick={onRetry} className={secondaryBtn}>I&rsquo;ve shared it, try again</button>}
          {onCancel && <button type="button" onClick={onCancel} className={secondaryBtn}>Cancel</button>}
        </div>
      )}
    </section>
  );
}
