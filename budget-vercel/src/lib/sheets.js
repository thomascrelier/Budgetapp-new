import { google } from 'googleapis';

// Google Sheets configuration
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

// Sheet names
const SHEETS = {
  ACCOUNTS: 'Accounts',
  TRANSACTIONS: 'Transactions',
  BUDGETS: 'Budgets',
};

// Get authenticated Google Sheets client
async function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '{}');

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
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
          values: [['id', 'account_id', 'date', 'description', 'amount', 'category', 'is_verified', 'import_batch_id', 'created_at']],
        },
      });
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

export async function getAccounts(includeInactive = false) {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.ACCOUNTS}!A:F`,
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return [];

  const [headers, ...data] = rows;

  return data
    .map(row => ({
      id: parseInt(row[0]) || 0,
      name: row[1] || '',
      account_type: row[2] || 'checking',
      initial_balance: parseFloat(row[3]) || 0,
      is_active: row[4] !== 'false',
      created_at: row[5] || new Date().toISOString(),
    }))
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
    { name: 'Rental Property', account_type: 'checking', initial_balance: 0 },
    { name: 'Visa Credit Card', account_type: 'credit_card', initial_balance: 0 },
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

export async function getTransactions(filters = {}) {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.TRANSACTIONS}!A:I`,
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return { transactions: [], total: 0 };

  const [headers, ...data] = rows;

  let transactions = data.map((row, index) => ({
    id: parseInt(row[0]) || index + 1,
    account_id: parseInt(row[1]) || 0,
    date: row[2] || '',
    description: row[3] || '',
    amount: parseFloat(row[4]) || 0,
    category: row[5] || 'Uncategorized',
    is_verified: row[6] === 'true',
    import_batch_id: row[7] || '',
    created_at: row[8] || '',
  }));

  // Apply filters
  if (filters.account_id) {
    transactions = transactions.filter(t => t.account_id === parseInt(filters.account_id));
  }
  if (filters.category) {
    transactions = transactions.filter(t => t.category === filters.category);
  }
  if (filters.start_date) {
    transactions = transactions.filter(t => t.date >= filters.start_date);
  }
  if (filters.end_date) {
    transactions = transactions.filter(t => t.date <= filters.end_date);
  }

  // Sort by date descending
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  // Pagination
  const skip = filters.skip || 0;
  const limit = filters.limit || 50;

  return {
    transactions: transactions.slice(skip, skip + limit),
    total: transactions.length,
  };
}

export async function getAllTransactions() {
  const { transactions } = await getTransactions({ limit: 100000 });
  return transactions;
}

export async function createTransactions(transactionsData) {
  const sheets = await getSheets();
  const existing = await getAllTransactions();

  let nextId = existing.length > 0 ? Math.max(...existing.map(t => t.id)) + 1 : 1;
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

  return rows.length;
}

export async function updateTransactionCategory(id, category) {
  const sheets = await getSheets();

  // Find the row index
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.TRANSACTIONS}!A:I`,
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row, i) => i > 0 && parseInt(row[0]) === parseInt(id));

  if (rowIndex === -1) {
    throw new Error('Transaction not found');
  }

  // Update the category (column F = index 5)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.TRANSACTIONS}!F${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[category]] },
  });

  return { success: true };
}

// ============ BUDGETS ============

export async function getBudgets() {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.BUDGETS}!A:F`,
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return [];

  const [headers, ...data] = rows;

  return data
    .map(row => ({
      id: parseInt(row[0]) || 0,
      category_name: row[1] || '',
      monthly_limit: parseFloat(row[2]) || 0,
      alert_threshold: parseFloat(row[3]) || 80,
      is_active: row[4] !== 'false',
      created_at: row[5] || '',
    }))
    .filter(b => b.is_active);
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
