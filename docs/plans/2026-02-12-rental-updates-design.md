# Rental Property Updates — Design Document

**Date:** 2026-02-12

## Overview

Five feature updates for the budget app, focused on rental property data and UI improvements.

## 1. Data Import & Cleanup

Import 790 rows from `Rental property newest transactions.csv` (CIBC Rental, 2021-01 to 2026-02) into both Google Sheets and SQLite.

**Script:** `budget-vercel/scripts/import-rental-csv.js`

- Parse CSV: `date, description, debit, credit` (no headers). Amount = credit - debit.
- Categorize using existing rules from `import_rental_property.py`, with tenant e-transfers as **"Rental Income"** (not "Income").
- New tenant/description mappings:
  - `MADISON BABCOCK` → Rental Income
  - `brandon and tay joint` → Rental Income
  - `Brandon Vuong Vuong` → Rental Income
  - `Chexy` → Rental Income
  - `Halil Cevrim` → Rental Income
  - `KPMG Inc.` → Other
  - `Auto Parts Settlement` → Other
  - `OPTICAL DISC DRIVE SETTLE` → Other
- Deduplicate against existing Google Sheets transactions on CIBC Rental by matching `(date, description, amount)`.
- Import new rows into both Google Sheets and SQLite.
- Re-categorize any existing "Income" entries on CIBC Rental to "Rental Income" in both data stores.

## 2. Category Consistency — "Rental Income" Rename

Update all code references:

- **`Transactions.jsx`** — Add "Rental Income" to the `CATEGORIES` dropdown array (keep "Income" for main job).
- **`rental-property/route.js`** — Change T776 Gross Rental Income mapping from `['Income']` to `['Rental Income']`.
- **`import_rental_property.py`** — Update `categorize()` e-transfer fallback to return `"Rental Income"` when amount > 0.
- **Memory notes** — Update category scheme to include "Rental Income".

## 3. Transactions Page — Account Column

Add an "Account" column to the transactions table (between Date and Description).

- **`sheets.js`** — Enrich `getTransactions()` to include `account_name` by joining against accounts data.
- **`transactions/route.js`** — No changes needed (passes through enriched data).
- **`Transactions.jsx`** — Add Account column header and cell displaying `account_name`.

## 4. Sankey Diagram — Rental Property Page

Visualize Income → Expense category flow for the selected year.

- **Left node:** Rental Income (total)
- **Right nodes:** Expense categories (Housing, Electricity, Gas, Property Tax, Water, Fees & Charges, etc.)
- **Surplus node:** Net surplus if income exceeds expenses
- **Library:** `d3-sankey` (custom SVG component, styled to match existing monochrome design)
- **Data source:** Existing rental property API (`category_breakdown`) — no backend changes.
- **Placement:** Between "Monthly Income vs Expenses" charts and "Year-over-Year Category Comparison".

## Files Changed

| Feature | Files |
|---|---|
| Data import + dedup | New `budget-vercel/scripts/import-rental-csv.js` |
| "Rental Income" rename | `Transactions.jsx`, `rental-property/route.js`, `import_rental_property.py` |
| Account column | `sheets.js`, `Transactions.jsx` |
| Sankey diagram | `RentalProperty.jsx`, `package.json` (add `d3-sankey`) |
