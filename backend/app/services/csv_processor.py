"""
CSV Processing Service for BudgetCSV

Handles ingestion of bank transaction CSV files with the following format:
- No headers (data starts at row 1)
- Column 0: Date (YYYY-MM-DD)
- Column 1: Description
- Column 2: Debit (money out)
- Column 3: Credit (money in)

Amount calculation: Credit - Debit
- Positive amount = income
- Negative amount = expense
"""

import pandas as pd
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional
from uuid import uuid4
from dataclasses import dataclass, field
from enum import Enum
from io import BytesIO
import logging

from app.utils.exceptions import (
    CSVValidationError,
    CSVParsingError,
    CSVColumnError
)

logger = logging.getLogger(__name__)


class ValidationSeverity(Enum):
    """Severity levels for validation issues."""
    ERROR = "error"      # Blocks processing
    WARNING = "warning"  # Logged but continues
    INFO = "info"        # Informational only


@dataclass
class ValidationIssue:
    """Represents a single validation issue found during processing."""
    row_number: int
    column: Optional[str]
    severity: ValidationSeverity
    message: str
    original_value: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "row_number": self.row_number,
            "column": self.column,
            "severity": self.severity.value,
            "message": self.message,
            "original_value": self.original_value
        }


@dataclass
class ProcessingResult:
    """Result of CSV processing operation."""
    success: bool
    transactions: list[dict]
    batch_id: str
    total_rows: int
    processed_rows: int
    skipped_rows: int
    issues: list[ValidationIssue]
    summary: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "batch_id": self.batch_id,
            "total_rows": self.total_rows,
            "processed_rows": self.processed_rows,
            "skipped_rows": self.skipped_rows,
            "issues": [i.to_dict() for i in self.issues],
            "summary": self.summary
        }


