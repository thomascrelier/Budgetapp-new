import { classify } from './classify';
import { monthOf, todayISO } from './dates';

export function round2(n) {
  const x = Number(n) || 0;
  const r = Math.round((Math.abs(x) + Number.EPSILON) * 100) / 100;
  return x < 0 ? -r : r;
}

export function inMonth(txns, month) {
  return txns.filter((t) => monthOf(t.date) === month);
}

export function summarize(txns) {
  let income = 0;
  let spending = 0;
  const cats = {};
  for (const t of txns) {
    const kind = classify(t);
    if (kind === 'income') income += t.amount;
    else if (kind === 'expense' || kind === 'refund') {
      spending -= t.amount;
      const c = t.category || 'Uncategorized';
      cats[c] = (cats[c] || 0) - t.amount;
    }
  }
  const byCategory = {};
  for (const [k, v] of Object.entries(cats)) byCategory[k] = round2(v);
  return {
    income: round2(income),
    spending: round2(spending),
    net: round2(income - spending),
    byCategory,
  };
}

export function budgetStatus(budgets, txns, month) {
  const { byCategory } = summarize(inMonth(txns, month));
  return budgets.map((b) => {
    const spent = Math.max(0, byCategory[b.category_name] || 0);
    const limit = Number(b.monthly_limit) || 0;
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    let status = 'on_track';
    if (limit > 0 && pct >= 100) status = 'over';
    else if (pct >= b.alert_threshold) status = 'warning';
    return {
      category_name: b.category_name,
      monthly_limit: b.monthly_limit,
      alert_threshold: b.alert_threshold,
      spent,
      remaining: round2(Math.max(0, limit - spent)),
      percentage_used: pct,
      status,
    };
  });
}

function shiftDay(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Daily end-of-day balance for the last `days` days, ending today (Toronto calendar).
export function balanceSeries(accounts, txns, days, now = new Date()) {
  const today = todayISO(now);
  const start = shiftDay(today, -(days - 1));
  let running = accounts.reduce((s, a) => s + (Number(a.initial_balance) || 0), 0);
  const perDay = {};
  for (const t of txns) {
    if (!t.date) continue;
    if (t.date < start) running += t.amount;
    else if (t.date <= today) perDay[t.date] = (perDay[t.date] || 0) + t.amount;
  }
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = shiftDay(start, i);
    running += perDay[date] || 0;
    out.push({ date, balance: round2(running) });
  }
  return out;
}
