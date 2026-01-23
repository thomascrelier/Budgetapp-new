"""Custom exceptions for BudgetCSV application."""


class BudgetCSVException(Exception):
    """Base exception for BudgetCSV application."""
    pass


class CSVValidationError(BudgetCSVException):
    """Raised when CSV validation fails."""
    pass


class CSVParsingError(BudgetCSVException):
    """Raised when CSV cannot be parsed."""
    pass


class CSVColumnError(BudgetCSVException):
    """Raised when CSV has incorrect column structure."""
    pass


class AccountNotFoundError(BudgetCSVException):
    """Raised when referenced account does not exist."""
    pass


class BudgetNotFoundError(BudgetCSVException):
    """Raised when referenced budget does not exist."""
    pass


class TransactionNotFoundError(BudgetCSVException):
    """Raised when referenced transaction does not exist."""
    pass
