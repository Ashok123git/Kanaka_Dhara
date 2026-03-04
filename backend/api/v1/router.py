from fastapi import APIRouter

from . import auth, wholesalers, contacts, orders, transactions


api_v1_router = APIRouter()

api_v1_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_v1_router.include_router(wholesalers.router, prefix="/wholesalers", tags=["wholesalers"])
api_v1_router.include_router(contacts.router, prefix="/contacts", tags=["contacts"])
api_v1_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_v1_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])

