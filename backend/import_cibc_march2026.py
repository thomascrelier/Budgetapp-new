"""Append CIBC Visa transactions from cibc (3).csv — Feb 13 to Mar 5, 2026."""

import csv
import sqlite3
import uuid
import shutil
from datetime import datetime

CSV_PATH = "/Users/thomas.crelier/Desktop/Claude/Budgetapp-new/cibc (3).csv"
DB_PATH = "/Users/thomas.crelier/Desktop/Claude/Budgetapp-new/backend/budgetcsv.db"
ACCOUNT_ID = 39  # Existing CIBC Visa account

CATEGORY_RULES = [
    # Groceries
    ("FRESHCO", "Groceries"),
    ("METRO ", "Groceries"),
    ("365 MARKET", "Groceries"),

    # Fast Food
    ("MCDONALD", "Fast Food"),
    ("DOMINOS", "Fast Food"),

    # Dining
    ("ICHIBAN SUSHI", "Dining"),
    ("JACK ASTOR", "Dining"),
    ("SHERWAY KEG", "Dining"),
    ("LUME KITCHEN", "Dining"),
    ("HOOTERS", "Dining"),
    ("PHO BEN THANH", "Dining"),
    ("LULU BAR", "Dining"),
    ("POKE BOX", "Dining"),

    # Coffee Shops
    ("STARBUCKS", "Coffee Shops"),

    # Transportation
    ("UBER CANADA/UBERTRIP", "Transportation"),
    ("PRESTO FARE", "Transportation"),

    # Food Delivery
    ("UBER CANADA/UBEREATS", "Fast Food"),

    # Shopping
    ("Amazon.ca Prime", "Shopping"),
    ("Amazon.ca", "Shopping"),
    ("AMZN Mktp", "Shopping"),
    ("SHOPPERS DRUG MART", "Pharmacy"),
    ("PET VALU", "Pets"),
    ("MASTERMIND TOYS", "Shopping"),
    ("TICKETMASTER", "Entertainment"),

    # Alcohol
    ("LCBO", "Alcohol & Bars"),

    # Rent
    ("CHEXY RENT", "Transfers & Payments"),

    # Transfers
    ("PAYMENT THANK YOU", "Transfers & Payments"),
    ("PAIEMENT MERCI", "Transfers & Payments"),

    # Travel / Spa
    ("MILLCROFT INN", "Travel"),

    # Therapy
    ("JODI ROUAH", "Therapy"),
]


def categorize(description):
    desc_upper = description.upper()
    for pattern, category in CATEGORY_RULES:
        if pattern.upper() in desc_upper:
            return category
    return "Uncategorized"


def main():
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = f"{DB_PATH}.backup-{timestamp}"
    shutil.copy2(DB_PATH, backup_path)
    print(f"Backup: {backup_path}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    batch_id = str(uuid.uuid4())
    rows_imported = 0
    category_counts = {}
    uncategorized = []

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row_num, row in enumerate(reader, start=1):
            date_str = row[0].strip()
            description = row[1].strip()
            debit_str = row[2].strip()
            credit_str = row[3].strip()

            dt = datetime.strptime(date_str, "%Y-%m-%d").date()
            debit = float(debit_str.replace(",", "")) if debit_str else 0.0
            credit = float(credit_str.replace(",", "")) if credit_str else 0.0
            amount = credit - debit  # positive = payment, negative = purchase

            category = categorize(description)
            category_counts[category] = category_counts.get(category, 0) + 1
            if category == "Uncategorized":
                uncategorized.append((date_str, description, amount))

            cursor.execute(
                """INSERT INTO transactions
                   (account_id, date, description, amount, category, is_verified, notes, import_batch_id)
                   VALUES (?, ?, ?, ?, ?, 0, NULL, ?)""",
                (ACCOUNT_ID, dt.isoformat(), description, round(amount, 2), category, batch_id),
            )
            rows_imported += 1

    conn.commit()

    # Verify
    cursor.execute("SELECT COUNT(*) FROM transactions WHERE import_batch_id = ?", (batch_id,))
    verified = cursor.fetchone()[0]

    print(f"\n--- IMPORT RESULTS ---")
    print(f"Rows imported: {rows_imported} (verified: {verified})")
    print(f"Batch ID: {batch_id}")
    print(f"\nCategory breakdown:")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat:25s} {count:4d}")

    if uncategorized:
        print(f"\n--- UNCATEGORIZED ({len(uncategorized)}) ---")
        for date_str, desc, amt in uncategorized:
            print(f"  {date_str} | {desc[:60]:60s} | ${amt:>10,.2f}")

    cursor.execute("SELECT COUNT(*) FROM transactions WHERE account_id = ?", (ACCOUNT_ID,))
    total = cursor.fetchone()[0]
    print(f"\nCIBC Visa total transactions: {total}")

    conn.close()


if __name__ == "__main__":
    main()
