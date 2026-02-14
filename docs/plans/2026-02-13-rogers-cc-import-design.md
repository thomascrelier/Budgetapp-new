# Rogers Credit Card Import — Design Document

**Date:** 2026-02-13
**Status:** Ready for future implementation

## Problem

There are ~160 Rogers Mastercard transactions (Mar 2025 – Feb 2026) that need to be imported into the budget app. This is a second credit card alongside the existing CIBC Visa. The data isn't in a clean CSV — it's copied from the Rogers online banking portal.

## Goal

Create a "Rogers Mastercard" account, parse the transaction data, auto-categorize using existing categories, import to SQLite, and sync to Google Sheets — same pipeline as the CIBC Visa import.

## Source Data Format

The Rogers portal exports data as structured text (not CSV). Each transaction looks like:

```
Feb 11, 2026
costco gas w1169
Gas
$69.19
```

Some transactions have a "foreign transaction" line between the category and amount:
```
Jan 16, 2026
openai *chatgpt subscr
Shopping
foreign transaction
$32.27
```

Negative amounts are payments/refunds (prefixed with `-$`):
```
Feb 10, 2026
payment, thank you
Miscellaneous
-$528.25
```

### Parsing Strategy

Save the pasted data to a text file, then parse line-by-line:
1. Detect date lines (`MMM DD, YYYY` format)
2. Next line = description
3. Next line = Rogers category (ignored — we remap)
4. Optional "foreign transaction" line (skip)
5. Next line = amount (`$X,XXX.XX` or `-$X,XXX.XX`)
6. Optional "View" line (skip)

---

## Category Mapping

Map Rogers descriptions to existing budget app categories using the same pattern-matching approach as the CIBC Visa import. Below are all unique merchants from the data:

| Rogers Description | Mapped Category | Rule Pattern |
|---|---|---|
| costco gas w1169 / w1261 | Transportation | `COSTCO GAS` |
| shell easypay | Transportation | `SHELL` |
| payment, thank you | Transfer | `PAYMENT` (existing) |
| bell canada (ob) | Internet | `BELL CANADA` (existing) |
| costco wholesale | Groceries | `COSTCO WHOLESALE` |
| spotify | Entertainment | `SPOTIFY` |
| la fitness / la fitness annual fee | Entertainment | `LA FITNESS` |
| openai *chatgpt | Shopping | `OPENAI` |
| linkedinpre* | Shopping | `LINKEDIN` |
| elevenlabs.io | Shopping | `ELEVENLABS` |
| fido mobile | Mobile | `FIDO` (existing) |
| rogers | Mobile | `ROGERS` (existing) |
| mcdonald's | Dining | `MCDONALD` |
| 365 market | Groceries | `365 MARKET` (existing) |
| freshco | Groceries | `FRESHCO` (existing) |
| metro | Groceries | `METRO ` (existing) |
| zehrs | Groceries | `ZEHRS` |
| steve's nf | Groceries | `STEVE'S` |
| visconti's nf | Groceries | `VISCONTI` |
| fortinos | Groceries | `FORTINOS` |
| jack astor's | Dining | `JACK ASTOR` |
| firehouse subs | Dining | `FIREHOUSE` |
| bar burrito | Dining | `BAR BURRITO` |
| starbucks | Dining | `STARBUCKS` (existing) |
| booster juice | Dining | `BOOSTER JUICE` |
| the pilot / greystones / ajax keg / dejavu | Dining | Individual rules |
| pho ben thanh | Dining | `PHO BEN` |
| dominos pizza | Dining | `DOMINOS` (existing) |
| mochaberry coffee | Dining | `MOCHABERRY` |
| petsmart / pet valu | Shopping | `PETSMART`, `PET VALU` |
| sporting life / sportchek / rwco | Shopping | Individual rules |
| banana republic | Shopping | `BANANA REPUBLIC` (existing) |
| google *google one | Shopping | `GOOGLE` |
| amazon / amzn mktp | Shopping | `AMAZON`, `AMZN` |
| canadian tire | Shopping | `CANADIAN TIRE` (existing) |
| presto fare / presto autl | Transportation | `PRESTO` |
| toronto parking | Transportation | `PARKING` |
| shoppers drug mart | Pharmacy | `SHOPPERS DRUG MART` (existing) |
| park lawn health | Therapy | `PARK LAWN HEALTH` (existing) |
| oshawa animal hospital / humberwood animal hosp | Veterinary | `ANIMAL HOSPITAL`, `HUMBERWOOD` |
| jodi rouah | Therapy | `JODI ROUAH` (existing) |
| intact insurance / aviva general | Insurance | `INTACT INSURANCE` (existing), `AVIVA` |
| cashback / remises | Transfer | `CASHBACK` |
| headwaters racquet | Entertainment | `HEADWATERS` |
| splitsville | Entertainment | `SPLITSVILLE` |
| the kidney foundation / alzheimers | Other | `KIDNEY`, `ALZHEIMER` |
| caledon- ccrw | Other | `CALEDON` |
| monkhouse law | Other | `MONKHOUSE` |
| mecp- | Other | `MECP` |

### New rules to add (not in CIBC Visa script)

```python
# Transportation (gas stations + transit)
("COSTCO GAS", "Transportation"),
("SHELL", "Transportation"),
("PRESTO", "Transportation"),
("PARKING", "Transportation"),

