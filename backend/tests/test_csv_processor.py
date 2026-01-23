"""Tests for CSV processor service."""

import pytest
from decimal import Decimal
from datetime import date

from app.services.csv_processor import CSVProcessor, process_csv_file
from app.utils.exceptions import CSVParsingError, CSVColumnError, CSVValidationError


class TestCSVProcessor:
    """Unit tests for CSV processor."""

    def test_valid_csv_processing(self):
        """Test processing a valid CSV file."""
        csv_content = b"2024-01-15,Grocery Store,50.00,0.00\n2024-01-16,Salary,0.00,3000.00"
        result = process_csv_file(csv_content, account_id=1)

        assert result.success is True
        assert len(result.transactions) == 2
        assert result.transactions[0]["amount"] == Decimal("-50.00")
        assert result.transactions[1]["amount"] == Decimal("3000.00")

    def test_nan_handling_empty_debit(self):
        """Test that empty debit values are treated as 0.00."""
        csv_content = b"2024-01-15,Coffee,,5.00"  # Empty debit
        result = process_csv_file(csv_content, account_id=1)

        assert result.success is True
        assert result.transactions[0]["amount"] == Decimal("5.00")

    def test_nan_handling_empty_credit(self):
        """Test that empty credit values are treated as 0.00."""
        csv_content = b"2024-01-15,Expense,50.00,"  # Empty credit
        result = process_csv_file(csv_content, account_id=1)

        assert result.success is True
        assert result.transactions[0]["amount"] == Decimal("-50.00")

    def test_invalid_date_format_non_strict(self):
        """Test handling of invalid date formats in non-strict mode."""
        csv_content = b"not-a-date,Description,10.00,0.00"
        result = process_csv_file(csv_content, account_id=1, strict_mode=False)

        assert result.skipped_rows == 1
        assert any(i.column == "Date" for i in result.issues)

    def test_alternative_date_format_us(self):
        """Test parsing of US date format (MM/DD/YYYY)."""
        csv_content = b"01/15/2024,Description,10.00,0.00"
        result = process_csv_file(csv_content, account_id=1)

        assert result.success is True
        assert result.transactions[0]["date"] == date(2024, 1, 15)

    def test_alternative_date_format_eu(self):
        """Test parsing of EU date format (DD/MM/YYYY)."""
        csv_content = b"15/01/2024,Description,10.00,0.00"
        result = process_csv_file(csv_content, account_id=1)

        assert result.success is True
        assert result.transactions[0]["date"] == date(2024, 1, 15)

    def test_monetary_value_with_currency_symbol(self):
        """Test parsing monetary values with currency symbols."""
        csv_content = b"2024-01-01,Test,$1000.00,0.00"
        result = process_csv_file(csv_content, account_id=1)

        assert result.success is True
        assert result.transactions[0]["amount"] == Decimal("-1000.00")

    def test_monetary_value_with_thousands_separator(self):
        """Test parsing monetary values with thousands separators."""
        csv_content = b'2024-01-01,Test,"1,000.00",0.00'
        result = process_csv_file(csv_content, account_id=1)

        assert result.success is True
        assert result.transactions[0]["amount"] == Decimal("-1000.00")

    def test_monetary_value_accounting_negative(self):
        """Test parsing negative amounts in accounting format (parentheses)."""
        csv_content = b"2024-01-01,Refund,(50.00),0.00"
        result = process_csv_file(csv_content, account_id=1)

        assert result.success is True
        # (50.00) in debit means it's a refund/credit
        assert result.transactions[0]["amount"] == Decimal("50.00")

    def test_empty_csv(self):
        """Test handling of empty CSV file."""
        with pytest.raises(CSVParsingError, match="empty"):
            process_csv_file(b"", account_id=1)

    def test_insufficient_columns(self):
        """Test handling of CSV with too few columns."""
        csv_content = b"2024-01-01,Description,100.00"  # Missing credit column

        with pytest.raises(CSVColumnError):
            process_csv_file(csv_content, account_id=1)

    def test_strict_mode_raises_on_error(self):
        """Test that strict mode raises on first error."""
        csv_content = b"invalid-date,Description,10.00,0.00"

        with pytest.raises(CSVValidationError):
            process_csv_file(csv_content, account_id=1, strict_mode=True)

    def test_batch_id_generation(self):
        """Test that all transactions get same batch ID."""
        csv_content = b"2024-01-01,A,10.00,0.00\n2024-01-02,B,20.00,0.00"
        result = process_csv_file(csv_content, account_id=1)

        batch_ids = {t["import_batch_id"] for t in result.transactions}
        assert len(batch_ids) == 1  # All same batch ID

    def test_amount_calculation_income(self):
        """Test amount calculation for income (credit only)."""
        csv_content = b"2024-01-01,Salary,0.00,5000.00"
        result = process_csv_file(csv_content, account_id=1)

        assert result.transactions[0]["amount"] == Decimal("5000.00")

    def test_amount_calculation_expense(self):
        """Test amount calculation for expense (debit only)."""
        csv_content = b"2024-01-01,Rent,1500.00,0.00"
        result = process_csv_file(csv_content, account_id=1)

        assert result.transactions[0]["amount"] == Decimal("-1500.00")

    def test_summary_statistics(self):
        """Test that summary statistics are calculated correctly."""
        csv_content = b"2024-01-01,Income,0.00,1000.00\n2024-01-02,Expense,300.00,0.00"
        result = process_csv_file(csv_content, account_id=1)

        assert result.summary["total_income"] == "1000.00"
        assert result.summary["total_expenses"] == "300.00"
        assert result.summary["net_amount"] == "700.00"
        assert result.summary["transaction_count"] == 2

    def test_description_truncation(self):
        """Test that long descriptions are truncated."""
        long_desc = "A" * 600  # Exceeds 500 char limit
        csv_content = f"2024-01-01,{long_desc},10.00,0.00".encode()
        result = process_csv_file(csv_content, account_id=1)

        assert len(result.transactions[0]["description"]) == 500
        assert any("truncated" in i.message.lower() for i in result.issues)

    def test_empty_description_handling(self):
        """Test handling of empty descriptions."""
        csv_content = b"2024-01-01,,10.00,0.00"
        result = process_csv_file(csv_content, account_id=1)

        assert result.transactions[0]["description"] == "No description"
        assert any("empty" in i.message.lower() for i in result.issues)

    def test_zero_amount_warning(self):
        """Test that zero amount transactions generate warning."""
        csv_content = b"2024-01-01,Zero Transaction,0.00,0.00"
        result = process_csv_file(csv_content, account_id=1)

        assert result.transactions[0]["amount"] == Decimal("0.00")
        assert any("$0.00" in i.message for i in result.issues)

    def test_both_debit_and_credit_warning(self):
        """Test warning when both debit and credit are non-zero."""
        csv_content = b"2024-01-01,Unusual,50.00,30.00"
        result = process_csv_file(csv_content, account_id=1)

        assert result.transactions[0]["amount"] == Decimal("-20.00")  # 30 - 50
        assert any("both debit" in i.message.lower() for i in result.issues)
