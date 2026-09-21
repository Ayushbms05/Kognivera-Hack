import json
import sqlite3
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "PS-02.db"

AXES = ["Budget", "Luxury", "Wellness", "Heritage", "Nightlife"]

def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def get_or_compute_user_vector(user_id: str, conn: sqlite3.Connection) -> Dict[str, Any]:
    """
    Fetches or computes a 5-axis preference vector for a user:
    [Budget, Luxury, Wellness, Heritage, Nightlife] in [0, 100].
    Prioritizes sf_user_prefs; falls back to users & user_interactions datasets.
    """
    # 1. Check sf_user_prefs table
    pref_row = conn.execute(
        "SELECT user_id, affinity_vector, top_vibe FROM sf_user_prefs WHERE user_id = ?",
        (user_id,)
    ).fetchone()

    display_name = user_id
    user_row = conn.execute(
        "SELECT user_id, display_name, budget_band, travel_style, traveller_type FROM users WHERE user_id = ?",
        (user_id,)
    ).fetchone()

    if user_row:
        display_name = user_row["display_name"]

    vector = {axis: 50.0 for axis in AXES}

    if pref_row and pref_row["affinity_vector"]:
        try:
            raw_affinity = json.loads(pref_row["affinity_vector"])
            # Map raw affinity keys (heritage, nature, pool, luxury, wellness, boutique, city) to 5 axes
            vector["Heritage"] = float(raw_affinity.get("heritage", 0.0)) * 100.0
            vector["Luxury"] = float(raw_affinity.get("luxury", 0.0)) * 100.0
            vector["Wellness"] = float(raw_affinity.get("wellness", 0.0) or raw_affinity.get("pool", 0.0)) * 100.0
            vector["Nightlife"] = float(raw_affinity.get("city", 0.0) or raw_affinity.get("boutique", 0.0)) * 100.0
            # Budget is inverse of luxury if not explicitly set
            vector["Budget"] = max(10.0, 100.0 - vector["Luxury"])
        except Exception:
            pass

    # 2. Enrich/Refine with canonical users.csv attributes
    if user_row:
        b_band = (user_row["budget_band"] or "").lower()
        t_style = (user_row["travel_style"] or "").lower()

        # Budget axis
        if b_band in ("shoestring", "budget"):
            vector["Budget"] = max(vector["Budget"], 90.0)
            vector["Luxury"] = min(vector["Luxury"], 25.0)
        elif b_band == "value":
            vector["Budget"] = max(vector["Budget"], 75.0)
            vector["Luxury"] = min(vector["Luxury"], 40.0)
        elif b_band == "mid":
            vector["Budget"] = 60.0
            vector["Luxury"] = 55.0
        elif b_band == "premium":
            vector["Budget"] = 35.0
            vector["Luxury"] = max(vector["Luxury"], 80.0)
        elif b_band == "luxury":
            vector["Budget"] = 15.0
            vector["Luxury"] = max(vector["Luxury"], 95.0)

        # Style overlays
        if t_style == "wellness":
            vector["Wellness"] = max(vector["Wellness"], 90.0)
        elif t_style == "cultural":
            vector["Heritage"] = max(vector["Heritage"], 92.0)
        elif t_style in ("adventure", "city"):
            vector["Nightlife"] = max(vector["Nightlife"], 85.0)
        elif t_style == "luxury":
            vector["Luxury"] = max(vector["Luxury"], 90.0)
        elif t_style == "budget":
            vector["Budget"] = max(vector["Budget"], 90.0)

    # 3. Incorporate implicit user_interactions weights
    interactions = conn.execute(
        "SELECT entity_type, entity_id, interaction_type, dwell_seconds, implicit_rating "
        "FROM user_interactions WHERE user_id = ? LIMIT 20",
        (user_id,)
    ).fetchall()

    if interactions:
        dwell_boost = sum((r["dwell_seconds"] or 0) for r in interactions)
        if dwell_boost > 300:
            vector["Heritage"] = min(100.0, vector["Heritage"] + 5.0)

    # Ensure vector values are bounded within [10.0, 100.0]
    for axis in AXES:
        vector[axis] = round(float(np.clip(vector[axis], 10.0, 100.0)), 1)

    return {
        "user_id": user_id,
        "display_name": display_name,
        "vector": vector
    }

