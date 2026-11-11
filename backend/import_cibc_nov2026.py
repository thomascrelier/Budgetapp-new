"""
Append new CIBC transactions (chequing + Visa exports, through Nov 10 2026)
to the Google Sheet that backs the Vercel app.

The CIBC exports contain the FULL account history, most of which is already in
the sheet. This script only appends rows the sheet does not have yet:

  * Dedup is count-aware on (date, description, amount) per account, so a
    genuine repeat (e.g. two identical transit fares on one day) is kept while
    rows already in the sheet are skipped.
  * Rows that are missing from the sheet but dated BEFORE the account's latest
    existing transaction are treated as "backfill" and are only reported, not
    written, unless --include-backfill is passed. (They usually mean the
    description was edited in the sheet, not that the row is really missing.)

Usage:
    python3 backend/import_cibc_nov2026.py --offline       # no Sheets access; categorization report only
    python3 backend/import_cibc_nov2026.py --dry-run       # reads the sheet, writes nothing
    python3 backend/import_cibc_nov2026.py                 # appends new rows
    python3 backend/import_cibc_nov2026.py --include-backfill

Requires budget-vercel/.env.local (GOOGLE_SPREADSHEET_ID, GOOGLE_CREDENTIALS_JSON)
and `pip install gspread google-auth` for anything other than --offline.

CSV format (no header row):
    chequing: Date, Description, Debit, Credit
    visa:     Date, Description, Debit, Credit, Card#
"""

import argparse
import csv
import json
import os
import sys
import time
from collections import Counter
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(HERE, "..", "budget-vercel", ".env.local")
DOWNLOADS = os.path.expanduser("~/Downloads")

SOURCES = [
    {
        "key": "chequing",
        "csv": os.path.join(DOWNLOADS, "cibc.csv"),
        "account": "Main Chequing",
        # Used only by --offline, where the sheet's real cutoff is unknown.
        "offline_since": "2026-02-10",
    },
    {
        "key": "visa",
        "csv": os.path.join(DOWNLOADS, "cibc (2).csv"),
        "account": "CIBC Visa",
        "offline_since": "2026-03-06",  # last import covered Feb 13 - Mar 5 2026
    },
]

# --------------------------------------------------------------------------
# Category rules: case-insensitive substring, first match wins.
# Names follow what is already in the sheet / what the app's analytics expect
# ("Transfer", "Investments", "Income" are excluded from spending; "Dining",
# "Groceries", "Coffee Shops", "Car Fuel" feed the trend tracker).
# --------------------------------------------------------------------------

