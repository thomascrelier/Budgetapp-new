/**
 * Import rental property transactions from CIBC CSV into Google Sheets and SQLite.
 *
 * Usage:
 *   node budget-vercel/scripts/import-rental-csv.mjs [--dry-run]
 *
 * Reads ~/Downloads/Rental property newest transactions.csv
 * Deduplicates against existing CIBC Rental transactions in Google Sheets.
 * Appends new rows to Sheets and SQLite.
 * Re-categorizes any existing "Income" entries on CIBC Rental to "Rental Income".
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { createRequire } from 'module';
import dotenv from 'dotenv';

// better-sqlite3 is installed locally (npm install better-sqlite3) but not in package.json
// to avoid breaking Vercel builds with native modules
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const ENV_PATH = resolve(__dirname, '../.env.local');
const CSV_PATH = resolve(process.env.HOME, 'Downloads/Rental property newest transactions.csv');
const DB_PATH = resolve(PROJECT_ROOT, 'backend/budgetcsv.db');

const DRY_RUN = process.argv.includes('--dry-run');

// Load env
dotenv.config({ path: ENV_PATH });
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID?.trim();
const CREDENTIALS = JSON.parse((process.env.GOOGLE_CREDENTIALS_JSON || '{}').trim());

// ============ Category Rules ============

const CATEGORY_RULES = [
  ['MORTGAGE PAYMENT', 'Mortgage'],
  ['Hydro One', 'Electricity'],
  ['ENBRIDGE', 'Gas'],
  ['Tax Pmt Town of Caledon', 'Property Tax'],
  ['CALEDON TAX', 'Property Tax'],
  ['REGIONOFPEEL EZ PAY', 'Water'],
  ['PEEL (REGION OF) WATER', 'Water'],
  ['SERVICE CHARGE', 'Fees & Charges'],
  ['CRA (REVENUE', 'Income Tax'],

  ['Bobby HVAC', 'Repairs & Maintenance'],
  ['Josh Carnackie', 'Repairs & Maintenance'],
  ['alex all mighty', 'Repairs & Maintenance'],
  ['Adam Apex', 'Repairs & Maintenance'],
  ['Deborah hall', 'Repairs & Maintenance'],
  ['One-time contact', 'Repairs & Maintenance'],
  ['HOME DEPOT', 'Repairs & Maintenance'],

  ['mike construction', 'Renovations'],
  ['Kosta Electri', 'Renovations'],
  ['matt Bove', 'Renovations'],
  ['Jessica kitchen', 'Renovations'],
  ['Permit Works', 'Renovations'],
  ['angelo window', 'Renovations'],
  ['Jeff Lucky', 'Renovations'],
  ['Adam Energy', 'Renovations'],

  ['MARIUSZ', 'Other'],
  ['Maria Crelier', 'Transfers & Payments'],
  ['THOMAS CRELIER', 'Transfers & Payments'],
  ['KPMG', 'Other'],
  ['Auto Parts Settlement', 'Other'],
  ['OPTICAL DISC DRIVE', 'Other'],

  ['AMERICAN EXPRESS', 'Transfers & Payments'],
  ['MASTERCARD, ROGERS', 'Transfers & Payments'],
  ['INTERNET TRANSFER', 'Transfers & Payments'],
  ['INTERNET DEPOSIT', 'Transfers & Payments'],
  ['INTERNET BILL PAY', 'Transfers & Payments'],
  ['ATM', 'Transfers & Payments'],
  ['CIBC-NGIC', 'Transfers & Payments'],
  ['E-TRANSFER STOP', 'Fees & Charges'],
];

function categorize(description, amount) {
  const descUpper = description.toUpperCase();
  for (const [pattern, category] of CATEGORY_RULES) {
    if (descUpper.includes(pattern.toUpperCase())) {
      return category;
    }
  }
  if (descUpper.includes('E-TRANSFER')) {
    return amount > 0 ? 'Rental Income' : 'Transfers & Payments';
  }
  return 'Uncategorized';
}

// ============ CSV Parsing ============

function parseCSV(path) {
  const content = readFileSync(path, 'utf-8');
  const rows = [];
  // Simple CSV parser that handles quoted fields
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    if (fields.length < 4) continue;

    const date = fields[0];
    const description = fields[1];
    const debit = fields[2] ? parseFloat(fields[2].replace(/,/g, '')) : 0;
    const credit = fields[3] ? parseFloat(fields[3].replace(/,/g, '')) : 0;
    const amount = Math.round((credit - debit) * 100) / 100;
    const category = categorize(description, amount);

    rows.push({ date, description, amount, category });
  }
  return rows;
}

// ============ Google Sheets ============

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function getExistingTransactions(sheets) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Transactions!A:I',
  });
  const rows = response.data.values || [];
  if (rows.length <= 1) return { transactions: [], nextId: 1 };

  const [, ...data] = rows;
  const transactions = data.map(row => ({
    id: parseInt(row[0]) || 0,
    account_id: parseInt(row[1]) || 0,
    date: row[2] || '',
    description: row[3] || '',
    amount: parseFloat(row[4]) || 0,
    category: row[5] || 'Uncategorized',
    rowIndex: 0,
  }));

  const maxId = Math.max(0, ...transactions.map(t => t.id));
  return { transactions, nextId: maxId + 1 };
}

async function getRentalAccountId(sheets) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Accounts!A:F',
  });
  const rows = response.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === 'CIBC Rental') {
      return parseInt(rows[i][0]);
    }
  }
  throw new Error('CIBC Rental account not found in Sheets');
}

async function recategorizeIncomeInSheets(sheets, accountId) {
  // Find all rows where account_id matches and category is "Income", change to "Rental Income"
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Transactions!A:I',
  });
  const rows = response.data.values || [];
  let count = 0;
  const updates = [];

  for (let i = 1; i < rows.length; i++) {
    const rowAccountId = parseInt(rows[i][1]) || 0;
    const category = rows[i][5] || '';
    if (rowAccountId === accountId && category === 'Income') {
      updates.push({
        range: `Transactions!F${i + 1}`,
        values: [['Rental Income']],
      });
      count++;
    }
  }

  if (updates.length > 0 && !DRY_RUN) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    });
  }

  return count;
}

// ============ Main ============

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== IMPORTING ===');
  console.log(`CSV: ${CSV_PATH}`);
  console.log(`DB:  ${DB_PATH}`);
  console.log();

  // Parse CSV
  const csvRows = parseCSV(CSV_PATH);
  console.log(`Parsed ${csvRows.length} rows from CSV`);

  // Connect to Google Sheets
  const sheets = await getSheetsClient();
  const accountId = await getRentalAccountId(sheets);
  console.log(`CIBC Rental account ID: ${accountId}`);

  // Get existing transactions for dedup
  const { transactions: existing, nextId } = await getExistingTransactions(sheets);
  const rentalExisting = existing.filter(t => t.account_id === accountId);
  console.log(`Existing rental transactions in Sheets: ${rentalExisting.length}`);

  // Build dedup set: (date, description, amount)
  const dedupSet = new Set(
    rentalExisting.map(t => `${t.date}|${t.description}|${t.amount}`)
  );

  // Find new rows
  const newRows = [];
  const dupes = [];
  for (const row of csvRows) {
    const key = `${row.date}|${row.description}|${row.amount}`;
    if (dedupSet.has(key)) {
      dupes.push(row);
    } else {
      newRows.push(row);
    }
  }

  console.log(`\nNew rows to import: ${newRows.length}`);
  console.log(`Duplicates skipped: ${dupes.length}`);

  // Category breakdown
  const catCounts = {};
  for (const row of newRows) {
    catCounts[row.category] = (catCounts[row.category] || 0) + 1;
  }
  console.log('\nCategory breakdown (new rows):');
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(25)} ${count}`);
  }

  // Check uncategorized
  const uncategorized = newRows.filter(r => r.category === 'Uncategorized');
  if (uncategorized.length > 0) {
    console.log(`\nUncategorized (${uncategorized.length}):`);
    for (const r of uncategorized) {
      console.log(`  ${r.date} | ${r.description.substring(0, 60).padEnd(60)} | $${r.amount.toFixed(2)}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n=== DRY RUN COMPLETE — no changes written ===');

    // Still check re-categorization count
    const recatCount = await recategorizeIncomeInSheets(sheets, accountId);
    console.log(`Would re-categorize ${recatCount} "Income" → "Rental Income" entries in Sheets`);
    return;
  }

  // === WRITE TO GOOGLE SHEETS ===
  if (newRows.length > 0) {
    let currentId = nextId;
    const now = new Date().toISOString();
    const batchId = `csv-import-${Date.now()}`;

    const sheetRows = newRows.map(row => [
      currentId++,
      accountId,
      row.date,
      row.description,
      row.amount,
      row.category,
      false,
      batchId,
      now,
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Transactions!A:I',
      valueInputOption: 'RAW',
      requestBody: { values: sheetRows },
    });

    console.log(`\nAppended ${sheetRows.length} rows to Google Sheets`);
  }

  // === RE-CATEGORIZE "Income" → "Rental Income" in Sheets ===
  const recatSheetsCount = await recategorizeIncomeInSheets(sheets, accountId);
  console.log(`Re-categorized ${recatSheetsCount} "Income" → "Rental Income" entries in Sheets`);

  // === WRITE TO SQLITE ===
  const db = new Database(DB_PATH);
  try {
    // Find or verify CIBC Rental account in SQLite
    let sqliteAccountId;
    const acctRow = db.prepare("SELECT id FROM accounts WHERE name = 'CIBC Rental'").get();
    if (acctRow) {
      sqliteAccountId = acctRow.id;
    } else {
      const insert = db.prepare(
        "INSERT INTO accounts (name, account_type, initial_balance, is_active) VALUES (?, ?, 0.00, 1)"
      );
      const result = insert.run('CIBC Rental', 'checking');
      sqliteAccountId = result.lastInsertRowid;
      console.log(`Created CIBC Rental in SQLite (id=${sqliteAccountId})`);
    }

    // Dedup against SQLite too
    const existingSqlite = db.prepare(
      "SELECT date, description, amount FROM transactions WHERE account_id = ?"
    ).all(sqliteAccountId);
    const sqliteDedupSet = new Set(
      existingSqlite.map(t => `${t.date}|${t.description}|${t.amount}`)
    );

    const batchId = `csv-import-${Date.now()}`;
    const insertStmt = db.prepare(
      `INSERT INTO transactions (account_id, date, description, amount, category, is_verified, notes, import_batch_id)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`
    );

    const insertMany = db.transaction((rows) => {
      let count = 0;
      for (const row of rows) {
        const key = `${row.date}|${row.description}|${row.amount}`;
        if (sqliteDedupSet.has(key)) continue;
        insertStmt.run(sqliteAccountId, row.date, row.description, row.amount, row.category, batchId);
        count++;
      }
      return count;
    });

    const sqliteCount = insertMany(newRows);
    console.log(`Inserted ${sqliteCount} rows into SQLite`);

    // Re-categorize "Income" → "Rental Income" in SQLite
    const recatStmt = db.prepare(
      "UPDATE transactions SET category = 'Rental Income' WHERE account_id = ? AND category = 'Income'"
    );
    const recatResult = recatStmt.run(sqliteAccountId);
    console.log(`Re-categorized ${recatResult.changes} "Income" → "Rental Income" entries in SQLite`);
  } finally {
    db.close();
  }

  console.log('\n=== IMPORT COMPLETE ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
