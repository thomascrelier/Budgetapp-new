# BudgetCSV — Product Roadmap

> Last updated: 2026-02-11

---

## Current State

BudgetCSV is a full-stack personal budgeting app:
- **Backend**: FastAPI + SQLite (deployed on Railway)
- **Frontend**: React/Vite + Tailwind CSS (deployed on Vercel)
- **Features**: CSV bank statement import, multi-account tracking, budget alerts, analytics dashboards, rental property analytics, optional Google Sheets sync

**Service account**: `budget-sheets-service@bamboo-weft-485018-k8.iam.gserviceaccount.com`

---

## Phase 1: Google Sheets Live Backup

**Goal**: Make Google Sheets the durable backup for all data. Every DB mutation auto-syncs to Sheets. If SQLite is wiped (Railway redeploy), the app auto-restores from Sheets.

### 1.1 — Rewrite Google Sheets Service

**File**: `backend/app/services/google_sheets.py`

Expand from write-only append to full CRUD sync + restore.

**New Sheets schema (3 worksheets):**

| Worksheet | Columns |
|-----------|---------|
| **Transactions** | `id, date, description, amount, category, account_id, account_name, is_verified, import_batch_id, synced_at` |
| **Accounts** | `id, name, account_type, initial_balance, is_active, created_at, synced_at` |
| **Budgets** | `id, category_name, monthly_limit, rollover_enabled, alert_threshold, created_at, synced_at` |

**Methods to implement:**

| Category | Methods |
|----------|---------|
| Worksheet mgmt | `_get_or_create_worksheet()`, `_find_row_by_id()` |
| Transaction sync | `sync_transaction_create()`, `sync_transactions_batch_create()`, `sync_transaction_update()`, `sync_transaction_delete()`, `sync_transactions_batch_delete()` |
| Account sync | `sync_account_create()`, `sync_account_update()`, `sync_account_delete()` |
| Budget sync | `sync_budget_create()`, `sync_budget_update()`, `sync_budget_delete()` |
| Full sync | `full_sync_to_sheets(db)`, `restore_from_sheets(db)` |

**Design decisions:**
- All sync methods accept **plain dicts** (not ORM objects) — safe for `BackgroundTasks` after DB session closes
- Row lookup via `worksheet.get_all_values()` + scan for ID in column A
- Batch deletes: bottom-to-top to preserve row indices
- Fire-and-forget: log errors, never block API responses

### 1.2 — Add Sync Hooks to Transaction Endpoints

**File**: `backend/app/routers/transactions.py`

| Endpoint | Sync Action |
|----------|-------------|
| `PUT /{id}` | `sync_transaction_update` |
| `PATCH /{id}/category` | `sync_transaction_update` |
| `PATCH /{id}/verify` | `sync_transaction_update` |
| `DELETE /{id}` | `sync_transaction_delete` |

**Pattern**: Add `BackgroundTasks` param, extract dict while session is open, fire background sync.

### 1.3 — Update Upload Endpoints

**File**: `backend/app/routers/upload.py`

| Endpoint | Change |
|----------|--------|
| `POST /csv` | Replace old `sync_transactions()` with `sync_transactions_batch_create()` via BackgroundTasks |
| `DELETE /batch/{batch_id}` | Collect IDs before delete, sync via `sync_transactions_batch_delete()` |

### 1.4 — Add Sync Hooks to Account Endpoints

**File**: `backend/app/routers/accounts.py`

| Endpoint | Sync Action |
|----------|-------------|
| `POST /` | `sync_account_create` |
| `PUT /{id}` | `sync_account_update` |
| `DELETE /{id}` | `sync_account_delete` + `sync_transactions_batch_delete` (cascade) |
| `POST /initialize-defaults` | `sync_account_create` for each new account |

### 1.5 — Add Sync Hooks to Budget Endpoints

**File**: `backend/app/routers/budgets.py`

| Endpoint | Sync Action |
|----------|-------------|
| `POST /` | `sync_budget_create` |
| `PUT /{id}` | `sync_budget_update` |
| `DELETE /{id}` | `sync_budget_delete` |

### 1.6 — New Sync Router

