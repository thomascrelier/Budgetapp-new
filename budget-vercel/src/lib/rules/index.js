import { CHEQUING_RULES, CARD_RULES, RENTAL_RULES } from './data.js';
import { rentalAccount } from '../scope.js';

export function normalizeDescription(desc) {
  return String(desc || '')
    .toUpperCase()
    .replace(/\d{3,}/g, ' ')
    .replace(/\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function accountKind(account, settings) {
  if (rentalAccount([account], settings)) return 'rental';
  const type = String(account.account_type || '').toLowerCase();
  if (type.includes('credit') || /visa|mastercard|amex|card/i.test(String(account.name || ''))) return 'card';
  return 'chequing';
}

export function buildHistory(txns) {
  const latest = new Map(); // key -> { date, category }
  for (const t of txns) {
    if (!t.category || t.category === 'Uncategorized') continue;
    const key = normalizeDescription(t.description);
    if (!key) continue;
    const date = String(t.date || '');
    const cur = latest.get(key);
    if (!cur || date >= cur.date) latest.set(key, { date, category: t.category });
  }
  return new Map([...latest].map(([k, v]) => [k, v.category]));
}

const RULES = { chequing: CHEQUING_RULES, card: CARD_RULES, rental: RENTAL_RULES };

export function categorize(description, amount, { kind = 'chequing', history } = {}) {
  if (history) {
    const hit = history.get(normalizeDescription(description));
    if (hit) return hit;
  }
  const upper = String(description || '').toUpperCase();
  for (const [pattern, category] of RULES[kind] || CHEQUING_RULES) {
    if (upper.includes(pattern.toUpperCase())) return category;
  }
  if (kind === 'rental' && upper.includes('E-TRANSFER')) {
    return amount > 0 ? 'Rental Income' : 'Transfers & Payments';
  }
  return 'Uncategorized';
}
