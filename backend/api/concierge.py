"""
Property Concierge API — Q&A bot grounded in hotel policies and amenities.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
import aiosqlite

from core.database import get_db
from core.schemas import ConciergeQuery, ConciergeResponse

router = APIRouter(prefix="/api/concierge", tags=["concierge"])


@router.post("", response_model=ConciergeResponse)
async def ask_concierge(
    req: ConciergeQuery,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Answer a question about a specific hotel using only its policies and amenities.
    Uses Claude AI with strict grounding. Falls back to a safe default if unavailable.
    """
    from services.concierge import answer_question
    return await answer_question(req, db)
