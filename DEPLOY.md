# Budget App - Deploy Summary

## Current State

- **10,217 transactions** | **33 accounts** | **35 categories** | **0 uncategorized**
- **Date range:** Sep 12, 2016 — Feb 9, 2026
- **Data source:** Google Sheets (live) + SQLite (backup)
- **Frontend:** Next.js on Vercel — https://budget-vercel.vercel.app
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

---

## Categories (35 total)

### Spending

| Category | Txns | Total Spent |
|---|---|---|
| Restaurants | 981 | $29,295 |
| Groceries | 972 | $30,666 |
| Housing | 818 | $263,924 |
| Transportation | 650 | $103,202 |
| Shopping | 470 | $36,963 |
| Alcohol & Bars | 353 | $12,478 |
| Coffee Shops | 316 | $4,526 |
| Uber | 312 | $5,566 |
| Entertainment | 218 | $6,711 |
| Travel | 194 | $94,503 |
| Electricity | 193 | $25,110 |
| Gas (Enbridge) | 130 | $11,947 |
| Pharmacy | 125 | $5,119 |
| Health & Wellness | 124 | $15,764 |
| Pets | 119 | $10,423 |
| Utilities & Bills | 84 | $27,950 |
| Internet | 74 | $4,260 |
| Water | 46 | $10,481 |
| Mobile | 43 | $5,600 |
| Donations | 37 | $3,889 |
| Gaming & Video Games | 32 | $321 |
| Renovations | 31 | $57,693 |
| Gym Membership | 24 | $1,591 |
| Eyecare | 18 | $3,456 |
| Education | 14 | $3,645 |
| Dentist | 8 | $3,550 |
| Social Media | 5 | $167 |

### Tax-Relevant (separated for CRA)

| Category | Txns | Total |
|---|---|---|
| Property Tax | 64 | $42,035 |
| Income Tax | 12 | $21,232 |
| Electricity | 193 | $25,110 |
| Gas | 130 | $11,947 |
| Water | 46 | $10,481 |
| Internet | 74 | $4,260 |
| Mobile | 43 | $5,600 |
| Pharmacy | 125 | $5,119 |
| Dentist | 8 | $3,550 |
| Eyecare | 18 | $3,456 |
| Donations | 37 | $3,889 |
| Education | 14 | $3,645 |

### Income & Financial

| Category | Txns | Received |
|---|---|---|
| Transfers & Payments | 1,468 | $4,537,276 |
| Investments | 1,421 | $1,421,280 |
| Income | 506 | $821,458 |
| Fees & Charges | 238 | $2,799 |
| Other | 116 | $840,478 |

---

## Accounts (33)

### Checking
CIBC Rental, Main, Main Chequing, Rental Property, Rental property, Chequing, Condo, Personal, Tangerine Chequing Account, Homeowner ReadiLine, Rental LOC, USD Account, 50239832, World Elite 0385, Ford Credit Account

### Credit Cards
American Express Aeroplan Reserve Card, VISA, Visa Credit Card, MasterCard, Smart Cash World MasterCard, TD Cash Back Visa Infinite Card

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
| `NEXTAUTH_URL` | https://budget-vercel.vercel.app |
| `NEXTAUTH_SECRET` | Set |
| `GOOGLE_CLIENT_ID` | Set |
| `GOOGLE_CLIENT_SECRET` | Set |
| `ALLOWED_EMAIL` | thomas.crelier@gmail.com |

### Local (.env.local)
Same Google credentials configured in `budget-vercel/.env.local`

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

---

## Deploy Checklist

- [ ] Sync latest data: `cd backend && python3 sync_to_sheets.py`
- [ ] Commit changes: `git add . && git commit`
- [ ] Push to GitHub: `git push origin main`
- [ ] Vercel auto-deploys from main branch
- [ ] Verify at https://budget-vercel.vercel.app
