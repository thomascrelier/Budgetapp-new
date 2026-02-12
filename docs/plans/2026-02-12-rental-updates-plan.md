# Rental Property Updates — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add account column to transactions, rename "Income" to "Rental Income" for rental data, import new CSV data, and add a Sankey diagram to the rental property page.

**Architecture:** Google Sheets is the primary data layer for the Vercel frontend; SQLite is the secondary backend store. Category changes propagate to both. The Sankey diagram uses d3-sankey with a custom SVG component.

**Tech Stack:** Next.js (App Router), Google Sheets API (googleapis), SQLite (backend), d3-sankey, recharts, Tailwind CSS.

---

### Task 1: Rename "Income" → "Rental Income" in Code

Update all code references so rental property income uses the distinct "Rental Income" category. This is foundational — other tasks depend on it.

**Files:**
- Modify: `budget-vercel/src/components/Transactions.jsx:6-27`
- Modify: `budget-vercel/src/app/api/analytics/rental-property/route.js:6`
- Modify: `backend/import_rental_property.py:81`

**Step 1: Add "Rental Income" to the Transactions.jsx CATEGORIES array**

In `budget-vercel/src/components/Transactions.jsx`, add `'Rental Income'` after `'Income'` (line 15) in the CATEGORIES array:

```javascript
const CATEGORIES = [
  'Uncategorized',
  'Groceries',
  'Dining',
  'Transportation',
  'Utilities',
  'Entertainment',
  'Shopping',
  'Healthcare',
  'Income',
  'Rental Income',
  'Rent',
  'Electricity',
  'Gas',
  'Water',
  'Internet',
  'Insurance',
  'Property Tax',
  'Maintenance',
  'HOA',
  'Transfer',
  'Other',
];
```

**Step 2: Update the T776_GROUPS in rental-property route**

In `budget-vercel/src/app/api/analytics/rental-property/route.js`, line 6, change:

```javascript
{ name: 'Gross Rental Income', categories: ['Income'], isIncome: true },
```

to:

```javascript
{ name: 'Gross Rental Income', categories: ['Rental Income'], isIncome: true },
```

**Step 3: Update import_rental_property.py categorize() function**

In `backend/import_rental_property.py`, line 81, change:

```python
return "Income" if amount > 0 else "Transfers & Payments"
```

to:

```python
return "Rental Income" if amount > 0 else "Transfers & Payments"
```

**Step 4: Update memory notes**

Update the Category Scheme in MEMORY.md to:
`Housing, Electricity, Gas, Property Tax, Water, Fees & Charges, Rental Income, Income, Income Tax, Renovations, Transfers & Payments, Other`

**Step 5: Verify locally**

Run: `cd /Users/thomas.crelier/Desktop/Claude/Budget/budget-vercel && npm run build`
Expected: Build succeeds with no errors.

**Step 6: Commit**

```bash
git add budget-vercel/src/components/Transactions.jsx budget-vercel/src/app/api/analytics/rental-property/route.js backend/import_rental_property.py
git commit -m "feat: rename rental income category from 'Income' to 'Rental Income'"
```

---

### Task 2: Add Account Column to Transactions Page

Enrich the transactions API response with account names and display them in the table.

**Files:**
- Modify: `budget-vercel/src/lib/sheets.js:275-309` (getTransactions function)
- Modify: `budget-vercel/src/components/Transactions.jsx:122-137` (table header), `141-199` (table rows)

**Step 1: Enrich getTransactions() with account_name**

In `budget-vercel/src/lib/sheets.js`, modify the `getTransactions()` function (starting at line 275). After filtering and sorting, enrich each transaction with `account_name` by looking up accounts:

```javascript
export async function getTransactions(filters = {}) {
  let allTransactions = getCached('transactions');
  if (!allTransactions) {
    allTransactions = await fetchTransactionsFromSheets();
    setCache('transactions', allTransactions);
  }

  let transactions = [...allTransactions];

  // Apply filters
  if (filters.account_id) {
    transactions = transactions.filter(t => t.account_id === parseInt(filters.account_id));
  }
  if (filters.category) {
    transactions = transactions.filter(t => t.category === filters.category);
  }
  if (filters.start_date) {
    transactions = transactions.filter(t => t.date >= filters.start_date);
  }
  if (filters.end_date) {
    transactions = transactions.filter(t => t.date <= filters.end_date);
  }

  // Sort by date descending
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  // Enrich with account names
  const accounts = await getAccounts(true);
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a.name]));
  transactions = transactions.map(t => ({
    ...t,
    account_name: accountMap[t.account_id] || 'Unknown',
  }));

  // Pagination
  const skip = filters.skip || 0;
  const limit = filters.limit || 50;

  return {
    transactions: transactions.slice(skip, skip + limit),
    total: transactions.length,
  };
}
```

**Step 2: Add Account column to the table header**

