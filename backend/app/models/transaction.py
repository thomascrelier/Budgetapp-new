"""Transaction model for BudgetCSV."""

from sqlalchemy import (
    Column, Integer, String, Numeric, Date, DateTime,
    Boolean, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Transaction(Base):
    """
    Represents a single financial transaction.

    Attributes:
        id: Primary key
        account_id: Foreign key to accounts table
        date: Transaction date (YYYY-MM-DD)
        description: Transaction description from bank
        amount: Positive = income, Negative = expense (Credit - Debit)
        category: User-assigned category for budgeting
        is_verified: User has reviewed/verified this transaction
        notes: Optional user notes
        import_batch_id: Groups transactions from same CSV upload
        created_at: When record was created
        updated_at: When record was last modified
    """

    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(
        Integer,
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    date = Column(Date, nullable=False, index=True)
    description = Column(String(500), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    category = Column(
        String(100),
        nullable=True,
        default="Uncategorized",
        index=True
    )
    is_verified = Column(Boolean, default=False, nullable=False)
    notes = Column(String(1000), nullable=True)
    import_batch_id = Column(String(36), nullable=True, index=True)  # UUID
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    account = relationship("Account", back_populates="transactions")

    # Indexes for common queries
    __table_args__ = (
        Index("ix_transactions_account_date", "account_id", "date"),
        Index("ix_transactions_date_category", "date", "category"),
        Index("ix_transactions_account_category_date", "account_id", "category", "date"),
    )

    def __repr__(self):
        return f"<Transaction(id={self.id}, date={self.date}, amount={self.amount})>"

    @property
    def is_expense(self) -> bool:
        """Returns True if this is an expense (negative amount)."""
        return self.amount < 0

    @property
    def is_income(self) -> bool:
        """Returns True if this is income (positive amount)."""
        return self.amount > 0
