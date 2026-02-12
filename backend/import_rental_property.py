"""
Import rental property transactions from CIBC CSV export.

Consolidates 3 fragmented rental property accounts into one clean "CIBC Rental" account,
auto-categorizes all transactions, and re-categorizes scattered rental-related transactions
in other accounts for consistency.

CSV format: Date (YYYY-MM-DD), Description, Debit, Credit — no headers
"""

import csv
import sqlite3
import uuid
import shutil
from datetime import datetime
from pathlib import Path

CSV_PATH = "/Users/thomas.crelier/Downloads/Rental property newest transactions.csv"
DB_PATH = "/Users/thomas.crelier/Desktop/Claude/Budget/backend/budgetcsv.db"

# --- Category Rules ---

# Specific description patterns (checked first, case-insensitive)
CATEGORY_RULES = [
    # Utilities & recurring
    ("MORTGAGE PAYMENT", "Housing"),
    ("Hydro One", "Electricity"),
    ("ENBRIDGE", "Gas"),
    ("Tax Pmt Town of Caledon", "Property Tax"),
    ("CALEDON TAX", "Property Tax"),
    ("REGIONOFPEEL EZ PAY", "Water"),
    ("PEEL (REGION OF) WATER", "Water"),
    ("SERVICE CHARGE", "Fees & Charges"),
    ("CRA (REVENUE", "Income Tax"),

    # Maintenance & repairs
    ("Bobby HVAC", "Housing"),
    ("Josh Carnackie", "Housing"),
    ("alex all mighty", "Housing"),
    ("Adam Apex", "Housing"),
    ("Deborah hall", "Housing"),
    ("One-time contact", "Housing"),

    # Renovation contractors
    ("mike construction", "Renovations"),
    ("Kosta Electri", "Renovations"),
    ("matt Bove", "Renovations"),
    ("Jessica kitchen", "Renovations"),
    ("Permit Works", "Renovations"),
    ("angelo window", "Renovations"),
    ("Jeff Lucky", "Renovations"),
    ("Adam Energy", "Renovations"),

    # People / transfers
    ("MARIUSZ", "Other"),
    ("Maria Crelier", "Transfers & Payments"),
    ("THOMAS CRELIER", "Transfers & Payments"),

    # Financial transfers
    ("AMERICAN EXPRESS", "Transfers & Payments"),
    ("MASTERCARD, ROGERS", "Transfers & Payments"),
    ("INTERNET TRANSFER", "Transfers & Payments"),
    ("INTERNET DEPOSIT", "Transfers & Payments"),
    ("INTERNET BILL PAY", "Transfers & Payments"),
    ("ATM", "Transfers & Payments"),
    ("CIBC-NGIC", "Transfers & Payments"),
    ("E-TRANSFER STOP", "Fees & Charges"),
]


def categorize(description, amount):
    """Categorize a transaction based on description and amount."""
    desc_upper = description.upper()

    for pattern, category in CATEGORY_RULES:
        if pattern.upper() in desc_upper:
            return category

    # E-TRANSFER fallback: income if credit, transfers if debit
    if "E-TRANSFER" in desc_upper:
        return "Income" if amount > 0 else "Transfers & Payments"

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
        # Step 2: Delete old fragmented accounts
        old_accounts = ["CIBC Rental", "Rental Property", "Rental property"]
        total_deleted = 0
        for name in old_accounts:
            cursor.execute("SELECT id FROM accounts WHERE name = ?", (name,))
            row = cursor.fetchone()
            if row:
                account_id = row[0]
                cursor.execute("SELECT COUNT(*) FROM transactions WHERE account_id = ?", (account_id,))
                count = cursor.fetchone()[0]
                cursor.execute("DELETE FROM transactions WHERE account_id = ?", (account_id,))
                cursor.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
                total_deleted += count
                print(f"  Deleted account '{name}' (id={account_id}): {count} transactions")
            else:
                print(f"  Account '{name}' not found, skipping")

        print(f"Total deleted: {total_deleted} transactions\n")

        # Step 3: Create clean account
        cursor.execute(
            "INSERT INTO accounts (name, account_type, initial_balance, is_active) VALUES (?, ?, 0.00, 1)",
            ("CIBC Rental", "checking"),
        )
        new_account_id = cursor.lastrowid
        print(f"Created account 'CIBC Rental' (id={new_account_id})\n")

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

                    # Parse date
                    dt = datetime.strptime(date_str, "%Y-%m-%d").date()

                    # Parse amounts
                    debit = float(debit_str.replace(",", "")) if debit_str else 0.0
                    credit = float(credit_str.replace(",", "")) if credit_str else 0.0
                    amount = credit - debit  # positive = income, negative = expense

                    # Categorize
                    category = categorize(description, amount)

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

        print(f"--- IMPORT RESULTS ---")
        print(f"Rows imported: {rows_imported}")
        print(f"Errors: {errors}")
        print(f"Batch ID: {batch_id}")
        print(f"\nTotal income:  ${total_income:,.2f}")
        print(f"Total expense: ${total_expense:,.2f}")
        print(f"Net:           ${total_income + total_expense:,.2f}")

        print(f"\nCategory breakdown:")
        for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
            print(f"  {cat:25s} {count:4d}")

        if uncategorized_rows:
            print(f"\n--- UNCATEGORIZED ({len(uncategorized_rows)} rows) ---")
            for row_num, date_str, desc, amt in uncategorized_rows:
                print(f"  Row {row_num}: {date_str} | {desc[:60]:60s} | ${amt:>10,.2f}")

        # Step 6: Re-categorize transactions in other accounts
        print(f"\n--- RE-CATEGORIZING OTHER ACCOUNTS ---")
        recategorize_count = 0

        # Renovation contractors across all accounts (except new CIBC Rental)
        renovation_patterns = [
            "mike construction",
            "Kosta Electri",
            "angelo window",
            "Brett McCullough",
            "Aetna Glass",
        ]
        for pattern in renovation_patterns:
            cursor.execute(
                """UPDATE transactions SET category = 'Renovations'
                   WHERE UPPER(description) LIKE ? AND account_id != ? AND category != 'Renovations'""",
                (f"%{pattern.upper()}%", new_account_id),
            )
            updated = cursor.rowcount
            if updated:
                recategorize_count += updated
                print(f"  '{pattern}' → Renovations: {updated} transactions")

        # Bobby HVAC → Housing (across all accounts except new)
        cursor.execute(
            """UPDATE transactions SET category = 'Housing'
               WHERE UPPER(description) LIKE '%BOBBY HVAC%' AND account_id != ? AND category != 'Housing'""",
            (new_account_id,),
        )
        updated = cursor.rowcount
        if updated:
            recategorize_count += updated
            print(f"  'Bobby HVAC' → Housing: {updated} transactions")

        # Other 1 HOUSE: Utilities & Bills with PEEL → Water
        cursor.execute(
            """UPDATE transactions SET category = 'Water'
               WHERE account_id = 18 AND category = 'Utilities & Bills'
               AND UPPER(description) LIKE '%PEEL%'""",
        )
        updated = cursor.rowcount
        if updated:
            recategorize_count += updated
            print(f"  'Other 1 HOUSE' PEEL Utilities & Bills → Water: {updated} transactions")

        print(f"Total re-categorized: {recategorize_count}")

        # Step 8: Commit
        conn.commit()
        print(f"\nAll changes committed successfully.")

        # Final verification
        cursor.execute(
            "SELECT COUNT(*) FROM transactions WHERE account_id = ?", (new_account_id,)
        )
        final_count = cursor.fetchone()[0]
        print(f"Verification: CIBC Rental now has {final_count} transactions")

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