In `budget-vercel/src/components/Transactions.jsx`, add a new `<th>` between Date and Description (after line 127):

```jsx
<th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
  Account
</th>
```

**Step 3: Add Account cell to the table body**

In `budget-vercel/src/components/Transactions.jsx`, add a new `<td>` between the Date cell and Description cell (after line 143):

```jsx
<td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
  {transaction.account_name}
</td>
```

**Step 4: Verify locally**

Run: `cd /Users/thomas.crelier/Desktop/Claude/Budget/budget-vercel && npm run build`
Expected: Build succeeds. Run `npm run dev` and check `/` — transactions table now shows Account column.

**Step 5: Commit**

```bash
git add budget-vercel/src/lib/sheets.js budget-vercel/src/components/Transactions.jsx
git commit -m "feat: add account column to transactions table"
```

---

### Task 3: Import New CSV Data

Write and run a Node.js script to import the 790-row CSV into Google Sheets and SQLite, with deduplication and the "Rental Income" category.

**Files:**
- Create: `budget-vercel/scripts/import-rental-csv.mjs`

**Step 1: Create the import script**

Create `budget-vercel/scripts/import-rental-csv.mjs`. This script:

1. Reads `~/Downloads/Rental property newest transactions.csv`
2. Parses each row (date, description, debit, credit — no headers)
3. Categorizes using the same rules as `import_rental_property.py` (ported to JS), with e-transfer fallback returning "Rental Income"
4. Fetches existing CIBC Rental transactions from Google Sheets
5. Deduplicates by matching `(date, description, amount)`
6. Appends only new rows to Google Sheets
7. Also imports into SQLite
8. Re-categorizes any existing "Income" entries on CIBC Rental to "Rental Income" in both stores
9. Prints a summary of what was imported, skipped, and re-categorized

The script needs Google credentials. Use the same env vars as the app: `GOOGLE_CREDENTIALS_JSON` and `GOOGLE_SPREADSHEET_ID`. Load them from `budget-vercel/.env.local`.

Category rules (ported from Python):

```javascript
const CATEGORY_RULES = [
  // Utilities & recurring
  ['MORTGAGE PAYMENT', 'Housing'],
  ['Hydro One', 'Electricity'],
  ['ENBRIDGE', 'Gas'],
  ['Tax Pmt Town of Caledon', 'Property Tax'],
  ['CALEDON TAX', 'Property Tax'],
  ['REGIONOFPEEL EZ PAY', 'Water'],
  ['PEEL (REGION OF) WATER', 'Water'],
  ['SERVICE CHARGE', 'Fees & Charges'],
  ['CRA (REVENUE', 'Income Tax'],

  // Maintenance & repairs
  ['Bobby HVAC', 'Housing'],
  ['Josh Carnackie', 'Housing'],
  ['alex all mighty', 'Housing'],
  ['Adam Apex', 'Housing'],
  ['Deborah hall', 'Housing'],
  ['One-time contact', 'Housing'],

  // Renovation contractors
  ['mike construction', 'Renovations'],
  ['Kosta Electri', 'Renovations'],
  ['matt Bove', 'Renovations'],
  ['Jessica kitchen', 'Renovations'],
  ['Permit Works', 'Renovations'],
  ['angelo window', 'Renovations'],
  ['Jeff Lucky', 'Renovations'],
  ['Adam Energy', 'Renovations'],

  // People / transfers
  ['MARIUSZ', 'Other'],
  ['Maria Crelier', 'Transfers & Payments'],
  ['THOMAS CRELIER', 'Transfers & Payments'],
  ['KPMG', 'Other'],
  ['Auto Parts Settlement', 'Other'],
  ['OPTICAL DISC DRIVE', 'Other'],

  // Financial transfers
  ['AMERICAN EXPRESS', 'Transfers & Payments'],
  ['MASTERCARD, ROGERS', 'Transfers & Payments'],
  ['INTERNET TRANSFER', 'Transfers & Payments'],
  ['INTERNET DEPOSIT', 'Transfers & Payments'],
  ['INTERNET BILL PAY', 'Transfers & Payments'],
  ['ATM', 'Transfers & Payments'],
  ['CIBC-NGIC', 'Transfers & Payments'],
  ['E-TRANSFER STOP', 'Fees & Charges'],
];

function categorize(description, amount) {
  const descUpper = description.toUpperCase();
  for (const [pattern, category] of CATEGORY_RULES) {
    if (descUpper.includes(pattern.toUpperCase())) {
      return category;
    }
  }
  // E-TRANSFER fallback
  if (descUpper.includes('E-TRANSFER')) {
    return amount > 0 ? 'Rental Income' : 'Transfers & Payments';
  }
  return 'Uncategorized';
}
```

**Step 2: Load env vars and connect to Google Sheets + SQLite**

The script should:
- Read `budget-vercel/.env.local` with `dotenv` (or manually parse it)
- Connect to Google Sheets using `googleapis`
- Connect to SQLite at `backend/budgetcsv.db` using `better-sqlite3` (install if needed)

