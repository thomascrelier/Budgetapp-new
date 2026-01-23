"""Budget management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional
from datetime import date
from decimal import Decimal

from app.database import get_db
from app.models import Budget, Transaction
from app.schemas import (
    BudgetCreate,
    BudgetUpdate,
    BudgetResponse,
    BudgetListResponse,
    BudgetStatus,
    BudgetStatusListResponse
)

router = APIRouter(prefix="/budgets", tags=["budgets"])


def calculate_category_spending(
    db: Session,
    category: str,
    year: int,
    month: int,
    account_ids: Optional[list[int]] = None
) -> Decimal:
    """Calculate total spending for a category in a given month."""
    query = db.query(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).filter(
        Transaction.category == category,
        Transaction.amount < 0,  # Only expenses
        extract('year', Transaction.date) == year,
        extract('month', Transaction.date) == month
    )

    if account_ids:
        query = query.filter(Transaction.account_id.in_(account_ids))

    result = query.scalar()
    return abs(Decimal(str(result)))


def get_budget_status(
    db: Session,
    budget: Budget,
    year: int,
    month: int,
    account_ids: Optional[list[int]] = None
) -> BudgetStatus:
    """Calculate budget status for a given month."""
    spent = calculate_category_spending(db, budget.category_name, year, month, account_ids)
    limit = Decimal(str(budget.monthly_limit))
    remaining = limit - spent

    if limit > 0:
        percentage_used = float((spent / limit) * 100)
    else:
        percentage_used = 0.0

    # Determine status color
    if percentage_used >= 100:
        status_color = "red"
    elif percentage_used >= 75:
        status_color = "yellow"
    else:
        status_color = "green"

    return BudgetStatus(
        category_name=budget.category_name,
        monthly_limit=limit,
        spent=spent,
        remaining=remaining,
        percentage_used=round(percentage_used, 1),
        status=status_color
    )


@router.get("/", response_model=BudgetListResponse)
def list_budgets(db: Session = Depends(get_db)):
    """List all budgets."""
    budgets = db.query(Budget).order_by(Budget.category_name).all()
    return BudgetListResponse(
        budgets=[BudgetResponse.model_validate(b) for b in budgets],
        total=len(budgets)
    )


@router.post("/", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
def create_budget(budget_data: BudgetCreate, db: Session = Depends(get_db)):
    """Create a new budget."""
    # Check for duplicate category
    existing = db.query(Budget).filter(
        Budget.category_name == budget_data.category_name
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Budget for category '{budget_data.category_name}' already exists"
        )

    budget = Budget(
        category_name=budget_data.category_name,
        monthly_limit=budget_data.monthly_limit,
        rollover_enabled=budget_data.rollover_enabled,
        alert_threshold=budget_data.alert_threshold
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)

    return BudgetResponse.model_validate(budget)


@router.get("/status", response_model=BudgetStatusListResponse)
def get_all_budget_statuses(
    month: Optional[str] = Query(
        None,
        description="Month in YYYY-MM format (defaults to current month)"
    ),
    account_ids: Optional[str] = Query(
        None,
        description="Comma-separated list of account IDs to filter"
    ),
    db: Session = Depends(get_db)
):
    """Get status for all budgets for a given month."""
    # Parse month
    if month:
        try:
            year, mon = map(int, month.split("-"))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid month format. Use YYYY-MM"
            )
    else:
        today = date.today()
        year, mon = today.year, today.month

    # Parse account IDs
    account_id_list = None
    if account_ids:
        try:
            account_id_list = [int(x.strip()) for x in account_ids.split(",")]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid account IDs format"
            )

    budgets = db.query(Budget).order_by(Budget.category_name).all()
    statuses = [
        get_budget_status(db, budget, year, mon, account_id_list)
        for budget in budgets
    ]

    return BudgetStatusListResponse(
        budgets=statuses,
        month=f"{year:04d}-{mon:02d}"
    )


@router.get("/{budget_id}", response_model=BudgetResponse)
def get_budget(budget_id: int, db: Session = Depends(get_db)):
    """Get a specific budget by ID."""
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Budget with ID {budget_id} not found"
        )
    return BudgetResponse.model_validate(budget)


@router.put("/{budget_id}", response_model=BudgetResponse)
def update_budget(
    budget_id: int,
    budget_data: BudgetUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing budget."""
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Budget with ID {budget_id} not found"
        )

    # Check for duplicate category if name is being changed
    if budget_data.category_name and budget_data.category_name != budget.category_name:
        existing = db.query(Budget).filter(
            Budget.category_name == budget_data.category_name
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Budget for category '{budget_data.category_name}' already exists"
            )

    update_data = budget_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(budget, field, value)

    db.commit()
    db.refresh(budget)

    return BudgetResponse.model_validate(budget)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    """Delete a budget."""
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Budget with ID {budget_id} not found"
        )

    db.delete(budget)
    db.commit()
