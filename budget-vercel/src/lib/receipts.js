// Pure helpers for receipts kept in a Google Drive folder. No server imports: the Tax view uses some of these too.

export const MIN_RECEIPT_AMOUNT = 50;
// Most files the receipts listing returns; past this the route reports `truncated`.
export const MAX_RECEIPT_FILES = 5000;
const INCOME_LINES = new Set(['8141', '8230']);
const DRIVE_ID = /^[A-Za-z0-9_-]+$/;

// First "123.45", "123,45" or "123_45" in a file name. Digits on either side don't extend the match
// into a longer number (so "1234567.89" is not read as 234567.89).
export function amountFromFilename(name) {
  const m = String(name ?? '').match(/(?<!\d)(\d{1,6})[.,_](\d{2})(?!\d)/);
  return m ? Number(`${m[1]}.${m[2]}`) : null;
}

const sameAmount = (a, b) => Math.abs(Math.abs(a) - b) <= 0.01 + 1e-9;

// fileId -> txnId, only when exactly one transaction carries the amount in the file name.
export function suggestMatches(files, txns) {
  const out = new Map();
  for (const f of files || []) {
    const amount = amountFromFilename(f.name);
    if (!amount) continue;
    const hits = (txns || []).filter((t) => Number.isFinite(t.amount) && sameAmount(t.amount, amount));
    if (hits.length === 1) out.set(f.id, hits[0].id);
  }
  return out;
}

const linkedIds = (links) => new Set(
  (links || []).filter((l) => l && l.transaction_id !== null && l.transaction_id !== undefined).map((l) => l.transaction_id),
);

// Capital items, and expense-line items of $50 or more, with no receipt linked.
export function missingReceipts(t776Result, links) {
  const linked = linkedIds(links);
  const out = [];
  for (const c of t776Result?.capital || []) if (!linked.has(c.txn.id)) out.push(c.txn);
  for (const line of t776Result?.lines || []) {
    if (INCOME_LINES.has(line.code)) continue;
    for (const t of line.items || []) {
      if (Math.abs(t.amount) >= MIN_RECEIPT_AMOUNT && !linked.has(t.id)) out.push(t);
    }
  }
  return out;
}

// Transactions a receipt can be linked to: the year's expense lines, capital items and items under review.
export function linkCandidates(t776Result) {
  const seen = new Set();
  const out = [];
  const add = (t) => { if (t && !seen.has(t.id)) { seen.add(t.id); out.push(t); } };
  for (const line of t776Result?.lines || []) {
    if (!INCOME_LINES.has(line.code)) (line.items || []).forEach(add);
  }
  (t776Result?.capital || []).forEach((c) => add(c.txn));
  (t776Result?.review || []).forEach(add);
  return out;
}

// A Drive folder link (…/folders/<id>, …?id=<id>) or a bare id. Null when it is neither.
export function extractFolderId(input) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  const m = s.match(/\/folders\/([A-Za-z0-9_-]+)/) || s.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return DRIVE_ID.test(s) && s.length >= 10 ? s : null;
}

export function isDriveId(value) {
  return typeof value === 'string' && DRIVE_ID.test(value);
}

function driveErrorStatus(err) {
  for (const c of [err?.response?.status, err?.status, err?.code]) {
    const n = Number(c);
    if (Number.isInteger(n) && n >= 400 && n < 600) return n;
  }
  return null;
}

function driveErrorReasons(err) {
  const lists = [err?.errors, err?.response?.data?.error?.errors, err?.response?.data?.error?.details];
  return lists.flatMap((l) => (Array.isArray(l) ? l.map((e) => e?.reason).filter(Boolean) : []));
}

const GENERIC_DRIVE_ERROR = "Couldn't read the receipts folder from Google Drive. Try again in a minute.";

