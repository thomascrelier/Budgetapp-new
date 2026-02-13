"""
Import Main Chequing transactions from CIBC CSV export.

Consolidates 3 fragmented chequing accounts ("Main Chequing", "Chequing", "Main")
into one clean "Main Chequing" account:
  1. Moves pre-2020 transactions from "Chequing" to "Main Chequing" (preserves old history)
  2. Deletes "Chequing" and "Main" accounts + their remaining transactions
  3. Imports all CSV rows into "Main Chequing"
  4. Auto-categorizes both imported and moved transactions

CSV format: Date (YYYY-MM-DD), Description, Debit, Credit — no headers
"""

import csv
import sqlite3
import uuid
import shutil
from datetime import datetime


CSV_PATH = "/Users/thomas.crelier/Downloads/CIBC Main account.csv"
DB_PATH = "/Users/thomas.crelier/Desktop/Claude/Budget/backend/budgetcsv.db"

# --- Category Rules (case-insensitive, first match wins) ---

CATEGORY_RULES = [
    # Income
    ("CLUTCH CANADA", "Income"),
    ("XERO SOFTWARE", "Income"),
    ("ADMIN BY CL", "Income"),
    ("CANADA LIFE", "Income"),
    ("WAGE/SALARY", "Income"),
    ("DEPOSIT CANADA", "Income"),
    ("Remise carbone", "Income"),
    ("CarbonRebate", "Income"),
    ("Cashback", "Income"),
    ("Cash Back", "Income"),
    ("DEPOSIT Tangerine", "Transfer"),

    # Housing
    ("MORTGAGE PAYMENT", "Mortgage"),

    # Debt
    ("SCOTIA BANK - SPL LOAN", "Debt Payment"),

    # Investments
    ("Wealthsimple", "Investments"),
    ("Shareowner", "Investments"),

    # Transfers
    ("MASTERCARD, ROGERS", "Transfer"),
    ("ROGERS BANK", "Transfer"),
    ("INTERNET TRANSFER", "Transfer"),
    ("AMERICAN EXPRESS", "Transfer"),
    ("CIBC VISA", "Transfer"),
    ("CIBC-NGIC", "Transfer"),

    # Utilities
    ("TORONTO HYDRO", "Utilities"),

    # Fees
    ("SERVICE CHARGE", "Fees & Charges"),
    ("MONTHLY FEE", "Fees & Charges"),
    ("NETWORK TRANSACTION FEE", "Fees & Charges"),
    ("NON-SUFFICIENT FUNDS", "Fees & Charges"),
    ("OVERDRAFT", "Fees & Charges"),

    # ATM
    ("ATM WITHDRAWAL", "Transfer"),
    ("ATM-INTERNATIONAL FEE", "Fees & Charges"),
]


def categorize(description):
    """Categorize a transaction based on description pattern matching."""
    desc_upper = description.upper()

    for pattern, category in CATEGORY_RULES:
        if pattern.upper() in desc_upper:
            return category

    return "Uncategorized"


def lookup_account(cursor, name):
    """Look up an account by name, return (id, name) or None."""
    cursor.execute("SELECT id FROM accounts WHERE name = ?", (name,))
    row = cursor.fetchone()
    return row[0] if row else None


