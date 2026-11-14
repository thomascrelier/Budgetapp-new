# Budget App - Deploy Summary

## Current State

- **13,367 transactions** | **36 accounts** | **50 categories** | **0 uncategorized**
- **Date range:** Sep 12, 2016 — Nov 10, 2026
- **Data source:** Google Sheets (live, sole copy — the SQLite backup no longer exists)
- **Frontend:** Next.js on Vercel — https://budgetapp-new.vercel.app
- **Spreadsheet:** https://docs.google.com/spreadsheets/d/1R6WeQexEfvg5THbjfHRpXIXv5V1jdyAUp2pdIAPX5Xo

---

## V2 Setup (one time)

Do these once after deploying V2. Step 1 is in Google Cloud, step 2 in Google Drive, steps 3 to 5 in the app.

1. **Turn on the Google Drive API.** In Google Cloud Console, open the project that owns the service account (the one in `GOOGLE_CREDENTIALS_JSON`), go to *APIs & Services → Library*, search for "Google Drive API" and click *Enable*. Until it is on, the Tax tab says the Google Drive API isn't turned on.
2. **Share a receipts folder with the app.** In Google Drive, create or pick the folder that holds your receipts. Subfolders one level down, such as one per year, are included. Right-click the folder, choose *Share*, paste the service account email and set it to **Viewer**. The Tax tab shows this email with a *Copy* button under *Rental Property → Tax*.
3. **Tell the app which folder.** Open the folder in Drive and copy its link from the address bar. Paste it on the Tax tab and save. To switch later, use *Change folder*.
4. **Add tenants.** In *Rental Property → Tenants*, click *Add tenant* for each tenant. Enter:
   - their unit and share of utilities;
   - how they pay utilities, either with the rent (above a base rent) or as separate e-transfers (up to a largest amount);
   - the name as it appears on their e-transfers;
   - the month they moved in.
5. **Enter mortgage interest every year.** On the Tax tab, type the year's interest from your lender's year-end statement into "Mortgage interest for YYYY". Line 8710 leaves out the mortgage until you do. Do this again for each new tax year.
6. **Receipt thumbnails come from Google.** They load only in a browser signed in to the Google account that owns the files. Elsewhere, each tile shows a document icon, and *Open in Drive* still works.
7. **The sheet updates itself.** The app creates the `Settings`, `Tenants` and `Receipts` tabs, with header rows, the first time it needs them. It also adds two columns to Transactions: J (`notes`) and K (`tax_tag`). The app writes edits back to specific rows, so **never sort the sheet**, and don't move, insert or delete rows. A filter view is fine because it leaves the rows in place.
8. **Starting balances.** Accounts column D (`initial_balance`) is the account's balance before its first transaction in the sheet. Set it so the balances in the app match the bank.

The rental account is the one named "CIBC Rental". To use another account, add a `rental_account_name` row to the `Settings` tab with that account's exact name.

---

## Data Pipeline

```
Bank CSV export → Upload CSV (in the app) → Google Sheets → Vercel App
```

Imports happen in the app. Download a CSV from the bank, then click **Upload CSV** in the sidebar. The app supports CIBC chequing and Visa exports (no header row) and CSVs with a header row.
- It works out which account the file belongs to and categorizes the rows.
- It skips rows the sheet already has. If the whole file is already there, it says which account has it.
- It shows what it will add before anything is written. Rows dated well before the account's latest transaction are listed separately and left unchecked; tick the ones you want.
- On confirm, it appends the new rows to the Transactions tab. Nothing else in the sheet changes.

The Python scripts in `backend/` are **optional and legacy**; the app does not use them.
- Most of them (`import_csv.py`, `import_*.py`, `fix_uncategorized.py`) wrote to a SQLite file that no longer exists.
- `import_cibc_nov2026.py` appends CIBC rows straight to the sheet (`--offline`, `--dry-run`). Upload CSV now does this job.
- The rules in `backend/` are the source `budget-vercel/scripts/export-rules.py` reads to generate `src/lib/rules/data.js`, so keep them.

`sync_to_sheets.py` was removed. It cleared the sheet and rebuilt it from that SQLite file, so running it now would wipe the live data.

---

## Categories (50 total)

### Spending

| Category | Txns | Total Spent |
|---|---|---|
| Groceries | 1,352 | $46,729 |
| Dining | 1,106 | $64,157 |
| Shopping | 787 | $76,521 |
| Mortgage | 658 | $611,125 |
| Transportation | 641 | $61,112 |
| Travel | 512 | $165,022 |
| Fast Food | 421 | $4,489 |
| Alcohol & Bars | 410 | $15,064 |
| Entertainment | 386 | $16,055 |
| Coffee Shops | 372 | $7,764 |
| Uber | 312 | $5,566 |
| Car Fuel | 274 | $13,937 |
| Pharmacy | 235 | $9,317 |
| Pets | 206 | $18,637 |
| Electricity | 200 | $26,653 |
| Gas | 138 | $12,469 |
| Internet | 133 | $8,043 |
| Home Improvement | 114 | $24,391 |
| Therapy | 70 | $12,386 |
| Property Tax | 70 | $45,208 |
| Mobile | 62 | $7,665 |
| Debt Payment | 60 | $38,838 |
| Gym Membership | 59 | $4,114 |
| Water | 49 | $11,194 |
| Repairs & Maintenance | 44 | $9,086 |
| Donations | 44 | $4,495 |
| Dentist | 41 | $13,309 |
| Gaming & Video Games | 41 | $565 |
| Renovations | 38 | $64,486 |
| Insurance | 37 | $4,798 |
| Eyecare | 27 | $5,100 |
| Rent | 26 | $39,165 |
| Education | 20 | $5,739 |
| Medical | 20 | $5,609 |
| Rental Property Insurance | 16 | $11,222 |
| Car Insurance | 15 | $15,860 |
| Income Tax | 12 | $21,232 |
| Health & Wellness | 10 | $813 |
| Veterinary | 9 | $1,582 |
| Advertising | 6 | $20 |
| Social Media | 5 | $167 |
| Utilities & Bills | 2 | $1,541 |
| Utilities | 2 | $339 |

