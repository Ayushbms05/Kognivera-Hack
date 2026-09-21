"""
User API — profiles and personalised recommendations.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import aiosqlite

from core.database import get_db
from core.schemas import UserProfile, HotelListItem, AmenityItem

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/{user_id}", response_model=UserProfile)
async def get_user(user_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a user profile."""
    cursor = await db.execute("SELECT * FROM users WHERE user_id = ?", [user_id])
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return UserProfile(
        user_id=row["user_id"],
        display_name=row["display_name"],
        email=row["email"],
        home_city_id=row["home_city_id"],
        home_currency=row["home_currency"],
        locale=row["locale"],
        budget_band=row["budget_band"],
        travel_style=row["travel_style"],
        traveller_type=row["traveller_type"],
        segment=row["segment"],
        loyalty_tier=row.get("loyalty_tier"),
    )


@router.get("/{user_id}/recommendations")
async def get_recommendations(
    user_id: str,
    city_id: Optional[str] = None,
    limit: int = Query(10, ge=1, le=50),
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Personalised hotel recommendations based on user interaction history.
    Uses the ranking service to compute affinity scores.
    """
    from services.ranking import compute_affinities

    # Get user profile with graceful fallback to first user for demo
    cursor = await db.execute("SELECT * FROM users WHERE user_id = ?", [user_id])
    user = await cursor.fetchone()
    if not user:
        fallback_cur = await db.execute("SELECT * FROM users WHERE status = 'active' LIMIT 1")
        user = await fallback_cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="No users found in database")
        user_id = user["user_id"]

    # Get scored hotels
    scored_hotels = await compute_affinities(user_id, user, city_id, limit, db)

    return {"user_id": user_id, "items": scored_hotels}


@router.get("")
async def list_users(
    limit: int = Query(10, ge=1, le=50),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List users (for demo/dev purposes)."""
    cursor = await db.execute(
        "SELECT * FROM users WHERE status = 'active' ORDER BY display_name LIMIT ?",
        [limit],
    )
    rows = await cursor.fetchall()
    return [
        UserProfile(
            user_id=r["user_id"],
            display_name=r["display_name"],
            email=r["email"],
            home_city_id=r["home_city_id"],
            home_currency=r["home_currency"],
            locale=r["locale"],
            budget_band=r["budget_band"],
            travel_style=r["travel_style"],
            traveller_type=r["traveller_type"],
            segment=r["segment"],
            loyalty_tier=r.get("loyalty_tier"),
        )
        for r in rows
    ]
