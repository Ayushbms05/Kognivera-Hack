"""
Hotel API routes — listing, detail, availability, and scarcity checks.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
import aiosqlite

from core.database import get_db
from core.schemas import (
    HotelListItem, HotelDetail, RoomType, RatePlan,
    AmenityItem, MediaItem, PolicyInfo,
    AvailabilityResponse, InventorySlot,
    PaginatedResponse, CityItem,
    HotelXRStatusResponse,
    PersonaInfo, RankedHotelItem, RankedSearchResponse, ScoreBreakdown,
    FeasibilityRequest, FeasibilityRuleResult, FeasibilityResponse,
)
from services.re_ranking import reranking_service
from services.policy_simulator import policy_simulator

router = APIRouter(prefix="/api/hotels", tags=["hotels"])


# ─── List Hotels ─────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse)
async def list_hotels(
    city_id: Optional[str] = None,
    city: Optional[str] = None,
    star_min: Optional[int] = Query(None, ge=1, le=5),
    star_max: Optional[int] = Query(None, ge=1, le=5),
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    property_type: Optional[str] = None,
    amenities: Optional[str] = None,  # comma-separated codes
    guest_score_min: Optional[float] = None,
    sort_by: Optional[str] = Query("relevance", pattern="^(relevance|price_asc|price_desc|rating|distance)$"),
    checkin_date: Optional[str] = None,
    checkout_date: Optional[str] = None,
    user_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Paginated hotel listing with filtering and sorting.
    Includes scarcity data (FOMO) and minimum price per hotel.
    """
    # Build WHERE clauses
    conditions = ["h.status = 'active'"]
    params: list = []

    if city_id:
        conditions.append("h.city_id = ?")
        params.append(city_id)
    elif city:
        conditions.append("c.name LIKE ?")
        params.append(f"%{city}%")

    if star_min:
        conditions.append("h.star_rating >= ?")
        params.append(star_min)
    if star_max:
        conditions.append("h.star_rating <= ?")
        params.append(star_max)

    if guest_score_min:
        conditions.append("h.guest_score >= ?")
        params.append(guest_score_min)

    if property_type:
        conditions.append("h.property_type = ?")
        params.append(property_type)

    where_clause = " AND ".join(conditions)

    # Sorting
    order_map = {
        "relevance": "h.guest_score DESC, h.review_count DESC",
        "price_asc": "min_price ASC",
        "price_desc": "min_price DESC",
        "rating": "h.guest_score DESC",
        "distance": "h.distance_to_centre_km ASC",
    }
    order_by = order_map.get(sort_by, order_map["relevance"])

    # Count total
    count_sql = f"""
        SELECT COUNT(DISTINCT h.hotel_id)
        FROM hotels h
        JOIN cities c ON h.city_id = c.city_id
        WHERE {where_clause}
    """
    cursor = await db.execute(count_sql, params)
    total_row = await cursor.fetchone()
    total = total_row["COUNT(DISTINCT h.hotel_id)"] if total_row else 0

    # Main query with min_price subquery
    offset = (page - 1) * page_size
    main_sql = f"""
        SELECT
            h.*,
            c.name AS city_name,
            c.state AS state,
            (
                SELECT MIN(CAST(rt.base_rate AS REAL))
                FROM hotel_room_types rt
                WHERE rt.hotel_id = h.hotel_id AND rt.status = 'active'
            ) AS min_price,
            (
                SELECT rt.currency
                FROM hotel_room_types rt
                WHERE rt.hotel_id = h.hotel_id AND rt.status = 'active'
                ORDER BY CAST(rt.base_rate AS REAL) ASC
                LIMIT 1
            ) AS min_price_currency,
            (
                SELECT hm.file_path
                FROM hotel_media hm
                WHERE hm.hotel_id = h.hotel_id AND hm.media_role = 'hero'
                LIMIT 1
            ) AS hero_image
        FROM hotels h
        JOIN cities c ON h.city_id = c.city_id
        WHERE {where_clause}
        ORDER BY {order_by}
        LIMIT ? OFFSET ?
    """
    cursor = await db.execute(main_sql, params + [page_size, offset])
    rows = await cursor.fetchall()

    # Filter by price if needed (post-query since min_price is a subquery)
    hotels = []
    for row in rows:
        mp = row.get("min_price")
        if price_min and mp and float(mp) < price_min:
            continue
        if price_max and mp and float(mp) > price_max:
            continue

        hotel = HotelListItem(
            hotel_id=row["hotel_id"],
            city_id=row["city_id"],
            city_name=row.get("city_name", ""),
            state=row.get("state"),
            name=row["name"],
            property_type=row["property_type"],
            star_rating=row["star_rating"],
            guest_score=row["guest_score"],
            review_count=row["review_count"],
            address_line=row["address_line"],
            lat=float(row["lat"]),
            lng=float(row["lng"]),
            distance_to_centre_km=float(row["distance_to_centre_km"]),
            description=row["description"],
            base_currency=row["base_currency"],
            checkin_time=row["checkin_time"],
            checkout_time=row["checkout_time"],
            hero_image=row.get("hero_image"),
            min_price=str(mp) if mp else None,
            min_price_currency=row.get("min_price_currency"),
            has_xr_scene=bool(row["has_xr_scene"]),
        )

        # Fetch top amenities for this hotel
        amenity_cursor = await db.execute("""
            SELECT a.amenity_id, a.code, a.label, a.amenity_group, ha.is_free, ha.note
            FROM hotel_amenities ha
            JOIN amenities a ON ha.amenity_id = a.amenity_id
            WHERE ha.hotel_id = ?
            LIMIT 6
        """, [row["hotel_id"]])
        amenity_rows = await amenity_cursor.fetchall()
        hotel.amenities = [
            AmenityItem(
                amenity_id=a["amenity_id"], code=a["code"],
                label=a["label"], group=a["amenity_group"],
                is_free=bool(a["is_free"]), note=a.get("note"),
            )
            for a in amenity_rows
        ]

        # Check scarcity: get min available units across all room types for today
        if checkin_date:
            scarcity_cursor = await db.execute("""
                SELECT MIN(ic.total_units - ic.booked_units - ic.held_units) AS min_avail
                FROM inventory_calendar ic
                JOIN hotel_room_types rt ON ic.entity_id = rt.room_type_id
                WHERE rt.hotel_id = ? AND ic.for_date = ?
            """, [row["hotel_id"], checkin_date])
        else:
            scarcity_cursor = await db.execute("""
                SELECT MIN(ic.total_units - ic.booked_units - ic.held_units) AS min_avail
                FROM inventory_calendar ic
                JOIN hotel_room_types rt ON ic.entity_id = rt.room_type_id
                WHERE rt.hotel_id = ?
                  AND ic.for_date = DATE('now')
            """, [row["hotel_id"]])

        scarcity_row = await scarcity_cursor.fetchone()
        if scarcity_row and scarcity_row["min_avail"] is not None:
            rooms_left = max(0, int(scarcity_row["min_avail"]))
            hotel.rooms_left = rooms_left
            hotel.fomo_active = rooms_left <= 3

        # Filter by amenities if specified
        if amenities:
            required = set(amenities.split(","))
            hotel_codes = {a.code for a in hotel.amenities}
            # Need to check full amenity list, not just top 6
            if not required.issubset(hotel_codes):
                full_amenity_cursor = await db.execute("""
                    SELECT a.code FROM hotel_amenities ha
                    JOIN amenities a ON ha.amenity_id = a.amenity_id
                    WHERE ha.hotel_id = ?
                """, [row["hotel_id"]])
                full_codes = {r["code"] for r in await full_amenity_cursor.fetchall()}
                if not required.issubset(full_codes):
                    total -= 1
                    continue

        hotels.append(hotel)

    return PaginatedResponse(
        items=[h.model_dump() for h in hotels],
        total=total,
        page=page,
        page_size=page_size,
        has_next=(page * page_size) < total,
    )


