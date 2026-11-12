import { describe, it, expect } from 'vitest';
import { accountVersion } from './version.js';

const txns = [
  { id: 1, account_id: 9, date: '2026-10-01', amount: 1225 },
  { id: 2, account_id: 1, date: '2026-10-02', amount: -5 },
  { id: 7, account_id: 9, date: '2026-10-03', amount: -180.29 },
  { id: null, account_id: 9, date: '2026-10-04', amount: -1 },
];

describe('accountVersion', () => {
  it('is the account row count and highest id', () => {
    expect(accountVersion(txns, 9)).toBe('3:7');
    expect(accountVersion(txns, '9')).toBe('3:7');
    expect(accountVersion(txns, 1)).toBe('1:2');
  });

  it('is 0:0 for an account with no rows', () => {
    expect(accountVersion(txns, 4)).toBe('0:0');
    expect(accountVersion([], 9)).toBe('0:0');
  });

  it('changes when the account gets a row, and not when another account does', () => {
    const before = accountVersion(txns, 9);
    expect(accountVersion([...txns, { id: 8, account_id: 9 }], 9)).not.toBe(before);
    expect(accountVersion([...txns, { id: 8, account_id: 1 }], 9)).toBe(before);
  });

  it('changes when a row is removed and another added in its place', () => {
    const swapped = [...txns.filter((t) => t.id !== 1), { id: 8, account_id: 9 }];
    expect(accountVersion(swapped, 9)).not.toBe(accountVersion(txns, 9));
  });
});
