'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatMoney } from '@/components/AnimatedNumber';
import TenantSetup from '@/components/rental/TenantSetup';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (m) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const STATUS = { paid: 'Paid', partial: 'Partly paid', open: 'Unpaid' };
const STATUS_TONE = { paid: 'text-positive', partial: 'text-warning', open: 'text-negative' };
const secondary = 'min-h-11 px-4 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors';

function TenantCard({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const { tenant, owed, credit, open, months } = entry;
  const panelId = `tenant-months-${tenant.id}`;
  return (
    <li className="glass-card rounded-xl p-4 md:p-6">
      <h3 className="font-semibold text-text-primary break-words">{tenant.name}{tenant.unit ? ` (${tenant.unit})` : ''}</h3>
      {owed > 0 ? (
        <p className="mt-2 text-3xl font-semibold text-accent-text tabular">
          {formatMoney(owed, { decimals: 2 })} <span className="text-base font-normal text-text-tertiary">owed</span>
        </p>
      ) : (
        <p className="mt-2 text-3xl font-semibold text-positive">All paid up</p>
      )}
      {open.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-text-secondary">
          {open.map((o) => (
            <li key={`${o.label}-${o.bill_date}`}>
              {o.label}: <span className="tabular">{formatMoney(o.owed, { decimals: 2 })}</span>, expected with the {monthName(o.due_month).split(' ')[0]} payment
            </li>
          ))}
        </ul>
      )}
      {credit > 0 && (
        <p className="mt-3 text-sm text-positive">
          <span className="tabular">{formatMoney(credit, { decimals: 2 })}</span> credit toward future bills
        </p>
      )}
      <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} aria-controls={panelId}
        className="mt-4 min-h-11 text-sm text-accent-text hover:underline">
        {expanded ? 'Hide month by month' : 'Show month by month'}
      </button>
      {expanded && (
        <div id={panelId} className="mt-2 space-y-4">
          {months.length === 0 && <p className="text-sm text-text-tertiary">No utility activity yet.</p>}
          {[...months].reverse().map((m) => (
            <div key={m.month} className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="text-left font-medium text-text-primary mb-1">{monthName(m.month)}</caption>
                <thead>
                  <tr className="text-text-tertiary text-left">
                    <th scope="col" className="py-1 pr-3 font-normal">Item</th>
                    <th scope="col" className="py-1 pr-3 font-normal text-right">Amount</th>
                    <th scope="col" className="py-1 font-normal text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {m.charges.map((c) => (
                    <tr key={`${c.label}-${c.bill_date}`} className="border-t border-border">
                      <td className="py-1 pr-3 text-text-secondary">{c.label}</td>
                      <td className="py-1 pr-3 text-right tabular">{formatMoney(c.amount, { decimals: 2 })}</td>
                      <td className={`py-1 text-right ${STATUS_TONE[c.status]}`}>
                        {STATUS[c.status]}{c.status === 'partial' ? ` (${formatMoney(c.paid, { decimals: 2 })})` : ''}
                      </td>
                    </tr>
                  ))}
                  {m.payments.map((p) => (
                    <tr key={`${p.date}-${p.amount}`} className="border-t border-border">
                      <td className="py-1 pr-3 text-text-secondary">Payment on {p.date}</td>
                      <td className="py-1 pr-3 text-right tabular">{formatMoney(p.utility_amount)}</td>
                      <td className="py-1 text-right text-text-muted">utilities</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

export default function TenantLedger() {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch('/api/rental/tenants');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setState({ loading: false, error: null, data });
    } catch (err) {
      setState({ loading: false, error: err.message || 'Network error', data: null });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { loading, error, data } = state;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-40" role="status">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" aria-hidden="true" />
        <span className="sr-only">Loading tenant ledger</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="glass-card rounded-xl p-8 text-center" role="alert">
        <h2 className="text-lg font-medium text-text-primary">Couldn&rsquo;t load the tenant ledger</h2>
        <p className="mt-2 text-text-tertiary">{error}. Check your connection and try again.</p>
        <button type="button" onClick={load} className={`${secondary} mt-4`}>Retry</button>
      </div>
    );
  }

  if (data.needs_setup || editing) {
    return (
      <div className="space-y-3">
        {data.error && <p role="alert" className="text-sm text-warning">{data.error}</p>}
        <TenantSetup
          tenants={data.all_tenants || []}
          onSaved={() => { if (data.needs_setup) setEditing(false); load(); }}
          onCancel={data.needs_setup ? undefined : () => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <section aria-labelledby="tenant-ledger-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="tenant-ledger-title" className="text-xl font-semibold text-text-primary">Tenant utilities</h2>
        <button type="button" onClick={() => setEditing(true)} className={secondary}>Edit tenants</button>
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.tenants.map((entry) => <TenantCard key={entry.tenant.id} entry={entry} />)}
      </ul>
    </section>
  );
}
