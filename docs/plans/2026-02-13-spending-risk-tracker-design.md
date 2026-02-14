# Spending Risk Tracker — Design Document

**Date:** 2026-02-13
**Status:** Ready for future implementation

## Problem

The Dashboard currently has a "Budget Progress" section that shows spend vs manually-set budget limits. This requires you to manually configure budgets for each category, and only flags things once you've already exceeded the limit. It doesn't surface *patterns* — like "you spent 3x more on coffee this month than your 3-month average" — which is what's actually useful for catching lifestyle creep and impulse spending.

## Goal

Replace the "Budget Progress" panel with a **Spending Risk Tracker** that automatically detects categories where current-month spending is abnormally high compared to your recent history. No manual budget setup required — it learns from your own patterns.

## How It Works

1. For each spending category this month, compare current spend to the **3-month rolling average**
2. Flag categories where current spend exceeds the average by a meaningful threshold
3. Rank by severity (biggest % spike or biggest $ overspend)
4. Show a visual indicator of how far off-trend each category is

### Risk Levels

| Level | Condition | Visual |
|-------|-----------|--------|
| **Normal** | ≤ 110% of 3-month avg | Not shown (only risks displayed) |
| **Elevated** | 110–150% of avg | Yellow/amber bar |
| **High** | 150–200% of avg | Orange bar |
| **Critical** | > 200% of avg | Red bar |

### Minimum thresholds (avoid noise)

- Skip categories with < $20 current month spend (a $2→$6 coffee spike isn't useful)
- Skip categories with < 3 months of history (not enough data to compare)
- Only show top 6 flagged categories to keep the panel compact

## Example Output

```
Spending Risks This Month

☕ Dining          $380 ← avg $190   ████████████████░░░░ +100%  🔴
⛽ Transportation  $210 ← avg $150   ████████████░░░░░░░░  +40%  🟡
🛍 Shopping        $340 ← avg $240   ██████████████░░░░░░  +42%  🟡
💊 Pharmacy        $95  ← avg $60    ████████████████░░░░  +58%  🟠

✅ 8 other categories on track
```

## Data Requirements

### New endpoint

**`GET /api/analytics/spending-risks?account_ids=...`**

Returns:
```json
{
  "current_month": "2026-02",
  "risks": [
    {
      "category": "Dining",
      "current_spend": 380,
      "avg_spend": 190,
      "months_of_data": 5,
      "delta_dollars": 190,
      "delta_percent": 100,
      "level": "critical",
      "monthly_history": [120, 210, 240, 190, 380]
    },
    {
      "category": "Transportation",
      "current_spend": 210,
      "avg_spend": 150,
      "months_of_data": 5,
      "delta_dollars": 60,
      "delta_percent": 40,
      "level": "elevated",
      "monthly_history": [130, 160, 160, 150, 210]
    }
  ],
  "on_track_count": 8,
  "total_categories": 12
}
```

**Implementation:** New route at `src/app/api/analytics/spending-risks/route.js`.

Logic:
1. Fetch all transactions via `getAllTransactions()`
2. Filter to last 4 months (current + 3 prior) and optional account_ids
3. Exclude non-spending categories (Transfer, Investments, Income, Rental Income)
4. Group by category × month, sum negative amounts
5. For each category: compute 3-month avg (excluding current month), compare to current month
6. Filter to categories with current spend > $20, history ≥ 3 months, and delta > 10%
7. Assign risk level based on delta_percent thresholds
8. Sort by delta_percent descending, return top 6
9. Include `monthly_history` (last 5 months of that category's spend) for sparklines

---

## Component Design

### New: `SpendingRiskTracker.jsx`

Replaces the "Budget Progress" panel in the right column of the charts row.

```
┌──────────────────────────────────┐
│ Spending Risks                   │
│ Compared to your 3-month average │
├──────────────────────────────────┤
│ Dining                     🔴   │
│ $380 this month · avg $190       │
│ ████████████████████░░░░  +100%  │
│ ▁▃▅▃█  (sparkline)              │
├──────────────────────────────────┤
│ Transportation             🟡   │
│ $210 this month · avg $150       │
│ ████████████████░░░░░░░░   +40%  │
│ ▃▄▄▃▅  (sparkline)              │
├──────────────────────────────────┤
│ ...                              │
├──────────────────────────────────┤
│ ✓ 8 categories on track          │
└──────────────────────────────────┘
```

Each risk item shows:
- Category name + risk level indicator (colored dot)
- Current spend vs average (text)
- Progress bar (colored by risk level, fills to represent % of avg)
- Optional: tiny sparkline showing the 5-month trend (using Recharts `<Line>` in a small `<ResponsiveContainer>`)

### Changes to existing files

| File | Change |
|------|--------|
| `Dashboard.jsx` | Replace `<BudgetProgressBar>` section with `<SpendingRiskTracker>` |
| `api.js` | Add `getSpendingRisks(accountIds)` method |
| `BudgetProgressBar.jsx` | No changes — keep the component, it's still used in Budget Settings page. Only remove from Dashboard. |

---

## Implementation Tasks

### Task 1: Backend — spending risks endpoint

**File:** `src/app/api/analytics/spending-risks/route.js` (new)

- Fetch all transactions, group by category × month
- Compute 3-month rolling average per category
- Compare current month to average
- Apply thresholds and minimum filters
- Return sorted risks + on_track_count

### Task 2: Frontend API client

**File:** `src/lib/api.js`

- Add `getSpendingRisks(accountIds)` function

### Task 3: SpendingRiskTracker component

**File:** `src/components/SpendingRiskTracker.jsx` (new)

- Props: none (fetches its own data)
- Accepts `selectedAccount` for account filtering
- Renders risk items with colored bars and sparklines
- Shows "on track" count at the bottom
- Empty state: "All spending on track this month" with a green checkmark

### Task 4: Wire into Dashboard

**File:** `src/components/Dashboard.jsx`

- Replace the Budget Progress panel contents with `<SpendingRiskTracker selectedAccount={selectedAccount} />`
- Update the panel title from "Budget Progress" to "Spending Risks"
- Add the `getSpendingRisks` call to the Dashboard's `loadData` function (or let the component fetch independently)

---

## What happens to Budget Progress?

The existing Budget Progress feature (manual budget limits + `BudgetProgressBar`) remains available on the **Budget Settings** page where you configure budgets. It's just no longer the primary Dashboard widget. If you want to bring it back alongside the risk tracker later, it could go in a tabbed panel or a separate section.

---

## Testing Checklist

- [ ] Categories with no recent history don't appear (avoid false positives)
- [ ] Categories under $20/month are filtered out
- [ ] Risk levels match the threshold table
- [ ] Sparklines show correct 5-month trend
- [ ] "On track" count is accurate
- [ ] Account filter works (risks recalculate per account)
- [ ] Empty state renders when all categories are on track
- [ ] Current month partial data doesn't cause misleading spikes (mid-month spend will naturally be lower — consider prorating)

## Open Question: Mid-Month Proration

If it's February 13 and you've spent $200 on Dining, but your 3-month average is $380, that's not a risk yet — you're on pace for ~$430, which *is* elevated. Two options:

- **Option A (simple):** Compare raw current spend to raw average. Only really useful after the 20th of the month.
- **Option B (prorated):** Extrapolate current spend to full month: `current_spend × (days_in_month / day_of_month)`. More accurate but can overreact early in the month.

**Recommendation:** Start with Option A. It's simpler, and early-month data is noisy anyway. Can add proration toggle later if useful.
