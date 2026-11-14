import { TZ } from '@/lib/dates';
import { parseDate } from '@/lib/sheetRows';

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

// import-YYYYMMDD-HHmmss in Toronto time.
export function importBatchId(now = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return `import-${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}`;
}

// Validate commit rows; returns { rows, error }.
export function validateCommitRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { error: 'No rows to import' };
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const description = String(r.description ?? '').trim();
    const amount = typeof r.amount === 'number' ? r.amount : Number.NaN;
    const dateStr = String(r.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || parseDate(dateStr) !== dateStr) return { error: `Row ${i + 1}: date must be YYYY-MM-DD` };
    if (!Number.isFinite(amount)) return { error: `Row ${i + 1}: amount must be a number` };
    if (!description) return { error: `Row ${i + 1}: description is required` };
    out.push({ date: r.date, description, amount, category: String(r.category || '').trim() || 'Uncategorized' });
  }
  return { rows: out };
}
