import { test, expect, vi, beforeEach, describe } from 'vitest';

// sheets.js against an in-memory Sheets client. Like the real API, values.get leaves out trailing empty
// rows and returns an empty row ([]) for a blank row in the middle of the data.
const fake = vi.hoisted(() => ({ tabs: {}, calls: [], addSheetError: null }));

vi.mock('googleapis', () => {
  const tabOf = (range) => String(range).split('!')[0];
  const read = (range) => {
    const rows = (fake.tabs[tabOf(range)] || []).map((r) => {
      const out = (r || []).map((c) => (c === undefined || c === null ? '' : c));
      let n = out.length;
      while (n && out[n - 1] === '') n--;
      return out.slice(0, n);
    });
    // "Tab!A1:K1" reads the header row only.
    const one = /!([A-Z]+)1:([A-Z]+)1$/.test(String(range)) ? rows.slice(0, 1) : rows;
    let n = one.length;
    while (n && one[n - 1].length === 0) n--;
    return one.slice(0, n);
  };
  const client = {
    spreadsheets: {
      get: async () => ({ data: { sheets: Object.keys(fake.tabs).map((title) => ({ properties: { title } })) } }),
      batchUpdate: async ({ requestBody }) => {
        fake.calls.push({ method: 'batchUpdate', requestBody });
        for (const r of requestBody.requests || []) {
          if (r.addSheet) {
            if (fake.addSheetError) throw fake.addSheetError;
            fake.tabs[r.addSheet.properties.title] ||= [];
          }
        }
        return { data: {} };
      },
      values: {
        get: async ({ range }) => ({ data: { values: read(range) } }),
        append: async (args) => {
          fake.calls.push({ method: 'append', ...args });
          fake.tabs[tabOf(args.range)].push(...args.requestBody.values);
          return { data: {} };
        },
        update: async (args) => { fake.calls.push({ method: 'update', ...args }); return { data: {} }; },
        batchUpdate: async (args) => { fake.calls.push({ method: 'values.batchUpdate', ...args }); return { data: {} }; },
      },
    },
  };
  return { google: { auth: { GoogleAuth: class {} }, sheets: () => client } };
});

const sheets = await import('@/lib/sheets');

const HEADER = ['id', 'account_id', 'date', 'description', 'amount', 'category', 'is_verified', 'import_batch_id', 'created_at', 'notes', 'tax_tag'];
const txn = (id, extra = []) => [id, 1, '2026-10-0' + id, `SHOP ${id}`, -10 * id, 'Groceries', false, '', '2026-10-01T00:00:00.000Z', ...extra];
const appends = () => fake.calls.filter((c) => c.method === 'append');

beforeEach(() => {
  sheets.clearCache();
  fake.tabs = {};
  fake.calls = [];
  fake.addSheetError = null;
});

describe('appends land below the last row that holds anything', () => {
  test('appendRangeAfter counts the header and blank middle rows', () => {
    expect(sheets.appendRangeAfter('Transactions', [HEADER, txn(1), [], txn(3)])).toBe('Transactions!A5');
    expect(sheets.appendRangeAfter('Settings', [['key', 'value']])).toBe('Settings!A2');
    expect(sheets.appendRangeAfter('Settings', [])).toBe('Settings!A1');
  });

  test('createTransactions with a cleared row in the middle appends after the data, inserting rows', async () => {
    fake.tabs.Transactions = [HEADER, txn(1), txn(2), [], txn(4), txn(5)];
    const res = await sheets.createTransactions([{ account_id: 1, date: '2026-11-01', description: 'NEW', amount: -5 }]);
    expect(res).toEqual({ created: 1, first_id: 6 });
    const [call] = appends();
    expect(call.range).toBe('Transactions!A7');
    expect(call.insertDataOption).toBe('INSERT_ROWS');
    expect(call.valueInputOption).toBe('RAW');
    expect(call.requestBody.values[0].slice(0, 6)).toEqual([6, 1, '2026-11-01', 'NEW', -5, 'Uncategorized']);
  });

  test('a new setting is appended below a blank row, not into it', async () => {
    fake.tabs.Settings = [['key', 'value'], ['rental_account_name', 'CIBC Rental'], [], ['receipts_folder_id', 'abc']];
    await sheets.setSetting('mortgage_interest:2026', '1234.5');
    const [call] = appends();
    expect(call.range).toBe('Settings!A5');
    expect(call.insertDataOption).toBe('INSERT_ROWS');
  });

  test('a new tenant and a new receipt link do the same', async () => {
    fake.tabs.Tenants = [
      ['id', 'name', 'unit', 'utility_share', 'utility_style', 'base_rent', 'separate_max', 'match_text', 'start_month', 'end_month', 'is_active'],
      [1, 'Tenant A', 'Upper', 0.5, 'separate', '', 300, 'TENANT A', '2026-01', '', true],
      [],
    ];
    fake.tabs.Receipts = [['drive_file_id', 'file_name', 'mime_type', 'transaction_id', 'linked_at'], [], ['f1', 'a.pdf', 'application/pdf', 3, 'x']];
    await sheets.saveTenant({ name: 'Tenant B', unit: 'Lower', utility_share: 0.5, utility_style: 'separate', separate_max: 300, start_month: '2026-02' });
    await sheets.linkReceipt({ drive_file_id: 'f2', file_name: 'b.pdf', mime_type: 'application/pdf', transaction_id: 4 });
    expect(appends().map((c) => [c.range, c.insertDataOption])).toEqual([
      ['Tenants!A3', 'INSERT_ROWS'],
      ['Receipts!A4', 'INSERT_ROWS'],
    ]);
  });
});

