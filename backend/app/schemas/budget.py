"""Pydantic schemas for Budget model."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal


class BudgetBase(BaseModel):
    """Base schema for budget data."""
    category_name: str = Field(..., min_length=1, max_length=100)
    monthly_limit: Decimal = Field(..., gt=0)
    rollover_enabled: bool = False
    alert_threshold: int = Field(default=75, ge=0, le=100)


class BudgetCreate(BudgetBase):
    """Schema for creating a new budget."""
    pass


class BudgetUpdate(BaseModel):
    """Schema for updating an existing budget."""
    category_name: Optional[str] = Field(None, min_length=1, max_length=100)
    monthly_limit: Optional[Decimal] = Field(None, gt=0)
    rollover_enabled: Optional[bool] = None
    alert_threshold: Optional[int] = Field(None, ge=0, le=100)


class BudgetResponse(BudgetBase):
    """Schema for budget response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class BudgetListResponse(BaseModel):
    """Schema for list of budgets response."""
    budgets: list[BudgetResponse]
    total: int


class BudgetStatus(BaseModel):
    """Budget status with spending information."""
    category_name: str
    monthly_limit: Decimal
    spent: Decimal
    remaining: Decimal
    percentage_used: float
    status: str  # "green", "yellow", "red"


class BudgetStatusListResponse(BaseModel):
    """Schema for list of budget statuses response."""
    budgets: list[BudgetStatus]
    month: str  # YYYY-MM format
