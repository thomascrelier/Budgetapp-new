// A fingerprint of one account's rows in the sheet: `${rowCount}:${maxId}`. The import preview returns it;
// the commit recomputes it from a fresh read and refuses to add rows when it differs, so a plan built
// before someone else's import (or an edit in the sheet) is never written as if nothing had changed.
export function accountVersion(txns, accountId) {
  const target = Number(accountId);
  let count = 0;
  let maxId = 0;
  for (const t of txns || []) {
    if (Number(t.account_id) !== target) continue;
    count += 1;
    if (Number.isFinite(t.id) && t.id > maxId) maxId = t.id;
  }
  return `${count}:${maxId}`;
}