def get_hotel_feature_vector(hotel_id: str, conn: sqlite3.Connection) -> Dict[str, Any]:
    """
    Derives a 5-axis feature vector [0, 100] for a hotel from its property_type,
    star_rating, and joined amenities.
    """
    hotel = conn.execute(
        "SELECT hotel_id, name, property_type, star_rating, description FROM hotels WHERE hotel_id = ?",
        (hotel_id,)
    ).fetchone()

    if not hotel:
        raise ValueError(f"Hotel '{hotel_id}' not found.")

    prop_type = (hotel["property_type"] or "").lower()
    star_rating = float(hotel["star_rating"] or 3.0)

    # Baseline scores
    vector = {
        "Budget": 50.0,
        "Luxury": 50.0,
        "Wellness": 30.0,
        "Heritage": 30.0,
        "Nightlife": 30.0
    }

    # Property type mapping
    if prop_type == "heritage":
        vector["Heritage"] += 50.0
        vector["Luxury"] += 20.0
        vector["Budget"] -= 15.0
    elif prop_type == "resort":
        vector["Luxury"] += 35.0
        vector["Wellness"] += 45.0
        vector["Nightlife"] += 15.0
        vector["Budget"] -= 20.0
    elif prop_type == "boutique":
        vector["Heritage"] += 25.0
        vector["Luxury"] += 30.0
        vector["Nightlife"] += 20.0
    elif prop_type == "hostel":
        vector["Budget"] += 45.0
        vector["Nightlife"] += 35.0
        vector["Luxury"] -= 35.0
    elif prop_type in ("guesthouse", "homestay", "apartment"):
        vector["Budget"] += 35.0
        vector["Heritage"] += 15.0
        vector["Luxury"] -= 20.0

    # Star rating impact
    if star_rating >= 5.0:
        vector["Luxury"] += 30.0
        vector["Budget"] -= 25.0
    elif star_rating >= 4.0:
        vector["Luxury"] += 15.0
        vector["Budget"] -= 10.0
    elif star_rating <= 2.0:
        vector["Budget"] += 25.0
        vector["Luxury"] -= 25.0

    # Joined amenities impact
    amenities = conn.execute("""
        SELECT a.label, a.amenity_group
        FROM hotel_amenities ha
        JOIN amenities a ON ha.amenity_id = a.amenity_id
        WHERE ha.hotel_id = ?
    """, (hotel_id,)).fetchall()

    for am in amenities:
        grp = (am["amenity_group"] or "").lower()
        lbl = (am["label"] or "").lower()

        if grp == "wellness" or any(w in lbl for w in ("spa", "pool", "yoga", "sauna", "fitness")):
            vector["Wellness"] += 10.0
        if grp == "food_beverage" and any(b in lbl for b in ("bar", "rooftop", "night", "cocktail")):
            vector["Nightlife"] += 15.0
        if any(l in lbl for l in ("infinity pool", "butler", "valet", "suite")):
            vector["Luxury"] += 12.0
        if any(b in lbl for b in ("free wi-fi", "kitchen", "self-service", "laundry")):
            vector["Budget"] += 8.0

    # Clamp all axes to [10.0, 100.0]
    for axis in AXES:
        vector[axis] = round(float(np.clip(vector[axis], 10.0, 100.0)), 1)

    return {
        "hotel_id": hotel_id,
        "hotel_name": hotel["name"],
        "property_type": hotel["property_type"],
        "vector": vector
    }

