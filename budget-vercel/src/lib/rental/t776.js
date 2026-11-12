import { classify } from '../classify';
import { round2 } from '../analytics';

export const T776_LINES = {
  '8141': 'Gross rents',
  '8230': 'Other related income',
  '8521': 'Advertising',
  '8690': 'Insurance',
  '8710': 'Interest and bank charges',
  '8810': 'Office expenses',
  '8860': 'Professional fees',
  '8871': 'Management and administration fees',
  '8960': 'Repairs and maintenance',
  '9180': 'Property taxes',
  '9200': 'Travel',
  '9220': 'Utilities',
  '9270': 'Other expenses',
};

const INCOME_LINES = new Set(['8141', '8230']);

export const CATEGORY_TO_LINE = {
  'Rental Income': '8141',
  'Insurance': '8690',
  'Rental Property Insurance': '8690',
  'Mortgage': '8710',
  'Fees & Charges': '8710',
  'Repairs & Maintenance': '8960',
  'Property Tax': '9180',
  'Electricity': '9220',
  'Gas': '9220',
  'Water': '9220',
  'Internet': '9220',
  'Advertising': '8521',
  'Renovations': 'review',
};

export function parseTaxTag(text) {
  const s = String(text ?? '').trim();
  if (!s) return null;
  if (/\bcapital\b/i.test(s)) {
    const m = s.match(/CCA(?:\s*class)?\s*(\d+(?:\.\d+)?)/i);
    return { kind: 'capital', cca_class: m ? m[1] : null };
  }
  if (/\bexclude\b|not\s+deductible/i.test(s)) return { kind: 'exclude' };
  if (/\breview\b/i.test(s)) return { kind: 'review' };
  const m = s.match(/\b(\d{4})\b/);
  if (m && T776_LINES[m[1]]) return { kind: 'line', line: m[1] };
  return null;
}

export function formatTaxTag(tag) {
  if (!tag) return '';
  if (tag.kind === 'line') return `T776 ${tag.line}`;
  if (tag.kind === 'capital') return tag.cca_class ? `Capital CCA ${tag.cca_class}` : 'Capital';
  if (tag.kind === 'exclude') return 'Exclude';
  if (tag.kind === 'review') return 'Review';
  return '';
}

export function buildT776({ txns, year, rentalAccountId, mortgageInterest = null }) {
  const prefix = `${year}-`;
  const buckets = {};
  const capital = [];
  const review = [];
  const notOn = [];
  let mortgagePayments = 0;

  for (const t of txns) {
    if (!String(t.date).startsWith(prefix)) continue;
    const tag = parseTaxTag(t.tax_tag);
    const isRental = t.account_id === rentalAccountId;
    const tagged = tag && (tag.kind === 'line' || tag.kind === 'capital');
    if (!isRental && !tagged) continue;
    if (tag && tag.kind === 'exclude') continue;

    if (tag && tag.kind === 'capital') { capital.push({ txn: t, cca_class: tag.cca_class }); continue; }
    if (tag && tag.kind === 'review') { review.push(t); continue; }
    if (tag && tag.kind === 'line') { (buckets[tag.line] ||= []).push(t); continue; }

    if (classify(t) === 'transfer') { notOn.push(t); continue; }
    const mapped = CATEGORY_TO_LINE[t.category];
    if (mapped === 'review') { review.push(t); continue; }
    if (!mapped) { notOn.push(t); continue; }
    if (t.category === 'Mortgage') { mortgagePayments -= t.amount; continue; }
    (buckets[mapped] ||= []).push(t);
  }

  const hasInterest = typeof mortgageInterest === 'number' && Number.isFinite(mortgageInterest);
  if (hasInterest) buckets['8710'] ||= [];

  const lines = [];
  for (const code of Object.keys(T776_LINES).sort()) {
    const items = (buckets[code] || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let amount = items.reduce((s, t) => s + (INCOME_LINES.has(code) ? t.amount : -t.amount), 0);
    if (code === '8710' && hasInterest) amount += mortgageInterest;
    amount = round2(amount);
    if (amount === 0 && items.length === 0) continue;
    lines.push({ code, label: T776_LINES[code], amount, items });
  }

  const sumOf = (pred) => round2(lines.filter((l) => pred(l.code)).reduce((s, l) => s + l.amount, 0));
  const gross_rents = sumOf((c) => c === '8141');
  const otherIncome = sumOf((c) => c === '8230');
  const total_expenses = sumOf((c) => !INCOME_LINES.has(c));
  return {
    year,
    lines,
    capital,
    review,
    not_on_t776: notOn,
    mortgage: {
      payments_total: round2(mortgagePayments),
      interest: hasInterest ? mortgageInterest : null,
      needs_interest: !hasInterest,
    },
    gross_rents,
    total_expenses,
    net: round2(gross_rents + otherIncome - total_expenses),
  };
}

function csvField(v) {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// receipts: optional Map(transaction id -> Drive link or file name) for the receipt column.
export function toT776Csv(result, receipts = null) {
  const out = [['section', 'line', 'label', 'date', 'description', 'amount', 'tax_tag', 'notes', 'receipt']];
  const item = (section, line, label, t, amount) =>
    out.push([section, line, label, t.date, t.description, amount, t.tax_tag || '', t.notes || '', receipts?.get(t.id) || '']);
  for (const l of result.lines) {
    const income = INCOME_LINES.has(l.code);
    for (const t of l.items) item('line', l.code, l.label, t, round2(income ? t.amount : -t.amount));
    if (l.code === '8710' && result.mortgage.interest !== null) {
      out.push(['line', l.code, l.label, '', 'Mortgage interest (entered for the year)', result.mortgage.interest, '', '', '']);
    }
    out.push(['total', l.code, l.label, '', '', l.amount, '', '', '']);
  }
  for (const c of result.capital) item('capital', '', `CCA class ${c.cca_class ?? '?'}`, c.txn, round2(-c.txn.amount));
  for (const t of result.review) item('review', '', 'Needs review', t, round2(-t.amount));
  out.push(['total', '', 'Gross rents', '', '', result.gross_rents, '', '', '']);
  out.push(['total', '', 'Total expenses', '', '', result.total_expenses, '', '', '']);
  out.push(['total', '', 'Net', '', '', result.net, '', '', '']);
  return out.map((r) => r.map(csvField).join(',')).join('\n') + '\n';
}