CHEQUING_RULES = [
    # Fees (before generic ATM / transfer rules)
    ("SERVICE CHARGE", "Fees & Charges"),
    ("MONTHLY FEE", "Fees & Charges"),
    ("NETWORK TRANSACTION FEE", "Fees & Charges"),
    ("NETWORK FEE DISCOUNT", "Fees & Charges"),
    ("FEE DISCOUNT", "Fees & Charges"),
    ("ATM REBATE", "Fees & Charges"),
    ("NON-SUFFICIENT FUNDS", "Fees & Charges"),
    ("OVERDRAFT", "Fees & Charges"),
    ("MEMO - FEES", "Fees & Charges"),
    ("RETURNED CHEQUE", "Fees & Charges"),
    ("CIBC-DISATF", "Fees & Charges"),

    # Income
    ("NITRO SOFTWARE", "Income"),
    ("CLUTCH CANADA", "Income"),
    ("OPEN TEXT", "Income"),
    ("XERO SOFTWARE", "Income"),
    ("WAGE/SALARY", "Income"),
    ("ADMIN BY CL", "Income"),
    ("CANADA LIFE", "Income"),
    ("DEPOSIT AE/EI", "Income"),
    ("Remise carbone", "Income"),
    ("CarbonRebate", "Income"),
    ("Great Canadian Rebates", "Income"),
    ("Cashback", "Income"),
    ("Cash Back", "Income"),
    ("TRIGIL LAW", "Income"),

    # Tax
    ("Tax Refund", "Income Tax"),
    ("CRA (REVENUE)", "Income Tax"),
    ("PREAUTHORIZED DEBIT CANADA", "Income Tax"),
    ("DEPOSIT CANADA", "Income"),

    # Housing
    ("Minto Corporate", "Rent"),
    ("dinara", "Rent"),
    ("Raman Dhugga", "Rent"),
    ("MORTGAGE PAYMENT", "Mortgage"),
    ("TORONTO STANDARD C", "Insurance"),

    # Utilities
    ("PROVIDENT ENERGY", "Utilities"),
    ("TORONTO HYDRO", "Utilities"),
    ("BELL CANADA", "Internet"),
    ("FIDO Mobile", "Mobile"),

    # Transportation
    ("407 ETR", "Transportation"),
    ("car parking", "Transportation"),
    ("Adam Law parking", "Transportation"),

    # Named e-transfers with a known purpose
    ("Ryan Bolton soccer", "Entertainment"),
    ("mike construction", "Renovations"),
    ("Bobby HVAC", "Renovations"),
    ("Adam Energy Audit", "Renovations"),
    ("Ramona Therapist", "Therapy"),
    ("joan physio", "Therapy"),
    ("Sunshine Flowers", "Shopping"),
    ("Doggie in the Window", "Pets"),

    # Debt / investments
    ("SCOTIA BANK - SPL LOAN", "Debt Payment"),
    ("Wealthsimple", "Investments"),
    ("Shareowner", "Investments"),
    ("QUESTRADE", "Investments"),
    ("GIC Bonus", "Investments"),
    ("DEPOSIT Tangerine", "Transfer"),
    ("Tangerine", "Investments"),

    # Point of sale
    ("YUKI JAPANESE", "Dining"),
    ("PETSMART", "Pets"),

    # Unknown-purpose deposits: kept out of "Income" until confirmed
    ("CAMBRIDGE MERCANTILE", "Other"),

    # Money movement (card payments, own-account transfers, cash, e-transfers)
    ("TO CARD", "Transfer"),
    ("MASTERCARD, ROGERS", "Transfer"),
    ("AMERICAN EXPRESS", "Transfer"),
    ("VISA, TD", "Transfer"),
    ("INTERNET TRANSFER", "Transfer"),
    ("INTERNET DEPOSIT", "Transfer"),
    ("INTERNET BILL PAY", "Transfer"),
    ("ATM WITHDRAWAL", "Transfer"),
    ("E-TRANSFER", "Transfer"),
    ("FULFILL REQUEST", "Transfer"),
    ("Bank Verify", "Transfer"),
    ("PREAUTHORIZED DEBIT", "Transfer"),
    ("Branch Transaction", "Transfer"),
    ("Electronic Funds", "Transfer"),
    ("Internet Banking", "Transfer"),
]

