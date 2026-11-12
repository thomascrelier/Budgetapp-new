import { test, expect } from 'vitest';
import { parseBankCsv } from '@/lib/import/parse';
import { detectAccount } from '@/lib/import/detect';
import { planImport } from '@/lib/import/plan';

const ACCOUNT_CSV = '2026-10-01,Internet Banking E-TRANSFER 1 Tenant B,,1225.00\n2026-10-01,Internet Banking E-TRANSFER 2 Tenant B,,1225.00\n2026-09-21,Electronic Funds Transfer PREAUTHORIZED DEBIT Hydro One,180.29,\n';
const CARD_CSV = '2026-09-15,"AVIVA GENERAL INSURANCE C MARKHAM, ON",1955.88,,4500********0000\n2026-09-24,PAYMENT THANK YOU/PAIEMEN T MERCI,,1956.00,4500********0000\n';
test('parses CIBC account and card files', () => {
  const a = parseBankCsv(ACCOUNT_CSV);
  expect(a.format).toBe('cibc-account');
  expect(a.rows.map(r => r.amount)).toEqual([1225, 1225, -180.29]);
  const c = parseBankCsv(CARD_CSV);
  expect(c.format).toBe('cibc-card');
  expect(c.rows[0]).toMatchObject({ description: 'AVIVA GENERAL INSURANCE C MARKHAM, ON', amount: -1955.88, card: '4500********0000' });
});
test('header CSV with one-sided debit/credit', () => {
  const h = parseBankCsv('Date,Description,Debit,Credit\n2026-11-02,COFFEE,4.50,\n2026-11-03,REFUND,,4.50\n');
  expect(h.format).toBe('header');
  expect(h.rows.map(r => r.amount)).toEqual([-4.5, 4.5]);
});
test('bad rows go to errors with line numbers; blank lines skipped', () => {
  const r = parseBankCsv('2026-10-01,A,5.00,\n\nnot-a-date,B,1.00,\n2026-10-02,C,abc,\n');
  expect(r.rows).toHaveLength(1);
  expect(r.errors.map(e => e.line)).toEqual([3, 4]);
  expect(r.errors[0].reason).toBeTruthy();
});
test('detectAccount finds the account that already has these rows', () => {
  const rows = parseBankCsv(ACCOUNT_CSV).rows;
  const txns = rows.map((r, i) => ({ id: i + 1, account_id: 9, date: r.date, amount: r.amount }));
  const res = detectAccount(rows, txns, [{ id: 9, name: 'Rental' }, { id: 1, name: 'Main' }]);
  expect(res).toHaveLength(1);
  expect(res[0]).toMatchObject({ account_id: 9, matched: 3, ratio: 1 });
  expect(detectAccount([], txns, [{ id: 9, name: 'Rental' }])).toEqual([]);
});
test('planImport is count-aware and flags older rows', () => {
  const rows = parseBankCsv(ACCOUNT_CSV).rows;
  const existing = [{ account_id: 9, date: '2026-10-01', amount: 1225, description: 'x' }, { account_id: 9, date: '2026-10-20', amount: -5, description: 'y' }];
  const p = planImport(rows, existing, { kind: 'rental', history: new Map() });
  expect(p.duplicates).toHaveLength(1);
  expect(p.new.map(r => r.date)).toEqual(['2026-10-01']);
  expect(p.older.map(r => r.date)).toEqual(['2026-09-21']);
  expect(p.new[0].category).toBe('Rental Income');
});
test('same file twice: nothing new', () => {
  const rows = parseBankCsv(ACCOUNT_CSV).rows;
  const existing = rows.map(r => ({ account_id: 9, ...r }));
  const p = planImport(rows, existing, { kind: 'rental', history: new Map() });
  expect(p.new).toHaveLength(0);
  expect(p.duplicates).toHaveLength(3);
});

test('a file without a header is always split on commas', () => {
  // Without the pin, a one-line export whose description holds semicolons was split on ";".
  const r = parseBankCsv('2026-10-01,STORE;A;B;C;D,5.00,');
  expect(r.format).toBe('cibc-account');
  expect(r.rows).toEqual([{ line: 1, date: '2026-10-01', description: 'STORE;A;B;C;D', amount: -5 }]);
  expect(r.errors).toEqual([]);
});
test('a malformed quote is reported and that row skipped', () => {
  const r = parseBankCsv('2026-10-01,A,5.00,\n2026-10-02,"B" x",6.00,\n2026-10-03,C,7.00,\n');
  expect(r.rows.map(x => x.line)).toEqual([1, 3]);
  expect(r.errors).toEqual([{ line: 2, reason: expect.stringMatching(/quote/i) }]);
});
test('an unclosed quote stops the import with one clear error', () => {
  const r = parseBankCsv('2026-10-01,A,5.00,\n2026-10-02,"B unclosed,6.00,\n2026-10-03,C,7.00,\n');
  expect(r.rows).toEqual([]);
  expect(r.errors).toEqual([
    { line: 2, reason: 'The file has an unclosed quote near line 2 — export it again from the bank.', file: true },
  ]);
});
test('header columns match case-insensitively on the words they contain', () => {
  const a = parseBankCsv('Transaction Date,Description,Amount (CAD)\n2026-11-02,COFFEE,-4.50\n');
  expect(a.rows).toEqual([{ line: 2, date: '2026-11-02', description: 'COFFEE', amount: -4.5 }]);
  // "Debit Amount" and "Credit Amount" are debit and credit columns, not a signed amount column.
  const b = parseBankCsv('POSTING DATE,Payee Name,Debit Amount,Credit Amount\n2026-11-02,COFFEE,4.50,\n2026-11-03,REFUND,,4.50\n');
  expect(b.rows.map(r => [r.description, r.amount])).toEqual([['COFFEE', -4.5], ['REFUND', 4.5]]);
});
