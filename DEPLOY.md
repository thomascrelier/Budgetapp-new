# Budget App - Deploy Summary

## Current State

- **13,238 transactions** | **36 accounts** | **50 categories** | **0 uncategorized**
- **Date range:** Sep 12, 2016 — Nov 10, 2026
- **Data source:** Google Sheets (live, sole copy — the SQLite backup no longer exists)
- **Frontend:** Next.js on Vercel — https://budgetapp-new.vercel.app
- **Spreadsheet:** https://docs.google.com/spreadsheets/d/1R6WeQexEfvg5THbjfHRpXIXv5V1jdyAUp2pdIAPX5Xo

---

## Data Pipeline

```
Mint CSV Export → import_csv.py → SQLite → sync_to_sheets.py → Google Sheets → Vercel App
```

| Script | Purpose |
|---|---|
| `backend/import_csv.py` | Imports Mint CSV exports into SQLite |
| `backend/sync_to_sheets.py` | Pushes SQLite data to Google Sheets |
| `backend/import_cibc_nov2026.py` | Appends new CIBC chequing + Visa rows straight to Google Sheets, deduplicated against what is already there (`--offline`, `--dry-run`) |

---

## Categories (50 total)

### Spending

| Category | Txns | Total Spent |
|---|---|---|
| Groceries | 1,352 | $46,729 |
| Dining | 1,106 | $64,157 |
| Shopping | 787 | $76,521 |
| Transportation | 641 | $61,112 |
| Mortgage | 619 | $598,329 |
| Travel | 512 | $165,022 |
| Fast Food | 421 | $4,489 |
| Alcohol & Bars | 410 | $15,064 |
| Entertainment | 386 | $16,055 |
| Coffee Shops | 372 | $7,764 |
| Uber | 312 | $5,566 |
| Car Fuel | 274 | $13,937 |
| Pharmacy | 235 | $9,317 |
| Pets | 206 | $18,637 |
| Electricity | 191 | $25,005 |
| Internet | 133 | $8,043 |
| Gas | 129 | $11,806 |
| Home Improvement | 114 | $24,391 |
| Therapy | 70 | $12,386 |
| Mobile | 62 | $7,665 |
| Property Tax | 61 | $41,052 |
| Debt Payment | 60 | $38,838 |
| Gym Membership | 59 | $4,114 |
| Water | 46 | $10,481 |
| Donations | 44 | $4,495 |
| Dentist | 41 | $13,309 |
| Gaming & Video Games | 41 | $565 |
| Renovations | 38 | $64,486 |
| Repairs & Maintenance | 37 | $6,687 |
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
| Property Tax | 61 | $41,052 |
| Income Tax | 12 | $21,232 |
| Electricity | 191 | $25,005 |
| Gas | 129 | $11,806 |
| Water | 46 | $10,481 |
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
| Transfers & Payments | 1,601 | $4,490,886 |
| Investments | 1,534 | $1,831,571 |
| Income | 533 | $1,380,602 |
| Fees & Charges | 426 | $5,610 |
| Rental Income | 113 | $160,582 |
| Transfer | 62 | $53,874 |
| Other | 3 | $1,845 |

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
Same Google credentials go in `budget-vercel/.env.local` (not currently present; needed only for the local scripts, and note `.gitignore` matches `.env`, not `.env.local`)

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

---

## Deploy Checklist

- [ ] Sync latest data: `cd backend && python3 sync_to_sheets.py`
- [ ] Commit changes: `git add . && git commit`
- [ ] Push to GitHub: `git push origin main`
- [ ] Vercel auto-deploys from main branch
- [ ] Verify at https://budgetapp-new.vercel.app