VISA_RULES = [
    # Card payments / fees
    ("PAYMENT THANK YOU", "Transfer"),
    ("PAIEMENT MERCI", "Transfer"),
    ("ANNUAL FEE", "Fees & Charges"),
    ("PURCHASE INTEREST", "Fees & Charges"),
    ("INTEREST REVERSAL", "Fees & Charges"),
    ("CREDIT ADJUSTMENT", "Fees & Charges"),
    ("YSI*PROP PYMT SVCFEE", "Fees & Charges"),

    # Rent
    ("YSI*Minto", "Rent"),
    # Matches the Feb-Mar 2026 import, which filed Chexy under this category.
    ("CHEXY RENT", "Transfers & Payments"),

    # Subscriptions (before the foreign-currency catch-all)
    ("ANTHROPIC", "Shopping"),
    ("CLAUDE.AI", "Shopping"),
    ("APPLE.COM", "Shopping"),
    ("Spotify", "Entertainment"),

    # Insurance / vehicle
    ("INTACT INSURANCE", "Insurance"),
    ("AVIVA", "Insurance"),
    ("MAZDA", "Transportation"),
    ("ACTIVE GREEN + ROSS", "Transportation"),
    ("MTO ", "Transportation"),
    ("AVIS.CA", "Travel"),

    # Health
    ("ANIMAL HOSPITAL", "Veterinary"),
    ("HUMBERWOOD", "Veterinary"),
    ("SPADINAVET", "Veterinary"),
    ("LOUISE GLEESON", "Therapy"),
    ("JODI ROUAH", "Therapy"),
    ("ERICA BERMAN", "Therapy"),
    ("REBALANCE", "Therapy"),
    ("PARK LAWN HEALTH", "Dentist"),
    ("DR. MURRELL", "Dentist"),
    ("VILLAGE ORTHODONTICS", "Dentist"),
    ("HUMBER BAY EYE CARE", "Eyecare"),
    ("SmartBuyGlasses", "Eyecare"),
    ("FORT YORK MEDICAL", "Medical"),
    ("HISTOPATH", "Medical"),
    ("SHOPPERS DRUG MART", "Pharmacy"),
    ("SDM ", "Pharmacy"),
    ("REXALL", "Pharmacy"),
    ("PHARMACY", "Pharmacy"),
    ("Amavita", "Pharmacy"),
    ("LA FITNESS", "Gym Membership"),
    ("OXYGEN YOGA", "Gym Membership"),
    ("CALEDON- CCRW", "Gym Membership"),

    # Pets
    ("PETSMART", "Pets"),
    ("PET VALU", "Pets"),
    ("BONE AND BISCUIT", "Pets"),
    ("BONE & BISCUIT", "Pets"),

    # Travel (bookings, lodging, and anything charged in a foreign currency)
    ("AIR CAN", "Travel"),
    ("AIR NZ", "Travel"),
    ("JETSTAR", "Travel"),
    ("Volotea", "Travel"),
    ("EXPEDIA", "Travel"),
    ("SUPER.COM", "Travel"),
    ("SUPERTRAVEL", "Travel"),
    ("SNAP TRAVEL", "Travel"),
    ("PRICELINE", "Travel"),
    ("VIATOR", "Travel"),
    ("GADVENTURES", "Travel"),
    ("Intrepid Travel", "Travel"),
    ("SUNWING", "Travel"),
    ("Qeeq", "Travel"),
    ("SIXT", "Travel"),
    ("NZETA", "Travel"),
    ("IVISA", "Travel"),
    ("BREWSTER INC", "Travel"),
    ("BANFF", "Travel"),
    ("ROCKWATER / WHITETOOTH", "Travel"),
    ("MAPLE LEAF CALGARY", "Travel"),
    ("PETROCAN-LAKE LOUISE", "Travel"),
    ("SAFEWAY #8918 CALGARY", "Travel"),
    ("MILLCROFT INN", "Travel"),
    ("THE DRAKE HOTEL", "Dining"),
    ("HOTEL", "Travel"),
    ("SHERATON", "Travel"),
    ("DOUBLETREE", "Travel"),
    ("HILTON", "Travel"),
    ("HYATT", "Travel"),
    ("CROWNE PLAZA", "Travel"),
    ("CAFE SINTRA", "Travel"),
    ("CASCADE WELLNESS LAGOS", "Travel"),
    ("REAL JOURNEYS", "Travel"),
    ("EAT STREET - HIA", "Travel"),
    ("LYFT *AIRPORT", "Travel"),
    ("PARK'N FLY", "Travel"),
    ("HEIRLOOM T1", "Travel"),
    ("HEARTH T1", "Travel"),
    ("FOOD TRUCK (E-TUK) YYZ", "Travel"),
    ("JG *RAPE CRISIS", "Donations"),
    ("Movember", "Donations"),
    ("The PMCF", "Donations"),
    (" EUR @", "Travel"),
    (" USD @", "Travel"),
    (" NZD @", "Travel"),
    (" CHF @", "Travel"),
    (" AUD @", "Travel"),
    (" DOP @", "Travel"),
    (" SGD @", "Travel"),
    (" IDR @", "Travel"),
    (" JPY @", "Travel"),

    # Telecom / utilities
    ("ROGERS", "Mobile"),
    ("FIDO", "Mobile"),
    ("BELL CANADA", "Internet"),

    # Coffee
    ("STARBUCKS", "Coffee Shops"),
    ("TIM HORTONS", "Coffee Shops"),
    ("DARK HORSE ESPRESSO", "Coffee Shops"),
    ("WALLACE ESPRESSO", "Coffee Shops"),
    ("Dineen Coffee", "Coffee Shops"),
    ("MILKY'S", "Coffee Shops"),
    ("Coffee_Party", "Entertainment"),

    # Alcohol
    ("LCBO", "Alcohol & Bars"),
    ("SLABTOWN CIDER", "Alcohol & Bars"),
    ("COLIO ESTATE WINES", "Alcohol & Bars"),

    # Car fuel
    ("COSTCO GAS", "Car Fuel"),
    ("PETRO-CANADA", "Car Fuel"),
    ("PETROCAN", "Car Fuel"),
    ("SHELL", "Car Fuel"),
    ("ESSO", "Car Fuel"),
    ("HUSKY", "Car Fuel"),
    ("BRYANS FUEL", "Car Fuel"),

    # Transportation
    ("UBER CANADA/UBEREATS", "Fast Food"),
    ("UBER", "Transportation"),
    ("LYFT", "Transportation"),
    ("PRESTO", "Transportation"),
    ("METROLINX", "Transportation"),
    ("GO TVM", "Transportation"),
    ("UNION STATION - TVM", "Transportation"),
    ("PARKING", "Transportation"),
    ("TARGET PARK", "Transportation"),
    ("IMPARK", "Transportation"),
    ("TORPRKAUT", "Transportation"),
    ("UNIT PARK", "Transportation"),
    ("PPARKLINK", "Transportation"),
    ("CAPITOL BUILDINGS", "Transportation"),
    ("ALLIED PROPERTIES", "Transportation"),
    ("CITY OF MISSISSAUGA", "Transportation"),
    ("FERRY DOCKS", "Transportation"),

    # Entertainment
    ("TCKTWEB", "Entertainment"),
    ("TICKETMASTER", "Entertainment"),
    ("A1*", "Entertainment"),
    ("REBEL GREEK", "Dining"),
    ("REBEL", "Entertainment"),
    ("CABANA", "Entertainment"),
    ("AERA ", "Entertainment"),
    ("COCA-COLA COLISEUM", "Entertainment"),
    ("BMO F", "Entertainment"),
    ("SCOTIABANK ARENA", "Entertainment"),
    ("ARAMARK ENTERTAINMENT", "Entertainment"),
    ("BOARD OF GOVERNORS", "Entertainment"),
    ("SECOND CITY", "Entertainment"),
    ("THEATRE ORANGEVILLE", "Entertainment"),
    ("Thermea", "Entertainment"),
    ("NORDIK", "Entertainment"),
    ("Wai Ariki", "Entertainment"),
    ("CINEPLEX", "Entertainment"),
    ("RIPLEYSAQUARIUM", "Entertainment"),
    ("ZOO", "Entertainment"),
    ("IMMERSIVE VAN GOGH", "Entertainment"),
    ("ESCAPE MANOR", "Entertainment"),
    ("TORONTO SYMPHONY", "Entertainment"),
    ("ROY THOMSON HALL", "Entertainment"),
    ("KOOZA", "Entertainment"),
    ("PINGLE'S FARM", "Entertainment"),
    ("SPRINGRIDGE FARM", "Entertainment"),
    ("GOLDSMITH'S ORCHARD", "Entertainment"),
    ("SPORTING LIFE 10K", "Entertainment"),
    ("LAST LEVEL LOUNGE", "Entertainment"),
    ("Sony Interactive", "Gaming & Video Games"),
    ("PLAYSTATION", "Gaming & Video Games"),
    ("GAMESTOP", "Gaming & Video Games"),

    # Groceries
    ("WWW COSTCO CA", "Shopping"),
    ("COSTCO", "Groceries"),
    ("FRESHCO", "Groceries"),
    ("FARM BOY", "Groceries"),
    ("METRO ", "Groceries"),
    ("365 MARKET", "Groceries"),
    ("NOFRILLS", "Groceries"),
    ("NO FRILL", "Groceries"),
    ("JORDAN'S NF", "Groceries"),
    ("STEVE'S NF", "Groceries"),
    ("COSIMO'S", "Groceries"),
    ("LOBLAW- GIFT", "Shopping"),
    ("LOBLAW", "Groceries"),
    ("FOOD BASICS", "Groceries"),
    ("SOBEYS", "Groceries"),
    ("LONGO'S", "Groceries"),
    ("FORTINOS", "Groceries"),
    ("WAL-MART", "Groceries"),
    ("WALMART", "Groceries"),
    ("HALENDA'S MEATS", "Groceries"),
    ("SAFEWAY", "Groceries"),
    ("COBS BREAD", "Groceries"),
    ("HASTY MARKET", "Groceries"),
    ("MACS CONV", "Groceries"),

    # Fast food (matches the Feb-Mar 2026 import)
    ("MCDONALD", "Fast Food"),
    ("DOMINO", "Fast Food"),
    ("WENDY", "Fast Food"),
    ("FIREHOUSE SUBS", "Fast Food"),
    ("SUBWAY", "Fast Food"),
    ("PIZZA PIZZA", "Fast Food"),
    ("QUESADA", "Fast Food"),
    ("CHIPOTLE", "Fast Food"),
    ("BAR BURRI", "Fast Food"),
    ("BAR BURITTO", "Fast Food"),
    ("PITA PIT", "Fast Food"),
    ("PITA DELI", "Fast Food"),
    ("DAIRY QUEEN", "Fast Food"),
    ("BOOSTER JUICE", "Fast Food"),
    ("HUNGERHUB", "Fast Food"),
    ("PANAGO", "Fast Food"),
    ("GREEN BOX", "Fast Food"),

    # Shopping
    ("AMAZON", "Shopping"),
    ("AMZN", "Shopping"),
    ("BANANAREPUBLIC", "Shopping"),
    ("BANANA REPUBLIC", "Shopping"),
    ("SPORT CHEK", "Shopping"),
    ("SPORTCHEK", "Shopping"),
    ("Sporting Life", "Shopping"),
    ("SOCCER WORLD", "Shopping"),
    ("MARKS.COM", "Shopping"),
    ("TRAVISMATHEW", "Shopping"),
    ("STEVE MADDEN", "Shopping"),
    ("BECKER SHOES", "Shopping"),
    ("BROWNS", "Shopping"),
    ("PEOPLES JEWELLERS", "Shopping"),
    ("Kate Spade", "Shopping"),
    ("LULULEMON", "Shopping"),
    ("HUDSON'S BAY", "Shopping"),
    ("THEBAY.COM", "Shopping"),
    ("SAXXUNDERWEAR", "Shopping"),
    ("STITCH IT", "Shopping"),
    ("WHIRLPOOL", "Shopping"),
    ("WF* ", "Shopping"),
    ("NATIONAL MATTRESS", "Shopping"),
    ("Dyson", "Shopping"),
    ("BEST BUY", "Shopping"),
    ("STAPLES", "Shopping"),
    ("LOWE'S", "Shopping"),
    ("IKEA", "Shopping"),
    ("INDIGO", "Shopping"),
    ("CANADIAN TIRE", "Shopping"),
    ("CDN TIRE", "Shopping"),
    ("DOLLARAMA", "Shopping"),
    ("DOLLAR TREE", "Shopping"),
    ("MASTERMIND TOYS", "Shopping"),
    ("SKULL SHAVER", "Shopping"),
    ("EDIBLE ARRANGEMENTS", "Shopping"),
    ("FLOWERS", "Shopping"),
    ("DMP FLORAL", "Shopping"),
    ("Etsy.com", "Shopping"),
    ("SPARKLE SOLUTIONS", "Shopping"),
    ("EVOLVE CLOTHING", "Shopping"),
    ("PARTY CITY", "Shopping"),
    ("ENNEAGRAM INSTITUTE", "Shopping"),
    ("PAYPAL *AGENCYIICHA", "Shopping"),
    ("FORBIDDEN PLEASURES", "Shopping"),
    ("UPS STORE", "Shopping"),
    ("NOKI SYSTEMS", "Shopping"),
    ("NESPRESSO", "Shopping"),
    ("HOME DEPOT", "Repairs & Maintenance"),

    # Other
    ("FCE-SENECA", "Education"),
    ("MONKHOUSE LAW", "Other"),
    ("CALEDON", "Other"),
    ("MECP", "Other"),

    # Dining (sit-down restaurants, bars, cafes)
    ("TST-", "Dining"),
    ("TST*", "Dining"),
    ("SQ *", "Dining"),
    ("FOOD* ", "Dining"),
    ("LS ", "Dining"),
    ("KEG", "Dining"),
    ("KELSEY", "Dining"),
    ("JACK ASTOR", "Dining"),
    ("CACTUS CLUB", "Dining"),
    ("OLIVE GARDEN", "Dining"),
    ("WILD WING", "Dining"),
    ("BEAST RESTAURANT", "Dining"),
    ("ELEPHANT & CASTLE", "Dining"),
    ("TATSU SUSHI", "Dining"),
    ("ICHIBAN SUSHI", "Dining"),
    ("DPRTMNT", "Dining"),
    ("DZO", "Dining"),
    ("ANEJO", "Dining"),
    ("KING TAPS", "Dining"),
    ("HUNTERS LANDING", "Dining"),
    ("MAD RADISH", "Dining"),
    ("AMSTERDAM BREWHOUSE", "Dining"),
    ("BANDIT BREWERY", "Dining"),
    ("BAR DEM", "Dining"),
    ("CRAFT", "Dining"),
    ("DUKES", "Dining"),
    ("TOWN CRIER", "Dining"),
    ("GRETA YYZ", "Dining"),
    ("CHEFS' HOUSE", "Dining"),
    ("LIGHTCASTER", "Dining"),
    ("GREYSTONES", "Dining"),
    ("GRANDMA LOVES YOU", "Dining"),
    ("BRUST BEVERAGES", "Dining"),
    ("CHUCK'S ROADHOUSE", "Dining"),
    ("PHO BEN", "Dining"),
    ("LULU BAR", "Dining"),
    ("LUME KITCHEN", "Dining"),
    ("POKE BOX", "Dining"),
    ("CAMPECHANO", "Dining"),
    ("BLONDIES PIZZA", "Dining"),
    ("FAT FORK", "Dining"),
    ("THE HATTER", "Dining"),
    ("TAPHOUSE", "Dining"),
    ("CODA", "Dining"),
    ("MOXIE", "Dining"),
    ("SCADDABUSH", "Dining"),
    ("SANSOTEI", "Dining"),
    ("RESTAURANT", "Dining"),
    ("PUB", "Dining"),
    ("GRILL", "Dining"),
    ("BISTRO", "Dining"),
    ("KITCHEN", "Dining"),
    ("RAMEN", "Dining"),
    ("DINER", "Dining"),
    ("TRATTORIA", "Dining"),
    ("PASTA", "Dining"),
]

