import { google } from 'googleapis';
import {
  TRANSACTION_HEADERS,
  parseAccountRow,
  parseAmount,
  parseBool,
  parseTransactionRow,
  parseTenantRow,
  parseReceiptRow,
  validateTenant,
  TENANT_HEADERS,
  RECEIPT_HEADERS,
} from '@/lib/sheetRows';
import { getAuth } from '@/lib/google';

// Google Sheets configuration
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

// Sheet names
const SHEETS = {
  ACCOUNTS: 'Accounts',
  TRANSACTIONS: 'Transactions',
  BUDGETS: 'Budgets',
  SETTINGS: 'Settings',
  TENANTS: 'Tenants',
  RECEIPTS: 'Receipts',
};

const READ_OPTIONS = {
  valueRenderOption: 'UNFORMATTED_VALUE',
  dateTimeRenderOption: 'FORMATTED_STRING',
};

// ============ IN-MEMORY CACHE ============

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const cache = {
  accounts: { data: null, timestamp: 0 },
  transactions: { data: null, timestamp: 0 },
  budgets: { data: null, timestamp: 0 },
  settings: { data: null, timestamp: 0 },
  tenants: { data: null, timestamp: 0 },
  receipts: { data: null, timestamp: 0 },
};

function getCached(key) {
  const entry = cache[key];
  if (entry.data && (Date.now() - entry.timestamp) < CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
}

function setCache(key, data) {
  cache[key] = { data, timestamp: Date.now() };
}

function invalidateCache(key) {
  cache[key] = { data: null, timestamp: 0 };
}

export function clearCache() {
  cache.accounts = { data: null, timestamp: 0 };
  cache.transactions = { data: null, timestamp: 0 };
  cache.budgets = { data: null, timestamp: 0 };
  cache.settings = { data: null, timestamp: 0 };
  cache.tenants = { data: null, timestamp: 0 };
  cache.receipts = { data: null, timestamp: 0 };
  _sheetsClient = null;
  _confirmedTabs.clear();
}

// ============ AUTH (cached client) ============

let _sheetsClient = null;

async function getSheets() {
  if (_sheetsClient) return _sheetsClient;

  _sheetsClient = google.sheets({ version: 'v4', auth: getAuth() });
  return _sheetsClient;
}

// Initialize sheets with headers if they don't exist
export async function initializeSheets() {
  const sheets = await getSheets();

  // Check if Accounts sheet exists
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheetNames = spreadsheet.data.sheets.map(s => s.properties.title);

    // Create Accounts sheet if missing
    if (!sheetNames.includes(SHEETS.ACCOUNTS)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: SHEETS.ACCOUNTS } } }],
        },
      });
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.ACCOUNTS}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['id', 'name', 'account_type', 'initial_balance', 'is_active', 'created_at']],
        },
      });
    }

    // Create Transactions sheet if missing
    if (!sheetNames.includes(SHEETS.TRANSACTIONS)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: SHEETS.TRANSACTIONS } } }],
        },
      });
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.TRANSACTIONS}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [TRANSACTION_HEADERS],
        },
      });
    }

    // Add the notes / tax_tag headers to an existing Transactions sheet
    if (sheetNames.includes(SHEETS.TRANSACTIONS)) {
      const extra = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.TRANSACTIONS}!J1:K1`,
      });
      const cells = (extra.data.values && extra.data.values[0]) || [];
      if (cells.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEETS.TRANSACTIONS}!J1:K1`,
          valueInputOption: 'RAW',
          requestBody: { values: [['notes', 'tax_tag']] },
        });
      }
    }

    // Create Budgets sheet if missing
    if (!sheetNames.includes(SHEETS.BUDGETS)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: SHEETS.BUDGETS } } }],
        },
      });
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.BUDGETS}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['id', 'category_name', 'monthly_limit', 'alert_threshold', 'is_active', 'created_at']],
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to initialize sheets:', error);
    throw error;
  }
}

// ============ ACCOUNTS ============

