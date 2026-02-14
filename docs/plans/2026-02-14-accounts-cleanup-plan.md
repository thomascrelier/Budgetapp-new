# Accounts Page Cleanup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the Accounts page and sidebar account filter, mark unused accounts inactive, keep all transaction data.

**Architecture:** Data-layer change (Google Sheet `is_active` flag) + UI cleanup (remove nav item, account filter, Accounts component, and `selectedAccount` prop threading).

**Tech Stack:** Next.js, Google Sheets API, React

---

### Task 1: Write a one-time script to mark inactive accounts

**Files:**
- Create: `budget-vercel/scripts/mark-inactive-accounts.js`

**Step 1: Write the script**

```js
// budget-vercel/scripts/mark-inactive-accounts.js
// One-time script to mark unused accounts as inactive in the Google Sheet.
// Run from budget-vercel/: node scripts/mark-inactive-accounts.js

const { google } = require('googleapis');

const KEEP_ACTIVE = ['Main Chequing', 'CIBC Rental', 'Visa Credit Card', 'Rogers Mastercard'];

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  // Read all accounts
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Accounts!A:F',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) {
    console.log('No accounts found.');
    return;
  }

  const [headers, ...data] = rows;
  const isActiveCol = headers.indexOf('is_active'); // column index for is_active

  let updated = 0;
  for (let i = 0; i < data.length; i++) {
    const name = data[i][1];
    const currentActive = data[i][isActiveCol];
    const shouldBeActive = KEEP_ACTIVE.includes(name);

    if (!shouldBeActive && currentActive !== 'false') {
      // Row index in sheet: i + 2 (1-based, skip header)
      const rowNum = i + 2;
      const cell = `Accounts!${String.fromCharCode(65 + isActiveCol)}${rowNum}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: cell,
        valueInputOption: 'RAW',
        requestBody: { values: [['false']] },
      });
      console.log(`Marked inactive: ${name} (row ${rowNum})`);
      updated++;
    } else if (shouldBeActive) {
      console.log(`Keeping active: ${name}`);
    } else {
      console.log(`Already inactive: ${name}`);
    }
  }

  console.log(`\nDone. ${updated} accounts marked inactive.`);
}

