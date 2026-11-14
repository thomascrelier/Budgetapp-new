import { describe, test, expect } from 'vitest';
import { parseAmount, parseDate, parseBool, parseTransactionRow, parseAccountRow, parseTenantRow, parseReceiptRow, validateTenant, normalizeSettingValue, TENANT_HEADERS, RECEIPT_HEADERS } from '@/lib/sheetRows';

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

describe('tenants, receipts, settings', () => {
  const base = ['1','Tenant A','Downstairs','40%','with_rent','2050','','tenant a|tenant-a','2025-11','','TRUE'];
  test('parseTenantRow basic', () => {
    expect(parseTenantRow(base)).toEqual({
      id: 1, name: 'Tenant A', unit: 'Downstairs', utility_share: 0.4, utility_style: 'with_rent',
      base_rent: 2050, separate_max: null, match_text: 'tenant a|tenant-a',
      start_month: '2025-11', end_month: null, is_active: true,
    });
  });
  test('separate style and share formats', () => {
    const r = parseTenantRow(['2','Tenant B','','0.6','separate','','500','','','','']);
    expect(r.separate_max).toBe(500);
    expect(r.utility_share).toBe(0.6);
    expect(r.is_active).toBe(true);
    expect(parseTenantRow(['3','B','','40','weird','','','','','','']).utility_share).toBe(0.4);
    expect(parseTenantRow(['3','B','','40','weird','','','','','','']).utility_style).toBe('with_rent');
    expect(parseTenantRow(['3','B','','250%','','','','','','','']).utility_share).toBe(1);
    expect(parseTenantRow(['3','B','','','','','','','2025-13x','2026-1','']).start_month).toBe(null);
    expect(parseTenantRow(['3','B','','','','','','','','2026-03','']).end_month).toBe('2026-03');
  });
  test('parseReceiptRow', () => {
    expect(RECEIPT_HEADERS.length).toBe(5);
    expect(TENANT_HEADERS.length).toBe(11);
    expect(parseReceiptRow(['f1','a.pdf','application/pdf',12,'2026-01-01'])).toEqual({
      drive_file_id: 'f1', file_name: 'a.pdf', mime_type: 'application/pdf', transaction_id: 12, linked_at: '2026-01-01',
    });
    expect(parseReceiptRow(['f1','a.pdf','x','','']).transaction_id).toBe(null);
  });
  test('validateTenant', () => {
    const ok = { name: 'T', utility_share: 0.4, utility_style: 'with_rent', base_rent: 100 };
    expect(validateTenant(ok)).toBe(null);
    expect(validateTenant({ ...ok, name: ' ' })).toMatch(/name/);
    expect(validateTenant({ ...ok, utility_share: 1.5 })).toMatch(/share/);
    expect(validateTenant({ ...ok, utility_style: 'x' })).toMatch(/style/);
    expect(validateTenant({ ...ok, base_rent: null })).toMatch(/base_rent/);
    expect(validateTenant({ ...ok, utility_style: 'separate', separate_max: null })).toMatch(/separate_max/);
    expect(validateTenant({ ...ok, utility_style: 'separate', separate_max: 50 })).toBe(null);
  });
  test('normalizeSettingValue', () => {
    expect(normalizeSettingValue('bogus', 'x')).toEqual({ error: expect.any(String) });
    expect(normalizeSettingValue('mortgage_interest:2026', '$1,234.50')).toEqual({ value: '1234.5' });
    expect(normalizeSettingValue('mortgage_interest:2026', '-5').error).toBeTruthy();
    expect(normalizeSettingValue('mortgage_interest:26', '5').error).toBeTruthy();
    expect(normalizeSettingValue('receipts_folder_id', 'https://drive.google.com/drive/folders/abc_123-X?usp=sharing')).toEqual({ value: 'abc_123-X' });
    expect(normalizeSettingValue('receipts_folder_id', ' abc123 ')).toEqual({ value: 'abc123' });
    expect(normalizeSettingValue('rental_account_name', ' Rental ')).toEqual({ value: 'Rental' });
  });
});