// What the Tax view tells the owner when Drive refuses. 403/404 mean the folder isn't shared with the app.
export function driveErrorMessage(err, email) {
  if (err?.code === 'INVALID_FOLDER_ID') {
    return "That doesn't look like a Drive folder link or ID. Paste the folder's link from Drive.";
  }
  if (err?.code === 'NOT_A_FOLDER') {
    return "That link points to a file, not a folder. Paste the link of the folder that holds your receipts.";
  }
  const reasons = driveErrorReasons(err);
  if (reasons.some((r) => r === 'accessNotConfigured' || r === 'SERVICE_DISABLED')) {
    return "The Google Drive API isn't turned on for this app's Google Cloud project. Enable it there, then try again.";
  }
  if (reasons.some((r) => /rateLimit/i.test(r))) return GENERIC_DRIVE_ERROR;
  const status = driveErrorStatus(err);
  if (status === 403 || status === 404) {
    return `The app can't open this folder. Share it with ${email || "the app's service account"} as Viewer.`;
  }
  return GENERIC_DRIVE_ERROR;
}

const YEAR_IN_NAME = /(?<!\d)((?:19|20)\d{2})(?!\d)/;

const txnSummary = (t) => (t ? {
  id: t.id, date: t.date, description: t.description, amount: t.amount, category: t.category, tax_tag: t.tax_tag || '',
} : null);

// The files the Tax view shows for one year: those linked to a transaction in that year, and unlinked ones
// unless they sit in a subfolder named for another year. Each file carries its link and a suggested match.
export function receiptFilesForYear({ files, links, txns, candidates, year }) {
  const prefix = `${year}-`;
  const linkByFile = new Map();
  for (const l of links || []) if (l && l.drive_file_id) linkByFile.set(l.drive_file_id, l);
  const txnById = new Map((txns || []).map((t) => [t.id, t]));

  const linkedTxn = (f) => {
    const id = linkByFile.get(f.id)?.transaction_id;
    return id === null || id === undefined ? null : txnById.get(id) || null;
  };

  const shown = (files || []).filter((f) => {
    const t = linkedTxn(f);
    if (t) return String(t.date).startsWith(prefix);
    const folderYear = String(f.folder || '').match(YEAR_IN_NAME);
    return !folderYear || folderYear[1] === String(year);
  });

  const taken = linkedIds(links);
  const unlinked = shown.filter((f) => !linkedTxn(f));
  const suggestions = suggestMatches(unlinked, (candidates || []).filter((t) => !taken.has(t.id)));

  return shown
    .map((f) => {
      const t = linkedTxn(f);
      return {
        ...f,
        transaction_id: t ? t.id : null,
        transaction: txnSummary(t),
        suggested_transaction_id: t ? null : suggestions.get(f.id) ?? null,
      };
    })
    .sort((a, b) => String(b.createdTime || '').localeCompare(String(a.createdTime || ''))
      || String(a.name).localeCompare(String(b.name)));
}

// transaction id -> what the CSV's receipt column shows: the Drive link when known, else the file name.
export function receiptColumn(links, files) {
  const linkById = new Map((files || []).map((f) => [f.id, f.webViewLink]));
  const byTxn = new Map();
  for (const l of links || []) {
    if (!l || l.transaction_id === null || l.transaction_id === undefined) continue;
    const value = linkById.get(l.drive_file_id) || l.file_name || l.drive_file_id;
    if (!byTxn.has(l.transaction_id)) byTxn.set(l.transaction_id, new Set());
    byTxn.get(l.transaction_id).add(value);
  }
  return new Map([...byTxn].map(([id, values]) => [id, [...values].join(' ; ')]));
}

// Body of POST /api/receipts/link -> { value } or { error }.
export function validateLinkBody(body) {
  if (!body || typeof body !== 'object') return { error: 'Send drive_file_id and transaction_id.' };
  const id = typeof body.drive_file_id === 'string' ? body.drive_file_id.trim() : '';
  if (!id || !isDriveId(id)) return { error: 'drive_file_id must be a Drive file id.' };
  const raw = body.transaction_id;
  const txnId = (typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw.trim()))) ? Number(raw) : NaN;
  if (!Number.isInteger(txnId) || txnId <= 0) return { error: 'transaction_id must be a positive whole number.' };
  return {
    value: {
      drive_file_id: id,
      file_name: typeof body.file_name === 'string' ? body.file_name : '',
      mime_type: typeof body.mime_type === 'string' ? body.mime_type : '',
      transaction_id: txnId,
    },
  };
}