def calculate_group_consensus(hotel_id: str, user_ids: List[str]) -> Dict[str, Any]:
    """
    Uses NumPy vector math to calculate:
    1. Group Centroid Vector (mean of all user vectors)
    2. Hotel Feature Vector
    3. Group Consensus Score and 5-axis alignment scores
    4. Individual satisfaction percentages
    5. Natural language alignment and compromise summary
    """
    if len(user_ids) < 2:
        raise ValueError("At least 2 users are required for group travel consensus.")

    conn = get_db_connection()
    try:
        # 1. Fetch user vectors
        users_data = [get_or_compute_user_vector(uid.strip(), conn) for uid in user_ids]

        # 2. Fetch hotel feature vector
        hotel_data = get_hotel_feature_vector(hotel_id, conn)
        hotel_v = np.array([hotel_data["vector"][axis] for axis in AXES], dtype=float)

        # 3. Compute Group Centroid Vector using NumPy
        user_matrix = np.array(
            [[u["vector"][axis] for axis in AXES] for u in users_data],
            dtype=float
        )
        centroid_v = np.mean(user_matrix, axis=0)
        centroid_dict = {AXES[i]: round(float(centroid_v[i]), 1) for i in range(len(AXES))}

        # 4. Axis Alignment Scores
        # Alignment is 100 - |Centroid - Hotel|
        axis_diffs = np.abs(centroid_v - hotel_v)
        axis_scores = []
        for i, axis in enumerate(AXES):
            align_pct = round(float(np.clip(100.0 - axis_diffs[i], 0.0, 100.0)), 1)
            axis_scores.append({
                "axis": axis,
                "group_avg": centroid_dict[axis],
                "hotel_offering": hotel_data["vector"][axis],
                "alignment_pct": align_pct
            })

        # 5. Overall Group Consensus Score (L2 Euclidean similarity scaled to 100%)
        # Max theoretical distance in 5D [0, 100] is sqrt(5 * 100^2) ≈ 223.6
        max_dist = np.sqrt(len(AXES) * (100.0 ** 2))
        centroid_dist = np.linalg.norm(centroid_v - hotel_v)
        group_consensus_score = int(np.clip(round((1.0 - (centroid_dist / max_dist)) * 100.0), 0, 100))

        # 6. Individual User Satisfaction Scores
        for i, u in enumerate(users_data):
            u_vec = user_matrix[i]
            u_dist = np.linalg.norm(u_vec - hotel_v)
            u_satisfaction = int(np.clip(round((1.0 - (u_dist / max_dist)) * 100.0), 0, 100))
            u["satisfaction_pct"] = u_satisfaction

        # 7. Identify High Alignment axes and individual compromises
        # High alignment axes: top 2 smallest axis_diffs
        sorted_axes_by_diff = sorted(range(len(AXES)), key=lambda k: axis_diffs[k])
        best_axis_1 = AXES[sorted_axes_by_diff[0]]
        best_axis_2 = AXES[sorted_axes_by_diff[1]]

        # Find user with lowest satisfaction or highest deviation on an axis
        lowest_user = min(users_data, key=lambda x: x["satisfaction_pct"])
        lowest_user_idx = users_data.index(lowest_user)
        user_axis_deviations = np.abs(user_matrix[lowest_user_idx] - hotel_v)
        compromised_axis_idx = int(np.argmax(user_axis_deviations))
        compromised_axis = AXES[compromised_axis_idx]

        compromise_summary = (
            f"High alignment on {best_axis_1} and {best_axis_2}, "
            f"slight compromise on {compromised_axis} for {lowest_user['display_name']}"
        )
        consensus_badge = f"{group_consensus_score}% Squad Match"

        return {
            "hotel_id": hotel_id,
            "hotel_name": hotel_data["hotel_name"],
            "property_type": hotel_data["property_type"],
            "axes": AXES,
            "group_centroid": centroid_dict,
            "hotel_features": hotel_data["vector"],
            "users": users_data,
            "axis_scores": axis_scores,
            "group_consensus_score": group_consensus_score,
            "consensus_badge": consensus_badge,
            "compromise_summary": compromise_summary,
            "recommendation_text": f"{consensus_badge}: {compromise_summary}."
        }

    finally:
        conn.close()

def get_squad_candidates(limit: int = 8) -> List[Dict[str, Any]]:
    """
    Returns curated squad candidate users with distinct personas and vectors.
    """
    conn = get_db_connection()
    try:
        rows = conn.execute("""
            SELECT user_id, display_name, budget_band, travel_style, traveller_type
            FROM users
            ORDER BY user_id ASC
            LIMIT ?
        """, (limit,)).fetchall()

        candidates = []
        for r in rows:
            u_data = get_or_compute_user_vector(r["user_id"], conn)
            candidates.append({
                "user_id": r["user_id"],
                "display_name": r["display_name"],
                "budget_band": r["budget_band"],
                "travel_style": r["travel_style"],
                "traveller_type": r["traveller_type"],
                "vector": u_data["vector"]
            })
        return candidates
    finally:
        conn.close()

