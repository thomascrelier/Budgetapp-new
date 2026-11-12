import { describe, test, expect } from 'vitest';
import { parseAmount, parseDate, parseBool, parseTransactionRow, parseAccountRow } from '@/lib/sheetRows';

describe('sheetRows', () => {
  test('parseAmount handles sheet formats', () => {
    expect(parseAmount(-45.5)).toBe(-45.5);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('$45')).toBe(45);
    expect(parseAmount('-$1,200.00')).toBe(-1200);
    expect(parseAmount('(12.50)')).toBe(-12.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
  test('parseDate normalizes to YYYY-MM-DD', () => {
    expect(parseDate('2026-11-05')).toBe('2026-11-05');
    expect(parseDate('2026/11/05')).toBe('2026-11-05');
    expect(parseDate('11/5/2026')).toBe('2026-11-05');
    expect(parseDate(46331)).toBe('2026-11-05');
    expect(parseDate('5 Nov')).toBeNull();
  });
  test('parseBool is case-insensitive', () => {
    expect(parseBool('FALSE', true)).toBe(false);
    expect(parseBool('false', true)).toBe(false);
    expect(parseBool(false, true)).toBe(false);
    expect(parseBool('TRUE', false)).toBe(true);
    expect(parseBool(true, false)).toBe(true);
    expect(parseBool('', true)).toBe(true);
  });
  test('parseTransactionRow reads A..K and reports bad rows', () => {
    const t = parseTransactionRow(['7','3','2026-09-15','Merchant A','-1,955.88','Insurance','TRUE','b1','x','note','T776 8690'], 12);
    expect(t).toMatchObject({ id: 7, account_id: 3, amount: -1955.88, is_verified: true, notes: 'note', tax_tag: 'T776 8690', row_number: 12, parse_error: null });
    expect(parseTransactionRow(['', '3', '2026-09-15', 'X', '-5'], 13).id).toBeNull();
    expect(parseTransactionRow(['8', '3', 'soon', 'X', '-5'], 14).parse_error).toMatch(/date/);
    expect(parseTransactionRow(['9', '3', '2026-09-15', 'X', 'n/a'], 15).parse_error).toMatch(/amount/);
  });
  test('parseTransactionRow accepts UNFORMATTED_VALUE types', () => {
    const t = parseTransactionRow([7, 3, 46331, 'Merchant B', -12.5, '', true, 'b1', '2026-11-05T10:00:00Z'], 2);
    expect(t).toMatchObject({ id: 7, account_id: 3, date: '2026-11-05', amount: -12.5, category: 'Uncategorized', is_verified: true, notes: '', tax_tag: '', parse_error: null });
  });
  test('parseAccountRow treats FALSE in any case as inactive', () => {
    expect(parseAccountRow(['1','Tenant A','credit','0','FALSE']).is_active).toBe(false);
    expect(parseAccountRow(['2','Main','checking','0','']).is_active).toBe(true);
  });
});
