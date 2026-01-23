"""Pydantic schemas for CSV upload operations."""

from pydantic import BaseModel
from typing import Optional


class ValidationIssueSchema(BaseModel):
    """Schema for validation issue."""
    row_number: int
    column: Optional[str]
    severity: str
    message: str
    original_value: Optional[str]


class SummarySchema(BaseModel):
    """Schema for upload summary."""
    total_income: str
    total_expenses: str
    net_amount: str
    date_range: Optional[dict]
    transaction_count: int


class UploadResponse(BaseModel):
    """Schema for successful upload response."""
    success: bool
    batch_id: str
    total_rows: int
    processed_rows: int
    skipped_rows: int
    issues: list[ValidationIssueSchema]
    summary: SummarySchema
    message: str


class PreviewResponse(BaseModel):
    """Schema for CSV preview response (without saving)."""
    success: bool
    total_rows: int
    valid_rows: int
    skipped_rows: int
    issues: list[ValidationIssueSchema]
    summary: SummarySchema
    preview_transactions: list[dict]  # First 10 transactions for preview
