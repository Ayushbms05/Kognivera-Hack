"""
NL Search Service — Gemini-powered natural language query parser.

Converts free-text utterances (in any language) into structured SearchFilters JSON.
Uses Gemini's JSON mode for guaranteed structured output, with a keyword fallback.
"""

from __future__ import annotations

import json
import re
import logging

import google.generativeai as genai

from core.config import get_settings
from core.schemas import SearchFilters

logger = logging.getLogger(__name__)

# ── System prompt for the NL parser ──────────────────────────────────

SYSTEM_PROMPT = """You are a hotel search query parser for StayFinder, an Indian hotel booking platform.

Your job: convert a user's natural language query into structured JSON search filters.

## Available Filter Fields

```json
{
  "city": "string — city name (title case, e.g. 'Jaipur', 'New Delhi')",
  "star_min": "int 1-5 — minimum star rating",
  "star_max": "int 1-5 — maximum star rating",
  "price_min": "float — minimum price per night in INR",
  "price_max": "float — maximum price per night in INR",
  "property_type": "one of: boutique, guesthouse, homestay, heritage, resort, hotel, hostel, apartment",
  "amenities": ["array of codes from: free_wifi, high_speed_wifi, air_conditioning, swimming_pool, infinity_pool, spa, ayurvedic_spa, gym, yoga_deck, sauna, steam_room, hot_tub, massage_service, restaurant, multi_cuisine_restaurant, rooftop_bar, coffee_shop, room_service_24h, breakfast_buffet, vegetarian_kitchen, jain_food, halal_kitchen, garden, terrace, beach_access, lake_view, mountain_view, bonfire_area, trekking_desk, free_parking, ev_charging, airport_shuttle, kids_club, family_rooms, play_area, step_free_access, elevator, work_desk, meeting_room"],
  "meal_preference": "one of: veg, jain, halal (extract from mentions of vegetarian, pure veg, Jain food, halal)",
  "distance_km": "float — max distance from city centre in km",
  "guest_score_min": "float — minimum guest review score (1-10 scale)",
  "sort_by": "one of: relevance, price_asc, price_desc, rating, distance",
  "guests": "int — number of guests",
  "quiet": "bool — true if user wants a quiet/peaceful property",
  "exclude_near": "string — what to avoid being near (e.g. 'airport', 'highway')"
}
```

## Rules
1. Parse queries in ANY language (Hindi, Tamil, Telugu, Bengali, English, code-mixed).
2. Map colloquial terms: "sasta" / "budget" -> low price_max, "luxury" / "premium" -> high star_min, "pool" -> swimming_pool amenity.
3. "under 8000" means price_max=8000. "above 5000" means price_min=5000.
4. "4-star" means star_min=4. "3-4 star" means star_min=3, star_max=4.
5. "pure veg" / "shakahari" -> meal_preference="veg". "Jain" -> meal_preference="jain".
6. "near beach" -> beach_access amenity. "near centre" / "walkable" -> distance_km=2.
7. Only include fields you are confident about. Omit uncertain fields (set to null).
8. Return ONLY valid JSON. No markdown, no explanations.

## Examples
Query: "quiet 4-star pure veg under 8000 in Jaipur"
{"city":"Jaipur","star_min":4,"price_max":8000,"meal_preference":"veg","quiet":true}

Query: "budget homestay with wifi near the beach in Goa"
{"city":"Panaji","property_type":"homestay","price_max":3000,"amenities":["free_wifi","beach_access"]}

Query: "luxury resort with pool and spa in Udaipur, sort by rating"
{"city":"Udaipur","property_type":"resort","star_min":4,"amenities":["swimming_pool","spa"],"sort_by":"rating"}"""


# ── Gemini-powered parser ────────────────────────────────────────────

async def parse_nl_query(query: str, language: str, db) -> tuple[SearchFilters, float]:
    """
    Parse a natural language query into structured SearchFilters.
    Uses Gemini with JSON mode, falls back to keyword extraction.
    Returns (filters, confidence_score).
    """
    settings = get_settings()

    if not settings.ai_available:
        logger.info("Gemini API key not configured, using keyword fallback")
        return _keyword_fallback(query), 0.4

    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(
            model_name=settings.gemini_model,
            system_instruction=SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )

        response = model.generate_content(f"Parse this hotel search query:\n\n\"{query}\"")

        # Extract JSON from response
        text = response.text.strip()
        parsed = json.loads(text)

        # Map to SearchFilters
        filters = SearchFilters(
            city=parsed.get("city"),
            star_min=parsed.get("star_min"),
            star_max=parsed.get("star_max"),
            price_min=parsed.get("price_min"),
            price_max=parsed.get("price_max"),
            property_type=parsed.get("property_type"),
            amenities=parsed.get("amenities", []),
            meal_preference=parsed.get("meal_preference"),
            distance_km=parsed.get("distance_km"),
            guest_score_min=parsed.get("guest_score_min"),
            sort_by=parsed.get("sort_by"),
            guests=parsed.get("guests"),
            quiet=parsed.get("quiet"),
            exclude_near=parsed.get("exclude_near"),
        )

        logger.info(f"Gemini parsed query '{query}' -> {filters.model_dump(exclude_none=True)}")
        return filters, 0.92

    except json.JSONDecodeError as e:
        logger.warning(f"Gemini returned invalid JSON: {e}, falling back to keywords")
        return _keyword_fallback(query), 0.4
    except Exception as e:
        logger.warning(f"Gemini API error: {e}, falling back to keywords")
        return _keyword_fallback(query), 0.4


