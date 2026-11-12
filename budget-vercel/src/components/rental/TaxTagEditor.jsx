'use client';

import { useRef, useState } from 'react';
import api from '@/lib/api';
import { T776_LINES, formatTaxTag, parseTaxTag } from '@/lib/rental/t776';
import { fieldClass, secondaryBtn } from './taxShared';

const CCA_CLASS = /^\d{1,2}(\.\d{1,2})?$/;

const choiceOf = (tag) => (!tag ? 'auto' : tag.kind === 'line' ? tag.line : tag.kind);

function tagFor(choice, ccaClass) {
  if (choice === 'auto') return null;
  if (choice === 'capital') return { kind: 'capital', cca_class: ccaClass || null };
  if (choice === 'exclude' || choice === 'review') return { kind: choice };
  return { kind: 'line', line: choice };
}

// Where one transaction goes on the T776, and a note. Writes tax_tag and notes on the transaction.
// onSaved({ txn, tagChanged, message }) may return a promise (the T776 reloads); when the save moved the
// item and this editor is gone afterwards, focusFallback() puts focus somewhere sensible.
export default function TaxTagEditor({ txn, onSaved, focusFallback }) {
  const formRef = useRef(null);
  const initial = parseTaxTag(txn.tax_tag);
  // What is stored now: a tag only counts as changed against this, so hand-written tags survive a notes-only save.
  const [baseline, setBaseline] = useState({ tag: formatTaxTag(initial), notes: txn.notes || '' });
  const [choice, setChoice] = useState(choiceOf(initial));
  const [ccaClass, setCcaClass] = useState(initial?.kind === 'capital' ? initial.cca_class || '' : '');
  const [notes, setNotes] = useState(txn.notes || '');
  const [classError, setClassError] = useState(null);
  const [status, setStatus] = useState({ saving: false, error: null, message: '' });

  const id = `tax-${txn.id}`;

  const save = async (e) => {
    e.preventDefault();
    if (status.saving) return;
    const cca = ccaClass.trim();
    if (choice === 'capital' && cca && !CCA_CLASS.test(cca)) {
      setClassError('Enter a class number such as 8 or 10.1, or leave it blank.');
      formRef.current?.querySelector(`#${id}-class`)?.focus();
      return;
    }
    const tagText = formatTaxTag(tagFor(choice, cca));
    const fields = {};
    if (tagText !== baseline.tag) fields.tax_tag = tagText;
    if (notes !== baseline.notes) fields.notes = notes;
    if (Object.keys(fields).length === 0) {
      setStatus({ saving: false, error: null, message: 'No changes to save.' });
      return;
    }
    setStatus({ saving: true, error: null, message: '' });
    try {
      const result = await api.updateTransaction(txn.id, fields);
      if (!result || result.error) throw new Error(result?.error || 'Save failed');
      setBaseline({ tag: fields.tax_tag ?? baseline.tag, notes: fields.notes ?? baseline.notes });
      setStatus({ saving: false, error: null, message: 'Saved.' });
      await onSaved?.({ txn, tagChanged: 'tax_tag' in fields, message: `Saved ${txn.description}.` });
      if (!formRef.current?.isConnected) focusFallback?.();
    } catch (err) {
      setStatus({ saving: false, error: `Couldn't save: ${err.message}. Try again.`, message: '' });
    }
  };

  return (
    <form ref={formRef} onSubmit={save} noValidate className="flex flex-wrap items-end gap-2">
      <div className="w-full sm:w-56">
        <label htmlFor={`${id}-tag`} className="block text-xs font-medium text-text-tertiary mb-1">T776 placement</label>
        <select id={`${id}-tag`} value={choice} onChange={(e) => { setChoice(e.target.value); setStatus((s) => ({ ...s, message: '' })); }}
          className={`${fieldClass} border-border`}>
          <option value="auto">Automatic (by category)</option>
          <optgroup label="T776 line">
            {Object.entries(T776_LINES).map(([code, label]) => (<option key={code} value={code}>{code} {label}</option>))}
          </optgroup>
          <option value="capital">Capital…</option>
          <option value="exclude">Exclude (not deductible)</option>
          <option value="review">Review later</option>
        </select>
      </div>
      {choice === 'capital' && (
        <div className="w-24">
          <label htmlFor={`${id}-class`} className="block text-xs font-medium text-text-tertiary mb-1">CCA class</label>
          <input id={`${id}-class`} value={ccaClass} inputMode="decimal" autoComplete="off" placeholder="8"
            onChange={(e) => { setCcaClass(e.target.value); setClassError(null); }}
            aria-invalid={classError ? true : undefined}
            aria-describedby={classError ? `${id}-class-error` : `${id}-class-hint`}
            className={`${fieldClass} tabular ${classError ? 'border-negative' : 'border-border'}`} />
        </div>
      )}
      <div className="flex-1 min-w-[10rem]">
        <label htmlFor={`${id}-notes`} className="block text-xs font-medium text-text-tertiary mb-1">Notes</label>
        <input id={`${id}-notes`} value={notes} autoComplete="off"
          onChange={(e) => { setNotes(e.target.value); setStatus((s) => ({ ...s, message: '' })); }}
          className={`${fieldClass} border-border`} />
      </div>
      <button type="submit" disabled={status.saving} aria-busy={status.saving || undefined} className={secondaryBtn}>
        {status.saving ? 'Saving…' : 'Save'}
      </button>
      <span role="status" className="self-center text-xs text-text-tertiary">{status.message}</span>
      {choice === 'capital' && !classError && (
        <p id={`${id}-class-hint`} className="w-full text-xs text-text-muted">Capital items are claimed through CCA, not as an expense. Class 8 covers appliances; leave the class blank if unsure.</p>
      )}
      {classError && <p id={`${id}-class-error`} className="w-full text-xs text-negative">{classError}</p>}
      {status.error && <p role="alert" className="w-full text-xs text-negative">{status.error}</p>}
    </form>
  );
}
