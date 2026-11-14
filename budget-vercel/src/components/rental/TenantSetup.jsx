'use client';

import { useState, useRef } from 'react';

const EMPTY = {
  id: null, name: '', unit: '', share_pct: '', utility_style: 'with_rent',
  base_rent: '', separate_max: '', match_text: '', start_month: '', end_month: '', is_active: true,
};

const toForm = (t) => ({
  id: t.id, name: t.name || '', unit: t.unit || '',
  share_pct: t.utility_share === null || t.utility_share === undefined ? '' : String(Math.round(t.utility_share * 10000) / 100),
  utility_style: t.utility_style || 'with_rent',
  base_rent: t.base_rent ?? '', separate_max: t.separate_max ?? '',
  match_text: t.match_text || '', start_month: t.start_month || '', end_month: t.end_month || '',
  is_active: t.is_active !== false,
});

function validate(f) {
  const e = {};
  if (!f.name.trim()) e.name = 'Enter a name.';
  const pct = Number(f.share_pct);
  if (f.share_pct === '' || !Number.isFinite(pct) || pct <= 0 || pct > 100) e.share_pct = 'Enter a share from 1 to 100.';
  if (f.utility_style === 'with_rent') {
    if (f.base_rent === '' || !(Number(f.base_rent) >= 0)) e.base_rent = 'Enter the base rent.';
  } else if (f.separate_max === '' || !(Number(f.separate_max) > 0)) {
    e.separate_max = 'Enter the largest utility e-transfer.';
  }
  if (!f.match_text.trim()) e.match_text = 'Enter the name on their e-transfers.';
  return e;
}

const input = 'w-full min-h-11 px-3 border rounded-lg bg-surface text-text-primary text-base md:text-sm focus:border-accent-text';
const primary = 'min-h-11 px-4 bg-accent text-on-accent rounded-lg font-semibold hover:bg-accent-hover transition-colors text-sm disabled:opacity-60 disabled:cursor-wait';
const secondary = 'min-h-11 px-4 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors';

