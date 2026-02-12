"""Account management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal

from app.database import get_db
from app.models import Account, Transaction
from app.schemas import (
    AccountCreate,
    AccountUpdate,
    AccountResponse,
    AccountListResponse,
    BalanceResponse
)

router = APIRouter(prefix="/accounts", tags=["accounts"])


def calculate_current_balance(db: Session, account: Account) -> Decimal:
    """Calculate current balance for an account."""
    transaction_sum = db.query(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).filter(Transaction.account_id == account.id).scalar()

    return Decimal(str(account.initial_balance)) + Decimal(str(transaction_sum))


@router.get("/", response_model=AccountListResponse)
def list_accounts(
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):
    """List all accounts."""
    query = db.query(Account)
    if not include_inactive:
        query = query.filter(Account.is_active == True)

    accounts = query.order_by(Account.name).all()

    # Calculate current balance for each account
    response_accounts = []
    for account in accounts:
        account_dict = {
            "id": account.id,
            "name": account.name,
            "account_type": account.account_type,
            "initial_balance": account.initial_balance,
            "is_active": account.is_active,
            "current_balance": calculate_current_balance(db, account),
            "created_at": account.created_at,
            "updated_at": account.updated_at
        }
        response_accounts.append(AccountResponse(**account_dict))

    return AccountListResponse(accounts=response_accounts, total=len(response_accounts))


@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(account_data: AccountCreate, db: Session = Depends(get_db)):
    """Create a new account."""
    # Check for duplicate name
    existing = db.query(Account).filter(Account.name == account_data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Account with name '{account_data.name}' already exists"
        )

    account = Account(
        name=account_data.name,
        account_type=account_data.account_type,
        initial_balance=account_data.initial_balance
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    return AccountResponse(
        id=account.id,
        name=account.name,
        account_type=account.account_type,
        initial_balance=account.initial_balance,
        is_active=account.is_active,
        current_balance=account.initial_balance,  # No transactions yet
        created_at=account.created_at,
        updated_at=account.updated_at
    )


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(account_id: int, db: Session = Depends(get_db)):
    """Get a specific account by ID."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with ID {account_id} not found"
        )

    return AccountResponse(
        id=account.id,
        name=account.name,
        account_type=account.account_type,
        initial_balance=account.initial_balance,
        is_active=account.is_active,
        current_balance=calculate_current_balance(db, account),
        created_at=account.created_at,
        updated_at=account.updated_at
    )


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    account_data: AccountUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing account."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with ID {account_id} not found"
        )

    # Check for duplicate name if name is being changed
    if account_data.name and account_data.name != account.name:
        existing = db.query(Account).filter(Account.name == account_data.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Account with name '{account_data.name}' already exists"
            )

    # Update fields
    update_data = account_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(account, field, value)

    db.commit()
    db.refresh(account)

    return AccountResponse(
        id=account.id,
        name=account.name,
        account_type=account.account_type,
        initial_balance=account.initial_balance,
        is_active=account.is_active,
        current_balance=calculate_current_balance(db, account),
        created_at=account.created_at,
        updated_at=account.updated_at
    )


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    """Delete an account and all its transactions."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with ID {account_id} not found"
        )

    db.delete(account)
    db.commit()


@router.post("/initialize-defaults")
def initialize_default_accounts(db: Session = Depends(get_db)):
    """
    Initialize the three default accounts if they don't exist:
    - Main Chequing
    - Rental Property
    - Visa Credit Card
    """
    default_accounts = [
        {"name": "Main Chequing", "account_type": "checking", "initial_balance": 0},
        {"name": "Rental Property", "account_type": "checking", "initial_balance": 0},
        {"name": "Visa Credit Card", "account_type": "credit_card", "initial_balance": 0},
    ]

    created = []
    existing = []

    for acct_data in default_accounts:
        acct = db.query(Account).filter(Account.name == acct_data["name"]).first()
        if acct:
            existing.append(acct_data["name"])
        else:
            account = Account(**acct_data)
            db.add(account)
            created.append(acct_data["name"])

    db.commit()

    return {
        "created": created,
        "existing": existing,
        "message": f"Created {len(created)} accounts, {len(existing)} already existed"
    }


@router.get("/{account_id}/balance", response_model=BalanceResponse)
def get_account_balance(account_id: int, db: Session = Depends(get_db)):
    """Get detailed balance information for an account."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with ID {account_id} not found"
        )

    transaction_sum = db.query(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).filter(Transaction.account_id == account_id).scalar()

    initial = Decimal(str(account.initial_balance))
    trans_total = Decimal(str(transaction_sum))

    return BalanceResponse(
        account_id=account.id,
        account_name=account.name,
        initial_balance=initial,
        transaction_total=trans_total,
        current_balance=initial + trans_total
    )
