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


class UtilityBreakdown(BaseModel):
    category: str
    current_month: Decimal
    rolling_avg_3m: Decimal
    rolling_avg_12m: Decimal
    year_over_year_change: Optional[float]


class RentalCashFlow(BaseModel):
    month: str
    income: Decimal
    expenses: Decimal
    net: Decimal
    utilities_total: Decimal


class RentalAnalyticsResponse(BaseModel):
    account_id: int
    account_name: str
    current_balance: Decimal
    monthly_cash_flow: Decimal
    ytd_cash_flow: Decimal
    utility_breakdown: list[UtilityBreakdown]
    cash_flow_history: list[RentalCashFlow]
    year_over_year: Optional[dict]


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


# Utility categories for rental property
UTILITY_CATEGORIES = ["water", "tax", "energy", "internet", "gas", "electricity", "hydro", "property tax"]


def is_utility_category(category: str) -> str:
    """Check if a category is a utility and normalize it."""
    if not category:
        return None
    cat_lower = category.lower()
    for util in UTILITY_CATEGORIES:
        if util in cat_lower:
            # Normalize to standard names
            if "water" in cat_lower:
                return "Water"
            if "tax" in cat_lower:
                return "Property Tax"
            if "energy" in cat_lower or "electricity" in cat_lower or "hydro" in cat_lower:
                return "Energy"
            if "internet" in cat_lower:
                return "Internet"
            if "gas" in cat_lower:
                return "Gas"
    return None


