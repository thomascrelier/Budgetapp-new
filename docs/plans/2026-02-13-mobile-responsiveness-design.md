# Mobile Responsiveness — Design Document

**Date:** 2026-02-13
**Status:** Ready for future implementation

## Problem

The Budget Tracker app is desktop-only. On an iPhone (375px), the fixed 256px sidebar consumes 68% of the viewport, the content area is squeezed to ~119px, and there's no way to collapse the navigation. The site is unusable on mobile.

## Goal

Make all pages fully usable on phones (375px+) and tablets (768px+) without breaking the existing desktop layout.

## Scope

| Component | File | What Changes |
|-----------|------|-------------|
| Layout | `src/app/layout.js` | Add viewport meta tag |
| Main shell | `src/app/page.js` | Remove fixed `ml-64`, add responsive margin |
| Sidebar | `src/components/Sidebar.jsx` | Hamburger toggle, slide-out drawer on mobile |
| Dashboard | `src/components/Dashboard.jsx` | Responsive chart heights, card padding |
| Transactions | `src/components/Transactions.jsx` | Stack filters 1-col, compact table rows |
| Rental Property | `src/components/RentalProperty.jsx` | Responsive grids, compact data tables |
| Budget Settings | `src/components/BudgetSettings.jsx` | Modal fits small screens |
| Accounts | `src/components/Accounts.jsx` | Responsive card grid |

## Breakpoints (Tailwind defaults)

- **sm** (640px) — large phones / landscape
- **md** (768px) — tablets, sidebar becomes persistent
- **lg** (1024px) — current desktop layout, no changes needed

## Design Decisions

### Sidebar → Mobile Drawer
- **Below md**: sidebar hidden off-screen, hamburger button in a fixed top bar
- **md and above**: sidebar stays fixed as-is (no changes to desktop)
- Drawer slides in from the left with a backdrop overlay
- Tapping a nav item closes the drawer
- Account selector, Upload CSV, Refresh Data all remain in the drawer

### Top Bar (mobile only)
- Fixed height bar with hamburger icon (left), "Budget Tracker" title (center), user avatar (right)
- Only visible below `md` breakpoint
- `<main>` gets `pt-14` (56px) on mobile to clear the top bar

### Content Area
- `ml-64` → `md:ml-64 ml-0`
- `p-8` → `p-4 md:p-8`

---

## Implementation Tasks

### Task 1: Viewport meta tag

**File:** `src/app/layout.js`

Next.js metadata export already handles this, but confirm the viewport export exists. Add if missing:

```js
export const metadata = {
  title: 'Budget Tracker',
  description: 'Personal finance management with Google Sheets',
};

// Add this:
export const viewport = {
  width: 'device-width',
  initialScale: 1,
};
```

**Effort:** Trivial

---

### Task 2: Mobile sidebar + top bar

**File:** `src/components/Sidebar.jsx`, `src/app/page.js`

1. Add `sidebarOpen` state + toggle handler in `page.js`, pass to Sidebar
2. Sidebar wrapper classes:
   - Desktop (`md:`): `fixed left-0 top-0 h-full w-64` (unchanged)
   - Mobile: `fixed inset-y-0 left-0 w-64 z-40 transform transition-transform` + `-translate-x-full` when closed
3. Backdrop overlay: `fixed inset-0 bg-black/50 z-30` when open, hidden when closed
4. Add a top bar component (mobile only):
   ```jsx
   <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-text-primary text-white flex items-center px-4 z-20">
     <button onClick={toggleSidebar}>☰</button>
     <span className="flex-1 text-center font-bold">Budget Tracker</span>
     {user?.image && <img src={user.image} className="w-8 h-8 rounded-full" />}
   </div>
   ```
5. Close sidebar on nav item click (mobile only)
6. Main content: `ml-0 pt-14 md:ml-64 md:pt-0 p-4 md:p-8`

**Effort:** Medium — this is the core change

---

### Task 3: Dashboard responsive tweaks

**File:** `src/components/Dashboard.jsx`

- KPI card grid: already `grid-cols-1 md:grid-cols-3` — no change needed
- Chart containers: `h-48 md:h-64` (shrink on mobile)
- Card padding: `p-4 md:p-6`
- Title: `text-2xl md:text-3xl`
- Budget progress bars: no changes needed (single column)

**Effort:** Small

---

### Task 4: Transactions responsive tweaks

**File:** `src/components/Transactions.jsx`

- Filter grid: change `grid-cols-2 md:grid-cols-3 lg:grid-cols-6` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-6`
- Table: already has `overflow-x-auto` wrapper — add `text-sm` on mobile via `text-xs sm:text-sm`
- Cell padding: `px-3 py-2 md:px-6 md:py-4`
- Hide low-value columns on mobile (e.g., account name) with `hidden sm:table-cell`
- Pagination buttons: increase touch target to `min-h-[44px]`

**Effort:** Small

---

### Task 5: Rental Property responsive tweaks

**File:** `src/components/RentalProperty.jsx`

- KPI cards grid: ensure `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Chart containers: `h-48 md:h-64`
- Monthly breakdown table: same treatment as Transactions table (compact padding, `overflow-x-auto`)
- Year selector: full width on mobile

**Effort:** Small

---

### Task 6: Budget Settings modal

**File:** `src/components/BudgetSettings.jsx`

- Modal: `max-w-md` → `max-w-md w-[calc(100%-2rem)]` with `mx-auto`
- Reduce padding on mobile: `p-4 md:p-6`
- Input text: `text-sm` (already fine)

**Effort:** Trivial

---

### Task 7: Accounts page

**File:** `src/components/Accounts.jsx`

- Card grid: ensure `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Card padding: `p-4 md:p-6`

**Effort:** Trivial

---

## Testing Checklist

- [ ] iPhone SE (375px) — all pages scrollable, no horizontal overflow
- [ ] iPhone 14 (390px) — sidebar drawer opens/closes smoothly
- [ ] iPad (768px) — sidebar switches to persistent mode
- [ ] Desktop (1024px+) — no visual regressions
- [ ] Sidebar drawer closes on nav item tap
- [ ] Backdrop click closes sidebar
- [ ] Charts render properly at smaller heights
- [ ] Transaction table scrolls horizontally without breaking layout
- [ ] Upload modal and Budget Settings modal fit on small screens
- [ ] All touch targets ≥ 44px

## Not in Scope

- PWA / install-to-homescreen
- Bottom tab navigation (hamburger drawer is simpler for 5 items)
- Swipe gestures
- Offline support
