import { test, expect } from 'vitest';
import { buildT776, parseTaxTag, formatTaxTag, toT776Csv } from '@/lib/rental/t776';

const R = 5; // rental account id
const row = (o) => ({ account_id: R, date: '2026-09-15', description: 'X', amount: -100, category: 'Repairs & Maintenance', tax_tag: '', notes: '', ...o });

test('tagged Visa row counts, untagged Visa insurance does not, card payment excluded', () => {
  const r = buildT776({ year: 2026, rentalAccountId: R, mortgageInterest: null, txns: [
    row({ account_id: 1, category: 'Insurance', amount: -1955.88, tax_tag: 'T776 line 8690 - Insurance' }),
    row({ account_id: 1, category: 'Insurance', amount: -278.64 }),
    row({ category: 'Insurance', amount: -1956, description: 'INTERNET TRANSFER TO CARD 4500********0000' }),
  ]});
  expect(r.lines.find(l => l.code === '8690').amount).toBe(1955.88);
  expect(r.not_on_t776).toHaveLength(1);
});
test('capital items are listed apart from expense lines', () => {
  const r = buildT776({ year: 2026, rentalAccountId: R, mortgageInterest: null, txns: [
    row({ account_id: 1, category: 'Shopping', amount: -971.79, tax_tag: 'T776 capital - CCA Class 8 (appliance)' }),
  ]});
  expect(r.capital).toEqual([expect.objectContaining({ cca_class: '8' })]);
  expect(r.total_expenses).toBe(0);
});
test('mortgage: only entered interest goes on 8710', () => {
  const txns = [row({ category: 'Mortgage', amount: -328.08 }), row({ category: 'Mortgage', amount: -328.08 }), row({ category: 'Fees & Charges', amount: -16.95 })];
  expect(buildT776({ year: 2026, rentalAccountId: R, mortgageInterest: null, txns }).mortgage).toEqual({ payments_total: 656.16, interest: null, needs_interest: true });
  expect(buildT776({ year: 2026, rentalAccountId: R, mortgageInterest: 400, txns }).lines.find(l => l.code === '8710').amount).toBe(416.95);
});
test('refund reduces repairs; Exclude drops a row', () => {
  const r = buildT776({ year: 2026, rentalAccountId: R, mortgageInterest: null, txns: [row({ amount: -900 }), row({ amount: 100 }), row({ amount: -50, tax_tag: 'Exclude' })] });
  expect(r.lines.find(l => l.code === '8960').amount).toBe(800);
});
test('parseTaxTag accepts earlier free text', () => {
  expect(parseTaxTag('Not deductible - card payment')).toEqual({ kind: 'exclude' });
  expect(parseTaxTag('Needs review')).toEqual({ kind: 'review' });
  expect(parseTaxTag('Capital CCA 8')).toEqual({ kind: 'capital', cca_class: '8' });
  expect(parseTaxTag('T776 8690')).toEqual({ kind: 'line', line: '8690' });
  expect(parseTaxTag('')).toBeNull();
});
test('formatTaxTag round-trips', () => {
  for (const s of ['T776 8690', 'Capital CCA 8', 'Exclude', 'Review']) expect(formatTaxTag(parseTaxTag(s))).toBe(s);
});
test('other-year rows ignored; income and net computed', () => {
  const r = buildT776({ year: 2026, rentalAccountId: R, mortgageInterest: null, txns: [
    row({ category: 'Rental Income', amount: 2000 }),
    row({ amount: -300 }),
    row({ date: '2025-09-15', amount: -999 }),
  ]});
  expect(r.gross_rents).toBe(2000);
  expect(r.total_expenses).toBe(300);
  expect(r.net).toBe(1700);
});
test('CSV quotes commas, quotes and newlines', () => {
  const r = buildT776({ year: 2026, rentalAccountId: R, mortgageInterest: null, txns: [row({ description: 'Paint, "white"', notes: 'a\nb' })] });
  const csv = toT776Csv(r);
  expect(csv.split('\n')[0]).toBe('section,line,label,date,description,amount,tax_tag,notes,receipt');
  expect(csv).toContain('"Paint, ""white"""');
  expect(csv).toContain('"a\nb"');
});
test('toT776Csv fills the receipt column from an optional transaction-to-receipt map', () => {
  const r = buildT776({ year: 2026, rentalAccountId: R, mortgageInterest: null, txns: [
    row({ id: 11, description: 'Plumber', amount: -900 }),
    row({ id: 12, description: 'Hardware store', amount: -40 }),
    row({ id: 13, account_id: 1, description: 'Appliance store', amount: -971.79, tax_tag: 'Capital CCA 8' }),
  ]});
  const lines = toT776Csv(r, new Map([[11, 'https://drive.example/f1'], [13, 'stove.pdf']])).split('\n');
  expect(lines.find(l => l.includes('Plumber')).endsWith(',https://drive.example/f1')).toBe(true);
  expect(lines.find(l => l.includes('Hardware store')).endsWith(',')).toBe(true);
  expect(lines.find(l => l.includes('Appliance store')).endsWith(',stove.pdf')).toBe(true);
  // One argument still works and leaves the column empty.
  expect(toT776Csv(r).split('\n').find(l => l.includes('Plumber')).endsWith(',')).toBe(true);
});
test('CSV text fields that a spreadsheet would run as formulas are quoted; amounts stay numbers', () => {
  const r = buildT776({ year: 2026, rentalAccountId: R, mortgageInterest: null, txns: [
    row({ id: 21, description: '=HYPERLINK("http://x")', notes: '+1 call back', amount: -100 }),
    row({ id: 22, description: 'Hardware refund', notes: '@supplier', amount: 50 }),
    row({ id: 23, description: '-Store credit', tax_tag: 'T776 9270', amount: -30 }),
  ]});
  const csv = toT776Csv(r, new Map([[21, '-scan.pdf']]));
  const lines = csv.split('\n');
  const first = lines.find(l => l.includes('HYPERLINK'));
  expect(first).toContain(`"'=HYPERLINK(""http://x"")"`);
  expect(first).toContain(",'+1 call back,");
  expect(first.endsWith(",'-scan.pdf")).toBe(true);
  expect(lines.find(l => l.includes('Hardware refund'))).toContain(",-50,,'@supplier,");
  expect(lines.find(l => l.includes('Store credit'))).toContain(",'-Store credit,30,T776 9270,");
  // A negative total is still a number.
  expect(lines).toContain('total,8960,Repairs and maintenance,,,50,,,');
});