async function fetchAccountsFromSheets() {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.ACCOUNTS}!A:F`,
    ...READ_OPTIONS,
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1).map(parseAccountRow);
}

export async function getAccounts(includeInactive = false) {
  let allAccounts = getCached('accounts');
  if (!allAccounts) {
    allAccounts = await fetchAccountsFromSheets();
    setCache('accounts', allAccounts);
  }

  return allAccounts
    .filter(account => includeInactive || account.is_active)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAccountById(id) {
  const accounts = await getAccounts(true);
  return accounts.find(a => a.id === parseInt(id)) || null;
}

export async function getAccountByName(name) {
  const accounts = await getAccounts(true);
  return accounts.find(a => a.name === name) || null;
}

export async function createAccount(data) {
  const sheets = await getSheets();
  const accounts = await getAccounts(true);

  // Check for duplicate name
  if (accounts.some(a => a.name === data.name)) {
    throw new Error(`Account with name '${data.name}' already exists`);
  }

  const newId = accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 1;
  const now = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.ACCOUNTS}!A:F`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        newId,
        data.name,
        data.account_type || 'checking',
        data.initial_balance || 0,
        true,
        now,
      ]],
    },
  });

  invalidateCache('accounts');

  return {
    id: newId,
    name: data.name,
    account_type: data.account_type || 'checking',
    initial_balance: data.initial_balance || 0,
    is_active: true,
    created_at: now,
  };
}

export async function initializeDefaultAccounts() {
  const defaultAccounts = [
    { name: 'Main Chequing', account_type: 'checking', initial_balance: 0 },
    { name: 'CIBC Rental', account_type: 'checking', initial_balance: 0 },
  ];

  const created = [];
  const existing = [];

  for (const acct of defaultAccounts) {
    const existingAccount = await getAccountByName(acct.name);
    if (existingAccount) {
      existing.push(acct.name);
    } else {
      await createAccount(acct);
      created.push(acct.name);
    }
  }

  return { created, existing };
}

// ============ TRANSACTIONS ============

// Returns every data row, including rows with parse errors.
async function fetchTransactionsFromSheets() {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.TRANSACTIONS}!A:K`,
    ...READ_OPTIONS,
  });

  const rows = response.data.values || [];
  const parsed = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;
    parsed.push(parseTransactionRow(row, i + 1));
  }
  return parsed;
}

async function getCachedTransactionRows() {
  let all = getCached('transactions');
  if (!all) {
    all = await fetchTransactionsFromSheets();
    setCache('transactions', all);
  }
  return all;
}

export async function getTransactions(filters = {}) {
  const all = (await getCachedTransactionRows()).filter(t => t.parse_error === null);

  // Categories come from every transaction, so the dropdown never shrinks with the filters or the page
  const categories = [...new Set(all.map(t => t.category).filter(Boolean))].sort();

  let transactions = all;

  // Apply filters
  if (filters.account_id) {
    transactions = transactions.filter(t => t.account_id === parseInt(filters.account_id));
  }
  if (filters.category) {
    transactions = transactions.filter(t => t.category === filters.category);
  }
  if (filters.type === 'income') {
    transactions = transactions.filter(t => t.amount > 0);
  } else if (filters.type === 'expense') {
    transactions = transactions.filter(t => t.amount < 0);
  }
  if (filters.start_date) {
    transactions = transactions.filter(t => t.date >= filters.start_date);
  }
  if (filters.end_date) {
    transactions = transactions.filter(t => t.date <= filters.end_date);
  }
  if (filters.search) {
    const term = filters.search.toLowerCase();
    transactions = transactions.filter(t => t.description.toLowerCase().includes(term));
  }

  // Sort by date descending
  transactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  // Enrich with account names
  const accounts = await getAccounts(true);
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a.name]));
  transactions = transactions.map(t => ({
    ...t,
    account_name: accountMap[t.account_id] || 'Unknown',
  }));

  // Pagination
  const skip = filters.skip || 0;
  const limit = filters.limit || 50;

  return {
    transactions: transactions.slice(skip, skip + limit),
    total: transactions.length,
    categories,
  };
}

// ============ SETTINGS / TENANTS / RECEIPTS TABS ============

const _confirmedTabs = new Set();

function colLetter(n) {
  return String.fromCharCode(64 + n);
}

// Creates the tab (with headers) when missing; writes headers if row 1 is empty.
// Never touches other rows. Memoized per process once confirmed.
export async function ensureTab(name, headers) {
  if (_confirmedTabs.has(name)) return;
  const sheets = await getSheets();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = spreadsheet.data.sheets.some(s => s.properties.title === name);
  const lastCol = colLetter(headers.length);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: name } } }] },
    });
  }
  const first = exists
    ? await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${name}!A1:${lastCol}1`,
      })
    : null;
  const cells = (first && first.data.values && first.data.values[0]) || [];
  if (cells.every(c => String(c ?? '').trim() === '')) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${name}!A1:${lastCol}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
  _confirmedTabs.add(name);
}

