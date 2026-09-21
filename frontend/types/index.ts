export interface AmenityItem {
  code: string;
  label: string;
  is_free?: boolean;
  note?: string | null;
}

export interface RatePlan {
  rate_plan_id: string;
  plan_type?: string;
  name: string;
  price_delta: number | string;
  currency?: string;
  includes_breakfast?: boolean;
  min_stay_nights?: number;
}

export interface RoomType {
  room_type_id: string;
  name: string;
  description?: string | null;
  capacity_adults: number;
  capacity_children: number;
  max_occupancy: number;
  bed_type?: string | null;
  room_view?: string | null;
  size_sqm?: number | null;
  base_rate: number;
  currency: string;
  has_ac: boolean;
  has_balcony: boolean;
  has_bathtub: boolean;
  smoking_allowed: boolean;
  amenities: AmenityItem[];
  available_inventory?: number;
  rate_plans?: RatePlan[];
}

export interface HotelMedia {
  media_id: string;
  media_type: string;
  media_role: string;
  file_path: string;
  caption?: string | null;
  sort_order: number;
}

export interface HotelPolicy {
  checkin_time?: string;
  checkout_time?: string;
  child_policy?: string | null;
  pet_policy?: string | null;
  extra_bed_policy?: string | null;
  extra_bed_charge?: number | null;
  payment_methods?: string | null;
  airport_pickup: boolean;
  early_checkin_possible: boolean;
  accessibility_notes?: string | null;
}

export interface MatchingMedia {
  media_id: string;
  caption: string;
  file_path?: string;
  media_role?: string;
  similarity?: number;
}

export interface VibeSearchItem {
  hotel_id: string;
  name: string;
  city_name: string;
  state?: string;
  property_type: string;
  star_rating: number;
  guest_score: number;
  review_count: number;
  address_line?: string;
  similarity_score: number;
  similarity_pct: number;
  matching_media: MatchingMedia[];
  matched_vibes: string[];
}

export interface HotelListItem {
  hotel_id: string;
  name: string;
  city_name: string;
  state: string;
  star_rating: number;
  property_type: string;
  guest_score: number;
  review_count: number;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  min_price: number;
  currency: string;
  hero_image?: string | null;
  amenities: AmenityItem[];
  vibe_match_pct?: number;
  vibe_match_label?: string;
  rooms_left_fomo?: number;
  vibe_similarity?: number;
  has_xr_scene?: boolean;
  matching_media?: MatchingMedia[];
  matched_vibes?: string[];
  final_score?: number;
  explainability?: string;
  personalization_rank?: number;
  score_breakdown?: ScoreBreakdown;
}

export interface HotelDetail extends HotelListItem {
  description?: string | null;
  address_line: string;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  checkin_time: string;
  checkout_time: string;
  total_rooms: number;
  policies?: HotelPolicy | null;
  room_types?: RoomType[];
  rooms?: RoomType[];
  media: HotelMedia[];
}

export interface HotelListResponse {
  total: number;
  page: number;
  page_size: number;
  items: HotelListItem[];
}

export interface SearchFilters {
  city?: string;
  check_in?: string;
  check_out?: string;
  guests?: number;
  star_min?: number;
  star_max?: number;
  price_min?: number;
  price_max?: number;
  property_type?: string;
  amenities?: string[];
  meal_preference?: string;
  distance_km?: number;
  guest_score_min?: number;
  sort_by?: string;
  quiet?: boolean;
  exclude_near?: string;
}

export interface SearchFilterChip {
  field: string;
  label: string;
  value: string | number | boolean;
}

export interface NLSearchResponse {
  query: string;
  language: string;
  filters: SearchFilters;
  parsed_chips: SearchFilterChip[];
  total_results: number;
  hotels: HotelListItem[];
}

export interface ConciergeQuery {
  hotel_id: string;
  question: string;
  conversation_history?: Array<{ question: string; answer: string }>;
}

export interface ConciergeResponse {
  answer: string;
  sources: string[];
  suggested_questions: string[];
}

export interface ReviewCitation {
  review_id: string;
  snippet: string;
}

export interface ReviewSummaryPoint {
  text: string;
  citations: ReviewCitation[];
}

export interface ReviewSummaryResponse {
  hotel_id: string;
  language: string;
  pros: ReviewSummaryPoint[];
  cons: ReviewSummaryPoint[];
  overall: string;
}

export interface PricingBreakdown {
  nights: number;
  rooms: number;
  base_rate_per_night: number;
  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  service_fee: number;
  total: number;
  currency: string;
}

export interface BookingRequest {
  user_id: string;
  hotel_id: string;
  room_type_id: string;
  check_in: string;
  check_out: string;
  num_rooms?: number;
  num_adults?: number;
  num_children?: number;
  special_requests?: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
}

export interface BookingResponse {
  booking_id: string;
  status: string;
  confirmation_code: string;
  hotel_id: string;
  hotel_name: string;
  room_name: string;
  check_in: string;
  check_out: string;
  num_rooms: number;
  num_adults: number;
  pricing: PricingBreakdown;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  created_at: string;
  total_amount?: string | number;
  tax_amount?: string | number;
  currency?: string;
  nights?: number;
}