class CSVProcessor:
    """
    Processes CSV files from bank exports into transaction records.

    Expected CSV format (no headers):
        0: Date (YYYY-MM-DD)
        1: Description
        2: Debit (expense - money out)
        3: Credit (income - money in)
    """

    # Column indices (0-based, no headers)
    COL_DATE = 0
    COL_DESCRIPTION = 1
    COL_DEBIT = 2
    COL_CREDIT = 3

    REQUIRED_COLUMNS = 4
    MAX_DESCRIPTION_LENGTH = 500
    DATE_FORMAT = "%Y-%m-%d"

    def __init__(self, strict_mode: bool = False):
        """
        Initialize the CSV processor.

        Args:
            strict_mode: If True, any validation error stops processing.
                        If False, problematic rows are skipped with warnings.
        """
        self.strict_mode = strict_mode
        self.issues: list[ValidationIssue] = []
        self.batch_id = str(uuid4())

    def process_csv(
        self,
        file_content: bytes,
        account_id: int,
        encoding: str = "utf-8"
    ) -> ProcessingResult:
        """
        Process a CSV file and return transaction records.

        Args:
            file_content: Raw bytes of the CSV file
            account_id: ID of the account to associate transactions with
            encoding: Character encoding of the file

        Returns:
            ProcessingResult containing transactions and processing metadata

        Raises:
            CSVValidationError: If file fails validation in strict mode
            CSVParsingError: If file cannot be parsed at all
        """
        self.issues = []
        self.batch_id = str(uuid4())

        try:
            # Step 1: Read CSV into DataFrame
            df = self._read_csv(file_content, encoding)

            # Step 2: Validate structure
            self._validate_structure(df)

            # Step 3: Process and transform data
            transactions, skipped = self._transform_data(df, account_id)

            # Step 4: Generate summary
            summary = self._generate_summary(transactions)

            return ProcessingResult(
                success=True,
                transactions=transactions,
                batch_id=self.batch_id,
                total_rows=len(df),
                processed_rows=len(transactions),
                skipped_rows=skipped,
                issues=self.issues,
                summary=summary
            )

        except pd.errors.EmptyDataError:
            raise CSVParsingError("CSV file is empty")
        except pd.errors.ParserError as e:
            raise CSVParsingError(f"Failed to parse CSV: {str(e)}")
        except UnicodeDecodeError:
            raise CSVParsingError(
                f"Failed to decode file with encoding '{encoding}'. "
                "Try a different encoding (e.g., 'latin-1', 'cp1252')"
            )

    def _read_csv(self, file_content: bytes, encoding: str) -> pd.DataFrame:
        """Read CSV content into a DataFrame."""
        df = pd.read_csv(
            BytesIO(file_content),
            header=None,  # No headers in file
            encoding=encoding,
            dtype=str,    # Read all as strings initially
            na_values=["", "NA", "N/A", "null", "NULL", "None"],
            keep_default_na=True,
            skipinitialspace=True,
            on_bad_lines="warn" if not self.strict_mode else "error"
        )

        logger.info(f"Read CSV with {len(df)} rows and {len(df.columns)} columns")
        return df

    def _validate_structure(self, df: pd.DataFrame) -> None:
        """Validate the CSV has the expected structure."""
        if len(df.columns) < self.REQUIRED_COLUMNS:
            raise CSVColumnError(
                f"CSV must have at least {self.REQUIRED_COLUMNS} columns, "
                f"found {len(df.columns)}. Expected: Date, Description, Debit, Credit"
            )

        if len(df.columns) > self.REQUIRED_COLUMNS:
            self._add_issue(
                row_number=0,
                column=None,
                severity=ValidationSeverity.WARNING,
                message=f"CSV has {len(df.columns)} columns, expected {self.REQUIRED_COLUMNS}. "
                       "Extra columns will be ignored."
            )

        if df.empty:
            raise CSVValidationError("CSV file contains no data rows")

    def _transform_data(
        self,
        df: pd.DataFrame,
        account_id: int
    ) -> tuple[list[dict], int]:
        """
        Transform DataFrame rows into transaction dictionaries.

        Returns:
            Tuple of (list of transaction dicts, number of skipped rows)
        """
        transactions = []
        skipped = 0

        for idx, row in df.iterrows():
            row_num = idx + 1  # Human-readable row number

            try:
                transaction = self._process_row(row, row_num, account_id)
                if transaction:
                    transactions.append(transaction)
                else:
                    # Row was skipped due to validation errors
                    skipped += 1
                    # In strict mode, check if there were any ERROR-level issues
                    if self.strict_mode:
                        error_issues = [
                            i for i in self.issues
                            if i.row_number == row_num and i.severity == ValidationSeverity.ERROR
                        ]
                        if error_issues:
                            raise CSVValidationError(
                                f"Row {row_num}: {error_issues[0].message}"
                            )
            except CSVValidationError:
                raise  # Re-raise validation errors
            except Exception as e:
                if self.strict_mode:
                    raise CSVValidationError(
                        f"Row {row_num}: {str(e)}"
                    )
                self._add_issue(
                    row_number=row_num,
                    column=None,
                    severity=ValidationSeverity.ERROR,
                    message=str(e)
                )
                skipped += 1

        return transactions, skipped

    def _process_row(
        self,
        row: pd.Series,
        row_num: int,
        account_id: int
    ) -> Optional[dict]:
        """
        Process a single row into a transaction dictionary.

        Args:
            row: Pandas Series representing one CSV row
            row_num: 1-based row number for error reporting
            account_id: Account to associate with transaction

        Returns:
            Transaction dict or None if row should be skipped
        """
        # Extract and validate date
        date_value = self._parse_date(row.iloc[self.COL_DATE], row_num)
        if date_value is None:
            return None

        # Extract and validate description
        description = self._parse_description(row.iloc[self.COL_DESCRIPTION], row_num)
        if description is None:
            return None

        # Extract and calculate amount (Credit - Debit)
        amount = self._calculate_amount(
            debit=row.iloc[self.COL_DEBIT],
            credit=row.iloc[self.COL_CREDIT],
            row_num=row_num
        )
        if amount is None:
            return None

        return {
            "account_id": account_id,
            "date": date_value,
            "description": description,
            "amount": amount,
            "category": "Uncategorized",
            "is_verified": False,
            "import_batch_id": self.batch_id
        }

    def _parse_date(self, value: str, row_num: int) -> Optional[date]:
        """Parse and validate date value."""
        if pd.isna(value) or str(value).strip() == "":
            self._add_issue(
                row_number=row_num,
                column="Date",
                severity=ValidationSeverity.ERROR,
                message="Date is required but missing",
                original_value=str(value)
            )
            return None

        date_str = str(value).strip()

        try:
            # Try primary format YYYY-MM-DD
            parsed = pd.to_datetime(date_str, format=self.DATE_FORMAT)
            return parsed.date()
        except ValueError:
            pass

        # Try alternative formats
        alternative_formats = [
            "%m/%d/%Y",  # MM/DD/YYYY (US format)
            "%d/%m/%Y",  # DD/MM/YYYY (EU format)
            "%m-%d-%Y",  # MM-DD-YYYY
            "%Y/%m/%d",  # YYYY/MM/DD
            "%d-%m-%Y",  # DD-MM-YYYY
        ]

        for fmt in alternative_formats:
            try:
                parsed = pd.to_datetime(date_str, format=fmt)
                self._add_issue(
                    row_number=row_num,
                    column="Date",
                    severity=ValidationSeverity.INFO,
                    message=f"Date parsed with alternative format '{fmt}'",
                    original_value=date_str
                )
                return parsed.date()
            except ValueError:
                continue

        self._add_issue(
            row_number=row_num,
            column="Date",
            severity=ValidationSeverity.ERROR,
            message=f"Invalid date format. Expected YYYY-MM-DD, got '{date_str}'",
            original_value=date_str
        )
        return None

    def _parse_description(self, value: str, row_num: int) -> Optional[str]:
        """Parse and validate description value."""
        if pd.isna(value) or str(value).strip() == "":
            self._add_issue(
                row_number=row_num,
                column="Description",
                severity=ValidationSeverity.WARNING,
                message="Description is empty, using 'No description'",
                original_value=str(value)
            )
            return "No description"

        description = str(value).strip()

        if len(description) > self.MAX_DESCRIPTION_LENGTH:
            self._add_issue(
                row_number=row_num,
                column="Description",
                severity=ValidationSeverity.WARNING,
                message=f"Description truncated from {len(description)} to {self.MAX_DESCRIPTION_LENGTH} characters"
            )
            description = description[:self.MAX_DESCRIPTION_LENGTH]

        return description

    def _calculate_amount(
        self,
        debit: str,
        credit: str,
        row_num: int
    ) -> Optional[Decimal]:
        """
        Calculate transaction amount as Credit - Debit.

        - Positive result = income (credit > debit)
        - Negative result = expense (debit > credit)
        - NaN values treated as 0.0
        """
        debit_val = self._parse_monetary_value(debit, "Debit", row_num)
        credit_val = self._parse_monetary_value(credit, "Credit", row_num)

        if debit_val is None or credit_val is None:
            return None

        amount = credit_val - debit_val

        # Warn if both debit and credit are non-zero (unusual)
        if debit_val != 0 and credit_val != 0:
            self._add_issue(
                row_number=row_num,
                column=None,
                severity=ValidationSeverity.WARNING,
                message=f"Both debit ({debit_val}) and credit ({credit_val}) are non-zero"
            )

        # Warn if amount is exactly zero
        if amount == 0:
            self._add_issue(
                row_number=row_num,
                column=None,
                severity=ValidationSeverity.INFO,
                message="Transaction amount is $0.00"
            )

        return amount

    def _parse_monetary_value(
        self,
        value: str,
        column_name: str,
        row_num: int
    ) -> Optional[Decimal]:
        """
        Parse a monetary value string into Decimal.

        Handles:
        - NaN/empty -> 0.0
        - Currency symbols ($, etc.)
        - Thousands separators (commas)
        - Parentheses for negative numbers
        """
        # Handle NaN/None/empty as 0.0 per requirements
        if pd.isna(value) or str(value).strip() == "":
            return Decimal("0.00")

        value_str = str(value).strip()

        # Check for parentheses (accounting notation for negative)
        is_negative = value_str.startswith("(") and value_str.endswith(")")
        if is_negative:
            value_str = value_str[1:-1]

        # Remove currency symbols and whitespace
        value_str = value_str.replace("$", "").replace("\u20ac", "").replace("\u00a3", "")
        value_str = value_str.replace(",", "").replace(" ", "")

        # Handle explicit negative sign
        if value_str.startswith("-"):
            is_negative = True
            value_str = value_str[1:]

        try:
            result = Decimal(value_str)
            if is_negative:
                result = -result
            # Round to 2 decimal places
            return result.quantize(Decimal("0.01"))
        except InvalidOperation:
            self._add_issue(
                row_number=row_num,
                column=column_name,
                severity=ValidationSeverity.ERROR,
                message=f"Invalid monetary value: '{value}'",
                original_value=str(value)
            )
            return None

    def _add_issue(
        self,
        row_number: int,
        column: Optional[str],
        severity: ValidationSeverity,
        message: str,
        original_value: Optional[str] = None
    ) -> None:
        """Add a validation issue to the issues list."""
        issue = ValidationIssue(
            row_number=row_number,
            column=column,
            severity=severity,
            message=message,
            original_value=original_value
        )
        self.issues.append(issue)

        log_msg = f"Row {row_number}"
        if column:
            log_msg += f" [{column}]"
        log_msg += f": {message}"

        if severity == ValidationSeverity.ERROR:
            logger.error(log_msg)
        elif severity == ValidationSeverity.WARNING:
            logger.warning(log_msg)
        else:
            logger.info(log_msg)

    def _generate_summary(self, transactions: list[dict]) -> dict:
        """Generate summary statistics for processed transactions."""
        if not transactions:
            return {
                "total_income": "0.00",
                "total_expenses": "0.00",
                "net_amount": "0.00",
                "date_range": None,
                "transaction_count": 0
            }

        amounts = [t["amount"] for t in transactions]
        dates = [t["date"] for t in transactions]

        income = sum(a for a in amounts if a > 0)
        expenses = sum(a for a in amounts if a < 0)

        return {
            "total_income": str(income),
            "total_expenses": str(abs(expenses)),
            "net_amount": str(income + expenses),
            "date_range": {
                "start": min(dates).isoformat(),
                "end": max(dates).isoformat()
            },
            "transaction_count": len(transactions)
        }


# Convenience function for quick processing
def process_csv_file(
    file_content: bytes,
    account_id: int,
    strict_mode: bool = False,
    encoding: str = "utf-8"
) -> ProcessingResult:
    """
    Convenience function to process a CSV file.

    Args:
        file_content: Raw bytes of CSV file
        account_id: ID of account to associate transactions
        strict_mode: Whether to fail on any validation error
        encoding: File encoding

    Returns:
        ProcessingResult with transactions and metadata
    """
    processor = CSVProcessor(strict_mode=strict_mode)
    return processor.process_csv(file_content, account_id, encoding)
