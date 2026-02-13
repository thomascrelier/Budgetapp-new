"""
Import CIBC Visa credit card transactions from CSV export.

Creates a "CIBC Visa" account (credit_card type), auto-categorizes transactions
using pattern-matching rules, and inserts all rows atomically.

CSV format: Date (YYYY-MM-DD), Description, Debit, Credit, Card# — no headers
"""

import csv
import sqlite3
import uuid
import shutil
from datetime import datetime


CSV_PATH = "/Users/thomas.crelier/Downloads/cibc (2).csv"
DB_PATH = "/Users/thomas.crelier/Desktop/Claude/Budget/backend/budgetcsv.db"

# --- Category Rules (case-insensitive, first match wins) ---

CATEGORY_RULES = [
    # Rental property
    ("BELL CANADA", "Internet"),
    ("HOME DEPOT", "Repairs & Maintenance"),

    # Groceries
    ("FRESHCO", "Groceries"),
    ("FARM BOY", "Groceries"),
    ("METRO ", "Groceries"),  # trailing space to avoid matching "AUCKLANDMETRO" etc.
    ("COSTCO", "Groceries"),
    ("365 MARKET", "Groceries"),
    ("WALMART", "Groceries"),

    # Dining
    ("BLONDIES PIZZA", "Dining"),
    ("DOMINOS", "Dining"),
    ("CAMPECHANO", "Dining"),
    ("TATSU SUSHI", "Dining"),
    ("STARBUCKS", "Dining"),
    ("DPRTMNT", "Dining"),
    ("PANAGO", "Dining"),

    # Transportation
    ("PETRO-CANADA", "Transportation"),
    ("UBER CANADA", "Transportation"),

    # Travel
    ("AIR CAN", "Travel"),

    # Healthcare
    ("SHOPPERS DRUG MART", "Healthcare"),
    ("PARK LAWN HEALTH", "Healthcare"),
    ("ANIMAL HOSPITAL", "Healthcare"),
    ("JODI ROUAH", "Healthcare"),

    # Utilities
    ("ROGERS", "Utilities"),

    # Insurance
    ("INTACT INSURANCE", "Insurance"),

    # Transfer (credit card payments)
    ("PAYMENT THANK YOU", "Transfer"),
    ("PAIEMENT MERCI", "Transfer"),

    # Shopping
    ("CANADIAN TIRE", "Shopping"),
    ("BANANA REPUBLIC", "Shopping"),
    ("SOCCER WORLD", "Shopping"),
    ("BONE & BISCUIT", "Shopping"),
]


def categorize(description):
    """Categorize a transaction based on description pattern matching."""
    desc_upper = description.upper()

    for pattern, category in CATEGORY_RULES:
        if pattern.upper() in desc_upper:
            return category

    return "Uncategorized"


def main():
    # Step 1: Backup
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = f"{DB_PATH}.backup-{timestamp}"
    shutil.copy2(DB_PATH, backup_path)
    print(f"Backup created: {backup_path}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Step 2: Delete existing CIBC Visa account + transactions (idempotent)
        cursor.execute("SELECT id FROM accounts WHERE name = ?", ("CIBC Visa",))
        row = cursor.fetchone()
        if row:
            account_id = row[0]
            cursor.execute("SELECT COUNT(*) FROM transactions WHERE account_id = ?", (account_id,))
            count = cursor.fetchone()[0]
            cursor.execute("DELETE FROM transactions WHERE account_id = ?", (account_id,))
            cursor.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
            print(f"Deleted existing 'CIBC Visa' account (id={account_id}): {count} transactions\n")
        else:
            print("No existing 'CIBC Visa' account found, creating fresh\n")

        # Step 3: Create account
        cursor.execute(
            "INSERT INTO accounts (name, account_type, initial_balance, is_active) VALUES (?, ?, 0.00, 1)",
            ("CIBC Visa", "credit_card"),
        )
        new_account_id = cursor.lastrowid
        print(f"Created account 'CIBC Visa' (id={new_account_id})\n")

        # Step 4 & 5: Parse CSV, categorize, and insert
        batch_id = str(uuid.uuid4())
        rows_imported = 0
        errors = 0
        category_counts = {}
        total_income = 0.0
        total_expense = 0.0
        uncategorized_rows = []

        with open(CSV_PATH, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            for row_num, row in enumerate(reader, start=1):
                try:
                    if len(row) < 4:
                        print(f"  Warning: row {row_num} has {len(row)} columns, skipping: {row}")
                        errors += 1
                        continue

                    date_str = row[0].strip()
                    description = row[1].strip()
                    debit_str = row[2].strip()
                    credit_str = row[3].strip()
                    # row[4] is card number — ignored

                    # Parse date
                    dt = datetime.strptime(date_str, "%Y-%m-%d").date()

                    # Parse amounts: positive = payment/refund, negative = purchase
                    debit = float(debit_str.replace(",", "")) if debit_str else 0.0
                    credit = float(credit_str.replace(",", "")) if credit_str else 0.0
                    amount = credit - debit

                    # Categorize
                    category = categorize(description)

                    # Track
                    category_counts[category] = category_counts.get(category, 0) + 1
                    if amount > 0:
                        total_income += amount
                    else:
                        total_expense += amount

                    if category == "Uncategorized":
                        uncategorized_rows.append((row_num, date_str, description, amount))

                    # Insert
                    cursor.execute(
                        """INSERT INTO transactions
                           (account_id, date, description, amount, category, is_verified, notes, import_batch_id)
                           VALUES (?, ?, ?, ?, ?, 0, NULL, ?)""",
                        (new_account_id, dt.isoformat(), description, round(amount, 2), category, batch_id),
                    )
                    rows_imported += 1

                except Exception as e:
                    errors += 1
                    if errors <= 10:
                        print(f"  Error row {row_num}: {e} — {row}")

        # Step 7: Print import results
        print(f"--- IMPORT RESULTS ---")
        print(f"Rows imported: {rows_imported}")
        print(f"Errors: {errors}")
        print(f"Batch ID: {batch_id}")
        print(f"\nTotal income (payments/refunds):  ${total_income:,.2f}")
        print(f"Total expense (purchases):        ${total_expense:,.2f}")
        print(f"Net:                              ${total_income + total_expense:,.2f}")

        print(f"\nCategory breakdown:")
        for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
            print(f"  {cat:25s} {count:4d}")

        if uncategorized_rows:
            print(f"\n--- UNCATEGORIZED ({len(uncategorized_rows)} rows) ---")
            for row_num, date_str, desc, amt in uncategorized_rows:
                print(f"  Row {row_num}: {date_str} | {desc[:60]:60s} | ${amt:>10,.2f}")

        # Step 8: Commit atomically
        conn.commit()
        print(f"\nAll changes committed successfully.")

        # Final verification
        cursor.execute(
            "SELECT COUNT(*) FROM transactions WHERE account_id = ?", (new_account_id,)
        )
        final_count = cursor.fetchone()[0]
        print(f"Verification: CIBC Visa now has {final_count} transactions")

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        print(f"All changes rolled back. Database unchanged.")
        print(f"Backup available at: {backup_path}")
        raise

    finally:
        conn.close()


if __name__ == "__main__":
    main()
