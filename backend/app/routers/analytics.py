"""Analytics and dashboard API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional
from datetime import date, timedelta
from decimal import Decimal
from pydantic import BaseModel

from app.database import get_db
from app.models import Account, Transaction, Budget
from app.routers.budgets import get_budget_status
from app.schemas import BudgetStatus

router = APIRouter(prefix="/analytics", tags=["analytics"])


# Response schemas specific to analytics
class KPIData(BaseModel):
    total_balance: Decimal
    monthly_spending: Decimal
    monthly_income: Decimal
    net_cash_flow: Decimal


class DashboardResponse(BaseModel):
    kpis: KPIData
    budget_alerts: list[BudgetStatus]


class CashFlowDataPoint(BaseModel):
    month: str  # YYYY-MM
    income: Decimal
    expenses: Decimal
    net: Decimal


class CashFlowResponse(BaseModel):
    data: list[CashFlowDataPoint]


class BalanceDataPoint(BaseModel):
    date: str  # YYYY-MM-DD
    balance: Decimal


class BalanceHistoryResponse(BaseModel):
    data: list[BalanceDataPoint]
    account_id: Optional[int]
    initial_balance: Decimal


class CategorySpending(BaseModel):
    category: str
    amount: Decimal
    percentage: float


class CategoryBreakdownResponse(BaseModel):
    categories: list[CategorySpending]
    total: Decimal
    month: str


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    account_ids: Optional[str] = Query(
        None,
        description="Comma-separated list of account IDs to filter"
    ),
    db: Session = Depends(get_db)
):
    """Get dashboard KPIs and budget alerts."""
    # Parse account IDs
    account_id_list = None
    if account_ids:
        try:
            account_id_list = [int(x.strip()) for x in account_ids.split(",")]
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid account IDs format"
            )

    # Calculate total balance across all accounts
    accounts_query = db.query(Account).filter(Account.is_active == True)
    if account_id_list:
        accounts_query = accounts_query.filter(Account.id.in_(account_id_list))
    accounts = accounts_query.all()

    total_balance = Decimal("0.00")
    for account in accounts:
        initial = Decimal(str(account.initial_balance))

        trans_query = db.query(
            func.coalesce(func.sum(Transaction.amount), 0)
        ).filter(Transaction.account_id == account.id)
        trans_sum = Decimal(str(trans_query.scalar()))

        total_balance += initial + trans_sum

    # Calculate this month's spending and income
    today = date.today()
    year, month = today.year, today.month

    transactions_query = db.query(Transaction).filter(
        extract('year', Transaction.date) == year,
        extract('month', Transaction.date) == month
    )
    if account_id_list:
        transactions_query = transactions_query.filter(
            Transaction.account_id.in_(account_id_list)
        )

    monthly_income = Decimal("0.00")
    monthly_spending = Decimal("0.00")

    for t in transactions_query.all():
        amount = Decimal(str(t.amount))
        if amount > 0:
            monthly_income += amount
        else:
            monthly_spending += abs(amount)

    # Get budget alerts (budgets at or above alert threshold)
    budgets = db.query(Budget).all()
    alerts = []
    for budget in budgets:
        status = get_budget_status(db, budget, year, month, account_id_list)
        if status.percentage_used >= budget.alert_threshold:
            alerts.append(status)

    # Sort alerts by percentage (highest first)
    alerts.sort(key=lambda x: x.percentage_used, reverse=True)

    return DashboardResponse(
        kpis=KPIData(
            total_balance=total_balance,
            monthly_spending=monthly_spending,
            monthly_income=monthly_income,
            net_cash_flow=monthly_income - monthly_spending
        ),
        budget_alerts=alerts
    )


@router.get("/cash-flow", response_model=CashFlowResponse)
def get_cash_flow(
    months: int = Query(12, ge=1, le=36, description="Number of months to include"),
    account_ids: Optional[str] = Query(None, description="Comma-separated account IDs"),
    db: Session = Depends(get_db)
):
    """Get monthly cash flow data (income vs expenses)."""
    # Parse account IDs
    account_id_list = None
    if account_ids:
        try:
            account_id_list = [int(x.strip()) for x in account_ids.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid account IDs format")

    today = date.today()
    data = []

    for i in range(months - 1, -1, -1):
        # Calculate the month
        year = today.year
        month = today.month - i

        while month <= 0:
            month += 12
            year -= 1

        # Query transactions for this month
        query = db.query(Transaction).filter(
            extract('year', Transaction.date) == year,
            extract('month', Transaction.date) == month
        )
        if account_id_list:
            query = query.filter(Transaction.account_id.in_(account_id_list))

        income = Decimal("0.00")
        expenses = Decimal("0.00")

        for t in query.all():
            amount = Decimal(str(t.amount))
            if amount > 0:
                income += amount
            else:
                expenses += abs(amount)

        data.append(CashFlowDataPoint(
            month=f"{year:04d}-{month:02d}",
            income=income,
            expenses=expenses,
            net=income - expenses
        ))

    return CashFlowResponse(data=data)


@router.get("/balance-history", response_model=BalanceHistoryResponse)
def get_balance_history(
    days: int = Query(30, ge=1, le=365, description="Number of days to include"),
    account_id: Optional[int] = Query(None, description="Account ID (all if not specified)"),
    db: Session = Depends(get_db)
):
    """Get daily balance history for the specified period."""
    today = date.today()
    start_date = today - timedelta(days=days - 1)

    # Get initial balance
    if account_id:
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        initial_balance = Decimal(str(account.initial_balance))
    else:
        # Sum initial balances of all active accounts
        accounts = db.query(Account).filter(Account.is_active == True).all()
        initial_balance = sum(Decimal(str(a.initial_balance)) for a in accounts)

    # Get all transactions up to and including today
    trans_query = db.query(Transaction).filter(Transaction.date <= today)
    if account_id:
        trans_query = trans_query.filter(Transaction.account_id == account_id)

    transactions = trans_query.order_by(Transaction.date).all()

    # Calculate running balance for each day
    data = []
    running_balance = initial_balance

    # First, add up all transactions before start_date
    for t in transactions:
        if t.date < start_date:
            running_balance += Decimal(str(t.amount))

    # Now calculate daily balances
    current_date = start_date
    trans_index = 0

    # Skip to transactions on or after start_date
    while trans_index < len(transactions) and transactions[trans_index].date < start_date:
        trans_index += 1

    while current_date <= today:
        # Add transactions for this day
        while trans_index < len(transactions) and transactions[trans_index].date == current_date:
            running_balance += Decimal(str(transactions[trans_index].amount))
            trans_index += 1

        data.append(BalanceDataPoint(
            date=current_date.isoformat(),
            balance=running_balance
        ))

        current_date += timedelta(days=1)

    return BalanceHistoryResponse(
        data=data,
        account_id=account_id,
        initial_balance=initial_balance
    )


@router.get("/spending-by-category", response_model=CategoryBreakdownResponse)
def get_spending_by_category(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    account_ids: Optional[str] = Query(None, description="Comma-separated account IDs"),
    db: Session = Depends(get_db)
):
    """Get spending breakdown by category for a given month."""
    # Parse month
    if month:
        try:
            year, mon = map(int, month.split("-"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")
    else:
        today = date.today()
        year, mon = today.year, today.month

    # Parse account IDs
    account_id_list = None
    if account_ids:
        try:
            account_id_list = [int(x.strip()) for x in account_ids.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid account IDs format")

    # Query spending by category
    query = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label('total')
    ).filter(
        Transaction.amount < 0,  # Only expenses
        extract('year', Transaction.date) == year,
        extract('month', Transaction.date) == mon
    )

    if account_id_list:
        query = query.filter(Transaction.account_id.in_(account_id_list))

    query = query.group_by(Transaction.category).order_by(func.sum(Transaction.amount))

    results = query.all()

    # Calculate total and percentages
    total = sum(abs(Decimal(str(r.total))) for r in results)

    categories = []
    for r in results:
        amount = abs(Decimal(str(r.total)))
        percentage = float((amount / total) * 100) if total > 0 else 0.0
        categories.append(CategorySpending(
            category=r.category or "Uncategorized",
            amount=amount,
            percentage=round(percentage, 1)
        ))

    # Sort by amount descending
    categories.sort(key=lambda x: x.amount, reverse=True)

    return CategoryBreakdownResponse(
        categories=categories,
        total=total,
        month=f"{year:04d}-{mon:02d}"
    )