export interface UserProfile {
  user_id: string;
  email: string;
  full_name: string;
  city: string;
  travel_style: string;
  budget_band: string;
  dietary_pref: string;
  accessibility_reqs: string;
  preferred_language: string;
}

export interface ItineraryActivity {
  time_slot: string;
  title: string;
  description: string;
  estimated_cost_inr: number;
  distance_from_hotel_km: number;
  category: string;
}

export interface ItineraryDay {
  day: number;
  theme: string;
  activities: ItineraryActivity[];
  dining_tip: string;
}

export interface ItineraryResponse {
  hotel_id: string;
  hotel_name: string;
  city_name: string;
  travel_style: string;
  days: ItineraryDay[];
  total_estimated_budget_inr: number;
  curator_note: string;
  ai_model: string;
}

export interface PricePoint {
  date: string;
  price: number;
  is_weekend: boolean;
  available_units: number;
}

export interface PriceTrendsResponse {
  hotel_id: string;
  hotel_name: string;
  currency: string;
  trend_data: PricePoint[];
  cheapest_date: string;
  cheapest_price: number;
  highest_date: string;
  highest_price: number;
  average_price: number;
  current_price: number;
  savings_vs_peak_pct: number;
  ai_insight: string;
}

export interface CurrencyItem {
  currency_id: string;
  iso4217: string;
  code?: string;
  name: string;
  symbol: string;
  exchange_rate_to_inr?: number;
  rate_to_inr: number;
  minor_unit_exponent: number;
  display_locale: string;
}

export interface StatutoryPricingBreakdown {
  subtotal: string;
  rate_plan_delta: string;
  tax_gst: string;
  total: string;
}

export interface PricingCalculateRequest {
  room_type_id: string;
  rate_plan_id?: string | null;
  target_currency: string;
  nights: number;
}

export interface PricingCalculateResponse {
  room_type_id: string;
  rate_plan_id?: string | null;
  room_name: string;
  rate_plan_name?: string | null;
  target_currency: string;
  currency_symbol: string;
  minor_unit_exponent: number;
  display_locale: string;
  exchange_rate_to_inr: string;
  nights: number;
  effective_nightly_rate_inr: string;
  gst_slab_pct: number;
  breakdown: StatutoryPricingBreakdown;
  formatted: StatutoryPricingBreakdown;
  apportionment_method: string;
}

export interface ItinerarySlot {
  time_slot: "morning" | "afternoon" | "evening";
  title: string;
  description: string;
  trip_id_ref: string;
}

export interface ItineraryDaySchedule {
  day: number;
  slots: ItinerarySlot[];
}

export interface CuratedItineraryResponse {
  hotel_id: string;
  city_name: string;
  travel_style: string;
  days: ItineraryDaySchedule[];
  contextual_transition?: string;
}

export interface PriceAnalyticsPoint {
  date: string;
  rate: number;
  rolling_avg: number;
  free_units: number;
}

export interface PriceAnalyticsResponse {
  hotel_id: string;
  room_type_name: string;
  currency: string;
  historical_trend: PriceAnalyticsPoint[];
  lowest_date: string;
  highest_date: string;
  price_recommendation: string;
  is_scarcity: boolean;
}

export interface WalkableLandmark {
  name: string;
  kind: string;
  distance_km: number;
  walk_time_minutes: number;
  lat?: number;
  lng?: number;
  description?: string;
}

export interface HotelProximityResponse {
  hotel_id: string;
  coordinates: { lat: number; lng: number };
  walkable_landmarks: WalkableLandmark[];
  walkability_score: number;
  isochrone_1_5km?: {
    type: "Polygon";
    coordinates: number[][][];
  };
  isochrone_5_0km?: {
    type: "Polygon";
    coordinates: number[][][];
  };
  transit_landmarks_5km?: WalkableLandmark[];
}

export interface HotelXRStatusResponse {
  hotel_id: string;
  has_xr_scene: boolean;
  scene_url: string;
  alt_text: string;
}

export interface PersonaInfo {
  user_id: string;
  name: string;
  label: string;
  segment: string;
  travel_style: string;
  budget_band: string;
  traveller_type: string;
  key_weights: Record<string, number>;
  avatar_color: string;
}

export interface ScoreBreakdown {
  filter_match: number;
  affinity: number;
  guest_score: number;
  proximity: number;
  final_score: number;
}

export interface RankedHotelItem extends HotelListItem {
  final_score: number;
  score_breakdown: ScoreBreakdown;
  explainability: string;
  personalization_rank: number;
}

export interface RankedSearchResponse {
  total: number;
  personalization_active: boolean;
  active_user?: PersonaInfo;
  items: RankedHotelItem[];
}

export interface FeasibilityRequest {
  arrival_time?: string | null;
  has_pets?: boolean;
  children_ages?: number[];
  adults_count?: number;
}

export interface FeasibilityRuleResult {
  parameter: string;
  status: "APPROVED" | "WARNING" | "DISQUALIFIED";
  hotel_rule: string;
  source_column: string;
}

