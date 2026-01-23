"""Account model for BudgetCSV."""

from sqlalchemy import Column, Integer, String, Numeric, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Account(Base):
    """
    Represents a financial account (checking, savings, credit card, etc.)

    Attributes:
        id: Primary key
        name: Display name for the account (e.g., "Chase Checking")
        account_type: Type of account (checking, savings, credit, investment)
        initial_balance: Starting balance when account was created
        is_active: Soft delete / visibility toggle
        created_at: Timestamp of account creation
        updated_at: Timestamp of last modification
    """

    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    account_type = Column(
        String(50),
        nullable=False,
        default="checking"
    )  # checking, savings, credit, investment
    initial_balance = Column(
        Numeric(12, 2),
        nullable=False,
        default=0.00
    )
    is_active = Column(Boolean, default=True, nullable=False)
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
    transactions = relationship(
        "Transaction",
        back_populates="account",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )

    def __repr__(self):
        return f"<Account(id={self.id}, name='{self.name}')>"