describe('getAllTransactionsFresh', () => {
  test('reads the sheet every time and leaves out rows that cannot be parsed', async () => {
    fake.tabs.Transactions = [HEADER, txn(1)];
    expect((await sheets.getAllTransactions()).map((t) => t.id)).toEqual([1]);
    fake.tabs.Transactions.push(txn(2), [3, 1, 'not a date', 'BAD', -1, 'Groceries']);
    // The cached read still has the old rows; the fresh one sees the new row and drops the bad one.
    expect((await sheets.getAllTransactions()).map((t) => t.id)).toEqual([1]);
    expect((await sheets.getAllTransactionsFresh()).map((t) => t.id)).toEqual([1, 2]);
  });
});

describe('ensureTab', () => {
  test('another request creating the tab first is not an error, and its headers are kept', async () => {
    // spreadsheets.get saw no Settings tab, but by the time addSheet runs another request has made it.
    fake.addSheetError = Object.assign(
      new Error('Invalid requests[0].addSheet: A sheet with the name "Settings" already exists. Please enter another name.'),
      { code: 400 },
    );
    const real = fake.tabs;
    fake.tabs = new Proxy(real, { ownKeys: () => Reflect.ownKeys(real).filter((k) => k !== 'Settings'), getOwnPropertyDescriptor: (t, k) => (k === 'Settings' ? undefined : Reflect.getOwnPropertyDescriptor(t, k)) });
    real.Settings = [['key', 'value'], ['rental_account_name', 'CIBC Rental']];
    expect(await sheets.getSettings()).toEqual({ rental_account_name: 'CIBC Rental' });
    expect(fake.calls.filter((c) => c.method === 'update')).toEqual([]);
  });

  test('other addSheet failures still fail', async () => {
    fake.addSheetError = Object.assign(new Error('The caller does not have permission'), { code: 403 });
    await expect(sheets.getSettings()).rejects.toThrow(/permission/);
  });
});

describe('updateTransactionFields', () => {
  test('writes the notes and tax_tag headers when J1:K1 are empty', async () => {
    fake.tabs.Transactions = [HEADER.slice(0, 9), txn(1), txn(2)];
    await sheets.updateTransactionFields(2, { notes: 'Kitchen tap' });
    const [call] = fake.calls.filter((c) => c.method === 'values.batchUpdate');
    expect(call.requestBody.data).toEqual([
      { range: 'Transactions!J3', values: [['Kitchen tap']] },
      { range: 'Transactions!J1', values: [['notes']] },
      { range: 'Transactions!K1', values: [['tax_tag']] },
    ]);
  });

  test('leaves headers that are already there alone', async () => {
    fake.tabs.Transactions = [HEADER, txn(1)];
    await sheets.updateTransactionFields(1, { category: 'Dining' });
    const [call] = fake.calls.filter((c) => c.method === 'values.batchUpdate');
    expect(call.requestBody.data).toEqual([{ range: 'Transactions!F2', values: [['Dining']] }]);
  });
});
