export const DEFAULT_RENTAL_ACCOUNT = 'CIBC Rental';

export function rentalAccount(accounts, settings) {
  const name = String((settings && settings.rental_account_name) || DEFAULT_RENTAL_ACCOUNT)
    .trim().toLowerCase();
  return accounts.find((a) => String(a.name || '').trim().toLowerCase() === name) || null;
}

export function personalAccountIds(accounts, settings) {
  const rental = rentalAccount(accounts, settings);
  return accounts
    .filter((a) => a.is_active && !(rental && a.id === rental.id))
    .map((a) => a.id);
}

export function resolveAccountIds(searchParams, accounts, settings) {
  const raw = searchParams.get('account_ids');
  if (raw) {
    const ids = raw.split(',').map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));
    if (ids.length) return ids;
  }
  return personalAccountIds(accounts, settings);
}
