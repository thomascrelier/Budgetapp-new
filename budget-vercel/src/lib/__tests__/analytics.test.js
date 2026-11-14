import { test, expect } from 'vitest';
import { summarize, inMonth, round2, budgetStatus, balanceSeries } from '@/lib/analytics';
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

test('budgetStatus uses net spending and marks over', () => {
  const txns = [
    { date: '2026-11-03', amount: -120, category: 'Dining', description: 'A' },
    { date: '2026-11-04', amount: 20, category: 'Dining', description: 'refund' },
    { date: '2026-10-30', amount: -500, category: 'Dining', description: 'old' },
  ];
  const [d] = budgetStatus([{ category_name: 'Dining', monthly_limit: 90, alert_threshold: 80 }], txns, '2026-11');
  expect(d).toMatchObject({ spent: 100, remaining: 0, status: 'over' });
});
test('balanceSeries ends today (Toronto) and sums signed amounts', () => {
  const s = balanceSeries([{ id: 1, initial_balance: 100 }], [{ account_id: 1, date: '2026-10-30', amount: -40 }], 3, new Date('2026-11-01T03:30:00Z'));
  expect(s.map(p => p.date)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31']);
  expect(s.at(-1).balance).toBe(60);
});
test('a negative income row reduces income instead of counting as spending', () => {
  const s = summarize([
    { amount: 2450, category: 'Rental Income', description: 'E-TRANSFER Tenant A' },
    { amount: -2450, category: 'Rental Income', description: 'E-TRANSFER RETURNED' },
    { amount: 2450, category: 'Rental Income', description: 'E-TRANSFER Tenant A' },
    { amount: -60, category: 'Dining', description: 'CAFE' },
  ]);
  expect(s).toEqual({ income: 2450, spending: 60, net: 2390, byCategory: { Dining: 60 } });
});