**File**: `backend/app/routers/sync.py` (new)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/sync/full` | Wipe Sheets, rebuild from DB (migration + manual re-sync) |
| `POST /api/v1/sync/restore` | Read Sheets, rebuild SQLite (disaster recovery) |
| `GET /api/v1/sync/status` | Check if Sheets sync is enabled/configured |

### 1.7 — Update App Startup

**File**: `backend/app/main.py`

- Register sync router
- Auto-restore on startup: if DB has 0 transactions and Sheets is configured, restore from Sheets

### 1.8 — Update Frontend API Service

**File**: `frontend/src/services/api.js`

Add: `syncFullToSheets()`, `restoreFromSheets()`, `getSyncStatus()`

### File Change Summary

| File | Action |
|------|--------|
| `backend/app/services/google_sheets.py` | Major rewrite (~400 lines) |
| `backend/app/routers/transactions.py` | Modify 4 endpoints |
| `backend/app/routers/upload.py` | Modify 2 endpoints |
| `backend/app/routers/accounts.py` | Modify 4 endpoints |
| `backend/app/routers/budgets.py` | Modify 3 endpoints |
| `backend/app/routers/sync.py` | New file |
| `backend/app/main.py` | Register router + auto-restore |
| `frontend/src/services/api.js` | Add sync endpoints |

### Verification

1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. `GET /api/v1/sync/status` — confirm enabled
3. `POST /api/v1/sync/full` — verify 3 worksheets created in Google Sheets with data
4. Update a transaction category — verify Sheets row updates within seconds
5. Delete a transaction — verify Sheets row removed
6. Upload CSV — verify new rows appear in Sheets with IDs
7. Delete SQLite DB, restart — verify auto-restore from Sheets
8. `POST /api/v1/sync/restore` — verify counts match

---

## Phase 2: Monarch Money-Inspired Features

Features inspired by [Monarch Money](https://www.monarch.com/), ranked by impact.

### Tier 1 — High Impact

| Feature | Description | Effort |
|---------|-------------|--------|
| **Recurring transaction detection** | Auto-detect subscriptions & recurring bills from transaction patterns. Calendar/list view with next expected date and amount. | Medium |
| **Transaction rules engine** | When user re-categorizes a transaction, offer to auto-apply that rule to past & future matching transactions (by description pattern). | Medium |
| **Net worth tracking** | Aggregate all account balances into a net worth chart over time. Separate assets vs liabilities. Historical snapshots. | Small |
| **Month-in-review summary** | Auto-generated monthly report: top spending categories, cash flow delta, net worth change, budget performance vs. prior month. | Small |
| **Transaction search** | Full-text search across transaction descriptions. Currently only category-based filtering exists. | Small |

### Tier 2 — Medium Impact

| Feature | Description | Effort |
|---------|-------------|--------|
| **Flex budgeting** | Alternative budget mode: set one total "flexible spending" amount. Unbudgeted categories auto-share the flex pool. Toggle between flex and category-based. | Medium |
| **Goal tracking** | Set savings goals with target amounts and timelines. Visual progress bars. Link goals to specific accounts. Calculate required monthly savings. | Medium |
| **Customizable dashboard** | Let user choose which widgets/cards appear on dashboard and their order. Drag-and-drop layout. Persist preferences. | Medium |
| **Split transactions** | Split a single transaction across multiple categories (e.g., Costco trip = groceries + household + electronics). | Medium |
| **Data export** | Export transactions and reports as CSV or PDF. Filtered exports (by date range, account, category). | Small |

### Tier 3 — Nice to Have

| Feature | Description | Effort |
|---------|-------------|--------|
| **Bill calendar** | Calendar view of upcoming bills and recurring charges with due dates and amounts. | Small |
| **Cash flow forecasting** | AI-powered projections of future balances based on recurring income/expenses and spending trends. | Large |
| **Credit card statement tracking** | Track statement balances, minimum payments due, payment due dates. Alert before due dates. | Medium |
| **Multi-currency support** | Support transactions in different currencies with automatic conversion rates. | Large |
| **Mobile-responsive redesign** | Full mobile-first responsive layout. Current design is desktop-oriented. | Medium |

---

## CLI & Deployment Status

| Tool | Status | Details |
|------|--------|---------|
| **Git** | Connected | `thomas.crelier@gmail.com` → `github.com/thomascrelier/Budgetapp-new.git` |
| **GitHub CLI (`gh`)** | Not installed | Install: `brew install gh && gh auth login` |
| **Vercel CLI** | Connected | Account: `thomascrelier-6120`, Team: "Thomas' projects" |
| **Railway** | Configured | Backend deploys via `railway.json` with Nixpacks |

---

## Tech Debt & Quick Wins

| Item | Priority | Notes |
|------|----------|-------|
| Migrate categories from localStorage to DB | High | Data lost on browser clear / new device |
| Set `DEBUG = False` in production | High | Currently hardcoded `True` in config.py |
| Move CORS origins to env var | Medium | Currently hardcoded in config.py |
| Add Alembic for DB migrations | Medium | Needed before any schema changes |
| Duplicate transaction detection on CSV import | Medium | Re-importing same CSV creates duplicates |
| Add more backend tests | Medium | Only 1 test file exists currently |
| Install `gh` CLI | Low | `brew install gh && gh auth login` for PR workflows |