def main():
    # Step 1: Backup
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = f"{DB_PATH}.backup-{timestamp}"
    shutil.copy2(DB_PATH, backup_path)
    print(f"Backup created: {backup_path}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # --- Look up account IDs dynamically ---
        main_chequing_id = lookup_account(cursor, "Main Chequing")
        chequing_id = lookup_account(cursor, "Chequing")
        main_id = lookup_account(cursor, "Main")

        print(f"\nAccount lookup:")
        print(f"  Main Chequing: id={main_chequing_id}")
        print(f"  Chequing:      id={chequing_id}")
        print(f"  Main:          id={main_id}")

        if main_chequing_id is None:
            raise RuntimeError("'Main Chequing' account not found in database")

        # --- Step 2: Move pre-2020 transactions from "Chequing" to "Main Chequing" ---
        moved_count = 0
        if chequing_id is not None:
            cursor.execute(
                "SELECT COUNT(*) FROM transactions WHERE account_id = ? AND date < '2020-12-01'",
                (chequing_id,),
            )
            moved_count = cursor.fetchone()[0]

            cursor.execute(
                "UPDATE transactions SET account_id = ? WHERE account_id = ? AND date < '2020-12-01'",
                (main_chequing_id, chequing_id),
            )
            print(f"\nMoved {moved_count} pre-2020 transactions from 'Chequing' to 'Main Chequing'")
        else:
            print("\n'Chequing' account not found, skipping move step")

        # --- Step 3: Delete "Chequing" and "Main" accounts + remaining transactions ---
        for name, acc_id in [("Chequing", chequing_id), ("Main", main_id)]:
            if acc_id is not None:
                cursor.execute(
                    "SELECT COUNT(*) FROM transactions WHERE account_id = ?", (acc_id,)
                )
                remaining = cursor.fetchone()[0]
                cursor.execute("DELETE FROM transactions WHERE account_id = ?", (acc_id,))
                cursor.execute("DELETE FROM accounts WHERE id = ?", (acc_id,))
                print(f"Deleted account '{name}' (id={acc_id}): {remaining} remaining transactions removed")
            else:
                print(f"Account '{name}' not found, skipping deletion")

        # Idempotency: clear any previously-imported CSV transactions from Main Chequing.
        # The CSV covers 2020-12-01 onward; moved old transactions are all pre-2020.
        cursor.execute(
            "DELETE FROM transactions WHERE account_id = ? AND date >= '2020-12-01'",
            (main_chequing_id,),
        )
        csv_cleared = cursor.rowcount
        if csv_cleared > 0:
            print(f"Cleared {csv_cleared} previously-imported CSV transactions from 'Main Chequing' (idempotency)")

        # --- Step 4: Import all CSV rows into "Main Chequing" ---
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

                    # Parse amounts: positive = incoming, negative = outgoing
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
                        (main_chequing_id, dt.isoformat(), description, round(amount, 2), category, batch_id),
                    )
                    rows_imported += 1

                except Exception as e:
                    errors += 1
                    if errors <= 10:
                        print(f"  Error row {row_num}: {e} — {row}")

        # --- Print CSV import results ---
        print(f"\n--- CSV IMPORT RESULTS ---")
        print(f"Rows imported: {rows_imported}")
        print(f"Errors: {errors}")
        print(f"Batch ID: {batch_id}")
        print(f"\nTotal income:  ${total_income:,.2f}")
        print(f"Total expense: ${total_expense:,.2f}")
        print(f"Net:           ${total_income + total_expense:,.2f}")

        print(f"\nCSV category breakdown:")
        for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
            print(f"  {cat:25s} {count:4d}")

        if uncategorized_rows:
            print(f"\n--- UNCATEGORIZED ({len(uncategorized_rows)} rows) ---")
            for row_num, date_str, desc, amt in uncategorized_rows:
                print(f"  Row {row_num}: {date_str} | {desc[:60]:60s} | ${amt:>10,.2f}")

        # --- Step 5: Re-categorize the moved old transactions ---
        # Old transactions have Mint-format descriptions, so our CIBC rules won't match most.
        # Only update if a rule matches; keep original Mint category otherwise.
        print(f"\n--- RE-CATEGORIZING MOVED OLD TRANSACTIONS ---")
        cursor.execute(
            "SELECT id, description, category FROM transactions WHERE account_id = ? AND date < '2020-12-01'",
            (main_chequing_id,),
        )
        old_transactions = cursor.fetchall()
        recategorized = 0
        old_category_counts = {}

        for txn_id, description, existing_category in old_transactions:
            new_category = categorize(description)
            if new_category != "Uncategorized":
                # Rule matched — update to new category
                cursor.execute(
                    "UPDATE transactions SET category = ? WHERE id = ?",
                    (new_category, txn_id),
                )
                recategorized += 1
                old_category_counts[new_category] = old_category_counts.get(new_category, 0) + 1
            else:
                # No rule matched — keep existing Mint category
                old_category_counts[existing_category] = old_category_counts.get(existing_category, 0) + 1

        print(f"Re-categorized {recategorized} of {len(old_transactions)} old transactions (rest kept original Mint categories)")
        print(f"\nOld transactions category breakdown (after re-categorization):")
        for cat, count in sorted(old_category_counts.items(), key=lambda x: -x[1]):
            print(f"  {cat:25s} {count:4d}")

        # --- Step 6: Commit atomically ---
        conn.commit()
        print(f"\nAll changes committed successfully.")

        # Final verification
        cursor.execute(
            "SELECT COUNT(*) FROM transactions WHERE account_id = ?", (main_chequing_id,)
        )
        final_count = cursor.fetchone()[0]
        print(f"\n--- FINAL VERIFICATION ---")
        print(f"Main Chequing total transactions: {final_count}")
        print(f"  - Moved old (pre-2020):  {moved_count}")
        print(f"  - Imported from CSV:     {rows_imported}")
        print(f"  - Expected total:        {moved_count + rows_imported}")

        # Verify accounts were deleted
        for name in ["Chequing", "Main"]:
            cursor.execute("SELECT id FROM accounts WHERE name = ?", (name,))
            if cursor.fetchone() is None:
                print(f"  Confirmed: '{name}' account deleted")
            else:
                print(f"  WARNING: '{name}' account still exists!")

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
