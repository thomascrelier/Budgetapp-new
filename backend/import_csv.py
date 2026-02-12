"""
Import transactions from Mint CSV export into the BudgetCSV database.

CSV columns: Date, Description, Original Description, Amount, Transaction Type, Category, Account Name, Labels, Notes
DB schema:
  - accounts: id, name, account_type, initial_balance, is_active
  - transactions: id, account_id, date, description, amount (+income/-expense), category, is_verified, notes, import_batch_id
"""

import csv
import sqlite3
import uuid
from datetime import datetime

CSV_PATH = "/Users/thomas.crelier/Downloads/transactions.csv"
DB_PATH = "/Users/thomas.crelier/Desktop/Claude/Budget/backend/budgetcsv.db"

# Map account names to account types based on name keywords
def classify_account_type(name):
    name_lower = name.lower()
    if any(kw in name_lower for kw in ["visa", "mastercard", "amex", "american express", "credit card", "cash back"]):
        return "credit_card"
    if any(kw in name_lower for kw in ["savings", "save", "tfsa", "rrsp", "rsp", "gic", "lira", "registered"]):
        return "savings"
    if any(kw in name_lower for kw in ["investment", "margin", "individual"]):
        return "investment"
    return "checking"


def main():
    batch_id = str(uuid.uuid4())
    print(f"Import batch ID: {batch_id}")

    # Read CSV
    rows = []
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    print(f"Read {len(rows)} rows from CSV")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get existing accounts
    cursor.execute("SELECT id, name FROM accounts")
    existing_accounts = {name: aid for aid, name in cursor.fetchall()}
    print(f"Existing accounts: {len(existing_accounts)}")

    # Collect unique account names from CSV
    csv_account_names = set(row["Account Name"] for row in rows)
    print(f"Unique accounts in CSV: {len(csv_account_names)}")

    # Create missing accounts
    created = 0
    for acct_name in sorted(csv_account_names):
        if acct_name not in existing_accounts:
            acct_type = classify_account_type(acct_name)
            cursor.execute(
                "INSERT INTO accounts (name, account_type, initial_balance, is_active) VALUES (?, ?, 0.00, 1)",
                (acct_name, acct_type),
            )
            existing_accounts[acct_name] = cursor.lastrowid
            created += 1
            print(f"  Created account: {acct_name} ({acct_type}) -> id={existing_accounts[acct_name]}")
    print(f"Created {created} new accounts")

    # Import transactions
    inserted = 0
    skipped = 0
    errors = 0

    for i, row in enumerate(rows):
        try:
            # Parse date (MM/DD/YYYY -> date object)
            dt = datetime.strptime(row["Date"], "%m/%d/%Y").date()

            # Description: use "Original Description" for more detail, fallback to "Description"
            description = (row.get("Original Description") or row.get("Description", "")).strip()
            if not description:
                description = row.get("Description", "No description").strip()
            # Truncate to 500 chars (DB limit)
            description = description[:500]

            # Amount: CSV has positive values; sign determined by Transaction Type
            raw_amount = float(row["Amount"].replace(",", "").replace("$", ""))
            txn_type = row["Transaction Type"].strip().lower()

            # In the DB: positive = income, negative = expense
            if txn_type == "debit":
                amount = -abs(raw_amount)
            else:  # credit
                amount = abs(raw_amount)

            category = row.get("Category", "Uncategorized").strip() or "Uncategorized"
            account_name = row["Account Name"].strip()
            account_id = existing_accounts[account_name]
            notes = row.get("Notes", "").strip() or None

            cursor.execute(
                """INSERT INTO transactions
                   (account_id, date, description, amount, category, is_verified, notes, import_batch_id)
                   VALUES (?, ?, ?, ?, ?, 0, ?, ?)""",
                (account_id, dt.isoformat(), description, amount, category, notes, batch_id),
            )
            inserted += 1

        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  Error row {i+2}: {e} — {row}")

    conn.commit()

    # Verify
    cursor.execute("SELECT COUNT(*) FROM transactions WHERE import_batch_id = ?", (batch_id,))
    verified_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM transactions")
    total_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM accounts")
    total_accounts = cursor.fetchone()[0]

    print(f"\n--- IMPORT COMPLETE ---")
    print(f"Inserted:  {inserted}")
    print(f"Skipped:   {skipped}")
    print(f"Errors:    {errors}")
    print(f"Verified in DB (this batch): {verified_count}")
    print(f"Total transactions in DB:    {total_count}")
    print(f"Total accounts in DB:        {total_accounts}")
    print(f"Batch ID: {batch_id}")

    conn.close()


if __name__ == "__main__":
    main()