const SETTINGS_HEADERS = ['key', 'value'];

async function readTabRows(name, headers) {
  await ensureTab(name, headers);
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${name}!A:${colLetter(headers.length)}`,
    ...READ_OPTIONS,
  });
  return response.data.values || [];
}

export async function getSettings() {
  const cached = getCached('settings');
  if (cached) return cached;
  const rows = await readTabRows(SHEETS.SETTINGS, SETTINGS_HEADERS);
  const settings = {};
  for (const row of rows.slice(1)) {
    const key = row[0] === undefined || row[0] === null ? '' : String(row[0]).trim();
    if (!key) continue;
    settings[key] = row[1] === undefined || row[1] === null ? '' : String(row[1]);
  }
  setCache('settings', settings);
  return settings;
}

export async function setSetting(key, value) {
  const rows = await readTabRows(SHEETS.SETTINGS, SETTINGS_HEADERS);
  const sheets = await getSheets();
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] ?? '').trim() === key) rowIndex = i;
  }
  if (rowIndex >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SETTINGS}!B${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[String(value)]] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SETTINGS}!A:B`,
      valueInputOption: 'RAW',
      requestBody: { values: [[key, String(value)]] },
    });
  }
  invalidateCache('settings');
}

export async function getTenants() {
  const cached = getCached('tenants');
  if (cached) return cached;
  const rows = await readTabRows(SHEETS.TENANTS, TENANT_HEADERS);
  const tenants = rows.slice(1)
    .filter(r => r.some(c => String(c ?? '').trim() !== ''))
    .map(parseTenantRow);
  setCache('tenants', tenants);
  return tenants;
}

export async function saveTenant(t) {
  const reason = validateTenant(t);
  if (reason) throw new Error(`Invalid tenant: ${reason}`);

  const rows = await readTabRows(SHEETS.TENANTS, TENANT_HEADERS);
  const sheets = await getSheets();
  const ids = rows.slice(1).map(r => parseInt(r[0], 10)).filter(n => !Number.isNaN(n));
  const existingId = t.id ? Number(t.id) : null;
  const id = existingId || (ids.length ? Math.max(...ids) + 1 : 1);

  const values = [
    id,
    String(t.name).trim(),
    t.unit || '',
    Number(t.utility_share),
    t.utility_style,
    t.base_rent === null || t.base_rent === undefined || t.base_rent === '' ? '' : parseAmount(t.base_rent),
    t.separate_max === null || t.separate_max === undefined || t.separate_max === '' ? '' : parseAmount(t.separate_max),
    t.match_text || '',
    t.start_month || '',
    t.end_month || '',
    t.is_active === false ? false : true,
  ];

  let rowIndex = -1;
  if (existingId) {
    for (let i = 1; i < rows.length; i++) {
      if (parseInt(rows[i][0], 10) === existingId) rowIndex = i;
    }
    if (rowIndex < 0) throw new Error(`Invalid tenant: id ${existingId} not found`);
  }
  if (rowIndex >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.TENANTS}!A${rowIndex + 1}:${colLetter(TENANT_HEADERS.length)}${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.TENANTS}!A:${colLetter(TENANT_HEADERS.length)}`,
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });
  }
  invalidateCache('tenants');
  return parseTenantRow(values);
}

export async function getReceiptLinks() {
  const cached = getCached('receipts');
  if (cached) return cached;
  const rows = await readTabRows(SHEETS.RECEIPTS, RECEIPT_HEADERS);
  const links = rows.slice(1).map(parseReceiptRow).filter(l => l.drive_file_id);
  setCache('receipts', links);
  return links;
}

export async function linkReceipt(link) {
  const rows = await readTabRows(SHEETS.RECEIPTS, RECEIPT_HEADERS);
  const sheets = await getSheets();
  const values = [
    link.drive_file_id,
    link.file_name || '',
    link.mime_type || '',
    link.transaction_id,
    new Date().toISOString(),
  ];
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] ?? '').trim() === link.drive_file_id) rowIndex = i;
  }
  if (rowIndex >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.RECEIPTS}!A${rowIndex + 1}:E${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.RECEIPTS}!A:E`,
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });
  }
  invalidateCache('receipts');
  return parseReceiptRow(values);
}

