import { describe, it, expect } from 'vitest';
import { importBatchId, validateCommitRows } from './batch.js';

describe('importBatchId', () => {
  it('uses Toronto time', () => {
    // 2026-12-01T02:05:09Z is 21:05:09 on Nov 30 in Toronto (EST)
    expect(importBatchId(new Date('2026-12-01T02:05:09Z'))).toBe('import-20261130-210509');
  });
  it('renders midnight as 00', () => {
    expect(importBatchId(new Date('2026-07-01T04:00:00Z'))).toBe('import-20260701-000000');
  });
});

describe('validateCommitRows', () => {
  const ok = { date: '2026-01-05', description: ' Shop A ', amount: -4.5 };
  it('rejects empty', () => {
    expect(validateCommitRows([]).error).toBeTruthy();
    expect(validateCommitRows(undefined).error).toBeTruthy();
  });
  it('defaults category and trims', () => {
    expect(validateCommitRows([ok]).rows).toEqual([{ date: '2026-01-05', description: 'Shop A', amount: -4.5, category: 'Uncategorized' }]);
  });
  it('rejects bad date, amount, description', () => {
    expect(validateCommitRows([{ ...ok, date: '1/5/2026' }]).error).toMatch(/Row 1/);
    expect(validateCommitRows([{ ...ok, date: '2024-13-45' }]).error).toMatch(/Row 1/);
    expect(validateCommitRows([{ ...ok, date: '2026-02-30' }]).error).toMatch(/Row 1/);
    expect(validateCommitRows([ok, { ...ok, amount: '3' }]).error).toMatch(/Row 2/);
    expect(validateCommitRows([{ ...ok, amount: NaN }]).error).toBeTruthy();
    expect(validateCommitRows([{ ...ok, description: '  ' }]).error).toBeTruthy();
  });
});
