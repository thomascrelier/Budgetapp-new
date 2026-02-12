"""Google Sheets integration for syncing transactions."""

import json
import os
from datetime import datetime
from typing import Optional, Set, Tuple

import gspread
from google.oauth2.service_account import Credentials


class GoogleSheetsService:
    """Service for syncing transactions to Google Sheets."""

    SCOPES = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]

    def __init__(self):
        self.client: Optional[gspread.Client] = None
        self.spreadsheet_id: Optional[str] = None
        self._initialize()

    def _initialize(self):
        """Initialize the Google Sheets client from credentials."""
        # Check for credentials file path
        creds_path = os.getenv("GOOGLE_CREDENTIALS_PATH")
        creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
        self.spreadsheet_id = os.getenv("GOOGLE_SPREADSHEET_ID")

        if not self.spreadsheet_id:
            print("Google Sheets: GOOGLE_SPREADSHEET_ID not set, sync disabled")
            return

        credentials = None

        if creds_path and os.path.exists(creds_path):
            credentials = Credentials.from_service_account_file(
                creds_path, scopes=self.SCOPES
            )
        elif creds_json:
            creds_dict = json.loads(creds_json)
            credentials = Credentials.from_service_account_info(
                creds_dict, scopes=self.SCOPES
            )

        if credentials:
            self.client = gspread.authorize(credentials)
            print("Google Sheets: Connected successfully")
        else:
            print("Google Sheets: No credentials found, sync disabled")

    def is_enabled(self) -> bool:
        """Check if Google Sheets sync is enabled."""
        return self.client is not None and self.spreadsheet_id is not None

    def _create_transaction_key(self, date: str, description: str, amount: float, account: str) -> str:
        """Create a unique key for a transaction to detect duplicates."""
        # Normalize the key components
        return f"{date}|{description.strip().lower()}|{amount:.2f}|{account.lower()}"

    def _get_existing_transactions(self, worksheet) -> Set[str]:
        """Get set of existing transaction keys from the worksheet."""
        existing_keys = set()
        try:
            # Get all records (skip header row)
            all_values = worksheet.get_all_values()
            if len(all_values) > 1:  # Has data beyond header
                for row in all_values[1:]:  # Skip header
                    if len(row) >= 5:  # Date, Description, Amount, Category, Account
                        date = row[0]
                        description = row[1]
                        try:
                            amount = float(row[2]) if row[2] else 0
                        except ValueError:
                            amount = 0
                        account = row[4]
                        key = self._create_transaction_key(date, description, amount, account)
                        existing_keys.add(key)
        except Exception as e:
            print(f"Error reading existing transactions: {e}")
        return existing_keys

    def sync_transactions(self, transactions: list, account_name: str) -> dict:
        """
        Sync transactions to Google Sheets, skipping duplicates.

        Args:
            transactions: List of transaction dicts with date, description, amount, category
            account_name: Name of the account for labeling

        Returns:
            Dict with sync status, count added, and duplicates skipped
        """
        if not self.is_enabled():
            return {"synced": False, "reason": "Google Sheets not configured"}

        try:
            spreadsheet = self.client.open_by_key(self.spreadsheet_id)

            # Try to get the Transactions worksheet, create if doesn't exist
            try:
                worksheet = spreadsheet.worksheet("Transactions")
            except gspread.WorksheetNotFound:
                worksheet = spreadsheet.add_worksheet(
                    title="Transactions", rows=1000, cols=10
                )
                # Add headers
                headers = [
                    "Date",
                    "Description",
                    "Amount",
                    "Category",
                    "Account",
                    "Synced At",
                ]
                worksheet.append_row(headers)

            # Get existing transactions to check for duplicates
            existing_keys = self._get_existing_transactions(worksheet)

            # Prepare rows to add (skip duplicates)
            synced_at = datetime.now().isoformat()
            rows_to_add = []
            duplicates_skipped = 0

            for txn in transactions:
                date = txn.get("date", "")
                description = txn.get("description", "")
                amount = txn.get("amount", 0)

                # Check if this transaction already exists
                key = self._create_transaction_key(date, description, amount, account_name)

                if key in existing_keys:
                    duplicates_skipped += 1
                    continue

                # Add to existing keys to prevent duplicates within same batch
                existing_keys.add(key)

                row = [
                    date,
                    description,
                    amount,
                    txn.get("category", "Uncategorized"),
                    account_name,
                    synced_at,
                ]
                rows_to_add.append(row)

            # Batch append all new rows
            if rows_to_add:
                worksheet.append_rows(rows_to_add)

            return {
                "synced": True,
                "count": len(rows_to_add),
                "duplicates_skipped": duplicates_skipped,
                "spreadsheet_id": self.spreadsheet_id,
            }

        except Exception as e:
            print(f"Google Sheets sync error: {e}")
            return {"synced": False, "reason": str(e)}


# Singleton instance
sheets_service = GoogleSheetsService()
