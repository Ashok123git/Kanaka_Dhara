"""Transactions API: CRUD for wholesaler-scoped transactions and attachments."""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.config import settings
from app.dependencies import get_current_wholesaler_id, get_db
from db.schemas import (
    TransactionAttachmentInResponse,
    TransactionAttachmentResponse,
    TransactionCreate,
    TransactionResponse,
)
from repositories.transaction_repository import TransactionRepository
from services.transaction_service import TransactionService

router = APIRouter()

UPLOADS_PREFIX = "/api/v1/uploads"


def _attachment_to_in_response(attachment):
    """Build TransactionAttachmentInResponse with url for frontend."""
    path = attachment.file_path or ""
    url = f"{UPLOADS_PREFIX}/{path}" if path else ""
    return TransactionAttachmentInResponse(
        id=attachment.id,
        file_path=attachment.file_path,
        url=url,
    )


def _transaction_response_with_attachments(transaction, attachments_by_tid):
    """Build TransactionResponse with attachments list (with urls)."""
    data = TransactionResponse.model_validate(transaction).model_dump()
    attachments = attachments_by_tid.get(transaction.id, [])
    data["attachments"] = [_attachment_to_in_response(a) for a in attachments]
    return TransactionResponse.model_validate(data)


@router.get("/", response_model=list[TransactionResponse])
async def list_transactions(
    wholesaler_id: str = Depends(get_current_wholesaler_id),
    db=Depends(get_db),
    contact_id: str | None = Query(None, description="Filter by contact id"),
):
    """List all transactions for the current wholesaler. Optional filter by contact_id."""
    transactions = await TransactionService.list_transactions(
        db, wholesaler_id, contact_id=contact_id
    )
    if not transactions:
        return []
    tids = [t.id for t in transactions]
    attachments_by_tid = await TransactionRepository.list_attachments_by_transaction_ids(db, tids)
    return [
        _transaction_response_with_attachments(t, attachments_by_tid) for t in transactions
    ]


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    body: TransactionCreate,
    wholesaler_id: str = Depends(get_current_wholesaler_id),
    db=Depends(get_db),
):
    """Create a new transaction. Returns 400 if contact or order does not exist or does not belong to you."""
    try:
        transaction = await TransactionService.create_transaction(
            db, wholesaler_id, body
        )
    except ValueError as e:
        if "contact_not_found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contact not found or does not belong to your account.",
            ) from e
        if "order_not_found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order not found or does not belong to this contact.",
            ) from e
        raise
    await db.commit()
    await db.refresh(transaction)
    attachments = await TransactionRepository.list_attachments_by_transaction_id(db, transaction.id)
    return _transaction_response_with_attachments(
        transaction, {transaction.id: attachments}
    )


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: str,
    wholesaler_id: str = Depends(get_current_wholesaler_id),
    db=Depends(get_db),
):
    """Get a transaction by id. Returns 404 if not found or not owned by the current wholesaler."""
    transaction = await TransactionService.get_transaction(
        db, transaction_id, wholesaler_id
    )
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        )
    attachments = await TransactionRepository.list_attachments_by_transaction_id(db, transaction.id)
    return _transaction_response_with_attachments(
        transaction, {transaction.id: attachments}
    )


@router.post(
    "/{transaction_id}/attachments",
    response_model=TransactionAttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_transaction_attachment(
    transaction_id: str,
    file: UploadFile = File(...),
    wholesaler_id: str = Depends(get_current_wholesaler_id),
    db=Depends(get_db),
):
    """Upload a file attachment for a transaction. Returns 404 if transaction not found."""
    content = await file.read()
    filename = file.filename or "attachment"
    attachment = await TransactionService.upload_attachment(
        db,
        transaction_id,
        wholesaler_id,
        content,
        filename,
        settings.UPLOAD_DIR,
    )
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        )
    await db.commit()
    await db.refresh(attachment)
    return TransactionAttachmentResponse.model_validate(attachment)
