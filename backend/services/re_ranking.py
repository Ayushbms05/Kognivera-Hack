"""
Personalized Re-Ranking Service — Offline Collaborative & Stated-Preference Vector Affinity.

100% Deterministic Local Math (Zero LLM Tokens).
Reads directly from:
- 09_users.csv
- 15_user_interactions.csv
- 08_hotels.csv
- 11_hotel_amenities.csv
- 01_amenities.csv
"""

from __future__ import annotations

import csv
import json
import math
import sqlite3
from pathlib import Path
from typing import Optional, Dict, Any, List

from core.config import get_settings

# Paths
BASE_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "csv"

# Predefined Stage Personas from 09_users.csv
STAGE_PERSONAS: dict[str, dict[str, Any]] = {
    "usr_f855344d": {
        "user_id": "usr_f855344d",
        "name": "Priya Sharma",
        "label": "Heavy / Heritage Connoisseur",
        "segment": "heavy",
        "travel_style": "cultural",
        "budget_band": "luxury",
        "traveller_type": "couple",
        "avatar_color": "purple",
        "key_weights": {
            "Heritage Property": 5.0,
            "Cultural Style": 4.0,
            "Luxury / Boutique": 3.0,
        },
    },
    "usr_f5fd9c87": {
        "user_id": "usr_f5fd9c87",
        "name": "Aarav Patel",
        "label": "Cold-Start / Shoestring Backpacker",
        "segment": "cold_start",
        "travel_style": "adventure",
        "budget_band": "shoestring",
        "traveller_type": "backpacker",
        "avatar_color": "amber",
        "key_weights": {
            "Shoestring Budget": 5.0,
            "Hostel / Homestay": 4.0,
            "Free Wi-Fi": 3.0,
        },
    },
    "usr_1805266d": {
        "user_id": "usr_1805266d",
        "name": "Vikram Malhotra",
        "label": "Business Traveler",
        "segment": "cold_start",
        "travel_style": "comfort",
        "budget_band": "value",
        "traveller_type": "business",
        "avatar_color": "blue",
        "key_weights": {
            "Business Center": 5.0,
            "Meeting Rooms": 4.5,
            "High-Speed Wi-Fi": 4.0,
            "Central Proximity": 3.0,
        },
    },
}

# Feature Vocabulary Dimensions
VOCAB_FEATURES = [
    # Property Types
    "prop_heritage",
    "prop_boutique",
    "prop_resort",
    "prop_hotel",
    "prop_homestay",
    "prop_guesthouse",
    "prop_hostel",
    # Amenities
    "amen_free_wifi",
    "amen_swimming_pool",
    "amen_spa",
    "amen_business_center",
    "amen_meeting_rooms",
    "amen_airport_transfer",
    "amen_fitness_center",
    "amen_restaurant",
    "amen_bar",
    "amen_air_conditioning",
    "amen_heritage_courtyard",
    "amen_room_service",
    # Budget Bands
    "budget_shoestring",
    "budget_value",
    "budget_mid",
    "budget_premium",
    "budget_luxury",
]

FEATURE_INDEX = {feat: i for i, feat in enumerate(VOCAB_FEATURES)}
DIM_COUNT = len(VOCAB_FEATURES)


