'use client';

import { useRef, useState } from 'react';
import api from '@/lib/api';
import TaxTagEditor from './TaxTagEditor';
import { NewTabHint, fieldClass, money, primaryBtn, shortDate } from './taxShared';

const INCOME = new Set(['8141', '8230']);

function Chevron({ open }) {
  return (
    <svg className={`w-4 h-4 shrink-0 text-text-tertiary transition-transform ${open ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M7.2 14.8a.75.75 0 0 1 0-1.06L10.94 10 7.2 6.26a.75.75 0 1 1 1.06-1.06l4.27 4.27a.75.75 0 0 1 0 1.06L8.26 14.8a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
    </svg>
  );
}

// "Receipt: name ↗" when one is linked, "No receipt" when one is expected, null otherwise.
function receiptStatus(txnId, receiptFor, missingIds) {
  const file = receiptFor.get(txnId);
  if (file) {
    return file.webViewLink ? (
      <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="text-accent-text underline underline-offset-2 break-all">
        Receipt: {file.name}<NewTabHint />
      </a>
    ) : <span className="text-positive">Receipt: {file.name}</span>;
  }
  return missingIds.has(txnId) ? <span className="text-warning">No receipt</span> : null;
}

function ItemRow({ txn, amount, receiptFor, missingIds, onTagSaved, focusFallback }) {
  const status = receiptStatus(txn.id, receiptFor, missingIds);
  return (
    <li className="px-4 md:px-6 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-text-primary break-words">{txn.description}</p>
          <p className="text-xs text-text-tertiary">
            <span className="tabular">{shortDate(txn.date)}</span>
            {status && <> · {status}</>}
          </p>
        </div>
        <p className="text-sm text-text-primary tabular whitespace-nowrap">{money(amount)}</p>
      </div>
      <TaxTagEditor txn={txn} onSaved={onTagSaved} focusFallback={focusFallback} />
    </li>
  );
}

function Group({ id, title, meta, amount, open, onToggle, buttonRef, children }) {
  const panelId = `t776-panel-${id}`;
  return (
    <li>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={onToggle}
        className="w-full min-h-11 flex items-center gap-3 px-4 md:px-6 py-3 text-left hover:bg-surface-hover/50 transition-colors"
      >
        <Chevron open={open} />
        <span className="flex-1 min-w-0">
          <span className="font-medium text-text-primary break-words">{title}</span>
          {meta && <span className="block text-xs text-text-tertiary">{meta}</span>}
        </span>
        {amount !== undefined && <span className="tabular font-medium text-text-primary whitespace-nowrap">{money(amount)}</span>}
      </button>
      {open && (
        <div id={panelId} className="bg-surface-hover/30 border-t border-border/50">
          {children}
        </div>
      )}
    </li>
  );
}

const itemCount = (n) => `${n} item${n === 1 ? '' : 's'}`;

function MortgageRow({ year, mortgage, onSaved }) {
  const [value, setValue] = useState(mortgage.interest === null ? '' : String(mortgage.interest));
  const [state, setState] = useState({ saving: false, error: null, message: '' });
  const id = `mortgage-interest-${year}`;

  const save = async (e) => {
    e.preventDefault();
    if (state.saving) return;
    if (!value.trim()) {
      setState({ saving: false, error: 'Enter the interest from the statement, or 0 if there was none.', message: '' });
      return;
    }
    setState({ saving: true, error: null, message: '' });
    try {
      await api.saveSetting(`mortgage_interest:${year}`, value.trim());
      setState({ saving: false, error: null, message: 'Saved.' });
      await onSaved?.(`Mortgage interest for ${year} saved.`);
    } catch (err) {
      setState({ saving: false, error: `Couldn't save: ${err.message}.`, message: '' });
    }
  };

  return (
    <li className="px-4 md:px-6 py-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-medium text-text-primary">Mortgage (line 8710)</p>
        <p className="text-xs text-text-tertiary tabular">Payments in {year}: {money(mortgage.payments_total)}</p>
      </div>
      {mortgage.needs_interest && (
        <p className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-text-primary">
          <span aria-hidden="true" className="text-warning font-semibold">!</span>
          <span>Line 8710 leaves out your mortgage until you enter the interest for {year}. Only the interest is deductible, not the whole payment.</span>
        </p>
      )}
      <form onSubmit={save} noValidate className="flex flex-wrap items-end gap-2">
        <label htmlFor={id} className="w-full block text-sm font-medium text-text-secondary">
          Mortgage interest for {year} (from your lender&rsquo;s year-end statement)
        </label>
        <div className="relative flex-1 min-w-0 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" aria-hidden="true">$</span>
          <input id={id} value={value} inputMode="decimal" autoComplete="off" placeholder="0.00"
            onChange={(e) => { setValue(e.target.value); setState((s) => ({ ...s, error: null, message: '' })); }}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? `${id}-error` : undefined}
            className={`${fieldClass} pl-7 tabular ${state.error ? 'border-negative' : 'border-border'}`} />
        </div>
        <button type="submit" disabled={state.saving} aria-busy={state.saving || undefined} className={primaryBtn}>
          {state.saving ? 'Saving…' : 'Save'}
        </button>
        <span role="status" className="self-center text-xs text-text-tertiary">{state.message}</span>
        {state.error && <p id={`${id}-error`} role="alert" className="w-full text-xs text-negative">{state.error}</p>}
      </form>
    </li>
  );
}

