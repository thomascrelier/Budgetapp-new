# Month Drill-Down — Design Document

**Date:** 2026-02-13
**Status:** Ready for future implementation

## Problem

The Dashboard cash flow chart shows 6 months of income vs expenses bars, but clicking a month does nothing. You can see that January had $X income and $Y spend, but there's no way to dig into *what* drove that month's numbers without manually switching to the Transactions page and filtering by date.

## Goal

Click any month bar on the cash flow chart → slide into a detailed monthly breakdown showing where money went, top transactions, daily spending curve, and category split.

## UX Flow

1. User sees the cash flow bar chart on the Dashboard
2. Clicks a month bar (e.g., "Jan")
3. Dashboard content is replaced by a **Month Detail** view for January 2026
4. A back arrow / "← Back to Dashboard" link returns to the main dashboard
5. The month detail view shows:
   - **Header**: "January 2026" with income/expenses/net summary
   - **Category breakdown**: horizontal bar chart or ranked list showing spend by category
   - **Daily spending curve**: line chart of cumulative spend through the month
   - **Top transactions**: the 10 largest expenses that month
   - **Full transaction list**: paginated table (reuse Transactions component in compact mode, pre-filtered to that month)

## Data Requirements

### Existing endpoints that can be reused

| Data | Endpoint | Params |
|------|----------|--------|
| Monthly income/expenses | `GET /api/analytics/cash-flow` | Already have this from Dashboard load |
| Transactions for a month | `GET /api/transactions` | `start_date=2026-01-01&end_date=2026-01-31` |
| Budget status for a month | `GET /api/budgets/status` | `month=2026-01` |

### New endpoint needed

**`GET /api/analytics/monthly-breakdown?month=2026-01&account_ids=...`**

Returns:
```json
{
  "month": "2026-01",
  "income": 5200,
  "expenses": 3100,
  "net": 2100,
  "category_breakdown": [
    { "category": "Groceries", "total": -450, "count": 12 },
    { "category": "Dining", "total": -320, "count": 8 },
    ...
  ],
  "daily_spending": [
    { "date": "2026-01-01", "amount": -85, "cumulative": -85 },
    { "date": "2026-01-02", "amount": -42, "cumulative": -127 },
    ...
  ],
  "top_transactions": [
    { "date": "2026-01-15", "description": "Rent Payment", "amount": -1500, "category": "Rent" },
    ...
  ]
}
```

**Implementation:** New route at `src/app/api/analytics/monthly-breakdown/route.js`. Fetches all transactions for the month via `getAllTransactions()`, filters by date and account, then:
- Groups by category and sums amounts
- Builds daily cumulative spend (negative amounts only)
- Sorts transactions by absolute amount descending, takes top 10

---

## Component Design

### New: `MonthDetail.jsx`

Full-page component that replaces Dashboard content when a month is selected.

```
┌─────────────────────────────────────────────┐
│ ← Back to Dashboard         January 2026    │
├─────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │ Income   │ │ Expenses │ │ Net      │     │
│ │ $5,200   │ │ $3,100   │ │ +$2,100  │     │
│ └──────────┘ └──────────┘ └──────────┘     │
├─────────────────────────────────────────────┤
│ Spending by Category     │ Daily Spending   │
│ ████████ Groceries $450  │ [line chart of   │
│ ██████ Dining $320       │  cumulative      │
│ █████ Transport $280     │  spend through   │
│ ████ Shopping $220       │  the month]      │
│ ███ Entertainment $180   │                  │
├─────────────────────────────────────────────┤
│ Top Transactions                            │
│ Jan 15  Rent Payment         -$1,500  Rent  │
│ Jan 3   Grocery Store          -$180  Groc  │
│ Jan 22  Electronics Store      -$150  Shop  │
│ ...                                         │
├─────────────────────────────────────────────┤
│ All Transactions (paginated table)          │
│ [reuse Transactions component, pre-filtered]│
└─────────────────────────────────────────────┘
```

### Changes to existing files

| File | Change |
|------|--------|
| `Dashboard.jsx` | Add `onClick` handler to BarChart bars. When clicked, set `selectedMonth` state. Conditionally render `<MonthDetail>` instead of Dashboard content. |
| `page.js` | No changes — drill-down is internal to Dashboard |
| `api.js` | Add `getMonthlyBreakdown(month, accountIds)` method |

### Making bars clickable (Recharts)

```jsx
<Bar
  dataKey="expenses"
  name="Expenses"
  fill="#EF4444"
  radius={[4, 4, 0, 0]}
  cursor="pointer"
  onClick={(data) => setSelectedMonth(data.month)}
/>
```

Both the income and expense bars for a month should trigger the drill-down.

---

## Implementation Tasks

### Task 1: Backend — monthly breakdown endpoint

**File:** `src/app/api/analytics/monthly-breakdown/route.js`

- Accept `month` (YYYY-MM) and optional `account_ids` query params
- Fetch all transactions, filter to month + accounts
- Exclude Transfer/Investments categories from expense totals
- Build category_breakdown (sorted by absolute total desc)
- Build daily_spending with cumulative totals
- Return top 10 transactions by absolute amount

### Task 2: Frontend API client

**File:** `src/lib/api.js`

- Add `getMonthlyBreakdown(month, accountIds)` function

### Task 3: MonthDetail component

**File:** `src/components/MonthDetail.jsx` (new)

- Props: `month` (e.g. "2026-01"), `selectedAccount`, `onBack` callback
- Fetches data from monthly-breakdown endpoint on mount
- Renders: KPI row, category bar chart, daily spending line chart, top transactions list
- Uses same Recharts library already in the project
- Reuses `formatCurrency` helper pattern from Dashboard

### Task 4: Wire up Dashboard click-through

**File:** `src/components/Dashboard.jsx`

- Add `selectedMonth` state (null = show dashboard, string = show drill-down)
- Add `onClick` to both Bar components in the cash flow chart
- When `selectedMonth` is set, render `<MonthDetail month={selectedMonth} onBack={() => setSelectedMonth(null)} />`
- When null, render normal dashboard

---

## Testing Checklist

- [ ] Clicking income or expense bar opens month detail
- [ ] Back button returns to dashboard
- [ ] Category breakdown totals match cash flow chart values
- [ ] Daily spending curve is monotonically increasing (cumulative)
- [ ] Top transactions are sorted by largest absolute amount
- [ ] Account filter carries through to drill-down
- [ ] Works for months with no transactions (empty state)
- [ ] Works for current month (partial data)
