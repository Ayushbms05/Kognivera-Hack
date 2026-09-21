"""
Yield Arbitrage & Limit-Order Booking API.
Pure mathematical pricing engine predicting price drop probabilities
and managing automated limit order bookings with UPI AutoPay mandates.
"""

from __future__ import annotations

from datetime import date
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
import aiosqlite

from core.database import get_db
from services.yield_arbitrage import arbitrage_engine

router = APIRouter(prefix="/api/hotels", tags=["arbitrage"])


class ArbitrageOrderRequest(BaseModel):
    room_type_id: str = Field(..., description="Target room type identifier")
    user_id: Optional[str] = Field("usr_default", description="Active user ID")
    for_date: str = Field(..., description="Target check-in date (YYYY-MM-DD)")
    target_price: float = Field(..., gt=0, description="Target limit price")
    target_currency: Optional[str] = Field("INR", description="Currency code")


class ArbitrageOrderResponse(BaseModel):
    success: bool
    eligible: bool
    order_id: Optional[str] = None
    status: Optional[str] = None
    hotel_id: str
    room_type_id: str
    room_name: Optional[str] = None
    for_date: str
    base_rate: float
    target_price: float
    discount_pct: float
    fill_probability: float
    fill_probability_pct: int
    upi_mandate_id: Optional[str] = None
    upi_mandate_uri: Optional[str] = None
    created_at: Optional[str] = None
    message: str


@router.get("/{hotel_id}/arbitrage-quote")
async def get_arbitrage_quote(
    hotel_id: str,
    room_type_id: str = Query(..., description="Target room type ID"),
    for_date: Optional[str] = Query(None, description="Check-in date (YYYY-MM-DD)"),
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Get live inventory metrics, cancellation heuristic, and precomputed discount-to-probability curve.
    Used by frontend slider to reactively render fill probability in real time.
    """
    date_str = for_date or "2026-09-24"
    try:
        metrics = await arbitrage_engine.calculate_arbitrage_metrics(
            hotel_id, room_type_id, date_str, db
        )
        return metrics
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{hotel_id}/arbitrage-order", response_model=ArbitrageOrderResponse)
async def place_arbitrage_order_endpoint(
    hotel_id: str,
    req: ArbitrageOrderRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Place a Limit-Order Yield Arbitrage booking.
    Evaluates probability score. If > 50%, saves to sf_limit_orders and returns UPI mandate.
    """
    try:
        res = await arbitrage_engine.place_arbitrage_order(
            hotel_id=hotel_id,
            room_type_id=req.room_type_id,
            user_id=req.user_id or "usr_default",
            for_date_str=req.for_date,
            target_price=req.target_price,
            db=db,
        )

        if not res["eligible"]:
            raise HTTPException(
                status_code=400,
                detail=res["message"],
            )

        return ArbitrageOrderResponse(**res)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to place limit order: {str(e)}")


@router.get("/{hotel_id}/limit-orders")
async def get_hotel_limit_orders(
    hotel_id: str,
    user_id: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Fetch active limit orders for a hotel or user.
    """
    await arbitrage_engine.ensure_tables(db)
    if user_id:
        cursor = await db.execute("""
            SELECT * FROM sf_limit_orders
            WHERE hotel_id = ? AND user_id = ?
            ORDER BY created_at DESC
        """, [hotel_id, user_id])
    else:
        cursor = await db.execute("""
            SELECT * FROM sf_limit_orders
            WHERE hotel_id = ?
            ORDER BY created_at DESC
            LIMIT 20
        """, [hotel_id])
    rows = await cursor.fetchall()
    return {
        "count": len(rows),
        "orders": [dict(r) for r in rows],
    }