RULES = {"chequing": CHEQUING_RULES, "visa": VISA_RULES}


def categorize(source_key, description):
    desc = description.upper()
    for pattern, category in RULES[source_key]:
        if pattern.upper() in desc:
            return category
    return "Uncategorized"


def parse_csv(source):
    rows = []
    with open(source["csv"], "r", encoding="utf-8-sig", newline="") as f:
        for rec in csv.reader(f):
            if len(rec) < 4 or not rec[0].strip():
                continue
            date = rec[0].strip()
            datetime.strptime(date, "%Y-%m-%d")  # fail loudly on a malformed row
            description = " ".join(rec[1].split())
            debit = float(rec[2].replace(",", "")) if rec[2].strip() else 0.0
            credit = float(rec[3].replace(",", "")) if rec[3].strip() else 0.0
            amount = round(credit - debit, 2)
            rows.append({
                "date": date,
                "description": description,
                "amount": amount,
                "category": categorize(source["key"], description),
            })
    return rows


def key_of(date, description, amount):
    return (date, " ".join(str(description).split()), round(float(amount), 2))


def split_new(csv_rows, existing_rows):
    """Return (new, backfill, already_present_count).

    existing_rows: iterable of (date, description, amount) already in the sheet
    for this account.
    """
    have = Counter(key_of(*r) for r in existing_rows)
    latest = max((r[0] for r in existing_rows), default="")
    new, backfill, present = [], [], 0
    # Oldest first so the appended block reads chronologically.
    for row in sorted(csv_rows, key=lambda r: r["date"]):
        k = key_of(row["date"], row["description"], row["amount"])
        if have[k] > 0:
            have[k] -= 1
            present += 1
        elif row["date"] >= latest:
            new.append(row)
        else:
            backfill.append(row)
    return new, backfill, present, latest


