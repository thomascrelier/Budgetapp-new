"""Pydantic schemas for Transaction model."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


class TransactionBase(BaseModel):
    """Base schema for transaction data."""
    date: date
    description: str = Field(..., max_length=500)
    amount: Decimal
    category: Optional[str] = Field(default="Uncategorized", max_length=100)
    is_verified: bool = False
    notes: Optional[str] = Field(None, max_length=1000)


class TransactionCreate(TransactionBase):
    """Schema for creating a new transaction."""
    account_id: int


class TransactionUpdate(BaseModel):
    """Schema for updating an existing transaction."""
    date: Optional[date] = None
    description: Optional[str] = Field(None, max_length=500)
    amount: Optional[Decimal] = None
    category: Optional[str] = Field(None, max_length=100)
    is_verified: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=1000)


class CategoryUpdate(BaseModel):
    """Schema for updating transaction category."""
    category: str = Field(..., max_length=100)


class TransactionResponse(TransactionBase):
    """Schema for transaction response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    import_batch_id: Optional[str]
    created_at: datetime
    updated_at: datetime


class TransactionListResponse(BaseModel):
    """Schema for paginated list of transactions response."""
    transactions: list[TransactionResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class CategoryListResponse(BaseModel):
    """Schema for list of distinct categories."""
    categories: list[str]
