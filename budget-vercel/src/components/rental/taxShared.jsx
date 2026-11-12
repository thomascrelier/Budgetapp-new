import { formatMoney } from '@/components/AnimatedNumber';

// Shared bits for the Tax tab: dates, money, where a transaction sits on the T776, pills and buttons.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const shortDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : String(iso || '');
};

export const money = (n) => formatMoney(n, { decimals: 2 });
// What a transaction cost (or brought in), without the bank's sign.
export const size = (t) => money(Math.abs(Number(t?.amount) || 0));

export const driveFolderUrl = (id) => `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
export const thumbnailUrl = (id, width = 320) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${width}`;

// txn id -> { kind: 'line', code, label } | { kind: 'capital', cca_class } | { kind: 'review' } | { kind: 'none' }
export function placementMap(t776) {
  const map = new Map();
  if (!t776) return map;
  for (const l of t776.lines || []) for (const t of l.items || []) map.set(t.id, { kind: 'line', code: l.code, label: l.label });
  for (const c of t776.capital || []) map.set(c.txn.id, { kind: 'capital', cca_class: c.cca_class });
  for (const t of t776.review || []) map.set(t.id, { kind: 'review' });
  for (const t of t776.not_on_t776 || []) map.set(t.id, { kind: 'none' });
  return map;
}

// "Repairs and maintenance" -> "Repairs" for pills; the table shows the full label.
const shortLabel = (label) => String(label || '').split(' and ')[0];

export function placementText(p) {
  if (!p) return null;
  if (p.kind === 'line') return `${p.code} ${shortLabel(p.label)}`;
  if (p.kind === 'capital') return p.cca_class ? `Capital · Class ${p.cca_class}` : 'Capital · class not set';
  if (p.kind === 'review') return 'Needs review';
  return 'Not on T776';
}

const PILL_TONES = {
  line: 'bg-surface-hover text-text-secondary border border-border',
  capital: 'bg-info/10 text-info',
  review: 'bg-warning/10 text-warning',
  none: 'bg-surface-hover text-text-tertiary border border-border',
  warn: 'bg-warning/10 text-warning',
  ok: 'bg-positive/10 text-positive',
};

export function Pill({ tone = 'line', children }) {
  return (
    <span className={`inline-block max-w-full rounded-full px-2 py-0.5 text-xs font-medium leading-5 break-words ${PILL_TONES[tone] || PILL_TONES.line}`}>
      {children}
    </span>
  );
}

export function PlacementPill({ placement }) {
  const text = placementText(placement);
  return text ? <Pill tone={placement.kind}>{text}</Pill> : null;
}

export const primaryBtn = 'inline-flex items-center justify-center min-h-11 px-4 bg-accent text-on-accent rounded-lg font-semibold hover:bg-accent-hover transition-colors text-sm disabled:opacity-60 disabled:cursor-wait';
export const secondaryBtn = 'inline-flex items-center justify-center gap-1 min-h-11 px-4 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors disabled:opacity-60 disabled:cursor-wait';
export const fieldClass = 'w-full min-h-11 px-3 border rounded-lg bg-surface text-text-primary text-base md:text-sm focus:border-accent-text';

export function NewTabHint() {
  return (
    <>
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </>
  );
}

export function DocumentIcon({ className = 'w-8 h-8' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}