def report(label, rows):
    if not rows:
        print(f"  {label}: none")
        return
    spend = sum(r["amount"] for r in rows if r["amount"] < 0)
    credits = sum(r["amount"] for r in rows if r["amount"] > 0)
    print(f"  {label}: {len(rows)} rows, {rows[0]['date']} to {rows[-1]['date']}, "
          f"debits ${-spend:,.2f}, credits ${credits:,.2f}")
    by_cat = {}
    for r in rows:
        c = by_cat.setdefault(r["category"], [0, 0.0])
        c[0] += 1
        c[1] += r["amount"]
    for cat, (n, total) in sorted(by_cat.items(), key=lambda kv: kv[1][1]):
        print(f"      {cat:24s} {n:4d}  {total:>12,.2f}")
    uncategorized = [r for r in rows if r["category"] == "Uncategorized"]
    if uncategorized:
        print(f"    UNCATEGORIZED ({len(uncategorized)}):")
        for r in uncategorized:
            print(f"      {r['date']} | {r['description'][:60]:60s} | {r['amount']:>10,.2f}")


def open_spreadsheet():
    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except ImportError:
        sys.exit("Missing dependency: pip install gspread google-auth")
    if not os.path.exists(ENV_PATH):
        sys.exit(f"Missing {os.path.normpath(ENV_PATH)} (needs GOOGLE_SPREADSHEET_ID and GOOGLE_CREDENTIALS_JSON)")
    env = {}
    for line in open(ENV_PATH):
        if "=" in line and not line.lstrip().startswith("#"):
            name, value = line.split("=", 1)
            env[name.strip()] = value.strip()
    creds_raw = env["GOOGLE_CREDENTIALS_JSON"]
    if creds_raw[:1] in "'\"" and creds_raw[-1:] == creds_raw[:1]:
        creds_raw = creds_raw[1:-1]
    creds = Credentials.from_service_account_info(
        json.loads(creds_raw),
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    return gspread.authorize(creds).open_by_key(env["GOOGLE_SPREADSHEET_ID"])


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--offline", action="store_true", help="no Sheets access; report rows after each account's assumed cutoff")
    ap.add_argument("--dry-run", action="store_true", help="read the sheet but write nothing")
    ap.add_argument("--include-backfill", action="store_true", help="also append missing rows dated before the account's latest transaction")
    args = ap.parse_args()

    parsed = {s["key"]: parse_csv(s) for s in SOURCES}

    if args.offline:
        print("=== OFFLINE: assumed cutoffs, nothing read from or written to Sheets ===")
        for s in SOURCES:
            rows = sorted((r for r in parsed[s["key"]] if r["date"] >= s["offline_since"]), key=lambda r: r["date"])
            print(f"\n{s['account']} ({os.path.basename(s['csv'])}, {len(parsed[s['key']])} rows in file)")
            report(f"on/after {s['offline_since']}", rows)
        return

    ss = open_spreadsheet()
    accounts = ss.worksheet("Accounts").get_all_values()[1:]
    account_ids = {row[1]: int(row[0]) for row in accounts if row and row[0]}
    tx_ws = ss.worksheet("Transactions")
    tx_values = tx_ws.get_all_values()[1:]
    next_id = max((int(r[0]) for r in tx_values if r and r[0].isdigit()), default=0) + 1
    print(f"Sheet has {len(tx_values)} transactions; next id {next_id}")

    to_append = []
    batch_id = f"cibc-nov2026-{int(time.time())}"
    now = datetime.now(timezone.utc).isoformat()

    for s in SOURCES:
        if s["account"] not in account_ids:
            sys.exit(f"Account '{s['account']}' not found in the Accounts sheet: {sorted(account_ids)}")
        account_id = account_ids[s["account"]]
        existing = []
        for r in tx_values:
            if len(r) >= 5 and r[1].strip() == str(account_id):
                try:
                    existing.append((r[2], r[3], float(str(r[4]).replace(",", "") or 0)))
                except ValueError:
                    continue
        new, backfill, present, latest = split_new(parsed[s["key"]], existing)
        print(f"\n{s['account']} (id {account_id}): {len(existing)} rows in sheet, latest {latest or 'n/a'}; "
              f"file has {len(parsed[s['key']])} rows, {present} already present")
        report("NEW", new)
        report("BACKFILL (missing but older than latest; " + ("WILL" if args.include_backfill else "NOT") + " be written)", backfill)
        chosen = new + (backfill if args.include_backfill else [])
        for row in sorted(chosen, key=lambda r: r["date"]):
            to_append.append([account_id, row["date"], row["description"], row["amount"], row["category"]])

    if args.dry_run:
        print(f"\n=== DRY RUN: would append {len(to_append)} rows (batch {batch_id}) ===")
        return
    if not to_append:
        print("\nNothing to append.")
        return

    values = []
    for account_id, date, description, amount, category in to_append:
        values.append([next_id, account_id, date, description, amount, category, False, batch_id, now])
        next_id += 1
    tx_ws.append_rows(values, value_input_option="RAW", insert_data_option="INSERT_ROWS", table_range="A1")
    print(f"\nAppended {len(values)} rows to Transactions (batch {batch_id}).")
    print("The Vercel app caches the sheet for 5 minutes; POST /api/cache/refresh to see them sooner.")


if __name__ == "__main__":
    main()
