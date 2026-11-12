import { describe, test, expect } from 'vitest';
import { categorize, buildHistory, normalizeDescription, accountKind } from '../rules/index.js';

const rental = { kind: 'rental' };
test('rental rules', () => {
  expect(categorize('Electronic Funds Transfer PREAUTHORIZED DEBIT Hydro One', -151.68, rental)).toBe('Electricity');
  expect(categorize('Electronic Funds Transfer MORTGAGE PAYMENT MTG0001.1 CMI', -328.08, rental)).toBe('Mortgage');
  expect(categorize('Internet Banking E-TRANSFER 011770708355 Chexy', 2450, rental)).toBe('Rental Income');
  expect(categorize('Internet Banking E-TRANSFER 011659090781 Canadian Bread Settlement', 49.11, rental)).toBe('Other');
  expect(categorize('Internet Banking INTERNET TRANSFER 000000136558 TO CARD 4500********9145', -1956, rental)).toBe('Transfers & Payments');
});
test('unknown chequing rows are Uncategorized, not Transfer', () => {
  expect(categorize('Electronic Funds Transfer PREAUTHORIZED DEBIT SOME NEW BILLER', -80, { kind: 'chequing' })).toBe('Uncategorized');
});
test('history beats rules', () => {
  const history = buildHistory([{ description: 'Internet Banking E-TRANSFER 011111111 Tenant A', amount: 2100, category: 'Rental Income', date: '2026-01-01' }]);
  expect(categorize('Internet Banking E-TRANSFER 022222222 Tenant A', 2120, { kind: 'chequing', history })).toBe('Rental Income');
});
test('buildHistory uses most recent categorized row', () => {
  const h = buildHistory([
    { description: 'Shop X 123456', category: 'Dining', date: '2026-01-01' },
    { description: 'Shop X 999999', category: 'Groceries', date: '2026-02-01' },
    { description: 'Shop X 555555', category: 'Uncategorized', date: '2026-03-01' },
  ]);
  expect(h.get(normalizeDescription('Shop X'))).toBe('Groceries');
});
test('normalizeDescription', () => {
  expect(normalizeDescription('  Pay *12345  ab  c1 ')).toBe('PAY AB C1');
});
test('accountKind', () => {
  const accounts = [{ id: 1, name: 'CIBC Rental' }, { id: 2, name: 'Everyday' }, { id: 3, name: 'Gold Visa' }, { id: 4, name: 'X', account_type: 'credit' }];
  expect(accountKind(accounts[0], {})).toBe('rental');
  expect(accountKind(accounts[1], {})).toBe('chequing');
  expect(accountKind(accounts[2], {})).toBe('card');
  expect(accountKind(accounts[3], {})).toBe('card');
});
