"""
Import Rogers Mastercard transactions from text file export.

Creates a "Rogers Mastercard" account (credit_card type), auto-categorizes transactions
using pattern-matching rules, and inserts all rows atomically.

Text format: Multi-line blocks — Date, Description, Rogers Category, [foreign transaction], Amount
"""

import re
import sqlite3
import uuid
import shutil
from datetime import datetime


DATA_PATH = "/Users/thomas.crelier/Desktop/Claude/Budget/backend/data/rogers_transactions.txt"
DB_PATH = "/Users/thomas.crelier/Desktop/Claude/Budget/backend/budgetcsv.db"

# --- Category Rules (case-insensitive, first match wins) ---
# More specific patterns MUST come before generic ones

CATEGORY_RULES = [
    # Rental property
    ("BELL CANADA", "Internet"),
    ("HOME DEPOT", "Repairs & Maintenance"),

    # Transportation (specific gas patterns BEFORE generic COSTCO)
    ("COSTCO GAS", "Transportation"),
    ("SHELL", "Transportation"),
    ("PETRO-CANADA", "Transportation"),
    ("UBER CANADA", "Transportation"),
    ("PRESTO", "Transportation"),
    ("PARKING", "Transportation"),

    # Groceries (COSTCO WHOLESALE after COSTCO GAS)
    ("COSTCO WHOLESALE", "Groceries"),
    ("FRESHCO", "Groceries"),
    ("FARM BOY", "Groceries"),
    ("METRO ", "Groceries"),
    ("COSTCO", "Groceries"),
    ("365 MARKET", "Groceries"),
    ("WALMART", "Groceries"),
    ("ZEHRS", "Groceries"),
    ("STEVE'S", "Groceries"),
    ("VISCONTI", "Groceries"),
    ("FORTINOS", "Groceries"),
    ("LCBO", "Groceries"),

    # Dining
    ("MCDONALD", "Dining"),
    ("JACK ASTOR", "Dining"),
    ("FIREHOUSE", "Dining"),
    ("BAR BURRITO", "Dining"),
    ("BOOSTER JUICE", "Dining"),
    ("THE PILOT", "Dining"),
    ("GREYSTONES", "Dining"),
    ("AJAX KEG", "Dining"),
    ("DEJAVU", "Dining"),
    ("PHO BEN", "Dining"),
    ("MOCHABERRY", "Dining"),
    ("BLONDIES PIZZA", "Dining"),
    ("DOMINOS", "Dining"),
    ("CAMPECHANO", "Dining"),
    ("TATSU SUSHI", "Dining"),
    ("STARBUCKS", "Dining"),
    ("DPRTMNT", "Dining"),
    ("PANAGO", "Dining"),

    # Entertainment
    ("SPOTIFY", "Entertainment"),
    ("LA FITNESS", "Entertainment"),
    ("HEADWATERS", "Entertainment"),
    ("SPLITSVILLE", "Entertainment"),

    # Shopping
    ("OPENAI", "Shopping"),
    ("LINKEDIN", "Shopping"),
    ("ELEVENLABS", "Shopping"),
    ("GOOGLE", "Shopping"),
    ("AMAZON", "Shopping"),
    ("AMZN", "Shopping"),
    ("PETSMART", "Shopping"),
    ("PET VALU", "Shopping"),
    ("SPORTING LIFE", "Shopping"),
    ("SPORTCHEK", "Shopping"),
    ("RWCO", "Shopping"),
    ("CANADIAN TIRE", "Shopping"),
    ("BANANA REPUBLIC", "Shopping"),
    ("SOCCER WORLD", "Shopping"),
    ("BONE & BISCUIT", "Shopping"),

    # Healthcare
    ("SHOPPERS DRUG MART", "Pharmacy"),
    ("PARK LAWN HEALTH", "Therapy"),
    ("ANIMAL HOSPITAL", "Veterinary"),
    ("HUMBERWOOD", "Veterinary"),
    ("JODI ROUAH", "Therapy"),

    # Mobile/Telecom
    ("ROGERS", "Mobile"),
    ("FIDO", "Mobile"),

    # Insurance
    ("INTACT INSURANCE", "Insurance"),
    ("AVIVA", "Insurance"),

    # Transfer
    ("PAYMENT", "Transfer"),
    ("PAIEMENT", "Transfer"),
    ("CASHBACK", "Transfer"),

    # Other
    ("KIDNEY", "Other"),
    ("ALZHEIMER", "Other"),
    ("CALEDON", "Other"),
    ("MONKHOUSE", "Other"),
    ("MECP", "Other"),
]

# Date pattern: "MMM DD, YYYY"
DATE_RE = re.compile(r'^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}$')
# Amount pattern: "$1,234.56" or "-$1,234.56"
AMOUNT_RE = re.compile(r'^-?\$[\d,]+\.\d{2}$')


def categorize(description):
    desc_upper = description.upper()
    for pattern, category in CATEGORY_RULES:
        if pattern.upper() in desc_upper:
            return category
    return "Uncategorized"