# ── Keyword fallback ─────────────────────────────────────────────────

def _keyword_fallback(query: str) -> SearchFilters:
    """Simple regex-based keyword extraction as a fallback when AI is unavailable."""
    q = query.lower()
    filters = SearchFilters()

    # City extraction
    city_names = [
        "jaipur", "udaipur", "jodhpur", "jaisalmer", "agra", "new delhi", "delhi",
        "mumbai", "pune", "goa", "panaji", "bengaluru", "bangalore", "chennai",
        "hyderabad", "kolkata", "lucknow", "varanasi", "amritsar", "shimla",
        "manali", "rishikesh", "kochi", "munnar", "mysuru", "mysore", "gokarna",
        "bali", "dubai", "singapore", "bangkok", "darjeeling", "ooty", "nainital",
        "srinagar", "leh", "pondicherry", "madurai", "thanjavur", "alleppey",
        "wayanad", "hampi", "bhubaneswar", "puri", "gangtok", "shillong",
        "guwahati", "tirupati", "visakhapatnam", "ahmedabad", "bhuj",
        "aurangabad", "abu dhabi", "colombo", "kandy", "kathmandu",
        "kuala lumpur", "kyoto", "zurich", "doha", "male", "pokhara", "thimphu",
    ]
    for city in sorted(city_names, key=len, reverse=True):  # Longest match first
        if city in q:
            filters.city = city.title()
            break

    # Star rating
    star_match = re.search(r'(\d)\s*[-\u2011\u2013]?\s*star', q)
    if star_match:
        filters.star_min = int(star_match.group(1))

    star_range = re.search(r'(\d)\s*[-\u2011\u2013]\s*(\d)\s*star', q)
    if star_range:
        filters.star_min = int(star_range.group(1))
        filters.star_max = int(star_range.group(2))

    # Price
    price_match = re.search(r'(?:under|below|max|<|budget)\s*(?:rs\.?|\u20b9|inr)?\s*([\d,]+)', q)
    if price_match:
        filters.price_max = float(price_match.group(1).replace(",", ""))

    price_above = re.search(r'(?:above|over|min|>)\s*(?:rs\.?|\u20b9|inr)?\s*([\d,]+)', q)
    if price_above:
        filters.price_min = float(price_above.group(1).replace(",", ""))

    # Property type
    prop_types = ["boutique", "guesthouse", "homestay", "heritage", "resort", "hotel", "hostel", "apartment"]
    for pt in prop_types:
        if pt in q:
            filters.property_type = pt
            break

    # Amenities
    amenity_map = {
        "pool": "swimming_pool", "swimming pool": "swimming_pool",
        "infinity pool": "infinity_pool",
        "wifi": "free_wifi", "wi-fi": "free_wifi",
        "spa": "spa", "ayurvedic": "ayurvedic_spa",
        "gym": "gym", "fitness": "gym",
        "yoga": "yoga_deck",
        "restaurant": "restaurant",
        "parking": "free_parking", "ev charging": "ev_charging",
        "ac": "air_conditioning", "air condition": "air_conditioning",
        "breakfast": "breakfast_buffet",
        "beach": "beach_access", "near beach": "beach_access",
        "lake view": "lake_view", "mountain view": "mountain_view",
        "rooftop": "rooftop_bar",
        "kids": "kids_club", "family": "family_rooms",
        "accessible": "step_free_access", "wheelchair": "step_free_access",
    }
    for kw, code in amenity_map.items():
        if kw in q and code not in filters.amenities:
            filters.amenities.append(code)

    # Meal preference
    if any(w in q for w in ["pure veg", "vegetarian", "shakahari", "veg only"]):
        filters.meal_preference = "veg"
    elif "jain" in q:
        filters.meal_preference = "jain"
    elif "halal" in q:
        filters.meal_preference = "halal"

    # Quiet
    if any(w in q for w in ["quiet", "peaceful", "serene", "silent"]):
        filters.quiet = True

    # Sort
    if "cheapest" in q or "lowest price" in q:
        filters.sort_by = "price_asc"
    elif "best rated" in q or "top rated" in q or "highest rated" in q:
        filters.sort_by = "rating"
    elif "nearest" in q or "closest" in q:
        filters.sort_by = "distance"

    return filters
