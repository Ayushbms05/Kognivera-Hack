from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from services.group_consensus import calculate_group_consensus, get_squad_candidates

router = APIRouter(prefix="/api/hotels", tags=["Group Travel Consensus"])

@router.get("/squad-candidates")
def list_squad_candidates(limit: int = Query(8, ge=2, le=50)):
    """
    Returns curated squad candidate users with 5-axis preference vectors
    derived from sf_user_prefs, canonical users, and interaction dwell times.
    """
    try:
        candidates = get_squad_candidates(limit=limit)
        return {"candidates": candidates, "count": len(candidates)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch squad candidates: {str(e)}")

@router.get("/{hotel_id}/group-consensus")
def get_hotel_group_consensus(
    hotel_id: str,
    users: str = Query(..., description="Comma-separated user IDs (e.g. usr_6afe5712,usr_05c1346c,usr_c75aefa2)")
):
    """
    Multiplayer Group Travel Consensus Radar.
    Uses local NumPy vector algebra over [Budget, Luxury, Wellness, Heritage, Nightlife]
    to calculate the mathematical centroid of the travel squad, compares against
    the hotel's amenity/property feature vector, and outputs group & individual alignment.
    """
    user_ids = [u.strip() for u in users.split(",") if u.strip()]
    if len(user_ids) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 user IDs are required for group travel consensus calculation."
        )

    try:
        result = calculate_group_consensus(hotel_id=hotel_id, user_ids=user_ids)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Consensus calculation error: {str(e)}")