def parse_amount(amount_str):
    """Parse Rogers amount string. In Rogers: positive = purchase, negative = payment/refund.
    In our system: purchases are negative (money out), payments are positive (money in).
    So we negate the parsed value."""
    cleaned = amount_str.replace("$", "").replace(",", "")
    return -float(cleaned)


def parse_transactions(filepath):
    """Parse multi-line Rogers transaction format."""
    with open(filepath, "r", encoding="utf-8") as f:
        lines = [line.rstrip() for line in f.readlines()]

    transactions = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Skip empty lines
        if not line:
            i += 1
            continue

        # Look for date line
        if DATE_RE.match(line):
            date_str = line
            dt = datetime.strptime(date_str, "%b %d, %Y").date()

            # Next line: description
            i += 1
            description = lines[i].strip() if i < len(lines) else ""

            # Next line: Rogers category (we ignore it)
            i += 1

            # Check for optional "foreign transaction" line
            i += 1
            if i < len(lines) and lines[i].strip().lower() == "foreign transaction":
                i += 1

            # Amount line
            amount_str = lines[i].strip() if i < len(lines) else "$0.00"
            if AMOUNT_RE.match(amount_str):
                amount = parse_amount(amount_str)
            else:
                print(f"  Warning: unexpected amount format at line {i+1}: '{amount_str}'")
                i += 1
                continue

            transactions.append((dt, description, round(amount, 2)))

        i += 1

    return transactions


def main():
    # Step 1: Backup
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = f"{DB_PATH}.backup-{timestamp}"
    shutil.copy2(DB_PATH, backup_path)
    print(f"Backup created: {backup_path}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Step 2: Delete existing Rogers Mastercard account + transactions (idempotent)
        cursor.execute("SELECT id FROM accounts WHERE name = ?", ("Rogers Mastercard",))
        row = cursor.fetchone()
        if row:
            account_id = row[0]
            cursor.execute("SELECT COUNT(*) FROM transactions WHERE account_id = ?", (account_id,))
            count = cursor.fetchone()[0]
            cursor.execute("DELETE FROM transactions WHERE account_id = ?", (account_id,))
            cursor.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
            print(f"Deleted existing 'Rogers Mastercard' account (id={account_id}): {count} transactions\n")
        else:
            print("No existing 'Rogers Mastercard' account found, creating fresh\n")

        # Step 3: Create account
        cursor.execute(
            "INSERT INTO accounts (name, account_type, initial_balance, is_active) VALUES (?, ?, 0.00, 1)",
            ("Rogers Mastercard", "credit_card"),
        )
        new_account_id = cursor.lastrowid
        print(f"Created account 'Rogers Mastercard' (id={new_account_id})\n")

        # Step 4: Parse transactions
        raw_transactions = parse_transactions(DATA_PATH)
        print(f"Parsed {len(raw_transactions)} transactions from text file\n")

        # Step 5: Categorize and insert
        batch_id = str(uuid.uuid4())
        rows_imported = 0
        category_counts = {}
        total_income = 0.0
        total_expense = 0.0
        uncategorized_rows = []

        for dt, description, amount in raw_transactions:
            category = categorize(description)

            category_counts[category] = category_counts.get(category, 0) + 1
            if amount > 0:
                total_income += amount
            else:
                total_expense += amount

            if category == "Uncategorized":
                uncategorized_rows.append((dt.isoformat(), description, amount))

            cursor.execute(
                """INSERT INTO transactions
                   (account_id, date, description, amount, category, is_verified, notes, import_batch_id)
                   VALUES (?, ?, ?, ?, ?, 0, NULL, ?)""",
                (new_account_id, dt.isoformat(), description, amount, category, batch_id),
            )
            rows_imported += 1

        # Step 6: Print results
        print(f"--- IMPORT RESULTS ---")
        print(f"Rows imported: {rows_imported}")
        print(f"Batch ID: {batch_id}")
        print(f"\nTotal income (payments/refunds):  ${total_income:,.2f}")
        print(f"Total expense (purchases):        ${total_expense:,.2f}")
        print(f"Net:                              ${total_income + total_expense:,.2f}")

        print(f"\nCategory breakdown:")
        for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
            print(f"  {cat:25s} {count:4d}")

        if uncategorized_rows:
            print(f"\n--- UNCATEGORIZED ({len(uncategorized_rows)} rows) ---")
            for date_str, desc, amt in uncategorized_rows:
                print(f"  {date_str} | {desc[:60]:60s} | ${amt:>10,.2f}")

        # Step 7: Commit
        conn.commit()
        print(f"\nAll changes committed successfully.")

        cursor.execute(
            "SELECT COUNT(*) FROM transactions WHERE account_id = ?", (new_account_id,)
        )
        final_count = cursor.fetchone()[0]
        print(f"Verification: Rogers Mastercard now has {final_count} transactions")

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        print(f"All changes rolled back. Database unchanged.")
        raise

    finally:
        conn.close()


if __name__ == "__main__":
    main()
