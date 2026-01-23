"""Transaction management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import Optional
from datetime import date
import math

from app.database import get_db
from app.models import Transaction, Account
from app.schemas import (
    TransactionUpdate,
    CategoryUpdate,
    TransactionResponse,
    TransactionListResponse,
    CategoryListResponse
)

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/", response_model=TransactionListResponse)
def list_transactions(
    account_id: Optional[int] = Query(None, description="Filter by account ID"),
    start_date: Optional[date] = Query(None, description="Start date filter"),
    end_date: Optional[date] = Query(None, description="End date filter"),
    category: Optional[str] = Query(None, description="Filter by category"),
    is_verified: Optional[bool] = Query(None, description="Filter by verification status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=200, description="Items per page"),
    sort_by: str = Query("date", description="Sort field (date, amount, description)"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="Sort order"),
    db: Session = Depends(get_db)
):
    """List transactions with filtering and pagination."""
    query = db.query(Transaction)

    # Apply filters
    if account_id is not None:
        query = query.filter(Transaction.account_id == account_id)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if category:
        query = query.filter(Transaction.category == category)
    if is_verified is not None:
        query = query.filter(Transaction.is_verified == is_verified)

    # Get total count
    total = query.count()

    # Apply sorting
    sort_column = getattr(Transaction, sort_by, Transaction.date)
    if sort_order == "desc":
        sort_column = sort_column.desc()
    query = query.order_by(sort_column)

    # Apply pagination
    offset = (page - 1) * limit
    transactions = query.offset(offset).limit(limit).all()

    total_pages = math.ceil(total / limit) if total > 0 else 1

    return TransactionListResponse(
        transactions=[TransactionResponse.model_validate(t) for t in transactions],
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )


@router.get("/categories", response_model=CategoryListResponse)
def list_categories(db: Session = Depends(get_db)):
    """Get list of distinct categories."""
    categories = db.query(distinct(Transaction.category)).filter(
        Transaction.category.isnot(None)
    ).order_by(Transaction.category).all()

    return CategoryListResponse(
        categories=[c[0] for c in categories if c[0]]
    )


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """Get a specific transaction by ID."""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with ID {transaction_id} not found"
        )
    return TransactionResponse.model_validate(transaction)


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    transaction_data: TransactionUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing transaction."""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with ID {transaction_id} not found"
        )

    update_data = transaction_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(transaction, field, value)

    db.commit()
    db.refresh(transaction)

    return TransactionResponse.model_validate(transaction)


@router.patch("/{transaction_id}/category", response_model=TransactionResponse)
def update_transaction_category(
    transaction_id: int,
    category_data: CategoryUpdate,
    db: Session = Depends(get_db)
):
    """Update only the category of a transaction."""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with ID {transaction_id} not found"
        )

    transaction.category = category_data.category
    db.commit()
    db.refresh(transaction)

    return TransactionResponse.model_validate(transaction)


@router.patch("/{transaction_id}/verify", response_model=TransactionResponse)
def toggle_transaction_verification(
    transaction_id: int,
    db: Session = Depends(get_db)
):
    """Toggle the verification status of a transaction."""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with ID {transaction_id} not found"
        )

    transaction.is_verified = not transaction.is_verified
    db.commit()
    db.refresh(transaction)

    return TransactionResponse.model_validate(transaction)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """Delete a transaction."""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with ID {transaction_id} not found"
        )

    db.delete(transaction)
    db.commit()
