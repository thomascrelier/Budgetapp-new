import { test, expect } from 'vitest';
import { buildLedger, utilityBills } from '@/lib/rental/ledger';

const A = { id: 1, name: 'Tenant A', utility_share: 0.4, utility_style: 'with_rent', base_rent: 2050, match_text: 'tenant a', start_month: '2026-06', end_month: null, is_active: true };
const B = { id: 2, name: 'Tenant B', utility_share: 0.6, utility_style: 'separate', separate_max: 500, match_text: 'tenant b', start_month: '2026-06', end_month: null, is_active: true };
const bill = (date, category, amount) => ({ date, category, amount: -amount, description: category });
const pay = (date, who, amount) => ({ date, category: 'Rental Income', amount, description: `E-TRANSFER ${who}` });
const txns = [
  bill('2026-06-19', 'Water', 242.86), bill('2026-06-22', 'Electricity', 155.21), bill('2026-06-22', 'Gas', 30.81),
  bill('2026-07-22', 'Electricity', 152.45), bill('2026-07-22', 'Gas', 46.33),
  pay('2026-06-03', 'Tenant A', 2124.41), pay('2026-06-08', 'Tenant B', 111.61),
  pay('2026-07-03', 'Tenant A', 2129.51), pay('2026-07-03', 'Tenant B', 145.72), pay('2026-07-03', 'Tenant B', 119.27),
];

test('missed water share stays open for the right tenant', () => {
  const [a, b] = buildLedger({ txns, tenants: [A, B], now: new Date('2026-07-31T12:00:00Z') });
  expect(a.owed).toBe(97.14);
  expect(a.credit).toBe(0);
  expect(a.open).toEqual([expect.objectContaining({ label: 'Water (Jun 19 bill)', due_month: '2026-07', owed: 97.14 })]);
  expect(b.owed).toBe(0);
});
test('payment before the bills post is a credit', () => {
  const [, b] = buildLedger({ txns: [...txns, pay('2026-08-05', 'Tenant B', 130)], tenants: [A, B], now: new Date('2026-08-10T12:00:00Z') });
  expect(b.credit).toBe(130);
  expect(b.owed).toBe(0);
});
test('transactions after now are ignored', () => {
  const [, b] = buildLedger({ txns: [...txns, pay('2026-08-05', 'Tenant B', 130)], tenants: [A, B], now: new Date('2026-07-31T12:00:00Z') });
  expect(b.credit).toBe(0);
});
test('rent above separate_max is not a utility payment', () => {
  const [, b] = buildLedger({ txns: [...txns, pay('2026-07-01', 'Tenant B', 1225)], tenants: [A, B], now: new Date('2026-07-31T12:00:00Z') });
  expect(b.credit).toBe(0);
});
test('utilityBills sets water due the following month', () => {
  const bills = utilityBills(txns);
  expect(bills).toHaveLength(5);
  expect(bills.find((x) => x.kind === 'water')).toMatchObject({ amount: 242.86, due_month: '2026-07' });
});
test('a partial payment pays oldest first and leaves the rest open', () => {
  const [a] = buildLedger({ txns: [bill('2026-06-22', 'Gas', 100), pay('2026-06-05', 'Tenant A', 2050), pay('2026-06-25', 'Tenant A', 2050 + 10)], tenants: [A], now: new Date('2026-06-30T12:00:00Z') });
  expect(a.owed).toBe(30);
  expect(a.months[0].charges[0].status).toBe('partial');
});
