export const TRANSFER_CATEGORIES = ['Transfer', 'Transfers & Payments', 'Credit Card Payment'];
export const INVESTMENT_CATEGORIES = ['Investments'];
export const INCOME_CATEGORIES = ['Income', 'Rental Income'];

const CARD_PAYMENT_PATTERNS = [/\bTO CARD\b/i, /PAYMENT THANK YOU/i, /PAIEMEN ?T MERCI/i];

export function isCardPayment(description) {
  const d = String(description || '');
  return CARD_PAYMENT_PATTERNS.some((re) => re.test(d));
}

export function classify(t) {
  if (TRANSFER_CATEGORIES.includes(t.category) || isCardPayment(t.description)) return 'transfer';
  if (INVESTMENT_CATEGORIES.includes(t.category)) return 'investment';
  // Signed: a negative row in an income category (a returned payment, a reversal) reduces income.
  if (INCOME_CATEGORIES.includes(t.category)) return 'income';
  return t.amount < 0 ? 'expense' : 'refund';
}
