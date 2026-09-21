"""
Visual Onboarding API.
Delivers real hero imagery from 16_hotel_media.csv and builds a traveler's
affinity vector using local keyword frequency counting (Zero LLM API calls).
"""

from __future__ import annotations

import os
import re
import csv
import json
import random
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import aiosqlite

from core.database import get_db

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

# Curated high-res imagery mappings matching property style
CURATED_PHOTOS = {
    "heritage": [
        "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
    ],
    "resort": [
        "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
    ],
    "boutique": [
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
    ],
    "hotel": [
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1200&q=80",
    ],
    "homestay": [
        "https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=80",
    ],
    "pool": [
        "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1200&q=80",
    ],
    "nature": [
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80",
    ],
}

CATEGORY_KEYWORDS = {
    "heritage": [
        "heritage", "palace", "fort", "haveli", "royal", "historic",
        "monument", "courtyard", "traditional", "stone", "jaipur", "udaipur",
        "rajasthan", "regal", "carved", "antique", "pillars"
    ],
    "nature": [
        "nature", "mountain", "valley", "forest", "hills", "greenery",
        "wildlife", "tea", "plantation", "river", "peaceful", "serene",
        "view", "scenic", "garden", "orchard", "foliage", "mist"
    ],
    "pool": [
        "pool", "swim", "swimming", "water", "infinity", "plunge", "jacuzzi",
        "deck", "loungers", "lagoon", "cabana", "sunbath"
    ],
    "beach": [
        "beach", "sea", "ocean", "coastal", "shore", "sand", "bay", "waves",
        "tropical", "goa", "kovalam", "sunset", "palm"
    ],
    "city": [
        "city", "urban", "skyline", "central", "downtown", "metro",
        "commercial", "tower", "delhi", "mumbai", "bengaluru", "hub"
    ],
    "luxury": [
        "luxury", "resort", "spa", "exclusive", "villas", "premium",
        "deluxe", "5-star", "suites", "opulent", "grand", "fine", "butler"
    ],
    "wellness": [
        "wellness", "spa", "ayurveda", "yoga", "meditation", "retreat",
        "rejuvenation", "healing", "massage", "aromatherapy", "therapy"
    ],
    "boutique": [
        "boutique", "intimate", "chic", "artisan", "homestay", "charm",
        "cozy", "quaint", "quaintness", "personalized", "curated"
    ],
}

VIBE_LABELS = {
    "heritage": "Heritage Connoisseur",
    "nature": "Nature & Alpine Seeker",
    "pool": "Sun & Aquatic Retreat",
    "beach": "Coastal Horizon Voyager",
    "city": "Metropolitan Explorer",
    "luxury": "Ultra-Luxury Indulgence",
    "wellness": "Holistic Wellness Nomad",
    "boutique": "Artisanal Boutique Collector",
}


class SwipedImage(BaseModel):
    media_id: str
    hotel_id: str
    alt_text: Optional[str] = ""
    caption: Optional[str] = ""
    property_type: Optional[str] = ""


class PreferencesSubmissionRequest(BaseModel):
    user_id: str
    liked_images: List[SwipedImage] = []
    total_swiped: int = 10


