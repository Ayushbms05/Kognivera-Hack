from fastapi import APIRouter, HTTPException, Path, Query
import sqlite3
from pathlib import Path as FilePath
from typing import Dict, Any, List
from datetime import datetime, timezone

DB_PATH = FilePath(__file__).resolve().parent.parent / "data" / "PS-02.db"

router = APIRouter(prefix="/api/cities", tags=["Offline PWA Flight Mode Sync"])

def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

@router.get("/{city_id}/offline-package")
def get_city_offline_package(city_id: str):
    """
    Zero-Latency Flight Mode PWA Data Sync Endpoint.
    Serializes all hotels, room types, rate plans, policies, amenities,
    and top 3 hero image assets for a given city from 06_cities, 08_hotels, 16_hotel_media.
    """
    conn = get_db_connection()
    try:
        # 1. Resolve city by city_id or case-insensitive city name
        city = conn.execute(
            "SELECT * FROM cities WHERE city_id = ? OR LOWER(name) = LOWER(?)",
            (city_id, city_id)
        ).fetchone()

        if not city:
            raise HTTPException(status_code=404, detail=f"City '{city_id}' not found in StayFinder catalog.")

        resolved_city_id = city["city_id"]

        # 2. Fetch all active hotels in this city
        hotels_rows = conn.execute(
            """
            SELECT h.*, c.name as city_name, c.state as city_state
            FROM hotels h
            JOIN cities c ON h.city_id = c.city_id
            WHERE h.city_id = ?
            ORDER BY h.star_rating DESC, h.guest_score DESC
            """,
            (resolved_city_id,)
        ).fetchall()

        hotels_data = []
        all_image_urls = set()

        for h in hotels_rows:
            hid = h["hotel_id"]

            # 3. Fetch top 3 hero images for this hotel from hotel_media
            media_rows = conn.execute(
                """
                SELECT media_id, file_path, media_role, alt_text, sort_order
                FROM hotel_media
                WHERE hotel_id = ?
                ORDER BY
                    CASE WHEN media_role = 'hero' THEN 0 ELSE 1 END,
                    sort_order ASC
                LIMIT 3
                """,
                (hid,)
            ).fetchall()

            hero_images = [
                {
                    "media_id": m["media_id"],
                    "file_path": m["file_path"],
                    "media_role": m["media_role"],
                    "alt_text": m["alt_text"]
                }
                for m in media_rows
            ]

            for m in media_rows:
                if m["file_path"]:
                    all_image_urls.add(m["file_path"])

            # 4. Fetch room types and rate plans from hotel_room_types
            room_rows = conn.execute(
                """
                SELECT room_type_id, name, base_rate, currency, max_occupancy, bed_config, size_sqm
                FROM hotel_room_types
                WHERE hotel_id = ?
                ORDER BY base_rate ASC
                """,
                (hid,)
            ).fetchall()

            rooms_data = []
            min_price = None

            for r in room_rows:
                rt_id = r["room_type_id"]
                rate = float(r["base_rate"] or 0)
                if min_price is None or rate < min_price:
                    min_price = rate

                rate_plans = conn.execute(
                    """
                    SELECT rate_plan_id, name, plan_type, price_delta, includes_breakfast, min_stay_nights
                    FROM hotel_rate_plans
                    WHERE room_type_id = ?
                    """,
                    (rt_id,)
                ).fetchall()

                rooms_data.append({
                    "room_type_id": rt_id,
                    "name": r["name"],
                    "base_rate": rate,
                    "currency": r["currency"] or "INR",
                    "max_occupancy": r["max_occupancy"],
                    "bed_config": r["bed_config"],
                    "size_sqm": r["size_sqm"],
                    "rate_plans": [dict(rp) for rp in rate_plans]
                })

            # 5. Fetch joined amenities
            amenity_rows = conn.execute(
                """
                SELECT a.amenity_id, a.code, a.label, a.amenity_group, ha.is_free, ha.note
                FROM hotel_amenities ha
                JOIN amenities a ON ha.amenity_id = a.amenity_id
                WHERE ha.hotel_id = ?
                """,
                (hid,)
            ).fetchall()

            # 6. Fetch policies
            policy_row = conn.execute(
                "SELECT * FROM hotel_policies WHERE hotel_id = ?",
                (hid,)
            ).fetchone()

            hotels_data.append({
                "hotel_id": hid,
                "city_id": resolved_city_id,
                "city_name": h["city_name"],
                "state": h["city_state"],
                "name": h["name"],
                "property_type": h["property_type"],
                "star_rating": float(h["star_rating"] or 3.0),
                "guest_score": float(h["guest_score"] or 8.0),
                "review_count": int(h["review_count"] or 50),
                "address_line": h["address_line"],
                "lat": float(h["lat"]) if h["lat"] else None,
                "lng": float(h["lng"]) if h["lng"] else None,
                "distance_to_centre_km": float(h["distance_to_centre_km"]) if h["distance_to_centre_km"] else None,
                "description": h["description"],
                "min_price": min_price if min_price is not None else 4500.0,
                "currency": h["base_currency"] or "INR",
                "checkin_time": h["checkin_time"] or "14:00",
                "checkout_time": h["checkout_time"] or "11:00",
                "hero_images": hero_images,
                "hero_image": hero_images[0]["file_path"] if hero_images else None,
                "rooms": rooms_data,
                "room_types": rooms_data,
                "amenities": [dict(am) for am in amenity_rows],
                "policies": dict(policy_row) if policy_row else {}
            })

        city_meta = {
            "city_id": resolved_city_id,
            "name": city["name"],
            "state": city["state"],
            "country_code": city["country_code"],
            "lat": float(city["lat"]) if city["lat"] else None,
            "lng": float(city["lng"]) if city["lng"] else None,
            "description": city["description"],
            "timezone": city["timezone"],
            "region": city["region"],
            "hotel_count": len(hotels_data)
        }

        return {
            "city": city_meta,
            "hotels": hotels_data,
            "total_hotels": len(hotels_data),
            "image_urls": sorted(list(all_image_urls)),
            "synced_at": datetime.now(timezone.utc).isoformat(),
            "package_version": "v1.0"
        }
    finally:
        conn.close()