main().catch(console.error);
```

**Step 2: Run the script**

```bash
cd budget-vercel && node -e "require('dotenv').config({path:'.env.local'})" scripts/mark-inactive-accounts.js
```

Or more practically, load env vars then run:
```bash
cd budget-vercel && node -r dotenv/config scripts/mark-inactive-accounts.js
```

Note: requires `dotenv` (already a Next.js dep). If `dotenv/config` doesn't pick up `.env.local`, load it manually:
```bash
cd budget-vercel && DOTENV_CONFIG_PATH=.env.local node -r dotenv/config scripts/mark-inactive-accounts.js
```

Expected output: each account printed with "Keeping active" or "Marked inactive". Verify 4 accounts kept active.

**Step 3: Commit**

```bash
git add budget-vercel/scripts/mark-inactive-accounts.js
git commit -m "chore: script to mark unused accounts inactive"
```

---

### Task 2: Remove Accounts nav item and account filter from Sidebar

**Files:**
- Modify: `budget-vercel/src/components/Sidebar.jsx`

**Step 1: Remove "Accounts" from navItems (line 11)**

Change the `navItems` array to remove the accounts entry:
```js
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
  { id: 'rental-property', label: 'Rental Property', icon: BuildingIcon },
  { id: 'transactions', label: 'Transactions', icon: ListIcon },
  { id: 'budgets', label: 'Budget Settings', icon: SlidersIcon },
];
```

**Step 2: Remove accounts state and loadAccounts (lines 80-93)**

Remove:
- `const [accounts, setAccounts] = useState([]);`
- The `useEffect` calling `loadAccounts`
- The `loadAccounts` function
- The `useState` import is still needed for other state if any — actually Sidebar has no other state, but keep the import since it's used by the parent.

Wait — Sidebar doesn't use `useState` for anything else. But it imports `useState` for `accounts`. Remove the `useState` import too? Check: Sidebar uses `useState` only for `accounts`. Remove the import.

Update the component signature to remove `selectedAccount` and `onAccountChange` props:
```js
export default function Sidebar({ currentPage, onPageChange, onUploadClick, onRefreshClick, user, isOpen, onToggle }) {
```

**Step 3: Remove the "Filter by Account" section (lines 163-178)**

Delete the entire `<div className="p-4 border-t border-neutral-700">` block that contains the account filter `<select>`.

**Step 4: Remove WalletIcon (lines 39-45)**

No longer used since Accounts nav item is gone. Delete the `WalletIcon` function.

**Step 5: Remove unused imports**

Remove `useState` and `useEffect` from the import (neither is used anymore).
Remove `api` import (was only used for `loadAccounts`).

**Step 6: Verify the app compiles**

```bash
cd budget-vercel && npm run build 2>&1 | head -30
```

Expected: no errors related to Sidebar.

**Step 7: Commit**

```bash
git add budget-vercel/src/components/Sidebar.jsx
git commit -m "feat: remove Accounts nav and account filter from sidebar"
```

---

### Task 3: Remove selectedAccount state and Accounts page from page.js

**Files:**
- Modify: `budget-vercel/src/app/page.js`

**Step 1: Remove selectedAccount state (line 19)**

Delete: `const [selectedAccount, setSelectedAccount] = useState(null);`

**Step 2: Remove Accounts import (line 11)**

Delete: `import Accounts from '@/components/Accounts';`

**Step 3: Remove accounts case from renderPage (lines 62-63)**

Delete:
```js
case 'accounts':
  return <Accounts key={refreshKey} onAccountCreated={() => setRefreshKey((prev) => prev + 1)} />;
```

**Step 4: Stop passing selectedAccount to components**

Update Dashboard, Transactions, BudgetSettings renders — remove `selectedAccount` prop:
```js
case 'dashboard':
  return <Dashboard key={refreshKey} />;
// ...
case 'transactions':
  return <Transactions key={refreshKey} />;
// ...
case 'budgets':
  return <BudgetSettings key={refreshKey} />;
default:
  return <Dashboard key={refreshKey} />;
```

**Step 5: Update Sidebar props — remove selectedAccount and onAccountChange**

```jsx
<Sidebar
  currentPage={currentPage}
  onPageChange={setCurrentPage}
  onUploadClick={() => setIsUploadModalOpen(true)}
  onRefreshClick={handleRefreshData}
  user={session?.user}
  isOpen={sidebarOpen}
  onToggle={() => setSidebarOpen(!sidebarOpen)}
/>
```

**Step 6: Commit**

```bash
git add budget-vercel/src/app/page.js
git commit -m "feat: remove Accounts page and selectedAccount state from main page"
```

---

### Task 4: Clean up selectedAccount prop from child components

**Files:**
- Modify: `budget-vercel/src/components/Dashboard.jsx`
- Modify: `budget-vercel/src/components/Transactions.jsx`
- Modify: `budget-vercel/src/components/BudgetSettings.jsx`
- Modify: `budget-vercel/src/components/MonthDetail.jsx`
- Modify: `budget-vercel/src/components/SpendingRiskTracker.jsx`

**Step 1: Dashboard.jsx — remove selectedAccount prop, always use personalAccountIds**

Change signature from:
```js
export default function Dashboard({ selectedAccount }) {
```
to:
```js
export default function Dashboard() {
```

In `loadData`, remove the line:
```js
let accountIds = selectedAccount || personalIds || null;
```
Replace with:
```js
let accountIds = personalIds || null;
```

Remove `selectedAccount` from `useEffect` dependency array:
```js
useEffect(() => {
  loadData();
}, []);
```

Update MonthDetail usage (line ~102):
```jsx
<MonthDetail month={selectedMonth} selectedAccount={personalAccountIds} onBack={() => setSelectedMonth(null)} />
```

Update SpendingRiskTracker usage (line ~236):
```jsx
<SpendingRiskTracker selectedAccount={personalAccountIds} />
```

Note: MonthDetail and SpendingRiskTracker still receive `selectedAccount`/`personalAccountIds` — this is the personal-account-only filter (excluding CIBC Rental), NOT the sidebar filter. Rename the prop to `accountIds` for clarity? Keeping it simple — just pass `personalAccountIds` directly. These sub-components use it as `account_ids` query param, so it works fine.

**Step 2: Transactions.jsx — remove selectedAccount prop**

Change signature from:
```js
export default function Transactions({ selectedAccount }) {
```
to:
```js
export default function Transactions() {
```

Remove the `useEffect` that syncs `selectedAccount` to `filterAccount` (lines 60-63):
```js
useEffect(() => {
  setFilterAccount(selectedAccount ? String(selectedAccount) : '');
}, [selectedAccount]);
```

The Transactions component already has its own account filter dropdown for filtering transactions. This stays — it loads active accounts and lets the user filter by account within the transactions view.

**Step 3: BudgetSettings.jsx — remove selectedAccount prop**

Change signature to remove `selectedAccount`:
```js
export default function BudgetSettings() {
```

Remove `selectedAccount` from useEffect dependency (line 34) and from `getBudgetStatus` call (line 41):
```js
api.getBudgetStatus(null, null),
```

Wait — let me check what that call does. The second param is probably account filter. Since we don't filter by account anymore, pass `null`.

**Step 4: Verify build**

```bash
cd budget-vercel && npm run build 2>&1 | head -40
```

Expected: clean build, no errors.

**Step 5: Commit**

```bash
git add budget-vercel/src/components/Dashboard.jsx budget-vercel/src/components/Transactions.jsx budget-vercel/src/components/BudgetSettings.jsx
git commit -m "refactor: remove selectedAccount prop from Dashboard, Transactions, BudgetSettings"
```

---

### Task 5: Delete Accounts.jsx component

**Files:**
- Delete: `budget-vercel/src/components/Accounts.jsx`

**Step 1: Delete the file**

```bash
rm budget-vercel/src/components/Accounts.jsx
```

**Step 2: Verify no remaining imports**

```bash
grep -r "Accounts" budget-vercel/src/ --include="*.js" --include="*.jsx" | grep -v node_modules | grep -v ".next"
```

Expected: no imports of `Accounts` component remain.

**Step 3: Final build check**

```bash
cd budget-vercel && npm run build
```

Expected: clean build.

**Step 4: Commit**

```bash
git add -u budget-vercel/src/components/Accounts.jsx
git commit -m "chore: delete unused Accounts component"
```

---

### Task 6: Run the inactive-accounts script and verify end-to-end

**Step 1: Run the mark-inactive script**

```bash
cd budget-vercel && DOTENV_CONFIG_PATH=.env.local node -r dotenv/config scripts/mark-inactive-accounts.js
```

**Step 2: Start dev server and verify**

```bash
cd budget-vercel && npm run dev
```

Verify:
- Sidebar has no "Accounts" nav item
- Sidebar has no account filter dropdown
- Dashboard loads correctly with personal accounts
- Transactions page works
- Upload CSV modal shows only 4 active accounts
- Rental Property page unaffected

**Step 3: Delete the one-time script**

```bash
rm budget-vercel/scripts/mark-inactive-accounts.js
git add -u budget-vercel/scripts/mark-inactive-accounts.js
git commit -m "chore: remove one-time inactive-accounts script"
```
