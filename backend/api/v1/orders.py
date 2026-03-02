"""Orders API: CRUD for wholesaler-scoped orders."""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_current_wholesaler_id, get_db
from db.schemas import OrderCreate, OrderResponse, OrderUpdate
from services.order_service import OrderService

router = APIRouter()


@router.get("/", response_model=list[OrderResponse])
async def list_orders(
    wholesaler_id: str = Depends(get_current_wholesaler_id),
    db=Depends(get_db),
    contact_id: str | None = Query(None, description="Filter by contact id"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status: open or closed"),
):
    """List all orders for the current wholesaler. Optional filters by contact or status."""
    orders = await OrderService.list_orders(
        db,
        wholesaler_id,
        contact_id=contact_id,
        status_filter=status_filter,
    )
    return [OrderResponse.model_validate(o) for o in orders]


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    body: OrderCreate,
    wholesaler_id: str = Depends(get_current_wholesaler_id),
    db=Depends(get_db),
):
    """Create a new order. Returns 400 if the contact does not exist or does not belong to you."""
    try:
        order = await OrderService.create_order(db, wholesaler_id, body)
    except ValueError as e:
        if "contact_not_found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contact not found or does not belong to your account.",
            ) from e
        if "order_number_duplicate" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An order with this order number already exists.",
            ) from e
        raise
    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    wholesaler_id: str = Depends(get_current_wholesaler_id),
    db=Depends(get_db),
):
    """Get an order by id. Returns 404 if not found or not owned by the current wholesaler."""
    order = await OrderService.get_order(db, order_id, wholesaler_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )
    return OrderResponse.model_validate(order)


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: str,
    body: OrderUpdate,
    wholesaler_id: str = Depends(get_current_wholesaler_id),
    db=Depends(get_db),
):
    """Update an order. Returns 404 if order not found; 400 if contact_id is invalid."""
    try:
        order = await OrderService.update_order(db, order_id, wholesaler_id, body)
    except ValueError as e:
        if "contact_not_found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contact not found or does not belong to your account.",
            ) from e
        raise
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )
    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)
