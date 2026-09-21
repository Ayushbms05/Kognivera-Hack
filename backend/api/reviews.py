"""
Review Summarisation API — synthesise multilingual reviews into Pros/Cons.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
import aiosqlite

from core.database import get_db
from core.schemas import ReviewSummariseRequest, ReviewSummaryResponse

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


@router.post("/summarise", response_model=ReviewSummaryResponse)
async def summarise_reviews(
    req: ReviewSummariseRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Summarise exactly 25 reviews (mixed languages) for a hotel.
    Returns Pros/Cons in the user's requested language with review_id citations.
    """
    from services.review_summariser import summarise_hotel_reviews
    return await summarise_hotel_reviews(req.hotel_id, req.language, db)
