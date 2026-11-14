import Papa from 'papaparse';
import { parseAmount, parseDate } from '@/lib/sheetRows';
import { round2 } from '@/lib/analytics';

const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());
const isBlankRow = (cells) => cells.every((c) => clean(c) === '');

const parse = (text, delimiter) => Papa.parse(text, { header: false, skipEmptyLines: false, ...(delimiter ? { delimiter } : {}) });
const firstFilled = (data) => data.find((cells) => !isBlankRow(cells));

// Index of the first header cell containing one of `words` (case-insensitive) and none of `not`.
function findColumn(head, words, not = []) {
  return head.findIndex((h) => words.some((w) => h.includes(w)) && !not.some((w) => h.includes(w)));
}

// Returns { format, rows, errors }. Line numbers are 1-based file lines. An error with `file: true` means
// the file as a whole couldn't be read.
export function parseBankCsv(text) {
  const input = String(text || '').replace(/^﻿/, '');
  // CIBC exports have no header and are always comma-separated: don't let a description full of ";" or "|"
  // make Papa guess another delimiter. Anything else (a header row) keeps delimiter detection.
  const commaParsed = parse(input, ',');
  const first = firstFilled(commaParsed.data);
  const noHeader = Boolean(first) && parseDate(clean(first[0])) !== null;
  const parsed = noHeader ? commaParsed : parse(input);

  const lines = parsed.data
    .map((cells, i) => ({ cells, line: i + 1 }))
    .filter((l) => !isBlankRow(l.cells));
  const rows = [];
  const errors = [];
  if (!lines.length) return { format: 'header', rows, errors };

  const isCard = noHeader && lines.some((l) => clean(l.cells[4]) !== '');
  const format = noHeader ? (isCard ? 'cibc-card' : 'cibc-account') : 'header';

  // Papa's row errors (bad quoting). An unclosed quote swallows the rest of the file, so nothing is usable.
  const rowErrors = parsed.errors.filter((e) => Number.isInteger(e.row));
  const unclosed = rowErrors.find((e) => e.code === 'MissingQuotes');
  if (unclosed) {
    const line = unclosed.row + 1;
    return {
      format,
      rows: [],
      errors: [{ line, reason: `The file has an unclosed quote near line ${line} — export it again from the bank.`, file: true }],
    };
  }
  const badLines = new Map();
  for (const e of rowErrors) if (!badLines.has(e.row + 1)) badLines.set(e.row + 1, e.message);
  // A line Papa couldn't read cleanly is reported and skipped; true when that happened.
  const skipBad = (line) => {
    if (!badLines.has(line)) return false;
    errors.push({ line, reason: badLines.get(line) });
    return true;
  };

  if (noHeader) {
    for (const { cells, line } of lines) {
      if (skipBad(line)) continue;
      const date = parseDate(clean(cells[0]));
      if (!date) { errors.push({ line, reason: 'Unrecognized date' }); continue; }
      const debit = parseAmount(cells[2]);
      const credit = parseAmount(cells[3]);
      if (debit === null && credit === null) { errors.push({ line, reason: 'Missing or invalid amount' }); continue; }
      if ((clean(cells[2]) !== '' && debit === null) || (clean(cells[3]) !== '' && credit === null)) {
        errors.push({ line, reason: 'Missing or invalid amount' }); continue;
      }
      const row = {
        line, date, description: clean(cells[1]),
        amount: round2((credit ?? 0) - (debit ?? 0)),
      };
      if (isCard && clean(cells[4])) row.card = clean(cells[4]);
      rows.push(row);
    }
    return { format, rows, errors };
  }

  skipBad(lines[0].line); // A badly quoted header is reported; the columns are still looked for.
  const head = lines[0].cells.map((c) => clean(c).toLowerCase());
  const iDate = findColumn(head, ['date']);
  const iDesc = findColumn(head, ['description', 'payee', 'merchant', 'details']);
  // "Debit Amount" / "Credit Amount" are one-sided columns, and "Value Date" is a date, not an amount.
  const iAmt = findColumn(head, ['amount', 'value'], ['debit', 'credit', 'date', 'balance']);
  const iDebit = findColumn(head, ['debit']);
  const iCredit = findColumn(head, ['credit']);
  if (iDate < 0 || iAmt < 0 && iDebit < 0 && iCredit < 0) {
    errors.push({ line: lines[0].line, reason: 'Could not find date and amount columns in header', file: true });
    return { format, rows, errors };
  }
  for (const { cells, line } of lines.slice(1)) {
    if (skipBad(line)) continue;
    const date = parseDate(clean(cells[iDate]));
    if (!date) { errors.push({ line, reason: 'Unrecognized date' }); continue; }
    let amount = null;
    if (iAmt >= 0) {
      amount = parseAmount(cells[iAmt]);
    } else {
      const d = iDebit >= 0 ? parseAmount(cells[iDebit]) : null;
      const c = iCredit >= 0 ? parseAmount(cells[iCredit]) : null;
      const bad = (iDebit >= 0 && clean(cells[iDebit]) !== '' && d === null) ||
        (iCredit >= 0 && clean(cells[iCredit]) !== '' && c === null);
      if (!bad && (d !== null || c !== null)) amount = (c ?? 0) - (d ?? 0);
    }
    if (amount === null) { errors.push({ line, reason: 'Missing or invalid amount' }); continue; }
    rows.push({ line, date, description: iDesc >= 0 ? clean(cells[iDesc]) : '', amount: round2(amount) });
  }
  return { format, rows, errors };
}
