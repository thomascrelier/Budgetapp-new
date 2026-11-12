import { round2 } from '@/lib/analytics';

export const rowKey = (date, amount) => `${date}|${round2(amount).toFixed(2)}`;

// Which account already holds these rows? Count-aware match on (date, amount).
export function detectAccount(rows, transactions, accounts) {
  if (!rows.length) return [];
  const fileCounts = new Map();
  for (const r of rows) {
    const k = rowKey(r.date, r.amount);
    fileCounts.set(k, (fileCounts.get(k) || 0) + 1);
  }
  const results = [];
  for (const acct of accounts) {
    const have = new Map();
    for (const t of transactions) {
      if (Number(t.account_id) !== Number(acct.id)) continue;
      const k = rowKey(t.date, t.amount);
      have.set(k, (have.get(k) || 0) + 1);
    }
    let matched = 0;
    for (const [k, n] of fileCounts) matched += Math.min(n, have.get(k) || 0);
    if (matched > 0) {
      results.push({ account_id: acct.id, name: acct.name, matched, ratio: round2(matched / rows.length) });
    }
  }
  return results.sort((a, b) => b.matched - a.matched);
}