// The year's T776: totals, then each line with its items (each item's placement editable), the mortgage
// interest entry where line 8710 sits, and the rows still to sort out.
export function T776Table({ data, year, receiptFor, missingIds, onTagSaved, onMortgageSaved }) {
  const [open, setOpen] = useState(() => new Set());
  const buttons = useRef({});
  const headingRef = useRef(null);
  const toggle = (key) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const fallbackTo = (key) => () => (buttons.current[key] || headingRef.current)?.focus();

  const rows = [];
  let mortgagePlaced = false;
  const mortgageRow = <MortgageRow key={`mortgage-${year}`} year={year} mortgage={data.mortgage} onSaved={onMortgageSaved} />;
  for (const line of data.lines) {
    if (!mortgagePlaced && line.code > '8710') { rows.push(mortgageRow); mortgagePlaced = true; }
    const income = INCOME.has(line.code);
    const interestNote = line.code === '8710' && data.mortgage.interest !== null;
    rows.push(
      <Group key={line.code} id={`${year}-${line.code}`} title={`${line.code} ${line.label}`}
        meta={`${itemCount(line.items.length)}${interestNote ? ' + mortgage interest' : ''}`}
        amount={line.amount} open={open.has(line.code)} onToggle={() => toggle(line.code)}
        buttonRef={(el) => { buttons.current[line.code] = el; }}>
        {interestNote && (
          <p className="px-4 md:px-6 pt-3 text-xs text-text-tertiary">
            Includes <span className="tabular">{money(data.mortgage.interest)}</span> of mortgage interest entered below.
          </p>
        )}
        {line.items.length > 0 && (
          <ul className="divide-y divide-border/50">
            {line.items.map((t) => (
              <ItemRow key={t.id} txn={t} amount={income ? t.amount : -t.amount} receiptFor={receiptFor} missingIds={missingIds}
                onTagSaved={onTagSaved} focusFallback={fallbackTo(line.code)} />
            ))}
          </ul>
        )}
      </Group>,
    );
    if (!mortgagePlaced && line.code === '8710') { rows.push(mortgageRow); mortgagePlaced = true; }
  }
  if (!mortgagePlaced) rows.push(mortgageRow);

  const extra = [
    { key: 'review', title: 'Needs review', meta: 'Not counted until you choose a line, Capital or Exclude', items: data.review },
    { key: 'none', title: 'Not on the T776', meta: 'Transfers and categories with no T776 line. Tag any that belong.', items: data.not_on_t776 },
  ];
  for (const g of extra) {
    if (!g.items.length) continue;
    rows.push(
      <Group key={g.key} id={`${year}-${g.key}`} title={`${g.title} (${g.items.length})`} meta={g.meta}
        open={open.has(g.key)} onToggle={() => toggle(g.key)} buttonRef={(el) => { buttons.current[g.key] = el; }}>
        <ul className="divide-y divide-border/50">
          {g.items.map((t) => (
            <ItemRow key={t.id} txn={t} amount={-t.amount} receiptFor={receiptFor} missingIds={missingIds}
              onTagSaved={onTagSaved} focusFallback={fallbackTo(g.key)} />
          ))}
        </ul>
      </Group>,
    );
  }

  const totals = [
    { label: 'Gross rents', value: data.gross_rents, tone: 'text-text-primary' },
    { label: 'Total expenses', value: data.total_expenses, tone: 'text-text-primary' },
    { label: 'Net income', value: data.net, tone: data.net >= 0 ? 'text-positive' : 'text-negative' },
  ];

  return (
    <section className="glass-card rounded-xl overflow-hidden" aria-labelledby="t776-title">
      <div className="px-4 md:px-6 py-4 border-b border-border/50 space-y-3">
        <h3 id="t776-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-text-primary focus:outline-none">
          T776 {year}
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
          {totals.map((t) => (
            <div key={t.label} className="flex items-baseline justify-between gap-3 sm:block">
              <dt className="text-sm text-text-tertiary">{t.label}</dt>
              <dd className={`text-lg sm:text-xl font-semibold tabular ${t.tone}`}>{money(t.value)}</dd>
            </div>
          ))}
        </dl>
      </div>
      {data.lines.length === 0 && !data.review.length && !data.not_on_t776.length ? (
        <>
          <p className="px-4 md:px-6 py-6 text-text-tertiary">No rental transactions in {year} yet.</p>
          <ul className="border-t border-border/50">{mortgageRow}</ul>
        </>
      ) : (
        <ul className="divide-y divide-border/50">{rows}</ul>
      )}
    </section>
  );
}

