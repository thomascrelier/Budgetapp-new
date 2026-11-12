// Pure parsers for Google Sheet rows. Cells may arrive as numbers/booleans
// (UNFORMATTED_VALUE) or as hand-typed strings, so every parser accepts both.

export const TRANSACTION_HEADERS = [
  'id', 'account_id', 'date', 'description', 'amount', 'category',
  'is_verified', 'import_batch_id', 'created_at', 'notes', 'tax_tag',
];

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (isBlank(value)) return null;
  let s = String(value).trim();
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1).trim();
  }
  s = s.replace(/^\$/, '').replace(/,/g, '').trim();
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(s)) return null;
  const n = parseFloat(s);
  return negative ? -n : n;
}

function toIso(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export function parseDate(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    // Sheets serial: days since 1899-12-30
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return dt.toISOString().slice(0, 10);
  }
  if (isBlank(value)) return null;
  const s = String(value).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/);
  if (m) return toIso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return toIso(+m[3], +m[1], +m[2]);
  return null;
}

export function parseBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (isBlank(value)) return fallback;
  const s = String(value).trim().toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return fallback;
}

function parseIntCell(value) {
  if (isBlank(value)) return null;
  const n = parseInt(String(value).replace(/,/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

const text = (v) => (isBlank(v) ? '' : String(v));

export function parseTransactionRow(row, rowNumber) {
  const date = parseDate(row[2]);
  const amount = parseAmount(row[4]);
  const accountId = parseIntCell(row[1]);
  let parse_error = null;
  if (date === null) parse_error = 'invalid date';
  else if (amount === null) parse_error = 'invalid amount';
  else if (accountId === null) parse_error = 'invalid account_id';

  return {
    id: parseIntCell(row[0]),
    account_id: accountId ?? 0,
    date: date ?? '',
    description: text(row[3]),
    amount: amount ?? 0,
    category: text(row[5]) || 'Uncategorized',
    is_verified: parseBool(row[6], false),
    import_batch_id: text(row[7]),
    created_at: text(row[8]),
    notes: text(row[9]),
    tax_tag: text(row[10]),
    row_number: rowNumber,
    parse_error,
  };
}

export function parseAccountRow(row) {
  return {
    id: parseIntCell(row[0]) ?? 0,
    name: text(row[1]),
    account_type: text(row[2]) || 'checking',
    initial_balance: parseAmount(row[3]) ?? 0,
    is_active: parseBool(row[4], true),
    created_at: text(row[5]) || new Date().toISOString(),
  };
}
