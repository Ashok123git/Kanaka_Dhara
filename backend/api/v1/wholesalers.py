from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.dependencies import get_current_user, get_db
from core.security import create_access_token
from db.models import Wholesaler
from db.schemas import WholesalerCreate, WholesalerResponse

router = APIRouter()


@router.get("/me", response_model=WholesalerResponse)
async def get_my_wholesaler_profile(
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Return the current user's wholesaler profile. 404 if not yet registered."""
    sub = user.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    user_id = str(sub)
    result = await db.execute(select(Wholesaler).where(Wholesaler.user_id == user_id))
    wholesaler = result.scalar_one_or_none()
    if not wholesaler:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wholesaler profile not found. Complete registration first.",
        )
    return wholesaler


@router.put("/me")
async def upsert_my_wholesaler_profile(
    body: WholesalerCreate,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Create or update the current user's wholesaler profile.
    If no profile exists, creates one and returns a new access_token with wholesaler_id
    so the frontend can update auth state without re-login.
    """
    sub = user.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    user_id = str(sub)
    result = await db.execute(select(Wholesaler).where(Wholesaler.user_id == user_id))
    wholesaler = result.scalar_one_or_none()

    if wholesaler:
        # Update existing
        wholesaler.shop_name = body.shop_name
        wholesaler.owner_name = body.owner_name
        wholesaler.mobile = body.mobile
        wholesaler.address = body.address
        wholesaler.gst_number = body.gst_number
        wholesaler.pan_number = body.pan_number
        wholesaler.status = body.status
        wholesaler.trade_credit_days = body.trade_credit_days
        await db.commit()
        await db.refresh(wholesaler)
        return {"wholesaler": WholesalerResponse.model_validate(wholesaler)}
    else:
        # Create new
        wholesaler = Wholesaler(
            user_id=user_id,
            shop_name=body.shop_name,
            owner_name=body.owner_name,
            mobile=body.mobile,
            address=body.address,
            gst_number=body.gst_number,
            pan_number=body.pan_number,
            status=body.status,
            trade_credit_days=body.trade_credit_days,
        )
        db.add(wholesaler)
        await db.commit()
        await db.refresh(wholesaler)
        # Issue new token with wholesaler_id so protected routes work
        access_token = create_access_token(
            subject=user_id,
            wholesaler_id=str(wholesaler.id),
        )
        return {
            "wholesaler": WholesalerResponse.model_validate(wholesaler),
            "access_token": access_token,
            "token_type": "bearer",
            "has_wholesaler": True,
        }
