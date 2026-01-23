"""Pydantic schemas for Account model."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal


class AccountBase(BaseModel):
    """Base schema for account data."""
    name: str = Field(..., min_length=1, max_length=100)
    account_type: str = Field(
        default="checking",
        pattern="^(checking|savings|credit|investment)$"
    )
    initial_balance: Decimal = Field(default=Decimal("0.00"))


class AccountCreate(AccountBase):
    """Schema for creating a new account."""
    pass


class AccountUpdate(BaseModel):
    """Schema for updating an existing account."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    account_type: Optional[str] = Field(
        None,
        pattern="^(checking|savings|credit|investment)$"
    )
    initial_balance: Optional[Decimal] = None
    is_active: Optional[bool] = None


class AccountResponse(AccountBase):
    """Schema for account response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    current_balance: Decimal
    created_at: datetime
    updated_at: datetime


class AccountListResponse(BaseModel):
    """Schema for list of accounts response."""
    accounts: list[AccountResponse]
    total: int


class BalanceResponse(BaseModel):
    """Schema for account balance response."""
    account_id: int
    account_name: str
    initial_balance: Decimal
    transaction_total: Decimal
    current_balance: Decimal