# ─── Live Persona Switcher & Ranked Search ───────────────────────────

@router.get("/personas", response_model=list[PersonaInfo])
async def get_stage_personas():
    """
    Returns the 3 stage personas from 09_users.csv for the on-stage persona switcher.
    """
    raw_personas = reranking_service.get_personas()
    return [PersonaInfo(**p) for p in raw_personas]


@router.get("/search/ranked", response_model=RankedSearchResponse)
async def search_ranked_hotels(
    user_id: Optional[str] = Query(None),
    city_id: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    personalization: bool = Query(True),
    property_type: Optional[str] = Query(None),
    amenities: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Ranked search endpoint implementing:
    Hotel Final Score = (0.55 * filter_match) + (0.20 * cosine_similarity(u, h)) + (0.15 * guest_score/10) + (0.10 * proximity)
    With deterministic explainability string generation and Persona Switcher support.
    """
    conditions = ["h.status = 'active'"]
    params: list = []

    if city_id:
        conditions.append("h.city_id = ?")
        params.append(city_id)
    elif city:
        conditions.append("c.name LIKE ?")
        params.append(f"%{city}%")

    if property_type:
        conditions.append("h.property_type = ?")
        params.append(property_type)

    where_clause = " AND ".join(conditions)

    query = f"""
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
        WHERE {where_clause}
        LIMIT ?
    """
    params.append(limit * 2)  # fetch pool for ranking
    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()

    hotel_ids = [r["hotel_id"] for r in rows]
    amenities_by_hotel: dict[str, list[AmenityItem]] = {hid: [] for hid in hotel_ids}

    if hotel_ids:
        placeholders = ",".join("?" for _ in hotel_ids)
        a_cur = await db.execute(f"""
            SELECT ha.hotel_id, a.amenity_id, a.code, a.label, a.amenity_group AS "group", ha.is_free, ha.note
            FROM hotel_amenities ha
            JOIN amenities a ON ha.amenity_id = a.amenity_id
            WHERE ha.hotel_id IN ({placeholders})
        """, hotel_ids)
        for a_row in await a_cur.fetchall():
            amenities_by_hotel[a_row["hotel_id"]].append(AmenityItem(
                amenity_id=a_row["amenity_id"],
                code=a_row["code"],
                label=a_row["label"],
                group=a_row["group"],
                is_free=bool(a_row["is_free"]),
                note=a_row["note"],
            ))

    # Construct hotel dicts for ranking service
    hotels_data = []
    for r in rows:
        hid = r["hotel_id"]
        h_dict = dict(r)
        h_dict["has_xr_scene"] = bool(r["has_xr_scene"]) if "has_xr_scene" in r.keys() else False
        h_dict["amenities"] = amenities_by_hotel.get(hid, [])
        hotels_data.append(h_dict)

    filter_criteria = {}
    if property_type:
        filter_criteria["property_type"] = property_type
    if city_id:
        filter_criteria["city_id"] = city_id

    ranked_results, active_user_profile = reranking_service.rank_hotels(
        hotels=hotels_data,
        user_id=user_id,
        personalization=personalization,
        filter_criteria=filter_criteria,
    )

    sliced_results = ranked_results[:limit]

    items: list[RankedHotelItem] = []
    for item in sliced_results:
        # Build HotelListItem fields
        ranked_hotel = RankedHotelItem(
            hotel_id=item["hotel_id"],
            city_id=item["city_id"],
            city_name=item.get("city_name", ""),
            state=item.get("state"),
            name=item["name"],
            property_type=item["property_type"],
            star_rating=item["star_rating"],
            guest_score=item.get("guest_score"),
            review_count=item.get("review_count", 0),
            address_line=item.get("address_line", ""),
            lat=float(item.get("lat") or 0.0),
            lng=float(item.get("lng") or 0.0),
            distance_to_centre_km=float(item.get("distance_to_centre_km") or 0.0),
            description=item.get("description", ""),
            base_currency=item.get("base_currency", "INR"),
            checkin_time=item.get("checkin_time", "14:00"),
            checkout_time=item.get("checkout_time", "11:00"),
            hero_image=item.get("hero_image"),
            min_price=str(item["min_price"]) if item.get("min_price") is not None else "4500",
            min_price_currency=item.get("min_price_currency", "INR"),
            amenities=item.get("amenities", []),
            has_xr_scene=bool(item.get("has_xr_scene", False)),
            vibe_match_pct=int(item["final_score"] * 100),
            vibe_match_label=item.get("explainability", ""),
            final_score=item["final_score"],
            score_breakdown=ScoreBreakdown(**item["score_breakdown"]),
            explainability=item["explainability"],
            personalization_rank=item["personalization_rank"],
        )
        items.append(ranked_hotel)

    return RankedSearchResponse(
        total=len(items),
        personalization_active=personalization,
        active_user=PersonaInfo(**active_user_profile),
        items=items,
    )


# ─── Hotel Detail ────────────────────────────────────────────────────

@router.get("/{hotel_id}", response_model=HotelDetail)
async def get_hotel(hotel_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Full hotel detail with rooms, amenities, policies, and media."""
    hotel_id = hotel_id.strip().rstrip("./")

    cursor = await db.execute("""
        SELECT h.*, c.name AS city_name, c.state AS state
        FROM hotels h
        JOIN cities c ON h.city_id = c.city_id
        WHERE h.hotel_id = ?
    """, [hotel_id])
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Hotel not found")

    # Media
    media_cursor = await db.execute(
        "SELECT * FROM hotel_media WHERE hotel_id = ? ORDER BY sort_order", [hotel_id]
    )
    media_rows = await media_cursor.fetchall()
    media = [
        MediaItem(
            media_id=m["media_id"], role=m["media_role"],
            file_path=m["file_path"], alt_text=m["alt_text"],
            width_px=m["width_px"], height_px=m["height_px"],
            sort_order=m["sort_order"],
        )
        for m in media_rows
    ]

    # Amenities
    amenity_cursor = await db.execute("""
        SELECT a.amenity_id, a.code, a.label, a.amenity_group, ha.is_free, ha.note
        FROM hotel_amenities ha
        JOIN amenities a ON ha.amenity_id = a.amenity_id
        WHERE ha.hotel_id = ?
    """, [hotel_id])
    amenity_rows = await amenity_cursor.fetchall()
    amenities_list = [
        AmenityItem(
            amenity_id=a["amenity_id"], code=a["code"],
            label=a["label"], group=a["amenity_group"],
            is_free=bool(a["is_free"]), note=a.get("note"),
        )
        for a in amenity_rows
    ]

    # Room types + rate plans
    room_cursor = await db.execute(
        "SELECT * FROM hotel_room_types WHERE hotel_id = ? AND status = 'active'",
        [hotel_id],
    )
    room_rows = await room_cursor.fetchall()
    room_types = []
    for rm in room_rows:
        rp_cursor = await db.execute(
            "SELECT * FROM hotel_rate_plans WHERE room_type_id = ? AND status = 'active'",
            [rm["room_type_id"]],
        )
        rp_rows = await rp_cursor.fetchall()
        rate_plans = [
            RatePlan(
                rate_plan_id=rp["rate_plan_id"],
                plan_type=rp["plan_type"], name=rp["name"],
                price_delta=rp["price_delta"], currency=rp["currency"],
                cancellation_window_hours=rp["cancellation_window_hours"],
                cancellation_penalty_pct=rp["cancellation_penalty_pct"],
                includes_breakfast=bool(rp["includes_breakfast"]),
                min_stay_nights=rp["min_stay_nights"],
            )
            for rp in rp_rows
        ]
        room_types.append(RoomType(
            room_type_id=rm["room_type_id"],
            hotel_id=rm["hotel_id"], name=rm["name"],
            max_occupancy=rm["max_occupancy"],
            max_adults=rm["max_adults"], max_children=rm["max_children"],
            bed_config=rm["bed_config"], size_sqm=rm["size_sqm"],
            base_rate=rm["base_rate"], currency=rm["currency"],
            total_units=rm["total_units"],
            smoking_allowed=bool(rm["smoking_allowed"]),
            status=rm["status"], rate_plans=rate_plans,
        ))

    # Policies
    pol_cursor = await db.execute(
        "SELECT * FROM hotel_policies WHERE hotel_id = ?", [hotel_id]
    )
    pol_row = await pol_cursor.fetchone()
    policies = None
    if pol_row:
        policies = PolicyInfo(
            child_policy=pol_row.get("child_policy"),
            pet_policy=pol_row.get("pet_policy"),
            extra_bed_policy=pol_row.get("extra_bed_policy"),
            extra_bed_charge=pol_row.get("extra_bed_charge"),
            extra_bed_currency=pol_row.get("extra_bed_currency"),
            payment_methods=pol_row.get("payment_methods"),
            airport_pickup=bool(pol_row.get("airport_pickup", 0)),
            early_checkin_possible=bool(pol_row.get("early_checkin_possible", 0)),
            accessibility_notes=pol_row.get("accessibility_notes"),
        )

    # Min price
    min_price = None
    min_price_currency = None
    if room_types:
        cheapest = min(room_types, key=lambda r: float(r.base_rate))
        min_price = cheapest.base_rate
        min_price_currency = cheapest.currency

    # Hero image
    hero = next((m.file_path for m in media if m.role == "hero"), None)

    return HotelDetail(
        hotel_id=row["hotel_id"],
        city_id=row["city_id"],
        city_name=row.get("city_name", ""),
        state=row.get("state"),
        name=row["name"],
        property_type=row["property_type"],
        star_rating=row["star_rating"],
        guest_score=row["guest_score"],
        review_count=row["review_count"],
        address_line=row["address_line"],
        lat=float(row["lat"]),
        lng=float(row["lng"]),
        distance_to_centre_km=float(row["distance_to_centre_km"]),
        description=row["description"],
        base_currency=row["base_currency"],
        checkin_time=row["checkin_time"],
        checkout_time=row["checkout_time"],
        chain_code=row.get("chain_code"),
        has_xr_scene=bool(row.get("has_xr_scene", 0)),
        status=row["status"],
        hero_image=hero,
        min_price=min_price,
        min_price_currency=min_price_currency,
        amenities=amenities_list,
        media=media,
        room_types=room_types,
        policies=policies,
    )


# ─── Availability / Scarcity ────────────────────────────────────────

@router.get("/{hotel_id}/availability")
async def get_availability(
    hotel_id: str,
    room_type_id: Optional[str] = None,
    checkin: Optional[str] = None,
    checkout: Optional[str] = None,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Get inventory slots for a hotel's room types within a date range.
    Returns scarcity flag when available units ≤ 3.
    """
    # Default to next 7 days if no dates given
    date_condition = ""
    params: list = [hotel_id]

    if checkin and checkout:
        date_condition = "AND ic.for_date >= ? AND ic.for_date < ?"
        params.extend([checkin, checkout])
    else:
        date_condition = "AND ic.for_date >= DATE('now') AND ic.for_date < DATE('now', '+7 days')"

    room_condition = ""
    if room_type_id:
        room_condition = "AND rt.room_type_id = ?"
        params.append(room_type_id)

    sql = f"""
        SELECT ic.*, rt.room_type_id, rt.name AS room_name, rt.hotel_id
        FROM inventory_calendar ic
        JOIN hotel_room_types rt ON ic.entity_id = rt.room_type_id
        WHERE rt.hotel_id = ? {date_condition} {room_condition}
        ORDER BY rt.room_type_id, ic.for_date
    """
    cursor = await db.execute(sql, params)
    rows = await cursor.fetchall()

    # Group by room type
    grouped: dict[str, list[InventorySlot]] = {}
    for r in rows:
        avail = max(0, r["total_units"] - r["booked_units"] - r["held_units"])
        slot = InventorySlot(
            inventory_id=r["inventory_id"],
            entity_type=r["entity_type"],
            entity_id=r["entity_id"],
            for_date=r["for_date"],
            total_units=r["total_units"],
            booked_units=r["booked_units"],
            held_units=r["held_units"],
            available_units=avail,
            price=r["price"],
            currency=r["currency"],
            min_stay_nights=r["min_stay_nights"],
            closed_to_arrival=bool(r["closed_to_arrival"]),
        )
        grouped.setdefault(r["room_type_id"], []).append(slot)

    results = []
    for rtid, slots in grouped.items():
        min_avail = min(s.available_units for s in slots) if slots else 0
        results.append(AvailabilityResponse(
            hotel_id=hotel_id,
            room_type_id=rtid,
            slots=slots,
            min_available=min_avail,
            is_scarce=min_avail <= 3,
        ))

    return results


# ─── Reviews for a hotel ─────────────────────────────────────────────

@router.get("/{hotel_id}/reviews")
async def get_hotel_reviews(
    hotel_id: str,
    language: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Paginated reviews for a hotel, optionally filtered by language."""
    conditions = ["hotel_id = ?"]
    params: list = [hotel_id]

    if language:
        conditions.append("language = ?")
        params.append(language)

    where = " AND ".join(conditions)
    offset = (page - 1) * page_size

    # Count
    count_cursor = await db.execute(
        f"SELECT COUNT(*) as cnt FROM hotel_reviews WHERE {where}", params
    )
    total = (await count_cursor.fetchone())["cnt"]

    # Fetch
    cursor = await db.execute(
        f"SELECT * FROM hotel_reviews WHERE {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params + [page_size, offset],
    )
    rows = await cursor.fetchall()

    return PaginatedResponse(
        items=rows,
        total=total,
        page=page,
        page_size=page_size,
        has_next=(page * page_size) < total,
    )


# ─── Cities ──────────────────────────────────────────────────────────

@router.get("/cities/list", response_model=list[CityItem])
async def list_cities(db: aiosqlite.Connection = Depends(get_db)):
    """All active cities with hotel counts."""
    cursor = await db.execute("""
        SELECT c.*, COUNT(h.hotel_id) AS hotel_count
        FROM cities c
        LEFT JOIN hotels h ON h.city_id = c.city_id AND h.status = 'active'
        WHERE c.status = 'active'
        GROUP BY c.city_id
        ORDER BY hotel_count DESC, c.name ASC
    """)
    rows = await cursor.fetchall()
    return [
        CityItem(
            city_id=r["city_id"], name=r["name"],
            state=r.get("state"), country_code=r["country_code"],
            lat=float(r["lat"]), lng=float(r["lng"]),
            region=r.get("region"), description=r.get("description"),
            hotel_count=r["hotel_count"],
        )
        for r in rows
    ]


# ─── ML Curated Itinerary ─────────────────────────────────────────────

@router.get("/{hotel_id}/itinerary")
async def get_hotel_itinerary(
    hotel_id: str,
    days: int = Query(3, ge=1, le=7),
    user_id: Optional[str] = None,
):
    """
    Local ML-Powered (Scikit-Learn KNN + Haversine Distance) 3-Day Itinerary Planner.
    Strictly uses real trips and activities from 14_trips.csv and 19_itineraries.csv.
    """
    from services.itinerary_ml import generate_local_ml_itinerary, add_contextual_transitions_optional
    result = generate_local_ml_itinerary(hotel_id=hotel_id, days=days, user_id=user_id)
    return await add_contextual_transitions_optional(result)


# ─── 30-Day Price Insights & Scarcity Analytics ───────────────────────

@router.get("/{hotel_id}/price-analytics")
async def get_hotel_price_analytics(
    hotel_id: str,
    room_type_id: Optional[str] = None,
):
    """
    Pure statistical and time-series numerical ML price analytics.
    Calculates 7-day rolling average, trend velocity, and real-time scarcity.
    """
    from services.price_analytics import calculate_price_analytics
    clean_hotel_id = hotel_id.strip().rstrip("./")
    return calculate_price_analytics(clean_hotel_id, room_type_id)


# ─── Dynamic Walkability Isochrone & Proximity ────────────────────────

@router.get("/{hotel_id}/proximity")
async def get_hotel_proximity_endpoint(hotel_id: str):
    """
    Dynamic Walkability Isochrone & Attraction Proximity.
    Spatial geodesic math (64-vertex circular polygon, Haversine distances to sf_landmarks,
    walkability score).
    """
    from services.proximity import get_hotel_proximity
    clean_hotel_id = hotel_id.strip().rstrip("./")
    try:
        return get_hotel_proximity(clean_hotel_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─── 360° Digital Twin / XR Scene Status ─────────────────────────────

@router.get("/{hotel_id}/xr-status", response_model=HotelXRStatusResponse)
async def get_hotel_xr_status(
    hotel_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Returns 360° Virtual Tour Digital Twin status and hero scene URL
    for hotels marked with has_xr_scene == 1 in official dataset.
    """
    clean_id = hotel_id.strip().rstrip("./")
    cursor = await db.execute(
        "SELECT hotel_id, name, has_xr_scene FROM hotels WHERE hotel_id = ?",
        [clean_id],
    )
    hotel = await cursor.fetchone()
    if not hotel:
        raise HTTPException(status_code=404, detail=f"Hotel {clean_id} not found")

    has_xr = bool(hotel["has_xr_scene"])
    scene_url = ""
    alt_text = ""

    if has_xr:
        m_cursor = await db.execute(
            "SELECT file_path, alt_text FROM hotel_media WHERE hotel_id = ? AND media_role = 'hero' LIMIT 1",
            [clean_id],
        )
        media = await m_cursor.fetchone()
        if media:
            scene_url = media["file_path"] or ""
            alt_text = media["alt_text"] or f"360° Digital Twin view at {hotel['name']}"
        else:
            scene_url = f"media/hotels/{clean_id}/hero.jpg"
            alt_text = f"360° Digital Twin view at {hotel['name']}"

    return HotelXRStatusResponse(
        hotel_id=clean_id,
        has_xr_scene=has_xr,
        scene_url=scene_url,
        alt_text=alt_text,
    )


# ─── Edge-Case Policy Simulator ──────────────────────────────────────

@router.post("/{hotel_id}/check-feasibility", response_model=FeasibilityResponse)
async def check_hotel_feasibility(
    hotel_id: str,
    payload: FeasibilityRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Edge-Case Policy Simulator evaluating:
    - check_in_time (early arrival vs checkin_time vs early_checkin_possible)
    - pet_policy (pet friendly vs conditional vs prohibited)
    - child_policy (age limits, free bedding, surcharges)
    - party_size (max_occupancy, max_adults, max_children)
    Returns tabular feasibility scorecard with exact source column citations.
    """
    clean_id = hotel_id.strip().rstrip("./")
    cursor = await db.execute(
        "SELECT hotel_id, name, checkin_time, checkout_time FROM hotels WHERE hotel_id = ?",
        [clean_id],
    )
    hotel = await cursor.fetchone()
    if not hotel:
        raise HTTPException(status_code=404, detail=f"Hotel {clean_id} not found")

    p_cursor = await db.execute(
        "SELECT * FROM hotel_policies WHERE hotel_id = ?",
        [clean_id],
    )
    policy_row = await p_cursor.fetchone()
    policy = dict(policy_row) if policy_row else None

    r_cursor = await db.execute(
        "SELECT * FROM hotel_room_types WHERE hotel_id = ? AND status = 'active'",
        [clean_id],
    )
    room_rows = await r_cursor.fetchall()
    room_types = [dict(r) for r in room_rows]

    evaluation = policy_simulator.evaluate_feasibility(
        hotel=dict(hotel),
        policy=policy,
        room_types=room_types,
        arrival_time=payload.arrival_time,
        has_pets=payload.has_pets,
        children_ages=payload.children_ages,
        adults_count=payload.adults_count,
    )

    return FeasibilityResponse(
        overall_feasible=evaluation["overall_feasible"],
        verdict_summary=evaluation["verdict_summary"],
        rules=[FeasibilityRuleResult(**r) for r in evaluation["rules"]],
    )

