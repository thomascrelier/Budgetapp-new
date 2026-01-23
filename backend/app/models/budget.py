"""Budget model for BudgetCSV."""

from sqlalchemy import Column, Integer, String, Numeric, DateTime, Boolean, CheckConstraint
from sqlalchemy.sql import func
from app.database import Base


class Budget(Base):
    """
    Represents a monthly spending limit for a category.

    Attributes:
        id: Primary key
        category_name: The category this budget applies to
        monthly_limit: Maximum spending allowed per month
        rollover_enabled: Whether unused budget rolls to next month
        alert_threshold: Percentage at which to show warning (default 75)
        created_at: When budget was created
        updated_at: When budget was last modified
    """

    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    category_name = Column(
        String(100),
        nullable=False,
        unique=True,
        index=True
    )
    monthly_limit = Column(
        Numeric(12, 2),
        nullable=False,
    )
    rollover_enabled = Column(Boolean, default=False, nullable=False)
    alert_threshold = Column(
        Integer,
        nullable=False,
        default=75
    )  # Percentage (0-100)
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

    __table_args__ = (
        CheckConstraint('monthly_limit > 0', name='positive_limit'),
        CheckConstraint('alert_threshold >= 0 AND alert_threshold <= 100', name='valid_threshold'),
    )

    def __repr__(self):
        return f"<Budget(category='{self.category_name}', limit={self.monthly_limit})>"
