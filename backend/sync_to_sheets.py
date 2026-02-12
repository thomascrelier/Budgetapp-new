"""
Sync all data from SQLite database to Google Sheets.

Pushes accounts and transactions to match the schema expected by
budget-vercel/src/lib/sheets.js:
  Accounts:     id, name, account_type, initial_balance, is_active, created_at
  Transactions: id, account_id, date, description, amount, category, is_verified, import_batch_id, created_at
"""

import json
import sqlite3
import time

import gspread
from google.oauth2.service_account import Credentials

# Config
DB_PATH = "/Users/thomas.crelier/Desktop/Claude/Budget/backend/budgetcsv.db"
ENV_PATH = "/Users/thomas.crelier/Desktop/Claude/Budget/budget-vercel/.env.local"
SPREADSHEET_ID = "1R6WeQexEfvg5THbjfHRpXIXv5V1jdyAUp2pdIAPX5Xo"
BATCH_SIZE = 2000  # rows per API call (Sheets allows up to ~50k cells per request)


def get_sheets_client():
    """Authenticate and return gspread client + spreadsheet."""
    env_content = open(ENV_PATH).read()
    creds_str = env_content.split("GOOGLE_CREDENTIALS_JSON=", 1)[1].strip()
    creds_json = json.loads(creds_str)

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = Credentials.from_service_account_info(creds_json, scopes=scopes)
    client = gspread.authorize(creds)
    return client.open_by_key(SPREADSHEET_ID)


def sync_accounts(spreadsheet, cursor):
    """Clear and rewrite all accounts to the Accounts sheet."""
    print("\n--- Syncing Accounts ---")
    ws = spreadsheet.worksheet("Accounts")

    # Fetch all accounts from SQLite
    cursor.execute(
        "SELECT id, name, account_type, initial_balance, is_active, created_at FROM accounts ORDER BY id"
    )
    rows = cursor.fetchall()
    print(f"  Found {len(rows)} accounts in SQLite")

    # Build sheet data: header + rows
    header = ["id", "name", "account_type", "initial_balance", "is_active", "created_at"]
    data = [header]
    for row in rows:
        aid, name, atype, balance, is_active, created_at = row
        data.append([
            aid,
            name,
            atype,
            float(balance) if balance else 0,
            "TRUE" if is_active else "FALSE",
            created_at or "",
        ])

    # Clear existing data and write fresh
    ws.clear()
    ws.update(range_name="A1", values=data)
    print(f"  Wrote {len(data) - 1} accounts to Google Sheets")


def sync_transactions(spreadsheet, cursor):
    """Clear and rewrite all transactions to the Transactions sheet."""
    print("\n--- Syncing Transactions ---")
    ws = spreadsheet.worksheet("Transactions")

    # Fetch all transactions from SQLite
    cursor.execute(
        "SELECT id, account_id, date, description, amount, category, is_verified, import_batch_id, created_at "
        "FROM transactions ORDER BY date DESC, id DESC"
    )
    rows = cursor.fetchall()
    print(f"  Found {len(rows)} transactions in SQLite")

    # Build header
    header = ["id", "account_id", "date", "description", "amount", "category", "is_verified", "import_batch_id", "created_at"]

    # Resize sheet to fit all data (header + rows + buffer)
    needed_rows = len(rows) + 10
    if ws.row_count < needed_rows:
        print(f"  Expanding sheet from {ws.row_count} to {needed_rows} rows...")
        ws.resize(rows=needed_rows, cols=len(header))

    # Clear existing data
    ws.clear()

    # Write header first
    ws.update(range_name="A1", values=[header])

    # Write transactions in batches
    total_written = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        data = []
        for row in batch:
            tid, account_id, date_val, desc, amount, category, is_verified, batch_id, created_at = row
            data.append([
                tid,
                account_id,
                str(date_val),  # YYYY-MM-DD
                desc or "",
                float(amount),
                category or "Uncategorized",
                "true" if is_verified else "false",
                batch_id or "",
                created_at or "",
            ])

        # Write batch starting at the correct row (row 2 = first data row)
        start_row = 2 + i
        end_row = start_row + len(data) - 1
        num_cols = len(header)
        # Convert column count to letter (I = 9th column)
        end_col = chr(ord("A") + num_cols - 1)
        range_name = f"A{start_row}:{end_col}{end_row}"

        ws.update(range_name=range_name, values=data)
        total_written += len(data)
        print(f"  Wrote batch {i // BATCH_SIZE + 1}: rows {start_row}-{end_row} ({total_written}/{len(rows)} total)")

        # Small delay between batches to respect rate limits
        if i + BATCH_SIZE < len(rows):
            time.sleep(1)

    print(f"  Done: {total_written} transactions written to Google Sheets")


def main():
    print("Connecting to Google Sheets...")
    spreadsheet = get_sheets_client()
    print(f"Connected to: {spreadsheet.title}")

    print("Connecting to SQLite...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Verify counts
    cursor.execute("SELECT COUNT(*) FROM accounts")
    print(f"  Accounts in DB: {cursor.fetchone()[0]}")
    cursor.execute("SELECT COUNT(*) FROM transactions")
    print(f"  Transactions in DB: {cursor.fetchone()[0]}")

    sync_accounts(spreadsheet, cursor)
    sync_transactions(spreadsheet, cursor)

    conn.close()

    print("\n=== SYNC COMPLETE ===")
    print(f"Spreadsheet: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")


if __name__ == "__main__":
    main()
