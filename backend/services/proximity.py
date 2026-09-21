"""
Spatial Geodesic Math & Attraction Proximity Service for StayFinder.
Calculates 64-vertex geodesic circular polygons, Haversine distances,
and real-time walkability scores based on sf_landmarks.
Zero LLM calls - pure deterministic numerical spatial algorithms.
"""

import math
import sqlite3
from typing import Dict, List, Any, Optional
from core.config import get_settings


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Haversine distance formula:
    d = 2 * R * asin(sqrt(sin(dlat/2)^2 + cos(lat1) * cos(lat2) * sin(dlon/2)^2))
    R = 6371.0 km
    """
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.asin(math.sqrt(a))
    return R * c


def compute_geodesic_polygon(
    lat: float, lng: float, radius_km: float, num_points: int = 64
) -> List[List[float]]:
    """
    Compute a 64-vertex accurate geodesic circular polygon.
    Returns coordinates in GeoJSON format: [[lng, lat], ...]
    """
    coords: List[List[float]] = []
    # 1 deg lat ~ 110.574 km, 1 deg lon ~ 111.320 * cos(lat) km
    dist_lat = radius_km / 110.574
    cos_lat = math.cos(math.radians(lat))
    dist_lon = radius_km / (111.320 * (cos_lat if abs(cos_lat) > 1e-6 else 1.0))

    for i in range(num_points):
        theta = (i / num_points) * (2.0 * math.pi)
        p_lat = lat + dist_lat * math.sin(theta)
        p_lng = lng + dist_lon * math.cos(theta)
        coords.append([round(p_lng, 6), round(p_lat, 6)])

    # Close loop
    coords.append(coords[0])
    return coords


def get_hotel_proximity(hotel_id: str) -> Dict[str, Any]:
    """
    Fetch hotel coordinates, compute Haversine distance to all city landmarks in sf_landmarks,
    filter and sort landmarks inside 1.5 km boundary, and calculate walkability score.
    """
    clean_hotel_id = hotel_id.strip().rstrip("./")

    # Connect to SQLite DB
    conn = sqlite3.connect(get_settings().db_abs_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Fetch Hotel info
    cursor.execute(
        "SELECT hotel_id, name, city_id, lat, lng FROM hotels WHERE hotel_id = ?",
        [clean_hotel_id],
    )
    hotel_row = cursor.fetchone()

    if not hotel_row:
        conn.close()
        raise ValueError(f"Hotel {clean_hotel_id} not found")

    hotel_lat = float(hotel_row["lat"])
    hotel_lng = float(hotel_row["lng"])
    city_id = hotel_row["city_id"]

    # 2. Query landmarks in this city from sf_landmarks
    cursor.execute(
        "SELECT landmark_id, city_id, name, kind, lat, lng, description FROM sf_landmarks WHERE city_id = ?",
        [city_id],
    )
    landmark_rows = cursor.fetchall()
    conn.close()

    # 3. Compute Haversine distance and filter within 1.5 km
    walkable_landmarks: List[Dict[str, Any]] = []
    all_nearby_5km: List[Dict[str, Any]] = []

    for row in landmark_rows:
        lm_lat = float(row["lat"])
        lm_lng = float(row["lng"])
        dist_km = haversine_distance(hotel_lat, hotel_lng, lm_lat, lm_lng)
        # Average walking speed = 5.0 km/h -> 12 minutes per km
        walk_time_min = max(1, int(round((dist_km / 5.0) * 60.0)))

        item = {
            "name": str(row["name"]),
            "kind": str(row["kind"]),
            "distance_km": round(dist_km, 2),
            "walk_time_minutes": walk_time_min,
            "lat": round(lm_lat, 6),
            "lng": round(lm_lng, 6),
            "description": row["description"] or "",
        }

        if dist_km <= 1.5:
            walkable_landmarks.append(item)
        if dist_km <= 5.0:
            all_nearby_5km.append(item)

    # Sort ascending by distance
    walkable_landmarks.sort(key=lambda x: x["distance_km"])
    all_nearby_5km.sort(key=lambda x: x["distance_km"])

    # 4. Walkability Score (0-100 calculated as min(100, len(walkable_landmarks) * 25))
    walkability_score = min(100, len(walkable_landmarks) * 25)

    # 5. Geodesic circular polygons (64 vertices)
    poly_1_5km = compute_geodesic_polygon(hotel_lat, hotel_lng, radius_km=1.5, num_points=64)
    poly_5_0km = compute_geodesic_polygon(hotel_lat, hotel_lng, radius_km=5.0, num_points=64)

    return {
        "hotel_id": clean_hotel_id,
        "coordinates": {
            "lat": round(hotel_lat, 6),
            "lng": round(hotel_lng, 6),
        },
        "walkable_landmarks": [
            {
                "name": lm["name"],
                "kind": lm["kind"],
                "distance_km": lm["distance_km"],
                "walk_time_minutes": lm["walk_time_minutes"],
                "lat": lm["lat"],
                "lng": lm["lng"],
            }
            for lm in walkable_landmarks
        ],
        "walkability_score": walkability_score,
        # GeoJSON isochrone polygons for MapLibre
        "isochrone_1_5km": {
            "type": "Polygon",
            "coordinates": [poly_1_5km],
        },
        "isochrone_5_0km": {
            "type": "Polygon",
            "coordinates": [poly_5_0km],
        },
        "transit_landmarks_5km": [
            {
                "name": lm["name"],
                "kind": lm["kind"],
                "distance_km": lm["distance_km"],
                "walk_time_minutes": lm["walk_time_minutes"],
                "lat": lm["lat"],
                "lng": lm["lng"],
            }
            for lm in all_nearby_5km
        ],
    }