class PersonalizedReRankingService:
    def __init__(self, data_dir: Optional[Path] = None):
        self.data_dir = data_dir or BASE_DATA_DIR
        self.users: dict[str, dict[str, Any]] = {}
        self.interactions: dict[str, list[dict[str, Any]]] = {}
        self.hotel_amenities: dict[str, set[str]] = {}
        self.amenity_code_map: dict[str, str] = {}
        self._loaded = False

    def load_data(self):
        if self._loaded:
            return

        # 1. Load 01_amenities.csv (amenity_id -> code)
        amen_file = self.data_dir / "01_amenities.csv"
        if amen_file.exists():
            with open(amen_file, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    self.amenity_code_map[row["amenity_id"]] = row.get("code", "").lower()

        # 2. Load 11_hotel_amenities.csv (hotel_id -> set of amenity codes)
        hotel_amen_file = self.data_dir / "11_hotel_amenities.csv"
        if hotel_amen_file.exists():
            with open(hotel_amen_file, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    hid = row["hotel_id"]
                    aid = row["amenity_id"]
                    code = self.amenity_code_map.get(aid, aid).lower()
                    if hid not in self.hotel_amenities:
                        self.hotel_amenities[hid] = set()
                    self.hotel_amenities[hid].add(code)

        # 3. Load 09_users.csv
        users_file = self.data_dir / "09_users.csv"
        if users_file.exists():
            with open(users_file, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    uid = row["user_id"]
                    self.users[uid] = {
                        "user_id": uid,
                        "display_name": row.get("display_name", "Traveler"),
                        "segment": row.get("segment", "cold_start"),
                        "budget_band": row.get("budget_band", "mid"),
                        "travel_style": row.get("travel_style", "comfort"),
                        "traveller_type": row.get("traveller_type", "solo"),
                    }

        # 4. Load 15_user_interactions.csv (for hotel entity interactions)
        ix_file = self.data_dir / "15_user_interactions.csv"
        if ix_file.exists():
            with open(ix_file, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get("entity_type") == "hotel":
                        uid = row["user_id"]
                        if uid not in self.interactions:
                            self.interactions[uid] = []
                        self.interactions[uid].append({
                            "entity_id": row["entity_id"],
                            "interaction_type": row.get("interaction_type", "view"),
                            "implicit_rating": float(row["implicit_rating"]) if row.get("implicit_rating") else 0.5,
                        })

        self._loaded = True

    def get_personas(self) -> list[dict[str, Any]]:
        """Returns the 3 stage personas."""
        self.load_data()
        return list(STAGE_PERSONAS.values())

    def get_user_profile(self, user_id: str) -> dict[str, Any]:
        """Fetch user or fallback to stage persona."""
        self.load_data()
        if user_id in STAGE_PERSONAS:
            return STAGE_PERSONAS[user_id]

        # Check calibrated travel DNA from sf_user_prefs (Visual Onboarding)
        try:
            db_path = get_settings().db_abs_path
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT user_id, affinity_vector, top_vibe FROM sf_user_prefs WHERE user_id = ?", [user_id])
            pref = c.fetchone()
            if pref:
                affinity = json.loads(pref["affinity_vector"])
                top_cats = sorted(affinity.items(), key=lambda x: x[1], reverse=True)[:3]
                weights = {k.capitalize(): round(v * 10, 1) for k, v in top_cats}

                # Also fetch user display name from users table if available
                c.execute("SELECT display_name FROM users WHERE user_id = ?", [user_id])
                u_row = c.fetchone()
                name = u_row["display_name"] if u_row else "Traveler"
                conn.close()
                return {
                    "user_id": user_id,
                    "name": name,
                    "label": pref["top_vibe"],
                    "segment": "calibrated_dna",
                    "travel_style": top_cats[0][0] if top_cats else "discovery",
                    "budget_band": "luxury" if affinity.get("luxury", 0) > 0.2 else "mid",
                    "traveller_type": "explorer",
                    "avatar_color": "terracotta",
                    "key_weights": weights,
                    "affinity_vector": affinity,
                }
            conn.close()
        except Exception:
            pass

        if user_id in self.users:
            raw = self.users[user_id]
            return {
                "user_id": raw["user_id"],
                "name": raw["display_name"],
                "label": f"{raw['segment'].replace('_', '-').title()} / {raw['travel_style'].title()} {raw['traveller_type'].title()}",
                "segment": raw["segment"],
                "travel_style": raw["travel_style"],
                "budget_band": raw["budget_band"],
                "traveller_type": raw["traveller_type"],
                "avatar_color": "emerald",
                "key_weights": {
                    raw["travel_style"].title(): 4.0,
                    raw["budget_band"].title(): 3.5,
                },
            }
        # Fallback to default persona 1 (Priya Sharma)
        return STAGE_PERSONAS["usr_f855344d"]

    def build_hotel_vector(self, hotel: dict[str, Any]) -> list[float]:
        """Construct normalized feature vector for a hotel."""
        vec = [0.0] * DIM_COUNT
        hid = hotel["hotel_id"]
        pt = (hotel.get("property_type") or "hotel").lower()

        # Property type feature
        prop_feat = f"prop_{pt}"
        if prop_feat in FEATURE_INDEX:
            vec[FEATURE_INDEX[prop_feat]] = 1.0

        # Amenities
        amenities = self.hotel_amenities.get(hid, set())
        for a in amenities:
            # Map common codes
            if "wifi" in a:
                vec[FEATURE_INDEX["amen_free_wifi"]] = 1.0
            elif "pool" in a:
                vec[FEATURE_INDEX["amen_swimming_pool"]] = 1.0
            elif "spa" in a or "wellness" in a:
                vec[FEATURE_INDEX["amen_spa"]] = 1.0
            elif "business" in a:
                vec[FEATURE_INDEX["amen_business_center"]] = 1.0
            elif "meeting" in a or "conference" in a:
                vec[FEATURE_INDEX["amen_meeting_rooms"]] = 1.0
            elif "airport" in a or "transfer" in a:
                vec[FEATURE_INDEX["amen_airport_transfer"]] = 1.0
            elif "gym" in a or "fitness" in a:
                vec[FEATURE_INDEX["amen_fitness_center"]] = 1.0
            elif "restaurant" in a or "dining" in a:
                vec[FEATURE_INDEX["amen_restaurant"]] = 1.0
            elif "bar" in a or "lounge" in a:
                vec[FEATURE_INDEX["amen_bar"]] = 1.0
            elif "ac" in a or "air_conditioning" in a:
                vec[FEATURE_INDEX["amen_air_conditioning"]] = 1.0
            elif "courtyard" in a or "heritage" in a:
                vec[FEATURE_INDEX["amen_heritage_courtyard"]] = 1.0
            elif "room_service" in a:
                vec[FEATURE_INDEX["amen_room_service"]] = 1.0

        # Budget band based on min_price
        price = 4500.0
        try:
            if hotel.get("min_price"):
                price = float(hotel["min_price"])
        except (ValueError, TypeError):
            price = 4500.0

        if price < 3000:
            vec[FEATURE_INDEX["budget_shoestring"]] = 1.0
        elif price < 5000:
            vec[FEATURE_INDEX["budget_value"]] = 1.0
        elif price < 10000:
            vec[FEATURE_INDEX["budget_mid"]] = 1.0
        elif price < 18000:
            vec[FEATURE_INDEX["budget_premium"]] = 1.0
        else:
            vec[FEATURE_INDEX["budget_luxury"]] = 1.0

        return vec

    def build_user_vector(self, user: dict[str, Any], hotels_by_id: dict[str, dict[str, Any]]) -> list[float]:
        """
        Construct user affinity vector.
        - For warm users (heavy/light): Weights: book=5.0, save=3.0, like=3.0, click=1.0, dismiss=-3.0.
        - For cold-start users: Derived directly from travel_style, traveller_type, and budget_band.
        """
        vec = [0.0] * DIM_COUNT
        uid = user["user_id"]
        segment = user.get("segment", "cold_start")
        user_ixs = self.interactions.get(uid, [])

        interaction_weights = {
            "book": 5.0,
            "save": 3.0,
            "like": 3.0,
            "share": 2.0,
            "click": 1.0,
            "view": 0.5,
            "dismiss": -3.0,
        }

        has_warm_interactions = len(user_ixs) > 0 and segment in ["heavy", "light"]

        if has_warm_interactions:
            # Accumulate interaction weights against hotel feature vectors
            for ix in user_ixs:
                hid = ix["entity_id"]
                w = interaction_weights.get(ix["interaction_type"], 0.5)
                h_obj = hotels_by_id.get(hid)
                if h_obj:
                    h_vec = self.build_hotel_vector(h_obj)
                    for i in range(DIM_COUNT):
                        vec[i] += w * h_vec[i]
                else:
                    # Generic fallback if hotel not in active slice
                    pass

        # Cold-start or stated-preference prior
        t_style = (user.get("travel_style") or "").lower()
        t_type = (user.get("traveller_type") or "").lower()
        b_band = (user.get("budget_band") or "").lower()

        # Stated preference multiplier (stronger if cold start)
        mult = 2.0 if not has_warm_interactions else 1.0

        # Travel style
        if t_style in ["cultural", "heritage"]:
            vec[FEATURE_INDEX["prop_heritage"]] += 4.5 * mult
            vec[FEATURE_INDEX["prop_boutique"]] += 3.0 * mult
            vec[FEATURE_INDEX["amen_heritage_courtyard"]] += 3.5 * mult
        elif t_style == "wellness":
            vec[FEATURE_INDEX["amen_spa"]] += 4.5 * mult
            vec[FEATURE_INDEX["amen_swimming_pool"]] += 3.5 * mult
            vec[FEATURE_INDEX["prop_resort"]] += 3.5 * mult
            vec[FEATURE_INDEX["amen_fitness_center"]] += 2.5 * mult
        elif t_style == "adventure":
            vec[FEATURE_INDEX["prop_homestay"]] += 3.5 * mult
            vec[FEATURE_INDEX["prop_hostel"]] += 3.5 * mult
            vec[FEATURE_INDEX["prop_resort"]] += 2.5 * mult
        elif t_style in ["comfort", "slow"]:
            vec[FEATURE_INDEX["prop_hotel"]] += 3.0 * mult
            vec[FEATURE_INDEX["prop_boutique"]] += 2.5 * mult
            vec[FEATURE_INDEX["amen_free_wifi"]] += 3.0 * mult
            vec[FEATURE_INDEX["amen_air_conditioning"]] += 3.0 * mult
        elif t_style == "budget":
            vec[FEATURE_INDEX["prop_hostel"]] += 4.0 * mult
            vec[FEATURE_INDEX["prop_guesthouse"]] += 3.5 * mult
            vec[FEATURE_INDEX["budget_shoestring"]] += 4.0 * mult

        # Traveller type
        if t_type == "business":
            vec[FEATURE_INDEX["amen_business_center"]] += 5.0 * mult
            vec[FEATURE_INDEX["amen_meeting_rooms"]] += 4.5 * mult
            vec[FEATURE_INDEX["amen_free_wifi"]] += 4.0 * mult
            vec[FEATURE_INDEX["amen_airport_transfer"]] += 3.0 * mult
            vec[FEATURE_INDEX["prop_hotel"]] += 3.5 * mult
        elif t_type == "backpacker":
            vec[FEATURE_INDEX["prop_hostel"]] += 4.5 * mult
            vec[FEATURE_INDEX["prop_guesthouse"]] += 3.5 * mult
            vec[FEATURE_INDEX["budget_shoestring"]] += 4.5 * mult
            vec[FEATURE_INDEX["amen_free_wifi"]] += 2.5 * mult

        # Budget band
        b_feat = f"budget_{b_band}"
        if b_feat in FEATURE_INDEX:
            vec[FEATURE_INDEX[b_feat]] += 4.0 * mult

        # Calibrated Travel DNA weights (if user swiped via Visual Onboarding)
        if user.get("affinity_vector"):
            aff = user["affinity_vector"]
            if aff.get("heritage"):
                w = aff["heritage"] * 8.0
                vec[FEATURE_INDEX["prop_heritage"]] += w
                vec[FEATURE_INDEX["amen_heritage_courtyard"]] += w * 0.8
            if aff.get("nature"):
                w = aff["nature"] * 7.0
                vec[FEATURE_INDEX["prop_resort"]] += w * 0.7
                vec[FEATURE_INDEX["amen_swimming_pool"]] += w * 0.5
            if aff.get("pool"):
                w = aff["pool"] * 8.0
                vec[FEATURE_INDEX["amen_swimming_pool"]] += w
            if aff.get("beach"):
                w = aff["beach"] * 7.0
                vec[FEATURE_INDEX["prop_resort"]] += w
            if aff.get("luxury"):
                w = aff["luxury"] * 8.0
                vec[FEATURE_INDEX["budget_luxury"]] += w
                vec[FEATURE_INDEX["amen_spa"]] += w * 0.7
            if aff.get("wellness"):
                w = aff["wellness"] * 8.0
                vec[FEATURE_INDEX["amen_spa"]] += w
                vec[FEATURE_INDEX["amen_fitness_center"]] += w * 0.6
            if aff.get("boutique"):
                w = aff["boutique"] * 8.0
                vec[FEATURE_INDEX["prop_boutique"]] += w
            if aff.get("city"):
                w = aff["city"] * 7.0
                vec[FEATURE_INDEX["prop_hotel"]] += w
                vec[FEATURE_INDEX["amen_business_center"]] += w * 0.7

        return vec

    @staticmethod
    def cosine_similarity(v1: list[float], v2: list[float]) -> float:
        """Compute cosine similarity between two feature vectors."""
        dot = 0.0
        norm1 = 0.0
        norm2 = 0.0
        for a, b in zip(v1, v2):
            dot += a * b
            norm1 += a * a
            norm2 += b * b
        if norm1 <= 0.0 or norm2 <= 0.0:
            return 0.0
        sim = dot / (math.sqrt(norm1) * math.sqrt(norm2))
        return max(0.0, min(1.0, sim))

    def generate_explainability(
        self,
        user: dict[str, Any],
        hotel: dict[str, Any],
        user_vec: list[float],
        hotel_vec: list[float],
        rank_boost: int,
        personalization: bool,
    ) -> str:
        """Generate human-readable deterministic explanation for top rank driver."""
        if not personalization:
            return "Standard unpersonalized ranking (Relevance + Guest Score)"

        # Compute element-wise dot product contributions
        contributions = [u * h for u, h in zip(user_vec, hotel_vec)]
        top_idx = max(range(DIM_COUNT), key=lambda i: contributions[i])
        top_feat = VOCAB_FEATURES[top_idx]
        top_val = contributions[top_idx]

        boost_str = f"+{max(1, rank_boost)} ranks"

        if user.get("segment") == "calibrated_dna":
            return f"{boost_str}: Calibrated to your {user.get('label', 'Travel DNA')} vibe"

        if top_val <= 0.01:
            return f"{boost_str}: High overall alignment with your {user.get('travel_style', 'travel').title()} preferences"

        # Feature-specific strings
        if top_feat == "prop_heritage":
            if user.get("segment") == "heavy":
                return f"{boost_str}: You frequently book Heritage stays"
            return f"{boost_str}: Top match for your Heritage & Cultural preference"
        elif top_feat == "budget_shoestring":
            return f"{boost_str}: Perfect match for your Shoestring budget (< Rs 3,000)"
        elif top_feat in ["amen_business_center", "amen_meeting_rooms", "amen_free_wifi"]:
            return f"{boost_str}: Features Business Center & High-Speed Wi-Fi"
        elif top_feat in ["amen_spa", "amen_swimming_pool"]:
            return f"{boost_str}: Features Luxury Spa & Wellness amenities"
        elif top_feat == "prop_hostel":
            return f"{boost_str}: Ideal social stay for Backpacker travelers"
        elif top_feat == "prop_resort":
            return f"{boost_str}: Luxury resort matching your relaxed travel style"
        elif top_feat == "amen_heritage_courtyard":
            return f"{boost_str}: Authentic traditional courtyard architecture"
        elif top_feat == "budget_luxury":
            return f"{boost_str}: Matches your Luxury tier preferences"
        else:
            style = user.get("travel_style", "travel").title()
            return f"{boost_str}: Strong alignment with your {style} travel profile"

    def rank_hotels(
        self,
        hotels: list[dict[str, Any]],
        user_id: Optional[str] = None,
        personalization: bool = True,
        filter_criteria: Optional[dict[str, Any]] = None,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """
        Rank hotel items using:
        Final Score = (0.55 * filter_match) + (0.20 * cosine_sim) + (0.15 * guest_score/10) + (0.10 * proximity)
        When personalization is False, cosine_sim term is 0.0 and base weights scale accordingly.
        """
        self.load_data()
        user_profile = self.get_user_profile(user_id or "usr_f855344d")

        # Map hotels by ID
        hotels_by_id = {h["hotel_id"]: h for h in hotels}
        user_vec = self.build_user_vector(user_profile, hotels_by_id)

        # Baseline sorting before personalization to compute rank changes
        base_sorted = sorted(
            hotels,
            key=lambda h: (float(h.get("guest_score") or 8.0) * 0.7 - float(h.get("distance_to_centre_km") or 5.0) * 0.1),
            reverse=True,
        )
        base_ranks = {h["hotel_id"]: i + 1 for i, h in enumerate(base_sorted)}

        ranked_items = []
        for h in hotels:
            hotel_vec = self.build_hotel_vector(h)

            # 1. Filter Match (0.0 to 1.0)
            filter_match = 1.0
            if filter_criteria:
                matched_filters = 0
                total_filters = 0
                if filter_criteria.get("property_type"):
                    total_filters += 1
                    if h.get("property_type") == filter_criteria["property_type"]:
                        matched_filters += 1
                if filter_criteria.get("city_id"):
                    total_filters += 1
                    if h.get("city_id") == filter_criteria["city_id"]:
                        matched_filters += 1
                if total_filters > 0:
                    filter_match = matched_filters / total_filters

            # 2. Vector Affinity Cosine Similarity (0.0 to 1.0)
            cosine_sim = self.cosine_similarity(user_vec, hotel_vec) if personalization else 0.0

            # 3. Guest Score Normalized (0.0 to 1.0)
            raw_gs = float(h.get("guest_score") or 8.0)
            norm_guest_score = min(1.0, max(0.0, raw_gs / 10.0))

            # 4. Proximity (0.0 to 1.0, closer to center is better)
            dist_km = float(h.get("distance_to_centre_km") or 5.0)
            norm_proximity = max(0.0, 1.0 - (dist_km / 15.0))

            # Exact formula
            if personalization:
                final_score = (
                    (0.55 * filter_match)
                    + (0.20 * cosine_sim)
                    + (0.15 * norm_guest_score)
                    + (0.10 * norm_proximity)
                )
            else:
                final_score = (
                    (0.70 * filter_match)
                    + (0.20 * norm_guest_score)
                    + (0.10 * norm_proximity)
                )

            breakdown = {
                "filter_match": round(filter_match, 3),
                "affinity": round(cosine_sim, 3) if personalization else 0.0,
                "guest_score": round(norm_guest_score, 3),
                "proximity": round(norm_proximity, 3),
                "final_score": round(final_score, 4),
            }

            ranked_items.append({
                "hotel": h,
                "final_score": final_score,
                "breakdown": breakdown,
                "hotel_vec": hotel_vec,
            })

        # Sort descending by final score
        ranked_items.sort(key=lambda item: item["final_score"], reverse=True)

        # Compute rank change and explainability string
        results = []
        for new_rank_0, item in enumerate(ranked_items):
            new_rank = new_rank_0 + 1
            hid = item["hotel"]["hotel_id"]
            old_rank = base_ranks.get(hid, new_rank)
            rank_boost = old_rank - new_rank  # Positive means it moved UP

            explainability = self.generate_explainability(
                user=user_profile,
                hotel=item["hotel"],
                user_vec=user_vec,
                hotel_vec=item["hotel_vec"],
                rank_boost=rank_boost,
                personalization=personalization,
            )

            res_entry = {
                **item["hotel"],
                "final_score": round(item["final_score"], 4),
                "score_breakdown": item["breakdown"],
                "explainability": explainability,
                "personalization_rank": new_rank,
            }
            results.append(res_entry)

        return results, user_profile


# Global Singleton
reranking_service = PersonalizedReRankingService()
