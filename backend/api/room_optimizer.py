from fastapi import APIRouter, HTTPException, Query
from datetime import date as dt_date
from typing import Optional
from services.room_optimizer import optimize_room

router = APIRouter(prefix="/api/hotels", tags=["Room Optimizer"])

@router.get("/{hotel_id}/room-optimizer")
def get_room_optimization(
    hotel_id: str,
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format. Defaults to current date.")
):
    """
    Bioclimatic Solar & Acoustic Room Optimizer.
    Uses pure astronomical solar physics (azimuth & altitude at 08:00 and 17:00)
    and Haversine acoustic dispersion against sf_landmarks to deterministically
    recommend the optimal room orientation for thermal and noise comfort.
    """
    target_date_str = date or dt_date.today().isoformat()

    try:
        result = optimize_room(hotel_id=hotel_id, target_date_str=target_date_str)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solar/Acoustic calculation error: {str(e)}")
