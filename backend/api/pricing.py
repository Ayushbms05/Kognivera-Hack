"""
Pricing calculation API endpoint with exact fractional math and statutory Indian GST.
"""

from fastapi import APIRouter, HTTPException
from core.schemas import PricingCalculateRequest, PricingCalculateResponse
from services.pricing_engine import calculate_pricing_breakdown

router = APIRouter(prefix="/api/pricing", tags=["pricing"])


@router.post("/calculate", response_model=PricingCalculateResponse)
async def calculate_pricing(request: PricingCalculateRequest):
    """
    Calculate exact room rate, rate plan delta, statutory Indian GST slab (12% vs 18%),
    and multi-currency conversion using the largest-remainder apportionment method.
    """
    try:
        result = calculate_pricing_breakdown(
            room_type_id=request.room_type_id,
            rate_plan_id=request.rate_plan_id,
            target_currency=request.target_currency,
            nights=request.nights,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pricing calculation failed: {str(e)}")