### Tax-Relevant (separated for CRA)

| Category | Txns | Total |
|---|---|---|
| Property Tax | 70 | $45,208 |
| Income Tax | 12 | $21,232 |
| Electricity | 200 | $26,653 |
| Gas | 138 | $12,469 |
| Water | 49 | $11,194 |
| Internet | 133 | $8,043 |
| Mobile | 62 | $7,665 |
| Pharmacy | 235 | $9,317 |
| Dentist | 41 | $13,309 |
| Eyecare | 27 | $5,100 |
| Donations | 44 | $4,495 |
| Education | 20 | $5,739 |

### Income & Financial

| Category | Txns | Received |
|---|---|---|
| Transfers & Payments | 1,605 | $4,490,886 |
| Investments | 1,534 | $1,831,571 |
| Income | 533 | $1,380,602 |
| Fees & Charges | 444 | $5,763 |
| Rental Income | 143 | $203,641 |
| Transfer | 62 | $53,874 |
| Other | 4 | $1,894 |

---

## Accounts (36)

### Checking
Main Chequing, CIBC Rental, Condo, Personal, Cash, 50239832, World Elite 0385, Homeowner ReadiLine, Rental LOC, USD Account, Ford Credit Account, Tangerine Chequing Account, Other 1 HOUSE, Other 2 USD, Other 3 CONDO

### Credit Cards
CIBC Visa, VISA, Visa Credit Card, MasterCard, Rogers Mastercard, Smart Cash World MasterCard, TD CASH BACK VISA INFINITE* CARD, American Express(R) Aeroplan(R)* Reserve Card, Amex (inactive)

### Savings
Savings, Save, TFSA, TFSA Tax Advantage Savings Account, Individual TFSA, Individual RSP, RRSP, LIRA, Registered GIC, Tangerine Savings Account, Tangerine Guaranteed Investment (GIC)

### Investment
Individual margin

---

## Environment

### Vercel (Production)
| Variable | Status |
|---|---|
| `GOOGLE_SPREADSHEET_ID` | Set (no trailing newline) |
| `GOOGLE_CREDENTIALS_JSON` | Set (clean JSON) |
| `NEXTAUTH_URL` | https://budgetapp-new.vercel.app |
| `NEXTAUTH_SECRET` | Set |
| `GOOGLE_CLIENT_ID` | Set |
| `GOOGLE_CLIENT_SECRET` | Set |
| `ALLOWED_EMAIL` | thomas.crelier@gmail.com |

### Local (.env.local)
Copy `budget-vercel/.env.example` to `budget-vercel/.env.local` and fill in the same Google credentials to run the app or the scripts locally. This checkout has no `.env.local` yet, and `.gitignore` keeps `.env.local` out of git.

The service account in `GOOGLE_CREDENTIALS_JSON` needs both the Google Sheets API and the Google Drive API enabled in its Cloud project (see V2 Setup). Its `client_email` is the address the Tax tab tells you to share the receipts folder with.

---

## Recent Changes

1. Imported 10,000 transactions from Mint CSV export
2. Set up Google Sheets API (service account, spreadsheet shared)
3. Fixed Vercel env vars (trailing newline issue)
4. Consolidated 99 Mint categories → 35 custom categories
5. Separated tax-relevant categories (property tax, income tax, utilities split, medical)
6. Added caching layer to sheets.js (5-min TTL)
7. Imported rental property transactions
8. Added rental property dashboard with T776 tax summary
9. Zero uncategorized transactions remaining
10. Imported CIBC chequing + Visa through Nov 10, 2026 (747 rows, deduplicated)
11. Imported CIBC Rental through Nov 9, 2026 (129 rows, batch `cibc-rental-2026-11-11`)
12. V2:
    - The app reads hand-edited cells more reliably.
    - Spending is defined the same way on every screen.
    - There is one set of categorization rules.
    - **Upload CSV** imports in the app, checking for duplicates first.
    - Rental Property has three tabs: Overview, Tenants (a utility ledger per tenant) and Tax (a T776 with receipts from Drive, tags, capital items and a CSV export).
    - `sync_to_sheets.py` was removed.

---

## Deploy Checklist

- [ ] Tests pass: `cd budget-vercel && npx vitest run`
- [ ] Build passes: `cd budget-vercel && npx next build`
- [ ] Commit changes: `git add . && git commit`
- [ ] Push to GitHub: `git push origin main`
- [ ] Vercel auto-deploys from main branch
- [ ] Verify at https://budgetapp-new.vercel.app
