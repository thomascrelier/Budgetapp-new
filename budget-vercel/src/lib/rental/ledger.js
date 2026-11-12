import { addMonths, monthOf, todayISO } from '@/lib/dates';
import { round2 } from '@/lib/analytics';

const KINDS = { electricity: 'Electricity', gas: 'Gas', water: 'Water' };
const CATEGORY_KIND = { electricity: 'electricity', gas: 'gas', water: 'water' };
const TOLERANCE_CENTS = 2;
const MAX_SUBSET_CHARGES = 12;

const cents = (n) => Math.round(n * 100);

function shortDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(d).replace('.', '');
}

export function utilityBills(txns) {
  const bills = [];
  for (const t of txns) {
    const kind = CATEGORY_KIND[String(t.category || '').toLowerCase()];
    if (!kind || !(t.amount < 0)) continue;
    const month = monthOf(t.date);
    bills.push({
      id: t.id, date: t.date, kind, amount: round2(Math.abs(t.amount)),
      due_month: kind === 'water' ? addMonths(month, 1) : month,
    });
  }
  return bills.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function utilityPart(t, tenant) {
  if (t.category !== 'Rental Income' || !(t.amount > 0)) return 0;
  const desc = String(t.description || '').toLowerCase();
  const terms = String(tenant.match_text || '').split('|').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!terms.some((term) => desc.includes(term))) return 0;
  if (tenant.utility_style === 'with_rent') return round2(Math.max(0, t.amount - (tenant.base_rent || 0)));
  return t.amount <= (tenant.separate_max ?? 0) ? t.amount : 0;
}

// Subset of open charges whose remaining sums to the payment (within tolerance): fewest charges, then oldest.
function findSubset(open, payCents) {
  if (open.length === 0 || open.length > MAX_SUBSET_CHARGES) return null;
  let best = null;
  const n = open.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    let sum = 0;
    const idx = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) { sum += open[i].remaining; idx.push(i); }
    if (Math.abs(sum - payCents) > TOLERANCE_CENTS) continue;
    if (!best || idx.length < best.length) { best = idx; continue; }
    if (idx.length === best.length) {
      for (let k = 0; k < idx.length; k++) {
        if (idx[k] !== best[k]) { if (idx[k] < best[k]) best = idx; break; }
      }
    }
  }
  return best ? best.map((i) => open[i]) : null;
}

function ledgerFor(tenant, bills, txns, today) {
  const charges = [];
  for (const b of bills) {
    if (tenant.start_month && b.due_month < tenant.start_month) continue;
    if (tenant.end_month && b.due_month > tenant.end_month) continue;
    const amount = round2(b.amount * tenant.utility_share);
    charges.push({
      label: `${KINDS[b.kind]} (${shortDate(b.date)} bill)`,
      bill_date: b.date, due_month: b.due_month, amount, remaining: cents(amount),
    });
  }
  charges.sort((a, b) => (a.bill_date < b.bill_date ? -1 : a.bill_date > b.bill_date ? 1 : 0));

  const payments = txns
    .map((t) => ({ date: t.date, amount: t.amount, utility_amount: utilityPart(t, tenant) }))
    .filter((p) => p.utility_amount > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const monthSet = new Set([...charges.map((c) => c.due_month), ...payments.map((p) => monthOf(p.date))]);
  const nowMonth = today.slice(0, 7);
  const months = [...monthSet].filter((m) => m <= nowMonth).sort();

  let credit = 0; // cents
  const applyOldestFirst = (open, amountCents) => {
    let left = amountCents;
    for (const c of open) {
      if (left <= 0) break;
      const take = Math.min(left, c.remaining);
      c.remaining -= take;
      left -= take;
    }
    return left;
  };
  const openFor = (m) => charges.filter((c) => c.due_month <= m && c.remaining > 0);

  for (const m of months) {
    for (const p of payments.filter((x) => monthOf(x.date) === m)) {
      const payCents = cents(p.utility_amount);
      const open = openFor(m);
      const subset = findSubset(open, payCents);
      if (subset) subset.forEach((c) => { c.remaining = 0; });
      else credit += applyOldestFirst(open, payCents);
    }
    credit = applyOldestFirst(openFor(m), credit);
  }

  const open = charges
    .filter((c) => c.due_month <= nowMonth && c.remaining > 0)
    .map((c) => ({ label: c.label, bill_date: c.bill_date, due_month: c.due_month, owed: round2(c.remaining / 100) }));

  const out = months.map((month) => ({
    month,
    charges: charges.filter((c) => c.due_month === month).map((c) => {
      const paid = round2((cents(c.amount) - c.remaining) / 100);
      return {
        label: c.label, bill_date: c.bill_date, amount: c.amount, paid,
        status: c.remaining === 0 ? 'paid' : paid > 0 ? 'partial' : 'open',
      };
    }),
    payments: payments.filter((p) => monthOf(p.date) === month),
  }));

  return {
    tenant,
    owed: round2(open.reduce((s, c) => s + c.owed, 0)),
    credit: round2(credit / 100),
    open,
    months: out,
  };
}

export function buildLedger({ txns, tenants, now = new Date() }) {
  const today = todayISO(now);
  const visible = txns.filter((t) => t.date <= today);
  const bills = utilityBills(visible);
  return tenants.map((tenant) => ledgerFor(tenant, bills, visible, today));
}
