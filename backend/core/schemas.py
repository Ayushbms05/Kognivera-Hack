"""
Pydantic models for strict request/response validation across the entire API.

All money fields use `str` to avoid floating-point issues (frontend uses decimal.js).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════════
#  HOTELS
# ═══════════════════════════════════════════════════════════════════════

class AmenityItem(BaseModel):
    amenity_id: str
    code: str
    label: str
    group: str
    is_free: bool = True
    note: Optional[str] = None


class MediaItem(BaseModel):
    media_id: str
    role: str
    file_path: str
    alt_text: str
    width_px: int
    height_px: int
    sort_order: int


class PolicyInfo(BaseModel):
    child_policy: Optional[str] = None
    pet_policy: Optional[str] = None
    extra_bed_policy: Optional[str] = None
    extra_bed_charge: Optional[str] = None
    extra_bed_currency: Optional[str] = None
    payment_methods: Optional[str] = None
    airport_pickup: bool = False
    early_checkin_possible: bool = False
    accessibility_notes: Optional[str] = None


class RatePlan(BaseModel):
    rate_plan_id: str
    plan_type: str
    name: str
    price_delta: str
    currency: str
    cancellation_window_hours: int
    cancellation_penalty_pct: int
    includes_breakfast: bool
    min_stay_nights: int


class RoomType(BaseModel):
    room_type_id: str
    hotel_id: str
    name: str
    max_occupancy: int
    max_adults: int
    max_children: int
    bed_config: str
    size_sqm: Optional[int] = None
    base_rate: str
    currency: str
    total_units: int
    smoking_allowed: bool
    status: str
    rate_plans: list[RatePlan] = []


class HotelListItem(BaseModel):
    """Compact hotel for search results / cards."""
    hotel_id: str
    city_id: str
    city_name: str = ""
    state: Optional[str] = None
    name: str
    property_type: str
    star_rating: int
    guest_score: Optional[float] = None
    review_count: int
    address_line: str
    lat: float
    lng: float
    distance_to_centre_km: float
    description: str
    base_currency: str
    checkin_time: str
    checkout_time: str
    hero_image: Optional[str] = None
    min_price: Optional[str] = None
    min_price_currency: Optional[str] = None
    amenities: list[AmenityItem] = []
    # Wow-factor fields
    vibe_match_pct: Optional[int] = None
    vibe_match_label: Optional[str] = None
    rooms_left: Optional[int] = None
    fomo_active: bool = False
    has_xr_scene: bool = False


class HotelDetail(HotelListItem):
    """Full hotel for the detail page."""
    chain_code: Optional[str] = None
    status: str = "active"
    media: list[MediaItem] = []
    room_types: list[RoomType] = []
    policies: Optional[PolicyInfo] = None


# ═══════════════════════════════════════════════════════════════════════
#  REVIEWS
# ═══════════════════════════════════════════════════════════════════════

class ReviewItem(BaseModel):
    review_id: str
    hotel_id: str
    user_id: int | str
    rating: int
    title: Optional[str] = None
    body: str
    language: str
    traveller_type: str
    stay_date: Optional[str] = None
    helpful_votes: int = 0
    has_photo: bool = False
    sentiment_hint: Optional[float] = None


class ReviewCitation(BaseModel):
    """A single cited review in a summary."""
    review_id: str
    snippet: str  # Short excerpt from the original review


class ReviewSummaryPoint(BaseModel):
    """One pro or con with citations."""
    text: str
    citations: list[ReviewCitation] = []


class ReviewSummaryResponse(BaseModel):
    hotel_id: str
    language: str  # Language the summary was generated in
    pros: list[ReviewSummaryPoint] = []
    cons: list[ReviewSummaryPoint] = []
    overall: str = ""  # One-line overall impression


class ReviewSummariseRequest(BaseModel):
    hotel_id: str
    language: str = "en-IN"


# ═══════════════════════════════════════════════════════════════════════
#  SEARCH
# ═══════════════════════════════════════════════════════════════════════

class SearchFilters(BaseModel):
    """Structured filters parsed from a natural language query."""
    city: Optional[str] = None
    city_id: Optional[str] = None
    star_min: Optional[int] = Field(None, ge=1, le=5)
    star_max: Optional[int] = Field(None, ge=1, le=5)
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    property_type: Optional[str] = None
    amenities: list[str] = []
    meal_preference: Optional[str] = None  # veg, jain, halal
    distance_km: Optional[float] = None
    guest_score_min: Optional[float] = None
    sort_by: Optional[str] = None  # relevance, price_asc, price_desc, rating, distance
    checkin_date: Optional[str] = None
    checkout_date: Optional[str] = None
    guests: Optional[int] = None
    quiet: Optional[bool] = None
    exclude_near: Optional[str] = None


class NLSearchRequest(BaseModel):
    query: str
    language: Optional[str] = "en-IN"
    user_id: Optional[str] = None


class NLSearchResponse(BaseModel):
    filters: SearchFilters
    chips: list[dict] = []  # { label, type, value, removable }
    parsed_chips: list[dict] = []
    original_query: str
    confidence: float = 0.0
    hotels: list[HotelListItem] = []
    total_results: int = 0


# ═══════════════════════════════════════════════════════════════════════
#  INVENTORY / AVAILABILITY
# ═══════════════════════════════════════════════════════════════════════

class InventorySlot(BaseModel):
    inventory_id: str
    entity_type: str
    entity_id: str
    for_date: str
    total_units: int
    booked_units: int
    held_units: int
    available_units: int = 0
    price: str
    currency: str
    min_stay_nights: int
    closed_to_arrival: bool


class AvailabilityResponse(BaseModel):
    hotel_id: str
    room_type_id: str
    slots: list[InventorySlot] = []
    min_available: int = 0  # Min available across the date range
    is_scarce: bool = False  # True if min_available <= 3


# ═══════════════════════════════════════════════════════════════════════
#  BOOKINGS
# ═══════════════════════════════════════════════════════════════════════

class BookingCreate(BaseModel):
    user_id: str
    hotel_id: str
    room_type_id: str
    rate_plan_id: Optional[str] = None
    checkin_date: Optional[str] = None
    checkout_date: Optional[str] = None
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    guests: Optional[int] = None
    num_rooms: Optional[int] = 1
    num_adults: Optional[int] = 2
    num_children: Optional[int] = 0
    guest_name: str
    guest_email: str
    guest_phone: Optional[str] = None
    special_requests: Optional[str] = None


class BookingConfirmation(BaseModel):
    booking_id: str
    booking_reference: str  # 6-char alphanumeric
    confirmation_code: Optional[str] = None
    hotel_name: str
    hotel_id: str
    room_type_name: str
    room_name: Optional[str] = None
    checkin_date: str
    checkout_date: str
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    nights: int
    guests: int
    num_rooms: Optional[int] = 1
    num_adults: Optional[int] = 2
    total_amount: str
    tax_amount: str
    currency: str
    status: str
    confirmed_at: Optional[str] = None
    cancellation_policy: Optional[str] = None
    whatsapp_share_url: str = ""
    pricing: Optional[dict] = None
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None


class GroupSplitRequest(BaseModel):
    party_size: int = Field(default=2, ge=2, le=20)


class GroupSplitResponse(BaseModel):
    booking_id: str
    total_amount: float
    currency: str
    per_person_share: float
    upi_uri: str
    whatsapp_share_text: str
    whatsapp_share_url: str = ""
    party_size: int
    shares: list[float] = []
    hotel_name: str = ""
    booking_reference: str = ""


# ═══════════════════════════════════════════════════════════════════════
#  USERS
# ═══════════════════════════════════════════════════════════════════════

class UserProfile(BaseModel):
    user_id: str
    display_name: str
    email: str
    home_city_id: str
    home_currency: str
    locale: str
    budget_band: str
    travel_style: str
    traveller_type: str
    segment: str
    loyalty_tier: Optional[str] = None


class AffinityScore(BaseModel):
    hotel_id: str
    score: float  # 0.0 - 1.0
    match_pct: int  # 0 - 100
    label: str  # "94% Match for your Adventure style"
    factors: list[str] = []  # Explanation of why


# ═══════════════════════════════════════════════════════════════════════
#  CONCIERGE
# ═══════════════════════════════════════════════════════════════════════

class ConciergeQuery(BaseModel):
    hotel_id: str
    question: str
    language: str = "en-IN"
    conversation_history: list[dict] = []  # Previous Q&A turns


class ConciergeResponse(BaseModel):
    answer: str
    sources: list[str] = []  # Which policy/amenity fields were used
    suggested_questions: list[str] = []


# ═══════════════════════════════════════════════════════════════════════
#  CITIES
# ═══════════════════════════════════════════════════════════════════════

class CityItem(BaseModel):
    city_id: str
    name: str
    state: Optional[str] = None
    country_code: str
    lat: float
    lng: float
    region: Optional[str] = None
    description: Optional[str] = None
    hotel_count: int = 0


# ═══════════════════════════════════════════════════════════════════════
#  GENERIC
# ═══════════════════════════════════════════════════════════════════════

class PaginatedResponse(BaseModel):
    """Wrapper for paginated list endpoints."""
    items: list = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    has_next: bool = False


# ═══════════════════════════════════════════════════════════════════════
#  AI ITINERARY
# ═══════════════════════════════════════════════════════════════════════

class ItineraryActivity(BaseModel):
    time_slot: str  # e.g., "09:00 - 12:00"
    title: str
    description: str
    estimated_cost_inr: int
    distance_from_hotel_km: float
    category: str  # "culture", "food", "nature", "shopping", "relaxation"


class ItineraryDay(BaseModel):
    day: int
    theme: str
    activities: list[ItineraryActivity] = []
    dining_tip: str


class ItineraryResponse(BaseModel):
    hotel_id: str
    hotel_name: str
    city_name: str
    travel_style: str
    days: list[ItineraryDay] = []
    total_estimated_budget_inr: int
    curator_note: str
    ai_model: str = "gemini-3.6-flash"


class ItineraryGenerateRequest(BaseModel):
    hotel_id: str
    user_id: Optional[str] = "usr_6afe5712"
    travel_style: Optional[str] = None
    days: int = 3


# ═══════════════════════════════════════════════════════════════════════
#  PRICE TRENDS
# ═══════════════════════════════════════════════════════════════════════

class PricePoint(BaseModel):
    date: str  # YYYY-MM-DD
    price: float
    is_weekend: bool = False
    available_units: int = 4


class PriceTrendsResponse(BaseModel):
    hotel_id: str
    hotel_name: str
    currency: str = "INR"
    trend_data: list[PricePoint] = []
    cheapest_date: str
    cheapest_price: float
    highest_date: str
    highest_price: float
    average_price: float
    current_price: float
    savings_vs_peak_pct: int
    ai_insight: str


# ═══════════════════════════════════════════════════════════════════════
#  CURRENCIES
# ═══════════════════════════════════════════════════════════════════════

class CurrencyItem(BaseModel):
    currency_id: str
    iso4217: str
    code: str
    name: str
    symbol: str
    exchange_rate_to_inr: float
    rate_to_inr: float
    minor_unit_exponent: int
    display_locale: str


class CurrenciesListResponse(BaseModel):
    base_currency: str = "INR"
    currencies: list[CurrencyItem] = []


# ═══════════════════════════════════════════════════════════════════════
#  PRICING ENGINE & STATUTORY GST APPORTIONMENT
# ═══════════════════════════════════════════════════════════════════════

class PricingCalculateRequest(BaseModel):
    room_type_id: str
    rate_plan_id: Optional[str] = None
    target_currency: str = "INR"
    nights: int = 1


class PricingBreakdown(BaseModel):
    subtotal: str
    rate_plan_delta: str
    tax_gst: str
    total: str


class PricingCalculateResponse(BaseModel):
    room_type_id: str
    rate_plan_id: Optional[str] = None
    room_name: str
    rate_plan_name: Optional[str] = None
    target_currency: str
    currency_symbol: str
    minor_unit_exponent: int
    display_locale: str
    exchange_rate_to_inr: str
    nights: int
    effective_nightly_rate_inr: str
    gst_slab_pct: int
    breakdown: PricingBreakdown
    formatted: PricingBreakdown
    apportionment_method: str = "largest_remainder"


# ═══════════════════════════════════════════════════════════════════════
#  VISUAL VIBE SEARCH (TF-IDF & VISION NLP)
# ═══════════════════════════════════════════════════════════════════════

class MatchingMediaItem(BaseModel):
    media_id: str
    caption: str
    file_path: Optional[str] = None
    media_role: Optional[str] = None
    similarity: Optional[float] = None


class VibeSearchItem(BaseModel):
    hotel_id: str
    name: str
    city_name: str
    state: Optional[str] = None
    property_type: str
    star_rating: Optional[float] = 4.0
    guest_score: Optional[float] = 8.5
    review_count: Optional[int] = 0
    address_line: Optional[str] = None
    similarity_score: float
    similarity_pct: int
    matching_media: list[MatchingMediaItem] = []
    matched_vibes: list[str] = []


class VibeSearchRequest(BaseModel):
    query_text: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════
#  360° DIGITAL TWIN / XR STATUS
# ═══════════════════════════════════════════════════════════════════════

class HotelXRStatusResponse(BaseModel):
    hotel_id: str
    has_xr_scene: bool
    scene_url: str
    alt_text: str


# ═══════════════════════════════════════════════════════════════════════
#  LIVE PERSONA SWITCHER & RE-RANKING
# ═══════════════════════════════════════════════════════════════════════

class PersonaInfo(BaseModel):
    user_id: str
    name: str
    label: str
    segment: str
    travel_style: str
    budget_band: str
    traveller_type: str
    key_weights: dict[str, float] = {}
    avatar_color: str = "amber"


class ScoreBreakdown(BaseModel):
    filter_match: float
    affinity: float
    guest_score: float
    proximity: float
    final_score: float


class RankedHotelItem(HotelListItem):
    final_score: float
    score_breakdown: ScoreBreakdown
    explainability: str
    personalization_rank: int


class RankedSearchResponse(BaseModel):
    total: int
    personalization_active: bool
    active_user: Optional[PersonaInfo] = None
    items: list[RankedHotelItem] = []


# ═══════════════════════════════════════════════════════════════════════
#  EDGE-CASE POLICY SIMULATOR
# ═══════════════════════════════════════════════════════════════════════

class FeasibilityRequest(BaseModel):
    arrival_time: Optional[str] = None
    has_pets: bool = False
    children_ages: list[int] = []
    adults_count: int = 2


class FeasibilityRuleResult(BaseModel):
    parameter: str
    status: str  # "APPROVED" | "WARNING" | "DISQUALIFIED"
    hotel_rule: str
    source_column: str


class FeasibilityResponse(BaseModel):
    overall_feasible: bool
    verdict_summary: str
    rules: list[FeasibilityRuleResult] = []




