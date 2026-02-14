"""
Fix all uncategorized transactions in the database using pattern-matching rules.
Updates in-place (no delete/recreate). Creates a backup first.
"""

import sqlite3
import shutil
from datetime import datetime

DB_PATH = "/Users/thomas.crelier/Desktop/Claude/Budget/backend/budgetcsv.db"

# --- Category Rules (case-insensitive, first match wins) ---
# More specific patterns MUST come before generic ones

CATEGORY_RULES = [
    # ===== TRANSFER / BANKING =====
    ("PAYMENT THANK YOU", "Transfer"),
    ("PAIEMENT MERCI", "Transfer"),
    ("ANNUAL FEE REBATE", "Fees & Charges"),
    ("ANNUAL FEE", "Fees & Charges"),
    ("PURCHASE INTEREST", "Fees & Charges"),
    ("INTEREST REVERSAL", "Fees & Charges"),
    ("CREDIT ADJUSTMENT", "Fees & Charges"),
    ("NETWORK FEE DISCOUNT", "Fees & Charges"),
    ("ATM-CANADA FEE DISCOUNT", "Fees & Charges"),
    ("MEMO - FEES", "Fees & Charges"),
    ("RETURNED CHEQUE", "Fees & Charges"),
    ("PREAUTHORIZED DEBIT CIBC-DISATF", "Fees & Charges"),

    # Main Chequing — E-transfers & banking (specific recipients first)
    ("dinara", "Housing"),
    ("Raman Dhugga", "Housing"),
    ("mike construction", "Renovations"),
    ("Bobby HVAC", "Renovations"),
    ("MARIUSZ OWCZARZ", "Renovations"),
    ("Adam Energy Audit", "Renovations"),
    ("Adam Law parking", "Other"),
    ("Ramona Therapist", "Therapy"),
    ("joan physio", "Therapy"),
    ("Ryan Bolton soccer", "Entertainment"),
    ("Sunshine Flowers", "Shopping"),
    ("Doggie in the Window", "Pets"),
    ("Lindsey Dabek", "Transfer"),
    ("Greg D", "Transfer"),
    ("Julia Rowe", "Transfer"),
    ("Aaron Roche", "Transfer"),
    ("Matt Teeter", "Transfer"),
    ("Simon Parubchuk", "Transfer"),
    ("Gabe Pirvu", "Transfer"),
    ("One-time contact", "Transfer"),
    ("RHEA SIMONE", "Transfer"),
    ("MICHELLE LUCZAY", "Transfer"),
    ("SCOTT ARMSTRONG", "Transfer"),
    ("ASHTONWILLIAMS", "Transfer"),
    ("Alfe Clemencio", "Transfer"),
    ("Mariusz Owczarz", "Transfer"),  # incoming transfer (different from outgoing reno)
    ("NAIVED THAKER", "Transfer"),
    ("DIANA KUZMINA", "Transfer"),
    ("Karolina Baker", "Transfer"),
    ("GRZEGORZ DIDUSZKO", "Transfer"),
    ("lina truong", "Transfer"),
    ("Rhea Rodrigues", "Transfer"),
    ("Amanda Elliott", "Transfer"),
    ("diana may", "Transfer"),
    ("QUESTRADE", "Investments"),
    ("Questrade", "Investments"),
    ("Tangerine", "Investments"),
    ("GIC Bonus", "Investments"),
    ("CRA (REVENUE)", "Income Tax"),
    ("TRIGIL LAW", "Income"),
    ("INTERNET BILL PAY", "Transfer"),  # bill payments to other cards
    ("IN-BRANCH TRANSFER", "Transfer"),
    ("DEBIT MEMO", "Transfer"),
    ("MEMO - TRANSFER", "Transfer"),
    ("WITHDRAWAL IBB", "Transfer"),
    ("EFT DEBIT REVERSAL", "Transfer"),
    ("E-TRANSFER STOP", "Transfer"),
    ("PREAUTHORIZED DEBIT", "Transfer"),  # generic catch-all for remaining preauth
    ("INTERNET BANKING", "Transfer"),  # generic catch-all
    ("BRANCH TRANSACTION", "Transfer"),  # generic catch-all
    ("ELECTRONIC FUNDS", "Transfer"),  # generic catch-all

    # ===== VETERINARY / PETS =====
    ("TAUNTON ROAD ANIMAL", "Veterinary"),
    ("HUMBERWOOD ANIMAL", "Veterinary"),
    ("OSHAWA ANIMAL", "Veterinary"),
    ("ANIMAL HOSPITAL", "Veterinary"),
    ("PETSMART", "Pets"),
    ("PET VALU", "Pets"),
    ("BONE AND BISCUIT", "Pets"),
    ("BONE & BISCUIT", "Pets"),

    # ===== HEALTHCARE =====
    ("SQ *ERICA BERMAN", "Therapy"),
    ("JODI ROUAH", "Therapy"),
    ("PARK LAWN HEALTH", "Dentist"),
    ("DR. MURRELL", "Dentist"),
    ("VILLAGE ORTHODONTICS", "Dentist"),
    ("HUMBER BAY EYE CARE", "Eyecare"),
    ("SMARTBUYGLASSES", "Eyecare"),
    ("REXALL PHARMACY", "Pharmacy"),
    ("SHOPPERS DRUG MART", "Pharmacy"),
    ("LAKES CARE PHARMACY", "Pharmacy"),
    ("MATAKANA PHARMACY", "Pharmacy"),
    ("Amavita", "Pharmacy"),
    ("HISTOPATH", "Medical"),
    ("OXYGEN YOGA", "Gym Membership"),

    # ===== GYM =====
    ("LA FITNESS", "Gym Membership"),

    # ===== ENTERTAINMENT / GAMING =====
    ("Sony Interactive", "Gaming & Video Games"),
    ("PLAYSTATIONNETWORK", "Gaming & Video Games"),
    ("PlayStation Network", "Gaming & Video Games"),
    ("GAMESTOP", "Gaming & Video Games"),
    ("SPLITSVILLE", "Entertainment"),
    ("HEADWATERS", "Entertainment"),
    ("CINEPLEX", "Entertainment"),
    ("TICKETMASTER", "Entertainment"),
    ("RIPLEYSAQUARIUM", "Entertainment"),
    ("TORONTO ZOO", "Entertainment"),
    ("RA-TORONTOZOO", "Entertainment"),
    ("IMMERSIVE VAN GOGH", "Entertainment"),
    ("ESCAPE MANOR", "Entertainment"),
    ("REBEL TORONTO", "Entertainment"),
    ("BMO FIELD", "Entertainment"),
    ("SCOTIABANK ARENA", "Entertainment"),
    ("BOARD OF GOVERNORS", "Entertainment"),
    ("TORONTO SYMPHONY", "Entertainment"),
    ("ROY THOMSON HALL", "Entertainment"),
    ("KOOZA", "Entertainment"),
    ("PINGLE'S FARM", "Entertainment"),
    ("SPRINGRIDGE FARM", "Entertainment"),
    ("GOLDSMITH'S ORCHARD", "Entertainment"),
    ("NORDIK SPA", "Entertainment"),
    ("NORDIK - THERMEA", "Entertainment"),
    ("Wai Ariki Hot Springs", "Entertainment"),

    # ===== SPOTIFY =====
    ("Spotify", "Entertainment"),
    ("SPOTIFY", "Entertainment"),

    # ===== ALCOHOL / BARS / LCBO =====
    ("LCBO", "Alcohol & Bars"),
    ("SLABTOWN CIDER", "Alcohol & Bars"),
    ("COLIO ESTATE WINES", "Alcohol & Bars"),

    # ===== COFFEE =====
    ("DARK HORSE ESPRESSO", "Coffee Shops"),
    ("THE COFFEE CLUB", "Coffee Shops"),
    ("The Coffee Bomb", "Coffee Shops"),
    ("REMEDY COFFEE", "Coffee Shops"),
    ("Axil Coffee Roasters", "Coffee Shops"),
    ("MOCHABERRY", "Coffee Shops"),
    ("STARBUCKS", "Coffee Shops"),
    ("TIM HORTONS", "Coffee Shops"),

    # ===== TRANSPORTATION =====
    ("COSTCO GAS", "Transportation"),
    ("SHELL EASYPAY", "Transportation"),
    ("SHELL C81004", "Transportation"),
    ("Shell A1 Limmat", "Transportation"),
    ("SHELL OIL", "Transportation"),
    ("ESSO CIRCLE", "Transportation"),
    ("ESSO", "Transportation"),
    ("PETRO-CANADA", "Transportation"),
    ("PETROCAN", "Transportation"),
    ("BOLTON HUSKY", "Transportation"),
    ("BRYANS FUEL", "Transportation"),
    ("UBER *TRIP", "Transportation"),
    ("UBER TRIP", "Transportation"),
    ("UBER* TRIP", "Transportation"),
    ("UBER ", "Transportation"),
    ("LYFT ", "Transportation"),
    ("PRESTO FARE", "Transportation"),
    ("METROLINX", "Transportation"),
    ("OSHAWA - GO TVM", "Transportation"),
    ("UNION STATION - TVM", "Transportation"),
    ("AT PUBLIC TRANSPORT", "Transportation"),
    ("TORONTO PARKING AUTH", "Transportation"),
    ("TORONTO PARKING AUTHOR", "Transportation"),
    ("IMPARK", "Transportation"),
    ("POLSON PARKING", "Transportation"),
    ("TORPRKAUT", "Transportation"),
    ("UNIT PARK", "Transportation"),
    ("PARK'N FLY", "Transportation"),
    ("CAPITOL BUILDINGS", "Transportation"),  # parking
    ("ALLIED PROPERTIES", "Transportation"),  # parking
    ("CITY OF MISSISSAUGA", "Transportation"),  # parking ticket
    ("MGB Matterhorn Parking", "Transportation"),
    ("MGB Tasch", "Transportation"),
    ("Autoverlad BLS", "Transportation"),  # Swiss car train
    ("KEISEI SKYLINER", "Transportation"),  # Japan train
    ("OASA ETICKET", "Transportation"),  # Athens transit

    # ===== CAR =====
    ("401 DIXIE MAZDA", "Transportation"),
    ("PRIMA MAZDA", "Transportation"),
    ("MOTION MAZDA", "Transportation"),
    ("ACTIVE GREEN + ROSS", "Transportation"),
    ("MTO RUS - SERVICEONTARIO", "Transportation"),

    # ===== INSURANCE =====
    ("INTACT INSURANCE", "Insurance"),
    ("AVIVA", "Insurance"),
    ("TORONTO STANDARD C", "Insurance"),  # condo insurance

    # ===== GROCERIES =====
    ("NOFRILLS", "Groceries"),
    ("NO FRILLS", "Groceries"),
    ("LOBLAWS", "Groceries"),
    ("FOOD BASICS", "Groceries"),
    ("SOBEYS", "Groceries"),
    ("COSIMO'S", "Groceries"),
    ("WAL-MART", "Groceries"),
    ("WALMART", "Groceries"),
    ("STEVE'S NF", "Groceries"),
    ("FORTINOS", "Groceries"),
    ("SS LOBLAW", "Groceries"),
    ("HALENDA'S MEATS", "Groceries"),
    ("SAFEWAY", "Groceries"),
    ("COBS BREAD", "Groceries"),
    ("FRESHCHOICE", "Groceries"),
    ("COSTCO WHOLESALE", "Groceries"),
    ("COSTCO", "Groceries"),
    ("FRESHCO", "Groceries"),
    ("FARM BOY", "Groceries"),
    ("METRO ", "Groceries"),
    ("365 MARKET", "Groceries"),
    ("Ritchies", "Groceries"),  # NZ grocery
    ("MIDTOWN MINI SUPERMARKET", "Groceries"),

    # ===== DINING / RESTAURANTS =====
    ("MCDONALD", "Dining"),
    ("McDonalds", "Dining"),
    ("CABANA POOL", "Dining"),
    ("DZO ", "Dining"),
    ("QUESADA", "Dining"),
    ("CACTUS CLUB", "Dining"),
    ("SHERWAY KEG", "Dining"),
    ("THE KEG ", "Dining"),
    ("AJAX KEG", "Dining"),
    ("FIREHOUSE SUBS", "Dining"),
    ("ELEPHANT & CASTLE", "Dining"),
    ("OHSHAWARMA", "Dining"),
    ("PITA PIT", "Dining"),
    ("PITA DELI", "Dining"),
    ("ASSEMBLY CHEF", "Dining"),
    ("CODA ", "Dining"),
    ("GREEN BOX", "Dining"),
    ("BAR BURRI", "Dining"),
    ("KOOZINA", "Dining"),
    ("CHIANG MAI", "Dining"),
    ("FAT FORK", "Dining"),
    ("SANSOTEI", "Dining"),
    ("BOOSTER JUICE", "Dining"),
    ("BORGO ANTICO", "Dining"),
    ("MOXIE", "Dining"),
    ("SCADDABUSH", "Dining"),
    ("SMOQUE", "Dining"),
    ("TERRONI", "Dining"),
    ("SUBWAY ", "Dining"),
    ("Subway ", "Dining"),
    ("CHIPOTLE", "Dining"),
    ("SWISS CHALET", "Dining"),
    ("DOMINO", "Dining"),
    ("JACK ASTOR", "Dining"),
    ("PIZZA PIZZA", "Dining"),
    ("JERK BROTHERS", "Dining"),
    ("SUNSET GRILL", "Dining"),
    ("STACKED PANCAKE", "Dining"),
    ("SQ *BURGER", "Dining"),
    ("NODO ", "Dining"),
    ("LUME KITCHEN", "Dining"),
    ("HUEVOS", "Dining"),
    ("PIZZAMUNNO", "Dining"),
    ("MY ROTI", "Dining"),
    ("LIBERTY COMMONS", "Dining"),
    ("AMANO PASTA", "Dining"),
    ("AVANTI TRATTORIA", "Dining"),
    ("DRUMS N FLATS", "Dining"),
    ("KB RESTAURANT", "Dining"),
    ("ANEJO", "Dining"),
    ("DALDONGNAE", "Dining"),
    ("HOTHOUSE", "Dining"),
    ("QUEEN'S PASTA", "Dining"),
    ("CORNER PLACE", "Dining"),
    ("ANGARA", "Dining"),
    ("TIN CUP", "Dining"),
    ("STUDEBAKER", "Dining"),
    ("IVY ARMS", "Dining"),
    ("TAPHOUSE", "Dining"),
    ("BROCK HOUSE", "Dining"),
    ("JASON GEORGE", "Dining"),
    ("CROOKED UNCLE", "Dining"),
    ("MORGAN`S PORT", "Dining"),
    ("DIME QUEEN", "Dining"),
    ("SHOELESS JOE", "Dining"),
    ("CHUCK'S ROADHOUSE", "Dining"),
    ("DELINA RESTAURANT", "Dining"),
    ("BB.Q CHICKEN", "Dining"),
    ("IKKOUSHA", "Dining"),
    ("TOUHENBOKU", "Dining"),
    ("JOHN STREET DINER", "Dining"),
    ("FIRKIN ON THE BAY", "Dining"),
    ("GOODMAN PUB", "Dining"),
    ("IRISH HARP", "Dining"),
    ("GRYPHON PUB", "Dining"),
    ("HEIRLOOM T1", "Dining"),
    ("HEARTH T1", "Dining"),
    ("SQ *STACKT", "Dining"),
    ("SQ *LOCAL", "Dining"),
    ("GRETA YYZ", "Dining"),
    ("BEER HALL", "Dining"),
    ("PINT PUBLIC", "Dining"),
    ("BEERTOWN", "Dining"),
    ("BELFAST LOVE", "Dining"),
    ("HUNTERS LANDING", "Dining"),
    ("DOCKSIDE WILLIES", "Dining"),
    ("RAD BROTHERS", "Dining"),
    ("12WELVE BISTRO", "Dining"),
    ("VAULT GASTRO", "Dining"),
    ("SQ *CHRONICLE", "Dining"),
    ("SQ *8-BIT CAFE", "Dining"),
    ("SQ *OPA'Z", "Dining"),
    ("PANAGO", "Dining"),
    ("DPRTMNT", "Dining"),
    ("TATSU SUSHI", "Dining"),
    ("CAMPECHANO", "Dining"),
    ("BLONDIES PIZZA", "Dining"),
    ("PHO BEN", "Dining"),
    ("MCGINTY", "Dining"),
    ("JAMESONS PUB", "Dining"),
    ("ADOBO FRESH", "Dining"),
    ("MI TACO", "Dining"),
    ("SQ *CANADIAN BREW", "Dining"),
    ("SHAWARMA KINGDOM", "Dining"),
    ("CHANG AND HUANG", "Dining"),
    ("NESPRESSO", "Dining"),  # coffee machine pods (food/bev)
    ("TST-", "Dining"),  # TST- prefix = Toast POS restaurants
    ("KELLYS LANDING", "Dining"),
    ("MARBLE SLAB", "Dining"),
    ("CONES AND CHARACTERS", "Dining"),
    ("SQ *ROCK STAR ICE", "Dining"),
    ("DAIRY QUEEN", "Dining"),
    ("ALLEY MISSISSAUGA", "Dining"),  # bubble tea
    ("Dieci Gelateria", "Dining"),
    ("00277 MACS CONV", "Dining"),

    # ===== TRAVEL (hotels, airlines, tour operators, foreign dining/activities) =====
    ("GADVENTURES", "Travel"),
    ("Intrepid Travel", "Travel"),
    ("SUNWING", "Travel"),
    ("AIR NZ", "Travel"),
    ("JETSTAR", "Travel"),
    ("Volotea", "Travel"),
    ("PRICELINE", "Travel"),
    ("SNAP TRAVEL", "Travel"),
    ("SUPERTRAVEL", "Travel"),
    ("VIATOR", "Travel"),
    ("EXPEDIA", "Travel"),
    ("Qeeq", "Travel"),
    ("SIXT", "Travel"),
    ("BANFF SPRINGS", "Travel"),
    ("HYATT REGENCY", "Travel"),
    ("SHERATON", "Travel"),
    ("DOUBLETREE", "Travel"),
    ("MOOSE HOTEL", "Travel"),
    ("CHARLES HOTEL", "Travel"),
    ("HILTON", "Travel"),
    ("Seehotel", "Travel"),
    ("HOTEL GARNI", "Travel"),
    ("SOVEREIGN HOTEL", "Travel"),
    ("DASH HOTEL", "Travel"),
    ("HARMONY HOTEL", "Travel"),
    ("ATHENS GATE HOTEL", "Travel"),
    ("NZETA", "Travel"),  # NZ visa
    ("IVISA", "Travel"),
    ("BREWSTER INC", "Travel"),
    ("TIX* DISCOVER BANFF", "Travel"),
    ("PARK DISTILLERY", "Travel"),  # Banff restaurant
    ("ROSE AND CROWN BANFF", "Travel"),  # Banff pub
    ("FOOD & BEVERAGE, BANFF", "Travel"),
    ("BANFF GRIZZLY", "Travel"),
    ("MAPLE LEAF CALGARY", "Travel"),
    ("ROCKWATER / WHITETOOTH", "Travel"),
    ("FH* REALNZ", "Travel"),
    ("REAL JOURNEYS", "Travel"),

    # Foreign transactions (NZD, CHF, EUR, AUD, USD abroad, DOP, SGD, IDR, JPY)
    ("NZD @", "Travel"),
    ("CHF @", "Travel"),
    ("EUR @", "Travel"),
    ("AUD @", "Travel"),
    ("DOP @", "Travel"),
    ("SGD @", "Travel"),
    ("IDR @", "Travel"),
    ("JPY @", "Travel"),
    ("USD @", "Travel"),

    # Specific travel locations that might not have currency
    ("COMING2 M BAHIA", "Travel"),  # Tulum
    ("RELAY AUCKLAND", "Travel"),
    ("ARAMARK ENTERTAINMENT", "Entertainment"),  # could be sports venue

    # ===== SHOPPING =====
    ("AMAZON", "Shopping"),
    ("AMZN", "Shopping"),
    ("Amazon", "Shopping"),
    ("IKEA", "Shopping"),
    ("CANADIAN TIRE", "Shopping"),
    ("CDN TIRE", "Shopping"),
    ("BANANAREPUBLIC", "Shopping"),
    ("BANANA REPUBLIC", "Shopping"),
    ("SPORT CHEK", "Shopping"),
    ("SPORTCHEK", "Shopping"),
    ("WWW.SPORTCHEK", "Shopping"),
    ("Sporting Life", "Shopping"),
    ("SPORTING LIFE", "Shopping"),
    ("HUDSON'S BAY", "Shopping"),
    ("THEBAY.COM", "Shopping"),
    ("Kate Spade", "Shopping"),
    ("LULULEMON", "Shopping"),
    ("LULULEMONCOM", "Shopping"),
    ("BROWNS SHOES", "Shopping"),
    ("BROWNSSHOES", "Shopping"),
    ("SP SAXXUNDERWEAR", "Shopping"),
    ("STITCH IT", "Shopping"),
    ("NATIONAL MATTRESS", "Shopping"),
    ("APPLE.COM", "Shopping"),
    ("Dyson Canada", "Shopping"),
    ("BEST BUY", "Shopping"),
    ("STAPLES", "Shopping"),
    ("LOWE'S", "Shopping"),
    ("INDIGO", "Shopping"),
    ("DOLLAR TREE", "Shopping"),
    ("DOLLARAMA", "Shopping"),
    ("SP SKULL SHAVER", "Shopping"),
    ("SP MASTERMIND TOYS", "Shopping"),
    ("EDIBLE ARRANGEMENTS", "Shopping"),
    ("GALERIA FLOWERS", "Shopping"),
    ("DMP FLORAL", "Shopping"),
    ("B2C LOBLAW- GIFT", "Shopping"),
    ("Etsy.com", "Shopping"),
    ("SPARKLE SOLUTIONS", "Shopping"),
    ("EVOLVE CLOTHING", "Shopping"),
    ("#839 PARTY CITY", "Shopping"),
    ("ENNEAGRAM INSTITUTE", "Shopping"),
    ("Movember Canada", "Donations"),
    ("JG *RAPE CRISIS", "Donations"),
    ("PAYPAL *AGENCYIICHA", "Shopping"),

    # ===== EDUCATION =====
    ("FCE-SENECA", "Education"),

    # ===== OTHER =====
    ("CALEDON BUILDING", "Other"),
    ("CALEDON- CCRW", "Other"),
    ("MECP-ONTPARK", "Other"),
    ("MECP-SIBBALD", "Other"),

    # ===== MOBILE =====
    ("FIDO Mobile", "Mobile"),
    ("ROGERS", "Mobile"),
    ("FIDO", "Mobile"),
]