export interface FeasibilityResponse {
  overall_feasible: boolean;
  verdict_summary: string;
  rules: FeasibilityRuleResult[];
}

export interface GroupSplitRequest {
  party_size: number;
}

export interface GroupSplitResponse {
  booking_id: string;
  total_amount: number;
  currency: string;
  per_person_share: number;
  upi_uri: string;
  whatsapp_share_text: string;
  whatsapp_share_url: string;
  party_size: number;
  shares: number[];
  hotel_name: string;
  booking_reference: string;
}

// ─── Visual Onboarding & Travel DNA Types ─────────────────────────────

export interface OnboardingImageItem {
  media_id: string;
  hotel_id: string;
  hotel_name: string;
  city_name: string;
  property_type: string;
  star_rating: number;
  alt_text: string;
  caption: string;
  vibe_hint: string;
  file_path: string;
  image_url: string;
  description?: string;
}

export interface OnboardingImagesResponse {
  count: number;
  items: OnboardingImageItem[];
}

export interface SwipedImagePayload {
  media_id: string;
  hotel_id: string;
  alt_text?: string;
  caption?: string;
  property_type?: string;
}

export interface PreferencesSubmissionRequest {
  user_id: string;
  liked_images: SwipedImagePayload[];
  total_swiped: number;
}

export interface PreferencesSubmissionResponse {
  status: string;
  user_id: string;
  top_vibe: string;
  affinity_vector: Record<string, number>;
  dominant_category?: string;
  matched_keywords?: Record<string, string[]>;
  message: string;
}

export interface UserPreferencesData {
  user_id: string;
  top_vibe: string;
  affinity_vector: Record<string, number>;
  swiped_count: number;
  updated_at: string;
}

// ─── WebAuthn Biometric Passkey Types ──────────────────────────────────

export interface PasskeyRegistrationOptionsResponse {
  options: any;
  user_id: string;
  username: string;
}

export interface QuickPasskeyLoginResponse {
  verified: boolean;
  user_id: string;
  username: string;
  display_name: string;
  is_new_user: boolean;
  credential_id: string;
  message: string;
}

// ─── Limit-Order Yield Arbitrage Types ─────────────────────────────────

export interface ProbabilityCurvePoint {
  discount_pct: number;
  target_price: number;
  fill_probability: number;
  fill_probability_pct: number;
  is_eligible: boolean;
}

export interface ArbitrageQuoteResponse {
  hotel_id: string;
  room_type_id: string;
  room_name: string;
  for_date: string;
  base_rate: number;
  currency: string;
  total_units: number;
  booked_units: number;
  held_units: number;
  unsold_units: number;
  fill_rate: number;
  days_until_checkin: number;
  time_decay_factor: number;
  cancellation_policy: string;
  cancellation_rate_prob: number;
  base_drop_probability: number;
  base_drop_probability_pct: number;
  recommended_target_price: number;
  recommended_discount_pct: number;
  recommended_fill_probability: number;
  probability_curve: ProbabilityCurvePoint[];
}

export interface ArbitrageOrderRequest {
  room_type_id: string;
  user_id?: string;
  for_date: string;
  target_price: number;
  target_currency?: string;
}

export interface ArbitrageOrderResponse {
  success: boolean;
  eligible: boolean;
  order_id?: string;
  status?: string;
  hotel_id: string;
  room_type_id: string;
  room_name?: string;
  for_date: string;
  base_rate: number;
  target_price: number;
  discount_pct: number;
  fill_probability: number;
  fill_probability_pct: number;
  upi_mandate_id?: string;
  upi_mandate_uri?: string;
  created_at?: string;
  message: string;
}

export interface SolarPoint {
  azimuth: number;
  altitude: number;
  hour_str: string;
}

export interface AcousticInfo {
  nearest_landmark_name: string;
  kind: string;
  distance_km: number;
  bearing_degrees: number;
  direction: string;
  estimated_decibels: number;
}

export interface RoomOptimizerResponse {
  hotel_id: string;
  hotel_name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  date: string;
  solar: {
    morning_8am: SolarPoint;
    evening_5pm: SolarPoint;
    trajectory: SolarPoint[];
  };
  acoustic: AcousticInfo;
  optimal_facing: string;
  sunlight_time: string;
  noise_shielding: boolean;
  recommendation_text: string;
}

export interface SquadMember {
  user_id: string;
  display_name: string;
  budget_band?: string;
  travel_style?: string;
  traveller_type?: string;
  vector: Record<string, number>;
  satisfaction_pct?: number;
}

export interface AxisScore {
  axis: string;
  group_avg: number;
  hotel_offering: number;
  alignment_pct: number;
}

export interface GroupConsensusResponse {
  hotel_id: string;
  hotel_name: string;
  property_type: string;
  axes: string[];
  group_centroid: Record<string, number>;
  hotel_features: Record<string, number>;
  users: SquadMember[];
  axis_scores: AxisScore[];
  group_consensus_score: number;
  consensus_badge: string;
  compromise_summary: string;
  recommendation_text: string;
}




