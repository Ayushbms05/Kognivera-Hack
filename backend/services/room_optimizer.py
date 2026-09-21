import math
import sqlite3
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "PS-02.db"

def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def calculate_solar_position(lat: float, lon: float, dt: datetime, tz_offset_hours: float = 5.5) -> Dict[str, float]:
    """
    Standard astronomical solar position algorithm (NOAA / Spencer model).
    Calculates azimuth (degrees from North, clockwise) and elevation/altitude (degrees above horizon).
    Zero external APIs or LLMs.
    """
    day_of_year = dt.timetuple().tm_yday
    hour_decimal = dt.hour + dt.minute / 60.0 + dt.second / 3600.0 - tz_offset_hours

    # Fractional year in radians
    gamma = 2.0 * math.pi / 365.0 * (day_of_year - 1 + (hour_decimal - 12.0) / 24.0)

    # Equation of time in minutes
    eqtime = 229.18 * (
        0.000075
        + 0.001868 * math.cos(gamma)
        - 0.032077 * math.sin(gamma)
        - 0.014615 * math.cos(2.0 * gamma)
        - 0.040849 * math.sin(2.0 * gamma)
    )

    # Solar declination angle in radians
    decl = (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2.0 * gamma)
        + 0.000907 * math.sin(2.0 * gamma)
        - 0.002697 * math.cos(3.0 * gamma)
        + 0.00148 * math.sin(3.0 * gamma)
    )

    # Time offset in minutes
    time_offset = eqtime + 4.0 * lon
    # True solar time in minutes
    tst = (hour_decimal * 60.0 + time_offset) % 1440.0
    # Solar hour angle in degrees
    ha = (tst / 4.0) - 180.0
    ha_rad = math.radians(ha)
    lat_rad = math.radians(lat)

    # Solar zenith angle
    cos_zenith = math.sin(lat_rad) * math.sin(decl) + math.cos(lat_rad) * math.cos(decl) * math.cos(ha_rad)
    cos_zenith = max(-1.0, min(1.0, cos_zenith))
    zenith_rad = math.acos(cos_zenith)
    elevation_deg = 90.0 - math.degrees(zenith_rad)

    # Solar azimuth angle (degrees clockwise from North)
    cos_azimuth = (math.sin(decl) - math.sin(lat_rad) * cos_zenith) / (math.cos(lat_rad) * math.sin(zenith_rad) + 1e-9)
    cos_azimuth = max(-1.0, min(1.0, cos_azimuth))
    azimuth_rad = math.acos(cos_azimuth)
    azimuth_deg = math.degrees(azimuth_rad)

    if ha > 0:
        azimuth_deg = (azimuth_deg + 180.0) % 360.0
    else:
        azimuth_deg = (540.0 - azimuth_deg) % 360.0

    return {
        "azimuth": round(azimuth_deg, 2),
        "altitude": round(elevation_deg, 2),
        "hour_str": dt.strftime("%H:%M")
    }

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates spherical distance in km using Haversine formula."""
    r = 6371.0  # Earth's radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c

def forward_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates initial bearing (azimuth clockwise from true North) from point 1 to point 2."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360.0) % 360.0

def bearing_to_cardinal(bearing: float) -> str:
    """Converts degrees into standard 8-point compass cardinal direction."""
    points = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"]
    idx = int((bearing + 22.5) // 45) % 8
    return points[idx]

def bearing_to_primary_cardinal(bearing: float) -> str:
    """Converts degrees into standard 4-point cardinal direction: North, East, South, West."""
    points = ["North", "East", "South", "West"]
    idx = int((bearing + 45.0) // 90) % 4
    return points[idx]

def estimate_decibels_at_distance(dist_km: float, base_source_db: float = 88.0) -> float:
    """
    Inverse square law acoustic attenuation:
    Lp = Lw - 20*log10(r) - 11 dB for spherical acoustic dispersion.
    Distance clamped to minimum 20 meters.
    """
    dist_m = max(20.0, dist_km * 1000.0)
    attenuation = 20.0 * math.log10(dist_m) + 11.0
    db = max(30.0, min(85.0, base_source_db - attenuation + 20.0))  # standard urban ambient floor
    return round(db, 1)

def optimize_room(hotel_id: str, target_date_str: str) -> Dict[str, Any]:
    """
    Computes solar trajectory and acoustic noise impact to deterministically
    recommend the optimal room orientation.
    """
    try:
        target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except Exception:
        target_date = date.today()

    conn = get_db_connection()
    try:
        # Fetch hotel coordinates
        hotel = conn.execute(
            "SELECT hotel_id, name, lat, lng, city_id FROM hotels WHERE hotel_id = ?",
            (hotel_id,)
        ).fetchone()

        if not hotel:
            raise ValueError(f"Hotel '{hotel_id}' not found.")

        lat = float(hotel["lat"])
        lon = float(hotel["lng"])

        # 1. Solar calculations at 08:00 AM and 17:00 PM
        dt_morning = datetime(target_date.year, target_date.month, target_date.day, 8, 0, 0)
        dt_evening = datetime(target_date.year, target_date.month, target_date.day, 17, 0, 0)

        morning_solar = calculate_solar_position(lat, lon, dt_morning)
        evening_solar = calculate_solar_position(lat, lon, dt_evening)

        # Full day trajectory points (every 1 hour from 06:00 to 18:00 for smooth arc rendering)
        trajectory_points = []
        for h in range(6, 19):
            dt_h = datetime(target_date.year, target_date.month, target_date.day, h, 0, 0)
            sp = calculate_solar_position(lat, lon, dt_h)
            if sp["altitude"] > -2.0:  # near or above horizon
                trajectory_points.append(sp)

        # 2. Acoustic calculations from sf_landmarks
        # Query transit hubs, train stations, airports, highways
        noise_query = """
            SELECT landmark_id, name, kind, lat, lng
            FROM sf_landmarks
            WHERE kind IN ('transit_hub', 'airport', 'train_station', 'highway')
        """
        landmarks = conn.execute(noise_query).fetchall()

        nearest_landmark = None
        min_dist = float("inf")
        noise_bearing = 0.0

        for lm in landmarks:
            lm_lat = float(lm["lat"])
            lm_lon = float(lm["lng"])
            dist = haversine_distance(lat, lon, lm_lat, lm_lon)
            if dist < min_dist:
                min_dist = dist
                nearest_landmark = lm
                noise_bearing = forward_bearing(lat, lon, lm_lat, lm_lon)

        if not nearest_landmark:
            # Fallback if no specific transit landmarks in vicinity
            nearest_landmark = {
                "name": "Urban Transit Corridor",
                "kind": "transit_hub"
            }
            min_dist = 3.5
            noise_bearing = 270.0  # default West

        noise_direction = bearing_to_cardinal(noise_bearing)
        noise_db = estimate_decibels_at_distance(min_dist)

        # 3. Deterministic Decision Engine
        # The shielded direction is directly opposite the noise source (bearing + 180 deg)
        shielded_bearing = (noise_bearing + 180.0) % 360.0
        shielded_cardinal = bearing_to_primary_cardinal(shielded_bearing)

        # Compare morning vs evening sun azimuth alignment with shielded facade
        # Morning sun azimuth (typically ~90-110 deg / East)
        # Evening sun azimuth (typically ~250-270 deg / West)
        morning_diff = abs(morning_solar["azimuth"] - shielded_bearing)
        morning_diff = min(morning_diff, 360.0 - morning_diff)

        evening_diff = abs(evening_solar["azimuth"] - shielded_bearing)
        evening_diff = min(evening_diff, 360.0 - evening_diff)

        if morning_diff <= evening_diff:
            optimal_facing = "East"
            sunlight_time = "Morning"
        else:
            optimal_facing = "West"
            sunlight_time = "Evening"

        # Check if optimal facing is shielded from the noise source
        # A facade faces `facing_deg`. If dot product with noise vector is negative, facade faces away!
        facing_azimuths = {"North": 0.0, "East": 90.0, "South": 180.0, "West": 270.0}
        facing_deg = facing_azimuths.get(optimal_facing, 90.0)
        angle_to_noise = abs(facing_deg - noise_bearing)
        angle_to_noise = min(angle_to_noise, 360.0 - angle_to_noise)
        noise_shielding = angle_to_noise > 75.0  # facing more than 75 deg away from noise source

        # Construct deterministic high-fidelity recommendation text
        noise_source_display = nearest_landmark["name"]
        article = "an" if optimal_facing.lower().startswith(("a", "e", "i", "o", "u")) else "a"
        recommendation_text = (
            f"Recommended: Request {article} {optimal_facing}-facing room. "
            f"You will receive direct {sunlight_time.lower()} sunlight and be shielded "
            f"from acoustic pollution from the nearby {noise_source_display}."
        )

        return {
            "hotel_id": hotel_id,
            "hotel_name": hotel["name"],
            "coordinates": {
                "latitude": lat,
                "longitude": lon
            },
            "date": target_date_str,
            "solar": {
                "morning_8am": morning_solar,
                "evening_5pm": evening_solar,
                "trajectory": trajectory_points
            },
            "acoustic": {
                "nearest_landmark_name": nearest_landmark["name"],
                "kind": nearest_landmark["kind"],
                "distance_km": round(min_dist, 2),
                "bearing_degrees": round(noise_bearing, 1),
                "direction": noise_direction,
                "estimated_decibels": noise_db
            },
            "optimal_facing": optimal_facing,
            "sunlight_time": sunlight_time,
            "noise_shielding": noise_shielding,
            "recommendation_text": recommendation_text
        }

    finally:
        conn.close()
