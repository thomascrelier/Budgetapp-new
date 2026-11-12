import { test, expect } from 'vitest';
import { classify, isCardPayment } from '@/lib/classify';

const t = (o) => ({ amount: -10, category: 'Groceries', description: 'STORE', ...o });
test('classify', () => {
  expect(classify(t({}))).toBe('expense');
  expect(classify(t({ amount: 20 }))).toBe('refund');
  expect(classify(t({ amount: 2000, category: 'Income' }))).toBe('income');
  expect(classify(t({ amount: 2450, category: 'Rental Income' }))).toBe('income');
  expect(classify(t({ category: 'Transfers & Payments' }))).toBe('transfer');
  expect(classify(t({ category: 'Insurance', description: 'Internet Banking INTERNET TRANSFER 000000136558 TO CARD 4500********9145' }))).toBe('transfer');
  expect(classify(t({ amount: 974.73, category: 'Income', description: 'PAYMENT THANK YOU/PAIEMEN T MERCI' }))).toBe('transfer');
  expect(classify(t({ category: 'Investments' }))).toBe('investment');
});
test('isCardPayment', () => {
  expect(isCardPayment('x to card 1')).toBe(true);
  expect(isCardPayment('PAIEMENT MERCI')).toBe(true);
  expect(isCardPayment('CAFE')).toBe(false);
  expect(isCardPayment(undefined)).toBe(false);
});