// Clears transaction_id on the row; never deletes rows.
export async function unlinkReceipt(driveFileId) {
  const rows = await readTabRows(SHEETS.RECEIPTS, RECEIPT_HEADERS);
  const sheets = await getSheets();
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] ?? '').trim() === driveFileId) rowIndex = i;
  }
  if (rowIndex < 0) return false;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.RECEIPTS}!D${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['']] },
  });
  invalidateCache('receipts');
  return true;
}


export async function getAllTransactions() {
  return (await getCachedTransactionRows()).filter(t => t.parse_error === null);
}

export async function getParseIssues() {
  return (await getCachedTransactionRows()).filter(t => t.parse_error !== null);
}

export async function createTransactions(transactionsData) {
  const sheets = await getSheets();
  // Fresh read so ids never collide with rows added since the cache was filled.
  const existing = await fetchTransactionsFromSheets();

  const ids = existing.map(t => t.id).filter(id => id !== null);
  const firstId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  let nextId = firstId;
  const now = new Date().toISOString();

  const rows = transactionsData.map(t => [
    nextId++,
    t.account_id,
    t.date,
    t.description,
    t.amount,
    t.category || 'Uncategorized',
    t.is_verified || false,
    t.import_batch_id || '',
    now,
  ]);

  if (rows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.TRANSACTIONS}!A:I`,
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
  }

  invalidateCache('transactions');

  return { created: rows.length, first_id: firstId };
}

const FIELD_COLUMNS = { category: 'F', notes: 'J', tax_tag: 'K' };

export async function updateTransactionFields(id, fields) {
  const sheets = await getSheets();
  const targetId = parseInt(id);

  // Fresh read: row numbers must be current.
  const matches = (await fetchTransactionsFromSheets()).filter(t => t.id === targetId);
  if (matches.length === 0) throw new Error('Transaction not found');
  if (matches.length > 1) throw new Error('Duplicate transaction id');
  const row = matches[0];

  const data = Object.entries(FIELD_COLUMNS)
    .filter(([name]) => fields[name] !== undefined)
    .map(([name, col]) => ({
      range: `${SHEETS.TRANSACTIONS}!${col}${row.row_number}`,
      values: [[fields[name]]],
    }));

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data },
    });
  }

  invalidateCache('transactions');

  const updated = { ...row };
  for (const name of Object.keys(FIELD_COLUMNS)) {
    if (fields[name] !== undefined) updated[name] = fields[name];
  }
  return updated;
}

// ============ BUDGETS ============

async function fetchBudgetsFromSheets() {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.BUDGETS}!A:F`,
    ...READ_OPTIONS,
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1).map(row => ({
    id: parseInt(row[0]) || 0,
    category_name: row[1] === undefined || row[1] === null ? '' : String(row[1]),
    monthly_limit: parseAmount(row[2]) ?? 0,
    alert_threshold: parseAmount(row[3]) ?? 80,
    is_active: parseBool(row[4], true),
    created_at: row[5] === undefined || row[5] === null ? '' : String(row[5]),
  }));
}

export async function getBudgets() {
  let allBudgets = getCached('budgets');
  if (!allBudgets) {
    allBudgets = await fetchBudgetsFromSheets();
    setCache('budgets', allBudgets);
  }
  return allBudgets.filter(b => b.is_active);
}

export async function createBudget(data) {
  const sheets = await getSheets();
  const budgets = await getBudgets();

  const newId = budgets.length > 0 ? Math.max(...budgets.map(b => b.id)) + 1 : 1;
  const now = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.BUDGETS}!A:F`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        newId,
        data.category_name,
        data.monthly_limit,
        data.alert_threshold || 80,
        true,
        now,
      ]],
    },
  });

  invalidateCache('budgets');

  return {
    id: newId,
    ...data,
    is_active: true,
    created_at: now,
  };
}

// ============ ANALYTICS HELPERS ============

export async function calculateAccountBalance(accountId) {
  const account = await getAccountById(accountId);
  if (!account) return 0;

  const transactions = await getAllTransactions();
  const accountTransactions = transactions.filter(t => t.account_id === parseInt(accountId));

  const transactionSum = accountTransactions.reduce((sum, t) => sum + t.amount, 0);
  return account.initial_balance + transactionSum;
}

export async function getAccountsWithBalances() {
  const accounts = await getAccounts();
  const transactions = await getAllTransactions();

  return accounts.map(account => {
    const accountTransactions = transactions.filter(t => t.account_id === account.id);
    const transactionSum = accountTransactions.reduce((sum, t) => sum + t.amount, 0);
    return {
      ...account,
      current_balance: account.initial_balance + transactionSum,
    };
  });
}