@router.get("/rental-property", response_model=RentalAnalyticsResponse)
def get_rental_property_analytics(
    db: Session = Depends(get_db)
):
    """Get detailed analytics for the rental property account."""
    # Find the Rental Property account
    account = db.query(Account).filter(Account.name == "Rental Property").first()
    if not account:
        raise HTTPException(
            status_code=404,
            detail="Rental Property account not found. Please initialize default accounts first."
        )

    today = date.today()
    current_year = today.year
    current_month = today.month

    # Calculate current balance
    initial = Decimal(str(account.initial_balance))
    trans_sum = db.query(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).filter(Transaction.account_id == account.id).scalar()
    current_balance = initial + Decimal(str(trans_sum))

    # Get all transactions for this account
    all_transactions = db.query(Transaction).filter(
        Transaction.account_id == account.id
    ).order_by(Transaction.date).all()

    # Calculate monthly cash flow (current month)
    monthly_income = Decimal("0.00")
    monthly_expenses = Decimal("0.00")
    for t in all_transactions:
        if t.date.year == current_year and t.date.month == current_month:
            amount = Decimal(str(t.amount))
            if amount > 0:
                monthly_income += amount
            else:
                monthly_expenses += abs(amount)

    # Calculate YTD cash flow
    ytd_income = Decimal("0.00")
    ytd_expenses = Decimal("0.00")
    for t in all_transactions:
        if t.date.year == current_year:
            amount = Decimal(str(t.amount))
            if amount > 0:
                ytd_income += amount
            else:
                ytd_expenses += abs(amount)

    # Build utility breakdown with rolling averages
    utility_spending = {}  # {category: {month: amount}}
    for t in all_transactions:
        util_cat = is_utility_category(t.category)
        if util_cat and Decimal(str(t.amount)) < 0:
            month_key = f"{t.date.year:04d}-{t.date.month:02d}"
            if util_cat not in utility_spending:
                utility_spending[util_cat] = {}
            if month_key not in utility_spending[util_cat]:
                utility_spending[util_cat][month_key] = Decimal("0.00")
            utility_spending[util_cat][month_key] += abs(Decimal(str(t.amount)))

    # Calculate rolling averages and YoY
    utility_breakdown = []
    current_month_key = f"{current_year:04d}-{current_month:02d}"
    last_year_month_key = f"{current_year - 1:04d}-{current_month:02d}"

    for util_cat in ["Water", "Property Tax", "Energy", "Internet", "Gas"]:
        months_data = utility_spending.get(util_cat, {})
        current_amount = months_data.get(current_month_key, Decimal("0.00"))

        # Rolling 3 month average
        rolling_3m_total = Decimal("0.00")
        rolling_3m_count = 0
        for i in range(3):
            m = current_month - i
            y = current_year
            while m <= 0:
                m += 12
                y -= 1
            key = f"{y:04d}-{m:02d}"
            if key in months_data:
                rolling_3m_total += months_data[key]
                rolling_3m_count += 1
        rolling_avg_3m = rolling_3m_total / rolling_3m_count if rolling_3m_count > 0 else Decimal("0.00")

        # Rolling 12 month average
        rolling_12m_total = Decimal("0.00")
        rolling_12m_count = 0
        for i in range(12):
            m = current_month - i
            y = current_year
            while m <= 0:
                m += 12
                y -= 1
            key = f"{y:04d}-{m:02d}"
            if key in months_data:
                rolling_12m_total += months_data[key]
                rolling_12m_count += 1
        rolling_avg_12m = rolling_12m_total / rolling_12m_count if rolling_12m_count > 0 else Decimal("0.00")

        # Year over year change
        last_year_amount = months_data.get(last_year_month_key, None)
        yoy_change = None
        if last_year_amount and last_year_amount > 0 and current_amount > 0:
            yoy_change = float((current_amount - last_year_amount) / last_year_amount * 100)

        utility_breakdown.append(UtilityBreakdown(
            category=util_cat,
            current_month=current_amount,
            rolling_avg_3m=rolling_avg_3m,
            rolling_avg_12m=rolling_avg_12m,
            year_over_year_change=yoy_change
        ))

    # Build 12-month cash flow history
    cash_flow_history = []
    for i in range(11, -1, -1):
        m = current_month - i
        y = current_year
        while m <= 0:
            m += 12
            y -= 1

        month_income = Decimal("0.00")
        month_expenses = Decimal("0.00")
        month_utilities = Decimal("0.00")

        for t in all_transactions:
            if t.date.year == y and t.date.month == m:
                amount = Decimal(str(t.amount))
                if amount > 0:
                    month_income += amount
                else:
                    month_expenses += abs(amount)
                    if is_utility_category(t.category):
                        month_utilities += abs(amount)

        cash_flow_history.append(RentalCashFlow(
            month=f"{y:04d}-{m:02d}",
            income=month_income,
            expenses=month_expenses,
            net=month_income - month_expenses,
            utilities_total=month_utilities
        ))

    # Year over year comparison
    last_year_total_income = Decimal("0.00")
    last_year_total_expenses = Decimal("0.00")
    this_year_total_income = Decimal("0.00")
    this_year_total_expenses = Decimal("0.00")

    for t in all_transactions:
        amount = Decimal(str(t.amount))
        if t.date.year == current_year - 1:
            if amount > 0:
                last_year_total_income += amount
            else:
                last_year_total_expenses += abs(amount)
        elif t.date.year == current_year:
            if amount > 0:
                this_year_total_income += amount
            else:
                this_year_total_expenses += abs(amount)

    year_over_year = None
    if last_year_total_income > 0 or last_year_total_expenses > 0:
        year_over_year = {
            "last_year": {
                "income": float(last_year_total_income),
                "expenses": float(last_year_total_expenses),
                "net": float(last_year_total_income - last_year_total_expenses)
            },
            "this_year": {
                "income": float(this_year_total_income),
                "expenses": float(this_year_total_expenses),
                "net": float(this_year_total_income - this_year_total_expenses)
            }
        }

    return RentalAnalyticsResponse(
        account_id=account.id,
        account_name=account.name,
        current_balance=current_balance,
        monthly_cash_flow=monthly_income - monthly_expenses,
        ytd_cash_flow=ytd_income - ytd_expenses,
        utility_breakdown=utility_breakdown,
        cash_flow_history=cash_flow_history,
        year_over_year=year_over_year
    )