def categorize(description):
    desc_upper = description.upper()
    for pattern, category in CATEGORY_RULES:
        if pattern.upper() in desc_upper:
            return category
    return None  # still uncategorized


def main():
    # Backup
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = f"{DB_PATH}.backup-{timestamp}"
    shutil.copy2(DB_PATH, backup_path)
    print(f"Backup created: {backup_path}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Get all uncategorized
        cursor.execute("""
            SELECT t.id, t.description, t.amount, a.name
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.category = 'Uncategorized' OR t.category IS NULL OR t.category = ''
        """)
        rows = cursor.fetchall()
        print(f"\nTotal uncategorized: {len(rows)}\n")

        updated = 0
        still_uncategorized = []
        category_counts = {}

        for tid, description, amount, account in rows:
            new_category = categorize(description)
            if new_category:
                cursor.execute(
                    "UPDATE transactions SET category = ? WHERE id = ?",
                    (new_category, tid)
                )
                category_counts[new_category] = category_counts.get(new_category, 0) + 1
                updated += 1
            else:
                still_uncategorized.append((tid, account, description, amount))

        print(f"--- RESULTS ---")
        print(f"Updated: {updated}")
        print(f"Still uncategorized: {len(still_uncategorized)}")

        print(f"\nCategory breakdown of updates:")
        for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
            print(f"  {cat:25s} {count:4d}")

        if still_uncategorized:
            print(f"\n--- STILL UNCATEGORIZED ({len(still_uncategorized)}) ---")
            for tid, acct, desc, amt in sorted(still_uncategorized, key=lambda x: abs(x[3]), reverse=True):
                print(f"  ID {tid:5d} | {acct:15s} | {desc[:65]:65s} | ${amt:>10,.2f}")

        conn.commit()
        print(f"\nAll changes committed.")

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
