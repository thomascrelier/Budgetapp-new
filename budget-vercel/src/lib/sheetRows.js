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

// ============ TENANTS / RECEIPTS / SETTINGS ============

export const TENANT_HEADERS = [
  'id', 'name', 'unit', 'utility_share', 'utility_style', 'base_rent',
  'separate_max', 'match_text', 'start_month', 'end_month', 'is_active',
];

export const RECEIPT_HEADERS = [
  'drive_file_id', 'file_name', 'mime_type', 'transaction_id', 'linked_at',
];

function parseMonth(value) {
  if (isBlank(value)) return null;
  const m = String(value).trim().match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

// "40%" -> 0.4, 0.4 -> 0.4, 40 -> 0.4 (values > 1 are percents); clamped 0-1.
function parseShare(value) {
  if (isBlank(value)) return 0;
  let s = typeof value === 'number' ? value : null;
  if (s === null) {
    const str = String(value).trim();
    const pct = str.endsWith('%');
    const n = parseAmount(pct ? str.slice(0, -1) : str);
    if (n === null) return 0;
    s = pct ? n / 100 : n;
    if (!pct && s > 1) s = s / 100;
  } else if (s > 1) {
    s = s / 100;
  }
  return Math.min(1, Math.max(0, s));
}

export function parseTenantRow(row) {
  return {
    id: parseIntCell(row[0]) ?? 0,
    name: text(row[1]),
    unit: text(row[2]),
    utility_share: parseShare(row[3]),
    utility_style: String(row[4] ?? '').trim() === 'separate' ? 'separate' : 'with_rent',
    base_rent: parseAmount(row[5]),
    separate_max: parseAmount(row[6]),
    match_text: text(row[7]),
    start_month: parseMonth(row[8]),
    end_month: parseMonth(row[9]),
    is_active: parseBool(row[10], true),
  };
}

export function parseReceiptRow(row) {
  return {
    drive_file_id: text(row[0]),
    file_name: text(row[1]),
    mime_type: text(row[2]),
    transaction_id: parseIntCell(row[3]),
    linked_at: text(row[4]),
  };
}

// Returns an error reason string, or null when the tenant is valid.
export function validateTenant(t) {
  if (!t || isBlank(t.name)) return 'name is required';
  const share = t.utility_share;
  if (typeof share !== 'number' || !Number.isFinite(share) || share < 0 || share > 1) {
    return 'utility_share must be between 0 and 1';
  }
  if (t.utility_style !== 'with_rent' && t.utility_style !== 'separate') {
    return 'utility_style must be with_rent or separate';
  }
  if (t.utility_style === 'with_rent' && parseAmount(t.base_rent) === null) {
    return 'base_rent is required for with_rent';
  }
  if (t.utility_style === 'separate' && parseAmount(t.separate_max) === null) {
    return 'separate_max is required for separate';
  }
  return null;
}

// Validates a settings write. Returns { value } (normalized) or { error }.
export function normalizeSettingValue(key, value) {
  const raw = value === undefined || value === null ? '' : String(value).trim();
  if (key === 'rental_account_name') return { value: raw };
  if (key === 'receipts_folder_id') {
    const m = raw.match(/\/folders\/([A-Za-z0-9_-]+)/);
    if (m) return { value: m[1] };
    return { value: raw.split(/[?#]/)[0].trim() };
  }
  if (/^mortgage_interest:\d{4}$/.test(String(key))) {
    const n = parseAmount(raw);
    if (n === null || n < 0) return { error: 'value must be a non-negative amount' };
    return { value: String(n) };
  }
  return { error: `unsupported setting key: ${key}` };
}
