"""Contacts API: CRUD for wholesaler-scoped contacts."""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_current_wholesaler_id, get_db
from db.schemas import ContactCreate, ContactResponse, ContactUpdate
from services.contact_service import ContactService

router = APIRouter()


@router.get("/", response_model=list[ContactResponse])
async def list_contacts(
    wholesaler_id: str = Depends(get_current_wholesaler_id),
    db=Depends(get_db),
    type: str | None = Query(None, description="Filter by type: customer or supplier"),
):
    """List all contacts for the current wholesaler. Optional filter by type."""
    contacts = await ContactService.list_contacts(
        db, wholesaler_id, type_filter=type
    )
    return [ContactResponse.model_validate(c) for c in contacts]


@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    body: ContactCreate,
    wholesaler_id: str = Depends(get_current_wholesaler_id),
    db=Depends(get_db),
):
    """Create a new contact for the current wholesaler."""
    contact = await ContactService.create_contact(db, wholesaler_id, body)
    await db.commit()
    await db.refresh(contact)
    return ContactResponse.model_validate(contact)


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: str,
    wholesaler_id: str = Depends(get_current_wholesaler_id),
    db=Depends(get_db),
):
    """Get a contact by id. Returns 404 if not found or not owned by the current wholesaler."""
    contact = await ContactService.get_contact(db, contact_id, wholesaler_id)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found.",
        )
    return ContactResponse.model_validate(contact)


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: str,
    body: ContactUpdate,
    wholesaler_id: str = Depends(get_current_wholesaler_id),
    db=Depends(get_db),
):
    """Update a contact. Returns 404 if not found or not owned by the current wholesaler."""
    contact = await ContactService.update_contact(db, contact_id, wholesaler_id, body)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found.",
        )
    await db.commit()
    await db.refresh(contact)
    return ContactResponse.model_validate(contact)
