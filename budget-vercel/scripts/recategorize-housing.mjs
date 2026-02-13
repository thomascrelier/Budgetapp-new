/**
 * One-time migration: Split "Housing" category into "Mortgage" and "Repairs & Maintenance"
 *
 * - MORTGAGE PAYMENT transactions → "Mortgage"
 * - All other Housing transactions (contractors) → "Repairs & Maintenance"
 *
 * Usage:
 *   node budget-vercel/scripts/recategorize-housing.mjs [--dry-run]
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, '../.env.local');
const DRY_RUN = process.argv.includes('--dry-run');

dotenv.config({ path: ENV_PATH });
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID?.trim();
const CREDENTIALS = JSON.parse((process.env.GOOGLE_CREDENTIALS_JSON || '{}').trim());

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== MIGRATING ===');

  const auth = new google.auth.GoogleAuth({
    credentials: CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Find CIBC Rental account ID
  const acctResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Accounts!A:F',
  });
  const acctRows = acctResponse.data.values || [];
  let rentalAccountId = null;
  for (let i = 1; i < acctRows.length; i++) {
    if (acctRows[i][1] === 'CIBC Rental') {
      rentalAccountId = acctRows[i][0];
      break;
    }
  }
  if (!rentalAccountId) {
    console.error('CIBC Rental account not found');
    process.exit(1);
  }
  console.log(`CIBC Rental account ID: ${rentalAccountId}`);

  // Get all transactions
  const txnResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Transactions!A:I',
  });
  const rows = txnResponse.data.values || [];
  console.log(`Total rows in sheet: ${rows.length - 1}`);

  // Find Housing transactions for CIBC Rental and split them
  const mortgageUpdates = [];
  const repairsUpdates = [];

  for (let i = 1; i < rows.length; i++) {
    const accountId = rows[i][1];
    const description = rows[i][3] || '';
    const category = rows[i][5] || '';

    if (accountId !== rentalAccountId || category !== 'Housing') continue;

    const sheetRow = i + 1; // 1-indexed, +1 for header
    if (description.toUpperCase().includes('MORTGAGE PAYMENT')) {
      mortgageUpdates.push({
        range: `Transactions!F${sheetRow}`,
        values: [['Mortgage']],
      });
    } else {
      repairsUpdates.push({
        range: `Transactions!F${sheetRow}`,
        values: [['Repairs & Maintenance']],
      });
    }
  }

  console.log(`\nHousing → Mortgage: ${mortgageUpdates.length} transactions`);
  console.log(`Housing → Repairs & Maintenance: ${repairsUpdates.length} transactions`);

  if (DRY_RUN) {
    console.log('\n=== DRY RUN COMPLETE — no changes written ===');
    return;
  }

  const allUpdates = [...mortgageUpdates, ...repairsUpdates];
  if (allUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: allUpdates,
      },
    });
    console.log(`\nUpdated ${allUpdates.length} transactions in Google Sheets`);
  }

  console.log('\n=== MIGRATION COMPLETE ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
