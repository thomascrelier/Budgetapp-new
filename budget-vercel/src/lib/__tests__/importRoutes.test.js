import { test, expect, vi, beforeEach, describe } from 'vitest';

// The import routes with sheet storage mocked (no Google credentials here).
vi.mock('@/lib/sheets', () => ({
  getAccounts: vi.fn(),
  getAccountById: vi.fn(),
  getAllTransactions: vi.fn(),
  getAllTransactionsFresh: vi.fn(),
  getSettings: vi.fn(),
  createTransactions: vi.fn(),
}));

const ACCOUNTS = [{ id: 9, name: 'Rental Chequing', account_type: 'checking', is_active: true }];
const CSV = '2026-10-01,Internet Banking E-TRANSFER 1 Tenant B,,1225.00\n2026-10-03,Electronic Funds Transfer PREAUTHORIZED DEBIT Hydro One,180.29,\n';
const SHEET = [{ id: 4, account_id: 9, date: '2026-10-01', description: 'Tenant B', amount: 1225, category: 'Rental Income' }];

let sheets;
let preview;
let commit;

beforeEach(async () => {
  sheets = await import('@/lib/sheets');
  preview = (await import('@/app/api/import/preview/route')).POST;
  commit = (await import('@/app/api/import/commit/route')).POST;
  vi.clearAllMocks();
  sheets.getAccounts.mockResolvedValue(ACCOUNTS);
  sheets.getAccountById.mockResolvedValue(ACCOUNTS[0]);
  sheets.getSettings.mockResolvedValue({ rental_account_name: 'Rental Chequing' });
  // A stale cache that doesn't have the row yet: the preview must not use it.
  sheets.getAllTransactions.mockResolvedValue([]);
  sheets.getAllTransactionsFresh.mockResolvedValue(SHEET);
});

const previewRequest = () => {
  const form = new FormData();
  form.append('file', new File([CSV], 'cibc.csv', { type: 'text/csv' }));
  form.append('account_id', '9');
  return new Request('http://localhost/api/import/preview', { method: 'POST', body: form });
};

const commitRequest = (body) => new Request('http://localhost/api/import/commit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const ROWS = [{ date: '2026-10-03', description: 'Hydro One', amount: -180.29, category: 'Electricity' }];

describe('POST /api/import/preview', () => {
  test('checks duplicates against a fresh read and returns the account version', async () => {
    const body = await (await preview(previewRequest())).json();
    expect(sheets.getAllTransactionsFresh).toHaveBeenCalled();
    expect(body.plan.duplicates).toHaveLength(1);
    expect(body.plan.new.map((r) => r.date)).toEqual(['2026-10-03']);
    expect(body.account_version).toBe('1:4');
  });
});

describe('POST /api/import/commit', () => {
  const withFresh = (rows) => sheets.createTransactions.mockImplementation(async (data, { verify } = {}) => {
    verify?.(rows);
    return { created: data.length, first_id: 5 };
  });

  test('adds the rows when the account is as the preview saw it', async () => {
    withFresh(SHEET);
    const res = await commit(commitRequest({ account_id: 9, account_version: '1:4', rows: ROWS }));
    expect(res.status).toBe(200);
    expect((await res.json()).created).toBe(1);
  });

  test('refuses with 409 when the account changed since the preview', async () => {
    withFresh([...SHEET, { id: 5, account_id: 9, date: '2026-10-03', description: 'Hydro One', amount: -180.29 }]);
    const res = await commit(commitRequest({ account_id: 9, account_version: '1:4', rows: ROWS }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'This account changed since the preview. Review the file again.' });
  });

  test('a commit without the preview version is refused the same way', async () => {
    withFresh(SHEET);
    const res = await commit(commitRequest({ account_id: 9, rows: ROWS }));
    expect(res.status).toBe(409);
  });
});

describe('POST /api/import/preview with an unreadable file', () => {
  test('an unclosed quote is reported as the reason the file could not be read', async () => {
    const form = new FormData();
    form.append('file', new File(['2026-10-01,A,5.00,\n2026-10-02,"B unclosed,6.00,\n'], 'cibc.csv', { type: 'text/csv' }));
    const res = await preview(new Request('http://localhost/api/import/preview', { method: 'POST', body: form }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('The file has an unclosed quote near line 2 — export it again from the bank.');
  });
});