**Step 3: Run the import script (dry run first)**

Run: `cd /Users/thomas.crelier/Desktop/Claude/Budget && node budget-vercel/scripts/import-rental-csv.mjs --dry-run`
Expected: Prints how many rows would be imported, how many are duplicates, and categorization breakdown. No actual writes.

**Step 4: Run the actual import**

Run: `cd /Users/thomas.crelier/Desktop/Claude/Budget && node budget-vercel/scripts/import-rental-csv.mjs`
Expected: Prints import results — rows imported, duplicates skipped, re-categorized count.

**Step 5: Verify via the app**

Run: `cd /Users/thomas.crelier/Desktop/Claude/Budget/budget-vercel && npm run dev`
Check the Rental Property page — data should now span back to 2021 with "Rental Income" as the income category.

**Step 6: Commit**

```bash
git add budget-vercel/scripts/import-rental-csv.mjs
git commit -m "feat: add rental property CSV import script with dedup and Rental Income category"
```

---

### Task 4: Sankey Diagram on Rental Property Page

Add a Sankey chart showing Income → Expense category flow for the selected year.

**Files:**
- Modify: `budget-vercel/package.json` (add d3-sankey, d3-shape)
- Create: `budget-vercel/src/components/SankeyChart.jsx`
- Modify: `budget-vercel/src/components/RentalProperty.jsx:368-370` (insert Sankey between charts and YoY comparison)

**Step 1: Install d3-sankey**

Run: `cd /Users/thomas.crelier/Desktop/Claude/Budget/budget-vercel && npm install d3-sankey d3-shape`

**Step 2: Create SankeyChart component**

Create `budget-vercel/src/components/SankeyChart.jsx` — a reusable SVG Sankey component.

Props:
- `data`: `{ nodes: [{ name }], links: [{ source, target, value }] }`
- `width` / `height`: dimensions (default 600x400)

Uses `d3-sankey` for layout computation and renders SVG `<rect>` for nodes and `<path>` for links. Style: monochrome palette matching existing COLORS constant. Income node in green (#22C55E), expense nodes in grays, surplus node in blue.

Tooltip on hover showing category name and dollar amount.

**Step 3: Build Sankey data from existing API response**

In `RentalProperty.jsx`, compute the Sankey data from `category_breakdown` (already available from the API):

```javascript
const sankeyData = useMemo(() => {
  if (!category_breakdown || category_breakdown.length === 0) return null;

  const incomeTotal = annual_summary.total_income || 0;
  const expenseCategories = category_breakdown.filter(c => !c.is_income && c.selected_year_total > 0);

  if (incomeTotal === 0 || expenseCategories.length === 0) return null;

  const totalExpenses = expenseCategories.reduce((sum, c) => sum + c.selected_year_total, 0);
  const surplus = Math.max(0, incomeTotal - totalExpenses);

  const nodes = [
    { name: 'Rental Income' },
    ...expenseCategories.map(c => ({ name: c.category })),
  ];
  if (surplus > 0) nodes.push({ name: 'Net Surplus' });

  const links = expenseCategories.map((c, i) => ({
    source: 0,
    target: i + 1,
    value: c.selected_year_total,
  }));
  if (surplus > 0) {
    links.push({ source: 0, target: nodes.length - 1, value: surplus });
  }

  return { nodes, links };
}, [category_breakdown, annual_summary]);
```

**Step 4: Insert the Sankey into the page layout**

In `RentalProperty.jsx`, add the Sankey chart between the Charts Row (`</div>` at line 368) and the Year-over-Year section (line 370):

```jsx
{/* Income Flow (Sankey) */}
{sankeyData && (
  <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
    <h2 className="text-lg font-bold text-text-primary mb-4">Income Flow</h2>
    <SankeyChart data={sankeyData} width={800} height={400} />
  </div>
)}
```

**Step 5: Verify locally**

Run: `cd /Users/thomas.crelier/Desktop/Claude/Budget/budget-vercel && npm run build`
Expected: Build succeeds. Run `npm run dev` and check Rental Property page — Sankey diagram shows income flowing into expense categories.

**Step 6: Commit**

```bash
git add budget-vercel/package.json budget-vercel/package-lock.json budget-vercel/src/components/SankeyChart.jsx budget-vercel/src/components/RentalProperty.jsx
git commit -m "feat: add Sankey income flow diagram to rental property page"
```

---

### Task 5: Final Build Verification & Deploy

**Step 1: Full build check**

Run: `cd /Users/thomas.crelier/Desktop/Claude/Budget/budget-vercel && npm run build`
Expected: Build succeeds with no errors or warnings.

**Step 2: Push to deploy**

```bash
git push origin main
```

Expected: Vercel auto-deploys from main. Check https://budgetapp-new.vercel.app after deploy.
