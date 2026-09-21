"""
Natural Language Search API — parses user queries into structured filters via Claude.
Also provides city/hotel typeahead suggestions.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, UploadFile, File, Form, HTTPException
from typing import Optional
import aiosqlite

from core.database import get_db
from core.schemas import NLSearchRequest, NLSearchResponse, SearchFilters, VibeSearchItem

router = APIRouter(prefix="/api/search", tags=["search"])


# ─── NL Search ───────────────────────────────────────────────────────

@router.post("/nl", response_model=NLSearchResponse)
async def nl_search(
    req: NLSearchRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Parse a natural language query into structured search filters.
    Uses Claude AI with fallback to keyword extraction.
    """
    from services.nl_search import parse_nl_query

    filters, confidence = await parse_nl_query(req.query, req.language or "en-IN", db)

    # Resolve city name to city_id if needed
    if filters.city and not filters.city_id:
        cursor = await db.execute(
            "SELECT city_id FROM cities WHERE LOWER(name) = LOWER(?) AND status = 'active'",
            [filters.city],
        )
        row = await cursor.fetchone()
        if row:
            filters.city_id = row["city_id"]

    # Build chips for the frontend
    chips = _build_chips(filters)

    # Fetch matching hotels for these parsed filters
    from api.hotels import list_hotels
    hotel_res = await list_hotels(
        city=filters.city,
        city_id=filters.city_id,
        star_min=filters.star_min,
        star_max=filters.star_max,
        price_min=filters.price_min,
        price_max=filters.price_max,
        property_type=filters.property_type,
        amenities=",".join(filters.amenities) if filters.amenities else None,
        sort_by=filters.sort_by or "relevance",
        page=1,
        page_size=20,
        db=db,
    )

    return NLSearchResponse(
        filters=filters,
        chips=chips,
        parsed_chips=chips,
        original_query=req.query,
        confidence=confidence,
        hotels=hotel_res.items,
        total_results=hotel_res.total,
    )


def _build_chips(filters: SearchFilters) -> list[dict]:
    """Convert SearchFilters into human-readable, removable filter chips."""
    chips = []

    if filters.city:
        chips.append({
            "label": filters.city,
            "type": "city",
            "value": filters.city_id or filters.city,
            "icon": "map-pin",
            "removable": True,
        })

    if filters.star_min:
        label = f"{filters.star_min}+ stars" if not filters.star_max else f"{filters.star_min}-{filters.star_max} stars"
        chips.append({
            "label": label,
            "type": "star_rating",
            "value": filters.star_min,
            "icon": "star",
            "removable": True,
        })

    if filters.price_max:
        label = f"Under ₹{int(filters.price_max):,}"
        if filters.price_min:
            label = f"₹{int(filters.price_min):,} – ₹{int(filters.price_max):,}"
        chips.append({
            "label": label,
            "type": "price",
            "value": filters.price_max,
            "icon": "indian-rupee",
            "removable": True,
        })
    elif filters.price_min:
        chips.append({
            "label": f"Above ₹{int(filters.price_min):,}",
            "type": "price",
            "value": filters.price_min,
            "icon": "indian-rupee",
            "removable": True,
        })

    if filters.property_type:
        chips.append({
            "label": filters.property_type.replace("_", " ").title(),
            "type": "property_type",
            "value": filters.property_type,
            "icon": "building",
            "removable": True,
        })

    for amenity in filters.amenities:
        chips.append({
            "label": amenity.replace("_", " ").title(),
            "type": "amenity",
            "value": amenity,
            "icon": "check-circle",
            "removable": True,
        })

    if filters.meal_preference:
        meal_labels = {"veg": "Pure Vegetarian", "jain": "Jain Food", "halal": "Halal Kitchen"}
        chips.append({
            "label": meal_labels.get(filters.meal_preference, filters.meal_preference.title()),
            "type": "meal",
            "value": filters.meal_preference,
            "icon": "utensils",
            "removable": True,
        })

    if filters.guest_score_min:
        chips.append({
            "label": f"Rating {filters.guest_score_min}+",
            "type": "guest_score",
            "value": filters.guest_score_min,
            "icon": "thumbs-up",
            "removable": True,
        })

    if filters.distance_km:
        chips.append({
            "label": f"Within {filters.distance_km} km",
            "type": "distance",
            "value": filters.distance_km,
            "icon": "navigation",
            "removable": True,
        })

    if filters.guests:
        chips.append({
            "label": f"{filters.guests} guest{'s' if filters.guests > 1 else ''}",
            "type": "guests",
            "value": filters.guests,
            "icon": "users",
            "removable": True,
        })

    return chips


# ─── Typeahead Suggestions ───────────────────────────────────────────

@router.get("/suggestions")
async def search_suggestions(
    q: str = Query(..., min_length=1),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Typeahead suggestions for cities and hotels."""
    results = []

    # Cities
    cursor = await db.execute("""
        SELECT city_id, name, state, country_code
        FROM cities
        WHERE status = 'active' AND (LOWER(name) LIKE LOWER(?) OR LOWER(state) LIKE LOWER(?))
        ORDER BY name
        LIMIT 5
    """, [f"%{q}%", f"%{q}%"])
    for row in await cursor.fetchall():
        label = row["name"]
        if row["state"]:
            label += f", {row['state']}"
        results.append({
            "type": "city",
            "id": row["city_id"],
            "label": label,
            "country_code": row["country_code"],
        })

    # Hotels
    cursor = await db.execute("""
        SELECT h.hotel_id, h.name, c.name AS city_name
        FROM hotels h
        JOIN cities c ON h.city_id = c.city_id
        WHERE h.status = 'active' AND LOWER(h.name) LIKE LOWER(?)
        ORDER BY h.guest_score DESC
        LIMIT 5
    """, [f"%{q}%"])
    for row in await cursor.fetchall():
        results.append({
            "type": "hotel",
            "id": row["hotel_id"],
            "label": f"{row['name']} — {row['city_name']}",
        })

    return results


# ─── Visual Vibe Search ──────────────────────────────────────────────

@router.post("/vibe", response_model=list[VibeSearchItem])
async def vibe_search(
    request: Request,
    file: Optional[UploadFile] = File(None),
    query_text: Optional[str] = Form(None),
):
    """
    Visual Vibe Search connecting imagery to hotel amenity metadata using local TF-IDF vectorization.
    Accepts either { "query_text": str } (JSON or form) OR multipart form upload { "file": image }.
    """
    from services.vibe_search import VisualVibeEngine
    engine = VisualVibeEngine.get_instance()

    # 1. Handle JSON request body if provided
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            if isinstance(body, dict) and "query_text" in body:
                query_text = body["query_text"]
        except Exception:
            pass

    # 2. Handle image upload (extract keywords via Vision NLP with SQLite hash cache)
    if file is not None:
        file_bytes = await file.read()
        if len(file_bytes) > 0:
            keywords, results = engine.search_by_image(file_bytes)
            return results

    # 3. Handle text vibe query via local TF-IDF
    if query_text and query_text.strip():
        results = engine.search_by_text(query_text.strip())
        return results

    raise HTTPException(
        status_code=400,
        detail="Either 'query_text' or an inspiration 'file' must be provided for Visual Vibe Search.",
    )