async def _ensure_prefs_table(db: aiosqlite.Connection) -> None:
    await db.execute("""
        CREATE TABLE IF NOT EXISTS sf_user_prefs (
            user_id TEXT PRIMARY KEY,
            affinity_vector TEXT NOT NULL,
            top_vibe TEXT NOT NULL,
            swiped_count INTEGER NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    await db.commit()


@router.get("/images")
async def get_onboarding_images(db: aiosqlite.Connection = Depends(get_db)):
    """
    Return 10 random hero images from 16_hotel_media.csv joined with hotels and cities.
    """
    cursor = await db.execute("""
        SELECT 
            m.media_id,
            m.hotel_id,
            m.file_path,
            m.alt_text,
            h.name as hotel_name,
            h.property_type,
            h.star_rating,
            h.description as hotel_description,
            c.name as city_name
        FROM hotel_media m
        JOIN hotels h ON m.hotel_id = h.hotel_id
        LEFT JOIN cities c ON h.city_id = c.city_id
        WHERE m.media_role = 'hero'
        ORDER BY RANDOM()
        LIMIT 10
    """)
    rows = await cursor.fetchall()

    items = []
    for idx, row in enumerate(rows):
        prop_type = (row["property_type"] or "hotel").lower()
        hotel_id = row["hotel_id"]
        
        # Select curated photo based on property type and hash
        photo_pool = CURATED_PHOTOS.get(prop_type) or CURATED_PHOTOS["hotel"]
        if "pool" in (row["alt_text"] or "").lower():
            photo_pool = CURATED_PHOTOS["pool"]
        photo_url = photo_pool[idx % len(photo_pool)]

        caption = f"{row['hotel_name']} • {row['city_name'] or 'India'}"
        vibe_hint = prop_type.capitalize()
        if "palace" in row["hotel_name"].lower() or "mahal" in row["hotel_name"].lower():
            vibe_hint = "Royal Heritage"

        items.append({
            "media_id": row["media_id"],
            "hotel_id": hotel_id,
            "hotel_name": row["hotel_name"],
            "city_name": row["city_name"] or "India",
            "property_type": row["property_type"] or "hotel",
            "star_rating": row["star_rating"] or 4,
            "alt_text": row["alt_text"] or f"Hero view at {row['hotel_name']}",
            "caption": caption,
            "vibe_hint": vibe_hint,
            "file_path": row["file_path"],
            "image_url": photo_url,
            "description": row["hotel_description"] or "",
        })

    return {
        "count": len(items),
        "items": items,
    }


@router.post("/preferences")
async def submit_preferences(
    req: PreferencesSubmissionRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Local keyword-matching algorithm (Zero LLM API calls).
    Extracts alt_text, caption, and property tokens from liked images.
    Maps frequency dictionary into a starting affinity vector and persists to sf_user_prefs.
    """
    await _ensure_prefs_table(db)

    # Initialize frequency counts
    freq: Dict[str, int] = {cat: 0 for cat in CATEGORY_KEYWORDS}
    matched_words: Dict[str, List[str]] = {cat: [] for cat in CATEGORY_KEYWORDS}

    # If no images liked (swiped left on all), provide balanced base weights
    if not req.liked_images:
        base_vector = {cat: round(1.0 / len(CATEGORY_KEYWORDS), 3) for cat in CATEGORY_KEYWORDS}
        top_vibe = "Eclectic Explorer"
        now = datetime.now().isoformat()
        await db.execute(
            """
            INSERT OR REPLACE INTO sf_user_prefs (user_id, affinity_vector, top_vibe, swiped_count, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (req.user_id, json.dumps(base_vector), top_vibe, req.total_swiped, now),
        )
        await db.commit()
        return {
            "status": "success",
            "user_id": req.user_id,
            "top_vibe": top_vibe,
            "affinity_vector": base_vector,
            "message": "Balanced travel DNA created.",
        }

    # Analyze text of each liked image
    for img in req.liked_images:
        # Fetch property description from DB if available
        desc = ""
        cur = await db.execute("SELECT description, property_type FROM hotels WHERE hotel_id = ?", [img.hotel_id])
        h_row = await cur.fetchone()
        if h_row:
            desc = h_row["description"] or ""
            if h_row["property_type"]:
                img_prop = h_row["property_type"].lower()
                if img_prop in freq:
                    freq[img_prop] += 3  # Direct property type weight

        full_text = f"{img.alt_text} {img.caption} {img.property_type} {desc}".lower()
        words = set(re.findall(r"\b[a-z]{3,}\b", full_text))

        for cat, keywords in CATEGORY_KEYWORDS.items():
            for kw in keywords:
                if kw in words or kw in full_text:
                    freq[cat] += 1
                    if kw not in matched_words[cat]:
                        matched_words[cat].append(kw)

    total_matches = sum(freq.values())
    if total_matches == 0:
        total_matches = 1

    # Compute normalized affinity vector
    affinity_vector = {
        cat: round(count / total_matches, 4)
        for cat, count in freq.items()
    }

    # Sort categories by affinity
    sorted_cats = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    top_cat = sorted_cats[0][0]
    runner_up = sorted_cats[1][0] if len(sorted_cats) > 1 and sorted_cats[1][1] > 0 else None

    if runner_up and sorted_cats[1][1] >= sorted_cats[0][1] * 0.7:
        top_vibe = f"{CATEGORY_KEYWORDS[top_cat][0].capitalize()} & {CATEGORY_KEYWORDS[runner_up][0].capitalize()} Specialist"
    else:
        top_vibe = VIBE_LABELS.get(top_cat, "Modern Explorer")

    # Persist to SQLite sf_user_prefs
    now = datetime.now().isoformat()
    await db.execute(
        """
        INSERT OR REPLACE INTO sf_user_prefs (user_id, affinity_vector, top_vibe, swiped_count, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (req.user_id, json.dumps(affinity_vector), top_vibe, req.total_swiped, now),
    )
    await db.commit()

    return {
        "status": "success",
        "user_id": req.user_id,
        "top_vibe": top_vibe,
        "affinity_vector": affinity_vector,
        "dominant_category": top_cat,
        "matched_keywords": {k: v for k, v in matched_words.items() if v},
        "message": f"Travel DNA calibrated: {top_vibe}",
    }


@router.get("/preferences/{user_id}")
async def get_user_preferences(user_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Retrieve calibrated travel DNA preferences for a user."""
    await _ensure_prefs_table(db)
    cursor = await db.execute("SELECT * FROM sf_user_prefs WHERE user_id = ?", [user_id])
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Preferences not found for user")

    return {
        "user_id": row["user_id"],
        "top_vibe": row["top_vibe"],
        "affinity_vector": json.loads(row["affinity_vector"]),
        "swiped_count": row["swiped_count"],
        "updated_at": row["updated_at"],
    }
