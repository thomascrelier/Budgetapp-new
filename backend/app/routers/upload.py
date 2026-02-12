"""CSV upload API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models import Account, Transaction
from app.schemas import UploadResponse, PreviewResponse, ValidationIssueSchema
from app.schemas.upload import SummarySchema
from app.services.csv_processor import process_csv_file
from app.services.google_sheets import sheets_service
from app.utils.exceptions import CSVValidationError, CSVParsingError, CSVColumnError

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/csv", response_model=UploadResponse)
async def upload_csv(
    file: UploadFile = File(...),
    account_id: int = Form(...),
    encoding: Optional[str] = Form("utf-8"),
    strict_mode: Optional[bool] = Form(False),
    db: Session = Depends(get_db)
):
    """
    Upload and process a CSV file of transactions.

    CSV Format (no headers):
    - Column 0: Date (YYYY-MM-DD)
    - Column 1: Description
    - Column 2: Debit (money out)
    - Column 3: Credit (money in)
    """
    # Validate account exists
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with ID {account_id} not found"
        )

    # Validate file type
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV file"
        )

    # Read file content
    content = await file.read()

    try:
        # Process CSV
        result = process_csv_file(
            file_content=content,
            account_id=account_id,
            strict_mode=strict_mode,
            encoding=encoding
        )

        # Save transactions to database
        for trans_data in result.transactions:
            transaction = Transaction(
                account_id=trans_data["account_id"],
                date=trans_data["date"],
                description=trans_data["description"],
                amount=trans_data["amount"],
                category=trans_data["category"],
                is_verified=trans_data["is_verified"],
                import_batch_id=trans_data["import_batch_id"]
            )
            db.add(transaction)

        db.commit()

        # Sync to Google Sheets if enabled
        sheets_result = {"synced": False}
        if sheets_service.is_enabled():
            sheets_data = [
                {
                    "date": t["date"].isoformat(),
                    "description": t["description"],
                    "amount": float(t["amount"]),
                    "category": t["category"],
                }
                for t in result.transactions
            ]
            sheets_result = sheets_service.sync_transactions(sheets_data, account.name)

        # Convert issues to schema format
        issues = [
            ValidationIssueSchema(
                row_number=i.row_number,
                column=i.column,
                severity=i.severity.value,
                message=i.message,
                original_value=i.original_value
            )
            for i in result.issues
        ]

        # Build success message
        message = f"Successfully imported {result.processed_rows} transactions"
        if sheets_result.get("synced"):
            message += f" (synced {sheets_result.get('count', 0)} to Google Sheets)"

        return UploadResponse(
            success=True,
            batch_id=result.batch_id,
            total_rows=result.total_rows,
            processed_rows=result.processed_rows,
            skipped_rows=result.skipped_rows,
            issues=issues,
            summary=SummarySchema(**result.summary),
            message=message
        )

    except CSVColumnError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV format error: {str(e)}"
        )
    except CSVParsingError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV parsing error: {str(e)}"
        )
    except CSVValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV validation error: {str(e)}"
        )


@router.post("/csv/preview", response_model=PreviewResponse)
async def preview_csv(
    file: UploadFile = File(...),
    account_id: int = Form(...),
    encoding: Optional[str] = Form("utf-8"),
    db: Session = Depends(get_db)
):
    """
    Preview a CSV file without saving to database.

    Returns the first 10 transactions and validation issues.
    """
    # Validate account exists
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with ID {account_id} not found"
        )

    # Validate file type
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV file"
        )

    # Read file content
    content = await file.read()

    try:
        # Process CSV (non-strict to get all issues)
        result = process_csv_file(
            file_content=content,
            account_id=account_id,
            strict_mode=False,
            encoding=encoding
        )

        # Convert issues to schema format
        issues = [
            ValidationIssueSchema(
                row_number=i.row_number,
                column=i.column,
                severity=i.severity.value,
                message=i.message,
                original_value=i.original_value
            )
            for i in result.issues
        ]

        # Get preview of first 10 transactions
        preview_transactions = []
        for t in result.transactions[:10]:
            preview_transactions.append({
                "date": t["date"].isoformat(),
                "description": t["description"],
                "amount": str(t["amount"]),
                "category": t["category"]
            })

        return PreviewResponse(
            success=True,
            total_rows=result.total_rows,
            valid_rows=result.processed_rows,
            skipped_rows=result.skipped_rows,
            issues=issues,
            summary=SummarySchema(**result.summary),
            preview_transactions=preview_transactions
        )

    except CSVColumnError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV format error: {str(e)}"
        )
    except CSVParsingError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV parsing error: {str(e)}"
        )


@router.delete("/batch/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_batch(batch_id: str, db: Session = Depends(get_db)):
    """
    Delete all transactions from a specific import batch.

    This allows users to undo an import.
    """
    transactions = db.query(Transaction).filter(
        Transaction.import_batch_id == batch_id
    ).all()

    if not transactions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No transactions found for batch ID {batch_id}"
        )

    for transaction in transactions:
        db.delete(transaction)

    db.commit()