function CapitalRow({ item, receiptFor, onTagSaved, focusFallback }) {
  const [editing, setEditing] = useState(false);
  const { txn, cca_class } = item;
  const panelId = `capital-edit-${txn.id}`;
  // A capital item always wants a receipt.
  const status = receiptStatus(txn.id, receiptFor, new Set([txn.id]));
  return (
    <li className="px-4 md:px-6 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-text-primary break-words">{txn.description}</p>
          <p className="text-xs text-text-tertiary">
            <span className="tabular">{shortDate(txn.date)}</span>
            {' · '}
            {cca_class ? <span>CCA class {cca_class}</span> : <span className="text-warning">CCA class not set</span>}
            {' · '}
            {status}
          </p>
          {txn.notes && <p className="text-xs text-text-tertiary mt-1 break-words">{txn.notes}</p>}
        </div>
        <p className="text-sm font-medium text-text-primary tabular whitespace-nowrap">{money(-txn.amount)}</p>
      </div>
      <button type="button" aria-expanded={editing} aria-controls={editing ? panelId : undefined}
        aria-label={editing ? `Hide the tag editor for ${txn.description}` : `Change class or tag for ${txn.description}`}
        onClick={() => setEditing((v) => !v)} className="min-h-11 text-sm text-accent-text hover:underline underline-offset-4">
        {editing ? 'Hide' : 'Change class or tag'}
      </button>
      {editing && (
        <div id={panelId}>
          <TaxTagEditor txn={txn} onSaved={onTagSaved} focusFallback={focusFallback} />
        </div>
      )}
    </li>
  );
}

// Capital purchases (claimed through CCA, not as expenses): what, when, cost, class.
export function CapitalList({ capital, year, receiptFor, onTagSaved }) {
  const headingRef = useRef(null);
  const total = capital.reduce((s, c) => s - c.txn.amount, 0);
  return (
    <section className="glass-card rounded-xl overflow-hidden" aria-labelledby="capital-title">
      <div className="px-4 md:px-6 py-4 border-b border-border/50">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 id="capital-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-text-primary focus:outline-none">
            Capital items {year}
          </h3>
          {capital.length > 0 && <p className="text-sm text-text-tertiary tabular">Total cost {money(Math.round(total * 100) / 100)}</p>}
        </div>
        <p className="mt-1 text-sm text-text-tertiary">Claimed through capital cost allowance (CCA) over several years, not as an expense line.</p>
      </div>
      {capital.length === 0 ? (
        <p className="px-4 md:px-6 py-6 text-text-tertiary">No capital items in {year}. Choose &ldquo;Capital…&rdquo; on a purchase above to list it here.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {capital.map((c) => (
            <CapitalRow key={c.txn.id} item={c} receiptFor={receiptFor} onTagSaved={onTagSaved}
              focusFallback={() => headingRef.current?.focus()} />
          ))}
        </ul>
      )}
    </section>
  );
}
