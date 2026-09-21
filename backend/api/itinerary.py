"""
Itinerary API — AI Auto-Itinerary Builder endpoint.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
import aiosqlite

from core.database import get_db
from core.schemas import ItineraryGenerateRequest, ItineraryResponse
from services.itinerary import generate_itinerary

router = APIRouter(prefix="/api/itinerary", tags=["itinerary"])


@router.post("/generate", response_model=ItineraryResponse)
async def create_itinerary(
    req: ItineraryGenerateRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Generate a personalized, day-by-day 3-day itinerary centered around
    the hotel using Google Gemini AI and destination data.
    """
    return await generate_itinerary(req, db)