export default function TenantSetup({ tenants = [], onSaved, onCancel }) {
  const [form, setForm] = useState(tenants.length === 0 ? EMPTY : null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  const set = (name, value) => {
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: undefined }));
  };
  const border = (n) => (errors[n] ? 'border-negative' : 'border-border');
  const err = (n) => errors[n] && <p id={`tenant-${n}-error`} className="text-xs text-negative mt-1">{errors[n]}</p>;
  const desc = (n, hint) => [errors[n] ? `tenant-${n}-error` : null, hint].filter(Boolean).join(' ') || undefined;

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) {
      formRef.current?.querySelector(`[name="${Object.keys(v)[0]}"]`)?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    const withRent = form.utility_style === 'with_rent';
    const payload = {
      id: form.id, name: form.name.trim(), unit: form.unit.trim(),
      utility_share: Math.round(Number(form.share_pct) * 100) / 10000,
      utility_style: form.utility_style,
      base_rent: withRent ? Number(form.base_rent) : null,
      separate_max: withRent ? null : Number(form.separate_max),
      match_text: form.match_text.trim(),
      start_month: form.start_month || null, end_month: form.end_month || null,
      is_active: form.is_active,
    };
    try {
      const res = await fetch('/api/rental/tenants', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Save failed');
      setForm(null);
      onSaved?.(data);
    } catch (ex) {
      setError(`Couldn't save the tenant: ${ex.message}. Check the details and try again.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass-card rounded-xl p-4 md:p-6 space-y-4" aria-labelledby="tenant-setup-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="tenant-setup-title" className="text-lg font-semibold text-text-primary">
          {tenants.length === 0 ? 'Set up your tenants' : 'Edit tenants'}
        </h2>
        {onCancel && !form && <button type="button" onClick={onCancel} className={secondary}>Done</button>}
      </div>

      {!form && (
        <>
          <ul className="divide-y divide-border">
            {tenants.map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-text-primary break-words">{t.name}{t.unit ? ` (${t.unit})` : ''}</p>
                  <p className="text-sm text-text-tertiary tabular">
                    {Math.round(t.utility_share * 100)}% of utilities{t.is_active ? '' : ', inactive'}
                  </p>
                </div>
                <button type="button" className={secondary} onClick={() => { setErrors({}); setError(null); setForm(toForm(t)); }}
                  aria-label={`Edit ${t.name}`}>Edit</button>
              </li>
            ))}
          </ul>
          <button type="button" className={primary} onClick={() => { setErrors({}); setError(null); setForm(EMPTY); }}>Add tenant</button>
        </>
      )}

      {form && (
        <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
          {tenants.length === 0 && (
            <p className="text-sm text-text-tertiary">Add each tenant so the app can show what they owe for each utility bill.</p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="tenant-name" className="block text-sm font-medium text-text-secondary mb-2">Name</label>
              <input id="tenant-name" name="name" value={form.name} onChange={(e) => set('name', e.target.value)}
                aria-invalid={errors.name ? true : undefined} aria-describedby={desc('name')} className={`${input} ${border('name')}`} />
              {err('name')}
            </div>
            <div>
              <label htmlFor="tenant-unit" className="block text-sm font-medium text-text-secondary mb-2">Unit</label>
              <input id="tenant-unit" name="unit" value={form.unit} onChange={(e) => set('unit', e.target.value)} className={`${input} border-border`} />
            </div>
            <div>
              <label htmlFor="tenant-share" className="block text-sm font-medium text-text-secondary mb-2">Share of utilities (%)</label>
              <input id="tenant-share" name="share_pct" type="number" inputMode="decimal" min="1" max="100" step="any" value={form.share_pct}
                onChange={(e) => set('share_pct', e.target.value)} aria-invalid={errors.share_pct ? true : undefined}
                aria-describedby={desc('share_pct')} className={`${input} ${border('share_pct')} tabular`} />
              {err('share_pct')}
            </div>
            <div>
              <label htmlFor="tenant-start" className="block text-sm font-medium text-text-secondary mb-2">Start month</label>
              <input id="tenant-start" name="start_month" type="month" value={form.start_month}
                onChange={(e) => set('start_month', e.target.value)} className={`${input} border-border`} />
            </div>
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-text-secondary mb-2">How do they pay utilities?</legend>
            <div className="space-y-1">
              <label className="flex items-center gap-3 min-h-11 text-sm text-text-primary">
                <input type="radio" name="utility_style" value="with_rent" checked={form.utility_style === 'with_rent'}
                  onChange={() => set('utility_style', 'with_rent')} className="w-4 h-4 accent-accent" />
                Added to their rent payment
              </label>
              <label className="flex items-center gap-3 min-h-11 text-sm text-text-primary">
                <input type="radio" name="utility_style" value="separate" checked={form.utility_style === 'separate'}
                  onChange={() => set('utility_style', 'separate')} className="w-4 h-4 accent-accent" />
                Separate e-transfers
              </label>
            </div>
          </fieldset>

          {form.utility_style === 'with_rent' ? (
            <div>
              <label htmlFor="tenant-base" className="block text-sm font-medium text-text-secondary mb-2">Base rent ($)</label>
              <input id="tenant-base" name="base_rent" type="number" inputMode="decimal" min="0" step="0.01" value={form.base_rent}
                onChange={(e) => set('base_rent', e.target.value)} aria-invalid={errors.base_rent ? true : undefined}
                aria-describedby={desc('base_rent', 'tenant-base-hint')} className={`${input} ${border('base_rent')} tabular`} />
              <p id="tenant-base-hint" className="text-xs text-text-muted mt-1">Anything they send above this counts toward utilities.</p>
              {err('base_rent')}
            </div>
          ) : (
            <div>
              <label htmlFor="tenant-max" className="block text-sm font-medium text-text-secondary mb-2">Largest utility e-transfer ($)</label>
              <input id="tenant-max" name="separate_max" type="number" inputMode="decimal" min="0" step="0.01" value={form.separate_max}
                onChange={(e) => set('separate_max', e.target.value)} aria-invalid={errors.separate_max ? true : undefined}
                aria-describedby={desc('separate_max', 'tenant-max-hint')} className={`${input} ${border('separate_max')} tabular`} />
              <p id="tenant-max-hint" className="text-xs text-text-muted mt-1">E-transfers above this are treated as rent, not utilities.</p>
              {err('separate_max')}
            </div>
          )}

          <div>
            <label htmlFor="tenant-match" className="block text-sm font-medium text-text-secondary mb-2">Name as it appears on their e-transfers</label>
            <input id="tenant-match" name="match_text" value={form.match_text} onChange={(e) => set('match_text', e.target.value)}
              aria-invalid={errors.match_text ? true : undefined} aria-describedby={desc('match_text', 'tenant-match-hint')}
              className={`${input} ${border('match_text')}`} />
            <p id="tenant-match-hint" className="text-xs text-text-muted mt-1">Separate several spellings with |.</p>
            {err('match_text')}
          </div>

          {form.id && (
            <label className="flex items-center gap-3 min-h-11 text-sm text-text-primary">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="w-4 h-4 accent-accent" />
              Active tenant
            </label>
          )}

          {error && <p role="alert" className="text-sm text-negative">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className={primary}>{saving ? 'Saving…' : 'Save tenant'}</button>
            {(tenants.length > 0 || onCancel) && (
              <button type="button" disabled={saving} className={secondary}
                onClick={() => (tenants.length > 0 ? setForm(null) : onCancel?.())}>Cancel</button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
