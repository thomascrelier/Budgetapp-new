# Accounts Page Cleanup — Design

**Date:** 2026-02-14
**Status:** Approved

## Goal

Simplify the UI by removing the Accounts page and sidebar account filter. Only 4 accounts are actively used: Main Chequing, CIBC Rental, Visa Credit Card, Rogers Mastercard. All other accounts should be marked inactive but their transaction data preserved.

## Approach

Data-only cleanup + UI removal. No transaction data is deleted. Inactive accounts remain in the Google Sheet for reference.

## Changes

### 1. Google Sheet — Mark Inactive Accounts

Set `is_active=false` for every account except:
- Main Chequing
- CIBC Rental
- Visa Credit Card
- Rogers Mastercard

One-time data change. Transactions are untouched.

### 2. Sidebar (`Sidebar.jsx`)

- Remove "Accounts" from `navItems`
- Remove the "Filter by Account" dropdown section
- Remove `accounts` state, `loadAccounts` effect
- Remove `selectedAccount` and `onAccountChange` props

### 3. Main Page (`page.js`)

- Remove `selectedAccount` state
- Remove `accounts` case from `renderPage`
- Remove `Accounts` import
- Stop passing `selectedAccount` to Dashboard, Transactions, Sidebar, BudgetSettings

### 4. Component Cleanup

- Delete `Accounts.jsx`
- Keep `/api/accounts` route (still used internally by analytics/dashboard)
- Keep `initializeDefaultAccounts` (useful for future setup)

### 5. Preserved

- All transaction data in the sheet
- Analytics endpoints that reference accounts internally
- Account balance computation for dashboard use