# Groceries
("COSTCO WHOLESALE", "Groceries"),
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

# Entertainment / Subscriptions
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

# Insurance
("AVIVA", "Insurance"),

# Transfer
("CASHBACK", "Transfer"),

# Other
("KIDNEY", "Other"),
("ALZHEIMER", "Other"),
("CALEDON", "Other"),
("MONKHOUSE", "Other"),
("MECP", "Other"),
```

**Important:** `COSTCO GAS` must come before the existing `COSTCO` groceries rule (first match wins).

### Note on CIBC Visa rule conflict

The existing CIBC Visa script maps `COSTCO` → Groceries. For Rogers, we need `COSTCO GAS` → Transportation and `COSTCO WHOLESALE` → Groceries. The solution: add the more specific `COSTCO GAS` and `COSTCO WHOLESALE` rules *before* the generic `COSTCO` fallback. This also improves CIBC Visa categorization (Costco gas charges there were previously hitting Groceries).

---

## Implementation Tasks

### Task 1: Save source data to a text file

**File:** `backend/data/rogers_transactions.txt` (new)

Copy the pasted transaction data into a text file for the parser to read.

### Task 2: Create import script

**File:** `backend/import_rogers_cc.py` (new)

Mirrors `import_credit_card.py` but with:
- **Text parser** instead of CSV reader (handles the multi-line format)
- **Account name:** "Rogers Mastercard" (type: `credit_card`, initial_balance: 0)
- **Merged category rules:** All existing CIBC rules + new Rogers-specific rules (ordered so specific patterns like `COSTCO GAS` come before generic ones like `COSTCO`)
- Same atomic insert, backup, batch_id, and summary output

Parser pseudocode:
```python
lines = open(file).readlines()
i = 0
while i < len(lines):
    line = lines[i].strip()
    if is_date(line):  # matches "MMM DD, YYYY"
        date = parse_date(line)
        description = lines[i+1].strip()
        # Skip Rogers category line
        i += 2
        # Skip optional "foreign transaction" line
        if lines[i+1].strip().lower() == "foreign transaction":
            i += 1
        amount_str = lines[i+1].strip()  # "$69.19" or "-$528.25"
        amount = parse_amount(amount_str)
        # Skip optional "View" line
        ...
        yield (date, description, amount)
    i += 1
```

Amount parsing:
- Strip `$` and commas
- If starts with `-`, negate (these are payments/refunds → positive in our system)
- Purchases are positive in Rogers format → negative in our system (money going out)

**Wait — Rogers format quirk:** In Rogers, purchases are positive (`$69.19`) and payments are negative (`-$528.25`). In our system, purchases should be negative (expense) and payments positive (credit). So: `amount = -rogers_amount` for purchases, and payments are already negative in Rogers but should be positive in our system. Simplest: `amount = -parsed_value`.

### Task 3: Sync to Google Sheets

Run existing `backend/sync_to_sheets.py` — it already syncs all accounts and transactions from SQLite to Sheets. No changes needed.

### Task 4: Update CIBC Visa category rules

**File:** `backend/import_credit_card.py`

Add the new specific rules (COSTCO GAS, COSTCO WHOLESALE, etc.) to the CIBC Visa script too, so both scripts stay consistent. Move `COSTCO GAS` before the generic `COSTCO` rule.

### Task 5: Verify in app

- Confirm "Rogers Mastercard" appears in the sidebar account selector
- Confirm transactions show with correct categories
- Confirm Dashboard KPIs include the new account
- Spot-check a few transactions (amounts, dates, categories)

---

## Transaction Summary (from source data)

| Stat | Value |
|------|-------|
| Total transactions | ~160 |
| Date range | Mar 1, 2025 – Feb 11, 2026 |
| Payments (negative) | ~16 transactions |
| Purchases (positive) | ~144 transactions |
| Foreign transactions | 8 (OpenAI, ElevenLabs) |

### Major spending categories (estimated):
- **Transportation (gas):** ~$1,200 (Costco Gas, Shell)
- **Groceries:** ~$750 (Costco Wholesale, Freshco, Metro, etc.)
- **Dining:** ~$900 (365 Market, Starbucks, restaurants)
- **Shopping:** ~$2,100 (Costco Wholesale non-grocery, Amazon, clothing)
- **Entertainment:** ~$470 (LA Fitness, Spotify, Splitsville)
- **Insurance:** ~$4,400 (Intact, Aviva — large annual premiums)
- **Healthcare:** ~$2,200 (Vet, therapy, pharmacy)
- **Mobile/Telecom:** ~$650 (Bell, Fido, Rogers)

---

## Testing Checklist

- [ ] Parser handles "foreign transaction" lines correctly
- [ ] Parser handles commas in amounts (e.g., `$2,222.96`)
- [ ] Payments show as positive amounts (credits to the card)
- [ ] Purchases show as negative amounts (debits)
- [ ] No duplicate transactions if script is run twice (idempotent delete + recreate)
- [ ] All merchants are categorized (0 Uncategorized ideally)
- [ ] Google Sheets sync completes without errors
- [ ] New account visible in the app's account selector
- [ ] Dashboard totals update correctly
- [ ] Costco Gas ≠ Costco Wholesale (different categories)
