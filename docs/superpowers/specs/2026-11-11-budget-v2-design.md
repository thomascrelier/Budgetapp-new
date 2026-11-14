# Budget app V2: design

Date: 2026-11-11. App: `budget-vercel/` (Next.js 16 on Vercel, Google Sheet as database via a service account).

## Why

The owner (one person, Ontario) uses the app for personal spending and for one rental property (a two-unit house). Numbers "don't line up": the rental tab mixed card payments and personal Visa charges into rental expenses, imports silently dropped a whole account, each screen defined spending differently, and category edits fail. At tax time they file a CRA T776 and want receipts, kept in a Google Drive folder, viewable next to the items they support.

Success: every screen agrees on what income, spending and transfers are; importing a bank file is done in the app and can't silently double or drop data; the rental page shows what each tenant owes for which bill; and a Tax view lists T776 lines, capital items and receipts, ready for the accountant.

## Goals

1. **Fix live bugs.** Category edits fail (Next 16 `params` must be awaited). Credit card balances read backwards (purchases are stored negative, so a negative card balance is money owed).
2. **One definition of money.** One classifier (income / expense / refund / transfer / investment), one account scope (personal = active accounts except the rental account), one month calendar (America/Toronto), used by every analytics route. Card payments and transfers never count as spending or income. Refunds reduce spending in their category. Sheet cells parse robustly (formatted amounts, date strings, TRUE/FALSE in any case, blank ids).
3. **In-app import.** Read CIBC exports (no header row; account files have 4 columns, card files have 5 with the card number), and header CSVs. Detect the account by overlap with existing data. Show new / duplicate / older rows before saving; duplicates are count-aware on (date, amount). Categorize from the owner's own history first, then shared rules.
4. **Rental, corrected.** Cash overview excludes transfers. A T776 view maps categories to T776 lines with signs kept, takes mortgage interest from a figure the owner enters per year (only interest is deductible), lists capital items separately with a CCA class, and only pulls non-rental-account rows (e.g. Visa) when they are tagged for the T776.
5. **Tenant ledger.** Each tenant has a utility share and a payment style: utilities added on top of a base rent, or separate e-transfers under a maximum. Electricity and gas bills are due the month they post; water (quarterly) is due the following month. Show per tenant what's owed, for which bill, and what was paid.
6. **Tax view, receipts first** (owner chose layout C): tiles from the Drive receipts folder, each linked to a transaction, unlinked ones flagged, plus rental items missing receipts; per-transaction notes and a T776 tag; CSV export for the year.

## Non-goals

Bank sync; new budgeting method; recurring-bill calendar / forecast; net worth; computing CCA claims (the app lists items and classes, the accountant computes); OCR of receipts; rewriting the Python import scripts (one destructive script is deleted); cross-instance cache coherence on Vercel.

## Anti-goals

- Never reorder, sort or delete rows in the owner's sheet; only append rows or update specific cells.
- No personal names, account numbers or amounts hard-coded in source (the GitHub repo is public). Tenants are configured in the app and stored in the sheet.
- No silent drops: rows that fail to parse or are skipped as duplicates are reported.

## Decisions (owner's)

- Layout C for the tax section: receipts first, matched to transactions.
- Receipts live in a Google Drive folder the owner controls; the app links, it doesn't store files.
- Downstairs tenant adds the utility share to rent; upstairs tenant sends separate e-transfers; split 40/60 (configured in app).
- Money is CAD, en-CA.

## Decisions (builder's calls, recorded)

- Storage: Transactions gets column J `notes` and K `tax_tag`. New tabs `Settings` (key, value), `Tenants`, `Receipts`, created automatically with headers.
- `tax_tag` is readable text: `T776 8690`, `Capital CCA 8`, `Exclude`, `Review`. The parser also accepts earlier free text such as "T776 line 8690 - Insurance" or "T776 capital - CCA Class 8 (appliance)".
- Rental account name comes from `Settings.rental_account_name` (default `CIBC Rental`). Mortgage interest per year: `Settings` key `mortgage_interest:YYYY`. Receipts folder: `Settings.receipts_folder_id` (env `GOOGLE_RECEIPTS_FOLDER_ID` as fallback). The folder must be shared with the service account's email; the app shows that email.
- Classifier: transfer if category is Transfer / Transfers & Payments / Credit Card Payment, or the description is a card payment (`TO CARD`, `PAYMENT THANK YOU`, `PAIEMEN T MERCI`); investment if category Investments; positive amounts are income only in Income / Rental Income, otherwise refunds. `Debt Payment` stays spending (open question for the owner).
- Ported import rules drop the old catch-alls that filed any E-TRANSFER / PREAUTHORIZED DEBIT / Internet Banking row as Transfer; unknown rows become Uncategorized so they surface for review.
- Ledger allocation: a payment pays the charges due that month whose shares add up to it exactly (±$0.02); otherwise oldest open charges first. A payment in a month with no bills becomes a credit.
- Import: rows dated more than 7 days before the account's latest existing transaction are shown as "older" and unchecked by default.
- Receipt thumbnails load from `https://drive.google.com/thumbnail?id=<id>&sz=w320` in the owner's browser (they own the files); no proxy.
- Tests: vitest for pure modules; visual check with the mocked-API screenshot harness.
