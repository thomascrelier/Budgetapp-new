import { test, expect } from 'vitest';
import { summarize, inMonth, round2 } from '@/lib/analytics';
import { personalAccountIds, rentalAccount, resolveAccountIds } from '@/lib/scope';

test('summarize nets refunds and ignores transfers', () => {
  const s = summarize([
    { amount: -300, category: 'Shopping', description: 'BEST BUY' },
    { amount: 300, category: 'Shopping', description: 'BEST BUY REFUND' },
    { amount: -50, category: 'Dining', description: 'CAFE' },
    { amount: -1000, category: 'Transfers & Payments', description: 'X' },
    { amount: 3000, category: 'Income', description: 'PAYROLL' },
  ]);
  expect(s).toEqual({ income: 3000, spending: 50, net: 2950, byCategory: { Shopping: 0, Dining: 50 } });
});
test('round2 half away from zero', () => {
  expect(round2(1.005)).toBe(1.01);
  expect(round2(-1.005)).toBe(-1.01);
  expect(round2(0.1 + 0.2)).toBe(0.3);
});
test('inMonth', () => {
  const r = inMonth([{ date: '2026-03-01' }, { date: '2026-04-01' }], '2026-03');
  expect(r).toEqual([{ date: '2026-03-01' }]);
});
const accounts = [{ id: 1, name: 'Main', is_active: true }, { id: 2, name: 'CIBC Rental', is_active: true }, { id: 3, name: 'Old', is_active: false }];
test('personalAccountIds excludes inactive and the rental account', () => {
  expect(personalAccountIds(accounts, {})).toEqual([1]);
});
test('rentalAccount by setting, case-insensitive', () => {
  expect(rentalAccount(accounts, {}).id).toBe(2);
  expect(rentalAccount(accounts, { rental_account_name: 'main' }).id).toBe(1);
  expect(rentalAccount(accounts, { rental_account_name: 'zzz' })).toBeNull();
});
test('resolveAccountIds', () => {
  expect(resolveAccountIds(new URLSearchParams('account_ids=1,2'), accounts, {})).toEqual([1, 2]);
  expect(resolveAccountIds(new URLSearchParams(''), accounts, {})).toEqual([1]);
});
