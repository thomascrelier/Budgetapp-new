import { classify } from './classify';
import { monthOf } from './dates';

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
