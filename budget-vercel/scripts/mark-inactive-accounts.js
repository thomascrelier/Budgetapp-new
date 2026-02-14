/**
 * One-time script to mark unused accounts as inactive in Google Sheets.
 *
 * Keeps these 4 accounts active:
 *   - Main Chequing
 *   - CIBC Rental
 *   - Visa Credit Card
 *   - Rogers Mastercard
 *
 * All other accounts get is_active set to "false" (column E).
 *
 * Usage:
 *   cd budget-vercel
 *   DOTENV_CONFIG_PATH=.env.local node -r dotenv/config scripts/mark-inactive-accounts.js
 */

const { google } = require('googleapis');

const KEEP_ACTIVE = [
  'Main Chequing',
  'CIBC Rental',
  'Visa Credit Card',
  'Rogers Mastercard',
];

async function main() {
  // Read credentials from env
  const spreadsheetId = (process.env.GOOGLE_SPREADSHEET_ID || '').trim();
  const credentials = JSON.parse((process.env.GOOGLE_CREDENTIALS_JSON || '{}').trim());

  if (!spreadsheetId) {
    console.error('ERROR: GOOGLE_SPREADSHEET_ID is not set');
    process.exit(1);
  }
  if (!credentials.client_email) {
    console.error('ERROR: GOOGLE_CREDENTIALS_JSON is not set or invalid');
    process.exit(1);
  }

  // Authenticate
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Read the Accounts sheet (columns A:F)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Accounts!A:F',
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) {
    console.log('No account rows found (only header or empty sheet).');
    return;
  }

  const [headers, ...dataRows] = rows;
  console.log(`Found ${dataRows.length} account(s) in the sheet.\n`);

  // Collect updates for accounts that need to be deactivated
  const updates = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const name = row[1] || '';
    const currentIsActive = row[4];
    const sheetRow = i + 2; // +1 for 0-index, +1 for header row

    if (KEEP_ACTIVE.includes(name)) {
      console.log(`  KEEP ACTIVE:   "${name}" (row ${sheetRow}, is_active=${currentIsActive})`);
    } else {
      if (currentIsActive === 'false') {
        console.log(`  ALREADY INACTIVE: "${name}" (row ${sheetRow}, is_active=false)`);
      } else {
        console.log(`  MARK INACTIVE: "${name}" (row ${sheetRow}, is_active=${currentIsActive} -> false)`);
        updates.push({
          range: `Accounts!E${sheetRow}`,
          values: [['false']],
        });
      }
    }
  }

  console.log();

  if (updates.length === 0) {
    console.log('No changes needed. All non-keep accounts are already inactive.');
    return;
  }

  // Batch update all at once
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates,
    },
  });

  console.log(`Done. Updated ${updates.length} account(s) to is_active=false.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
