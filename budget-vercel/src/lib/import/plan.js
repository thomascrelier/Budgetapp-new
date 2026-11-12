import { categorize } from '@/lib/rules';
import { rowKey } from '@/lib/import/detect';

const DAY = 86400000;
const dayNum = (iso) => Date.parse(`${iso}T00:00:00Z`) / DAY;

// Split file rows into new / duplicates / older. accountTxns are already
// filtered to the chosen account. Rows that are not duplicates but share a
// (date, amount) key with existing rows are genuinely new extras (e.g. two
// identical payments), never "older".
export function planImport(rows, accountTxns, { kind, history, olderThanDays = 7 } = {}) {
  const have = new Map();
  let latest = null;
  for (const t of accountTxns) {
    const k = rowKey(t.date, t.amount);
    have.set(k, (have.get(k) || 0) + 1);
    if (!latest || t.date > latest) latest = t.date;
  }
  const seenInFile = new Map();
  const out = { new: [], duplicates: [], older: [] };
  for (const row of rows) {
    const k = rowKey(row.date, row.amount);
    const planned = { ...row, category: categorize(row.description, row.amount, { kind, history }) };
    const n = (seenInFile.get(k) || 0) + 1;
    seenInFile.set(k, n);
    const existing = have.get(k) || 0;
    if (n <= existing) out.duplicates.push(planned);
    else if (existing === 0 && latest && dayNum(latest) - dayNum(row.date) > olderThanDays) out.older.push(planned);
    else out.new.push(planned);
  }
  return out;
}
