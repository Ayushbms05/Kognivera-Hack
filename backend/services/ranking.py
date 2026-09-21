"""
Personalised Ranking Service — affinity scoring based on user interactions.
Stub for Step 1; full implementation in Step 2.
"""

from __future__ import annotations

from core.schemas import AffinityScore, HotelListItem, AmenityItem


# Interaction type weights for implicit rating
INTERACTION_WEIGHTS = {
    "book": 1.0,
    "save": 0.8,
    "like": 0.7,
    "share": 0.6,
    "click": 0.4,
    "view": 0.2,
    "search": 0.15,
    "dismiss": -0.3,
}


async def compute_affinities(
    user_id: str,
    user: dict,
    city_id: str | None,
    limit: int,
    db,
) -> list[dict]:
    """
    Compute personalised affinity scores for hotels based on user interaction history.
    Returns hotels with vibe_match_pct and vibe_match_label populated.
    """
    # Get user interaction history for hotel entities
    cursor = await db.execute("""
        SELECT entity_id, interaction_type, implicit_rating, dwell_seconds
        FROM user_interactions
        WHERE user_id = ? AND entity_type = 'hotel'
    """, [user_id])
    interactions = await cursor.fetchall()

    # Build hotel affinity map
    hotel_scores: dict[str, float] = {}
    for ix in interactions:
        hid = ix["entity_id"]
        weight = INTERACTION_WEIGHTS.get(ix["interaction_type"], 0.1)
        implicit = ix.get("implicit_rating") or 0.5
        score = weight * implicit
        hotel_scores[hid] = hotel_scores.get(hid, 0) + score

    # Get hotels with base query
    city_filter = ""
    params: list = []
    if city_id:
        city_filter = "AND h.city_id = ?"
        params.append(city_id)

    cursor = await db.execute(f"""
        SELECT h.*, c.name AS city_name, c.state,
            (SELECT MIN(CAST(rt.base_rate AS REAL)) FROM hotel_room_types rt
             WHERE rt.hotel_id = h.hotel_id AND rt.status = 'active') AS min_price,
            (SELECT rt.currency FROM hotel_room_types rt
             WHERE rt.hotel_id = h.hotel_id AND rt.status = 'active'
             ORDER BY CAST(rt.base_rate AS REAL) ASC LIMIT 1) AS min_price_currency,
            (SELECT hm.file_path FROM hotel_media hm
             WHERE hm.hotel_id = h.hotel_id AND hm.media_role = 'hero' LIMIT 1) AS hero_image
        FROM hotels h
        JOIN cities c ON h.city_id = c.city_id
        WHERE h.status = 'active' {city_filter}
    """, params)
    all_hotels = await cursor.fetchall()

    # Score each hotel
    travel_style = user.get("travel_style", "comfort")
    budget_band = user.get("budget_band", "mid")

    scored = []
    for h in all_hotels:
        base_score = hotel_scores.get(h["hotel_id"], 0)

        # Budget band alignment bonus
        price = float(h["min_price"]) if h.get("min_price") else 5000
        budget_bonus = 0
        if budget_band == "shoestring" and price < 3000:
            budget_bonus = 0.3
        elif budget_band == "value" and price < 5000:
            budget_bonus = 0.25
        elif budget_band == "mid" and 3000 <= price <= 10000:
            budget_bonus = 0.2
        elif budget_band == "premium" and 8000 <= price <= 20000:
            budget_bonus = 0.2
        elif budget_band == "luxury" and price > 15000:
            budget_bonus = 0.3

        # Guest score bonus
        gs = h.get("guest_score") or 5
        rating_bonus = (gs / 10) * 0.3

        # Property type alignment
        style_type_map = {
            "adventure": ["resort", "hostel", "homestay"],
            "luxury": ["boutique", "heritage", "resort"],
            "cultural": ["heritage", "boutique", "homestay"],
            "wellness": ["resort", "boutique"],
            "budget": ["hostel", "guesthouse", "homestay"],
            "slow": ["boutique", "homestay", "guesthouse"],
            "comfort": ["hotel", "resort", "boutique"],
        }
        preferred = style_type_map.get(travel_style, [])
        style_bonus = 0.2 if h["property_type"] in preferred else 0

        total_score = base_score + budget_bonus + rating_bonus + style_bonus
        # Normalise to 0-100 percentage
        match_pct = min(99, max(40, int(50 + total_score * 15)))

        scored.append({
            **h,
            "vibe_match_pct": match_pct,
            "vibe_match_label": f"{match_pct}% Match for your {travel_style.title()} style",
            "affinity_score": total_score,
        })

    # Sort by affinity score descending
    scored.sort(key=lambda x: x["affinity_score"], reverse=True)

    return scored[:limit]
