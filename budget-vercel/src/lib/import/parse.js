import Papa from 'papaparse';
import { parseAmount, parseDate } from '@/lib/sheetRows';
import { round2 } from '@/lib/analytics';

const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());
const isBlankRow = (cells) => cells.every((c) => clean(c) === '');

// Returns { format, rows, errors }. Line numbers are 1-based file lines.
export function parseBankCsv(text) {
  const parsed = Papa.parse(String(text || '').replace(/^﻿/, ''), {
    header: false,
    skipEmptyLines: false,
  });
  const lines = parsed.data
    .map((cells, i) => ({ cells, line: i + 1 }))
    .filter((l) => !isBlankRow(l.cells));
  const rows = [];
  const errors = [];
  if (!lines.length) return { format: 'header', rows, errors };

  const noHeader = parseDate(clean(lines[0].cells[0])) !== null;

  if (noHeader) {
    const isCard = lines.some((l) => clean(l.cells[4]) !== '');
    for (const { cells, line } of lines) {
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
    return { format: isCard ? 'cibc-card' : 'cibc-account', rows, errors };
  }

  const head = lines[0].cells.map((c) => clean(c).toLowerCase());
  const find = (names) => head.findIndex((h) => names.includes(h));
  const iDate = find(['date', 'transaction date', 'posted date']);
  const iDesc = find(['description', 'payee', 'merchant', 'details']);
  const iAmt = find(['amount', 'value']);
  const iDebit = find(['debit']);
  const iCredit = find(['credit']);
  if (iDate < 0 || iAmt < 0 && iDebit < 0 && iCredit < 0) {
    errors.push({ line: lines[0].line, reason: 'Could not find date and amount columns in header' });
    return { format: 'header', rows, errors };
  }
  for (const { cells, line } of lines.slice(1)) {
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
  return { format: 'header', rows, errors };
}
