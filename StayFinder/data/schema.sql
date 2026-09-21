-- KV Hackathon 2026 · travel data model v1.1.0-rc1
-- Only the 21 tables this problem statement needs.

CREATE EXTENSION IF NOT EXISTS vector;   -- optional, for embedding search

-- amenities  (Reference & geography)
CREATE TABLE amenities (
  amenity_id                   TEXT PRIMARY KEY,
  code                         TEXT NOT NULL UNIQUE,
  label                        TEXT NOT NULL,
  amenity_group                TEXT NOT NULL CHECK (amenity_group IN ('connectivity', 'wellness', 'food_beverage', 'family', 'accessibility', 'transport', 'business', 'outdoor')),
  icon_hint                    TEXT,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- currencies  (Reference & geography)
CREATE TABLE currencies (
  currency_id                  TEXT PRIMARY KEY,
  iso4217                      CHAR(3) NOT NULL UNIQUE,
  name                         TEXT NOT NULL,
  symbol                       TEXT NOT NULL,
  minor_unit_exponent          SMALLINT NOT NULL,
  display_locale               TEXT NOT NULL,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- inventory_calendar  (Availability & pricing)
CREATE TABLE inventory_calendar (
  inventory_id                 TEXT PRIMARY KEY,
  entity_type                  TEXT NOT NULL CHECK (entity_type IN ('room_type', 'flight_fare', 'guide', 'poi')),
  entity_id                    TEXT NOT NULL,
  for_date                     DATE NOT NULL,
  total_units                  INTEGER NOT NULL,
  booked_units                 INTEGER NOT NULL,
  held_units                   INTEGER NOT NULL,
  price                        NUMERIC(12,2) NOT NULL,
  currency                     CHAR(3) NOT NULL,
  min_stay_nights              SMALLINT NOT NULL,
  closed_to_arrival            BOOLEAN NOT NULL,
  updated_at                   TIMESTAMPTZ NOT NULL,
  UNIQUE (entity_type, entity_id, for_date),
  CHECK (booked_units + held_units <= total_units)
);

-- languages  (Reference & geography)
CREATE TABLE languages (
  language_id                  TEXT PRIMARY KEY,
  bcp47                        TEXT NOT NULL UNIQUE,
  english_name                 TEXT NOT NULL,
  native_name                  TEXT NOT NULL,
  script                       TEXT NOT NULL,
  rtl                          BOOLEAN NOT NULL,
  tts_supported                BOOLEAN NOT NULL,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- countries  (Reference & geography)
CREATE TABLE countries (
  country_id                   TEXT PRIMARY KEY,
  iso2                         CHAR(2) NOT NULL UNIQUE,
  iso3                         CHAR(3) NOT NULL UNIQUE,
  name                         TEXT NOT NULL,
  default_currency             CHAR(3) NOT NULL,
  calling_code                 TEXT NOT NULL,
  region                       TEXT NOT NULL,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- cities  (Reference & geography)
CREATE TABLE cities (
  city_id                      TEXT PRIMARY KEY,
  name                         TEXT NOT NULL,
  state                        TEXT,
  country_id                   TEXT NOT NULL,
  country_code                 CHAR(2) NOT NULL,
  lat                          NUMERIC(9,6) NOT NULL,
  lng                          NUMERIC(9,6) NOT NULL,
  timezone                     TEXT NOT NULL,
  region                       TEXT NOT NULL,
  population                   INTEGER,
  season_profile               TEXT NOT NULL CHECK (season_profile IN ('winter', 'summer', 'monsoon', 'post_monsoon', 'spring', 'autumn')),
  peak_months                  TEXT NOT NULL,
  primary_language             TEXT NOT NULL,
  description                  TEXT,
  status                       TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'archived', 'draft')),
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- eval_nl_search_set  (Signals & evaluation)
CREATE TABLE eval_nl_search_set (
  case_id                      TEXT PRIMARY KEY,
  utterance                    TEXT NOT NULL,
  language                     TEXT NOT NULL,
  expected_city_id             TEXT,
  expected_filters_json        TEXT NOT NULL,
  expected_sort                TEXT NOT NULL,
  difficulty                   TEXT NOT NULL,
  has_negation                 BOOLEAN NOT NULL,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- hotels  (Supply & catalogue)
CREATE TABLE hotels (
  hotel_id                     TEXT PRIMARY KEY,
  city_id                      TEXT NOT NULL,
  name                         TEXT NOT NULL,
  property_type                TEXT NOT NULL CHECK (property_type IN ('hotel', 'resort', 'homestay', 'hostel', 'apartment', 'boutique', 'heritage', 'guesthouse')),
  star_rating                  SMALLINT NOT NULL,
  guest_score                  NUMERIC(2,1),
  review_count                 INTEGER NOT NULL,
  address_line                 TEXT NOT NULL,
  lat                          NUMERIC(9,6) NOT NULL,
  lng                          NUMERIC(9,6) NOT NULL,
  distance_to_centre_km        NUMERIC(6,2) NOT NULL,
  description                  TEXT NOT NULL,
  base_currency                CHAR(3) NOT NULL,
  checkin_time                 TEXT NOT NULL,
  checkout_time                TEXT NOT NULL,
  chain_code                   TEXT,
  has_xr_scene                 BOOLEAN NOT NULL,
  status                       TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'archived', 'draft')),
  created_at                   TIMESTAMPTZ NOT NULL,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- users  (Identity & preference)
CREATE TABLE users (
  user_id                      TEXT PRIMARY KEY,
  display_name                 TEXT NOT NULL,
  email                        TEXT NOT NULL UNIQUE,
  home_city_id                 TEXT NOT NULL,
  home_currency                CHAR(3) NOT NULL,
  locale                       TEXT NOT NULL,
  budget_band                  TEXT NOT NULL CHECK (budget_band IN ('shoestring', 'value', 'mid', 'premium', 'luxury')),
  travel_style                 TEXT NOT NULL CHECK (travel_style IN ('budget', 'comfort', 'luxury', 'adventure', 'slow', 'cultural', 'wellness')),
  traveller_type               TEXT NOT NULL CHECK (traveller_type IN ('solo', 'couple', 'family', 'business', 'friends', 'senior', 'backpacker')),
  segment                      TEXT NOT NULL CHECK (segment IN ('heavy', 'light', 'cold_start')),
  date_of_signup               DATE NOT NULL,
  loyalty_tier                 TEXT,
  status                       TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'archived', 'draft')),
  created_at                   TIMESTAMPTZ NOT NULL,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- eval_queries  (Signals & evaluation)
CREATE TABLE eval_queries (
  query_id                     TEXT PRIMARY KEY,
  query_text                   TEXT NOT NULL,
  language                     TEXT NOT NULL,
  intent                       TEXT NOT NULL CHECK (intent IN ('budget_stay', 'family_stay', 'luxury_stay', 'heritage_poi', 'nature_poi', 'food_poi', 'adventure_package', 'honeymoon_package', 'accessibility', 'pet_friendly')),
  target_entity_type           TEXT NOT NULL CHECK (target_entity_type IN ('hotel', 'room_type', 'rate_plan', 'flight', 'flight_fare', 'poi', 'package', 'package_component', 'guide', 'transfer', 'event', 'xr_scene')),
  city_id                      TEXT,
  persona_user_id              TEXT,
  filters_json                 TEXT NOT NULL,
  k                            SMALLINT NOT NULL,
  notes                        TEXT,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- hotel_amenities  (Supply & catalogue)
CREATE TABLE hotel_amenities (
  hotel_amenity_id             TEXT PRIMARY KEY,
  hotel_id                     TEXT NOT NULL,
  amenity_id                   TEXT NOT NULL,
  is_free                      BOOLEAN NOT NULL,
  note                         TEXT,
  updated_at                   TIMESTAMPTZ NOT NULL,
  UNIQUE (hotel_id, amenity_id)
);

-- hotel_policies  (Supply & catalogue)
CREATE TABLE hotel_policies (
  policy_id                    TEXT PRIMARY KEY,
  hotel_id                     TEXT NOT NULL UNIQUE,
  child_policy                 TEXT NOT NULL,
  pet_policy                   TEXT NOT NULL,
  extra_bed_policy             TEXT NOT NULL,
  extra_bed_charge             NUMERIC(12,2),
  extra_bed_currency           CHAR(3),
  payment_methods              TEXT NOT NULL,
  airport_pickup               BOOLEAN NOT NULL,
  early_checkin_possible       BOOLEAN NOT NULL,
  accessibility_notes          TEXT,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- hotel_room_types  (Supply & catalogue)
CREATE TABLE hotel_room_types (
  room_type_id                 TEXT PRIMARY KEY,
  hotel_id                     TEXT NOT NULL,
  name                         TEXT NOT NULL,
  max_occupancy                SMALLINT NOT NULL,
  max_adults                   SMALLINT NOT NULL,
  max_children                 SMALLINT NOT NULL,
  bed_config                   TEXT NOT NULL CHECK (bed_config IN ('single', 'twin', 'double', 'queen', 'king', 'bunk', 'twin_double')),
  size_sqm                     SMALLINT,
  base_rate                    NUMERIC(12,2) NOT NULL,
  currency                     CHAR(3) NOT NULL,
  total_units                  INTEGER NOT NULL,
  smoking_allowed              BOOLEAN NOT NULL,
  status                       TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'archived', 'draft')),
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- trips  (Trip & itinerary)
CREATE TABLE trips (
  trip_id                      TEXT PRIMARY KEY,
  owner_user_id                TEXT NOT NULL,
  title                        TEXT NOT NULL,
  origin_city_id               TEXT,
  destination_city_id          TEXT NOT NULL,
  start_date                   DATE NOT NULL,
  end_date                     DATE NOT NULL,
  party_size                   SMALLINT NOT NULL,
  adults                       SMALLINT NOT NULL,
  children                     SMALLINT NOT NULL,
  trip_type                    TEXT NOT NULL CHECK (trip_type IN ('solo', 'couple', 'family', 'business', 'friends', 'senior', 'backpacker')),
  is_group_trip                BOOLEAN NOT NULL,
  status                       TEXT NOT NULL CHECK (status IN ('draft', 'planning', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  home_currency                CHAR(3) NOT NULL,
  notes                        TEXT,
  created_at                   TIMESTAMPTZ NOT NULL,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- user_interactions  (Signals & evaluation)
CREATE TABLE user_interactions (
  interaction_id               TEXT PRIMARY KEY,
  user_id                      TEXT NOT NULL,
  entity_type                  TEXT NOT NULL CHECK (entity_type IN ('hotel', 'room_type', 'rate_plan', 'flight', 'flight_fare', 'poi', 'package', 'package_component', 'guide', 'transfer', 'event', 'xr_scene')),
  entity_id                    TEXT NOT NULL,
  interaction_type             TEXT NOT NULL CHECK (interaction_type IN ('view', 'click', 'like', 'save', 'book', 'dismiss', 'share', 'search')),
  occurred_at                  TIMESTAMPTZ NOT NULL,
  dwell_seconds                INTEGER,
  position_in_list             SMALLINT,
  query_text                   TEXT,
  query_language               TEXT,
  channel                      TEXT NOT NULL CHECK (channel IN ('web', 'mobile_app', 'partner', 'call_centre', 'agent')),
  session_id                   TEXT NOT NULL,
  implicit_rating              NUMERIC(3,2)
);

-- hotel_media  (Supply & catalogue)
CREATE TABLE hotel_media (
  media_id                     TEXT PRIMARY KEY,
  hotel_id                     TEXT NOT NULL,
  room_type_id                 TEXT,
  media_role                   TEXT NOT NULL CHECK (media_role IN ('hero', 'room', 'lobby', 'exterior', 'dining', 'pool', 'bathroom', 'view', 'landmark', 'menu', 'sign', 'receipt')),
  file_path                    TEXT NOT NULL,
  alt_text                     TEXT NOT NULL,
  width_px                     INTEGER NOT NULL,
  height_px                    INTEGER NOT NULL,
  sort_order                   SMALLINT NOT NULL,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- hotel_rate_plans  (Supply & catalogue)
CREATE TABLE hotel_rate_plans (
  rate_plan_id                 TEXT PRIMARY KEY,
  room_type_id                 TEXT NOT NULL,
  plan_type                    TEXT NOT NULL CHECK (plan_type IN ('refundable', 'non_refundable', 'breakfast_included', 'half_board', 'full_board', 'long_stay')),
  name                         TEXT NOT NULL,
  price_delta                  NUMERIC(12,2) NOT NULL,
  currency                     CHAR(3) NOT NULL,
  cancellation_window_hours    INTEGER NOT NULL,
  cancellation_penalty_pct     SMALLINT NOT NULL,
  includes_breakfast           BOOLEAN NOT NULL,
  min_stay_nights              SMALLINT NOT NULL,
  status                       TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'archived', 'draft')),
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- hotel_reviews  (Supply & catalogue)
CREATE TABLE hotel_reviews (
  review_id                    TEXT PRIMARY KEY,
  hotel_id                     TEXT NOT NULL,
  user_id                      TEXT,
  rating                       SMALLINT NOT NULL,
  title                        TEXT,
  body                         TEXT NOT NULL,
  language                     TEXT NOT NULL,
  traveller_type               TEXT NOT NULL CHECK (traveller_type IN ('solo', 'couple', 'family', 'business', 'friends', 'senior', 'backpacker')),
  stay_date                    DATE NOT NULL,
  room_type_id                 TEXT,
  helpful_votes                INTEGER NOT NULL,
  has_photo                    BOOLEAN NOT NULL,
  sentiment_hint               NUMERIC(3,2),
  created_at                   TIMESTAMPTZ NOT NULL,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- itineraries  (Trip & itinerary)
CREATE TABLE itineraries (
  itinerary_id                 TEXT PRIMARY KEY,
  trip_id                      TEXT NOT NULL,
  name                         TEXT NOT NULL,
  version                      INTEGER NOT NULL,
  is_active                    BOOLEAN NOT NULL,
  generated_by                 TEXT NOT NULL CHECK (generated_by IN ('user', 'ai_planner', 'optimizer', 'agent', 'vote', 'import')),
  total_cost                   NUMERIC(12,2) NOT NULL,
  currency                     CHAR(3) NOT NULL,
  total_duration_minutes       INTEGER NOT NULL,
  total_carbon_kg              NUMERIC(10,3) NOT NULL,
  optimizer_weights            TEXT,
  status                       TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'archived', 'draft')),
  created_at                   TIMESTAMPTZ NOT NULL,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- bookings  (Booking & money)
CREATE TABLE bookings (
  booking_id                   TEXT PRIMARY KEY,
  user_id                      TEXT NOT NULL,
  trip_id                      TEXT,
  itinerary_id                 TEXT,
  booking_reference            TEXT NOT NULL UNIQUE,
  channel                      TEXT NOT NULL CHECK (channel IN ('web', 'mobile_app', 'partner', 'call_centre', 'agent')),
  total_amount                 NUMERIC(12,2) NOT NULL,
  currency                     CHAR(3) NOT NULL,
  tax_amount                   NUMERIC(12,2) NOT NULL,
  idempotency_key              TEXT NOT NULL UNIQUE,
  status                       TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'partially_confirmed', 'cancelled', 'failed', 'refunded')),
  confirmed_at                 TIMESTAMPTZ,
  cancelled_at                 TIMESTAMPTZ,
  cancellation_reason          TEXT,
  created_at                   TIMESTAMPTZ NOT NULL,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- payments  (Booking & money)
CREATE TABLE payments (
  payment_id                   TEXT PRIMARY KEY,
  booking_id                   TEXT NOT NULL,
  method                       TEXT NOT NULL CHECK (method IN ('card', 'upi', 'netbanking', 'wallet', 'mock')),
  status                       TEXT NOT NULL CHECK (status IN ('initiated', 'authorised', 'captured', 'failed', 'refunded', 'voided')),
  authorised_amount            NUMERIC(12,2) NOT NULL,
  captured_amount              NUMERIC(12,2) NOT NULL,
  refunded_amount              NUMERIC(12,2) NOT NULL,
  currency                     CHAR(3) NOT NULL,
  gateway_reference            TEXT NOT NULL,
  idempotency_key              TEXT NOT NULL UNIQUE,
  failure_code                 TEXT CHECK (failure_code IN ('hold_expired', 'sold_out', 'over_budget', 'invalid_id', 'currency_mismatch', 'idempotency_conflict', 'constraint_infeasible', 'low_confidence')),
  authorised_at                TIMESTAMPTZ,
  captured_at                  TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL,
  updated_at                   TIMESTAMPTZ NOT NULL
);

-- foreign keys
ALTER TABLE inventory_calendar ADD CONSTRAINT fk_inventory_calendar_currency FOREIGN KEY (currency) REFERENCES currencies(iso4217);
ALTER TABLE countries ADD CONSTRAINT fk_countries_default_currency FOREIGN KEY (default_currency) REFERENCES currencies(iso4217);
ALTER TABLE cities ADD CONSTRAINT fk_cities_country_id FOREIGN KEY (country_id) REFERENCES countries(country_id);
ALTER TABLE cities ADD CONSTRAINT fk_cities_primary_language FOREIGN KEY (primary_language) REFERENCES languages(bcp47);
ALTER TABLE eval_nl_search_set ADD CONSTRAINT fk_eval_nl_search_set_language FOREIGN KEY (language) REFERENCES languages(bcp47);
ALTER TABLE eval_nl_search_set ADD CONSTRAINT fk_eval_nl_search_set_expected_city_id FOREIGN KEY (expected_city_id) REFERENCES cities(city_id);
ALTER TABLE hotels ADD CONSTRAINT fk_hotels_city_id FOREIGN KEY (city_id) REFERENCES cities(city_id);
ALTER TABLE hotels ADD CONSTRAINT fk_hotels_base_currency FOREIGN KEY (base_currency) REFERENCES currencies(iso4217);
ALTER TABLE users ADD CONSTRAINT fk_users_home_city_id FOREIGN KEY (home_city_id) REFERENCES cities(city_id);
ALTER TABLE users ADD CONSTRAINT fk_users_home_currency FOREIGN KEY (home_currency) REFERENCES currencies(iso4217);
ALTER TABLE users ADD CONSTRAINT fk_users_locale FOREIGN KEY (locale) REFERENCES languages(bcp47);
ALTER TABLE eval_queries ADD CONSTRAINT fk_eval_queries_language FOREIGN KEY (language) REFERENCES languages(bcp47);
ALTER TABLE eval_queries ADD CONSTRAINT fk_eval_queries_city_id FOREIGN KEY (city_id) REFERENCES cities(city_id);
ALTER TABLE eval_queries ADD CONSTRAINT fk_eval_queries_persona_user_id FOREIGN KEY (persona_user_id) REFERENCES users(user_id);
ALTER TABLE hotel_amenities ADD CONSTRAINT fk_hotel_amenities_hotel_id FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id);
ALTER TABLE hotel_amenities ADD CONSTRAINT fk_hotel_amenities_amenity_id FOREIGN KEY (amenity_id) REFERENCES amenities(amenity_id);
ALTER TABLE hotel_policies ADD CONSTRAINT fk_hotel_policies_hotel_id FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id);
ALTER TABLE hotel_policies ADD CONSTRAINT fk_hotel_policies_extra_bed_currency FOREIGN KEY (extra_bed_currency) REFERENCES currencies(iso4217);
ALTER TABLE hotel_room_types ADD CONSTRAINT fk_hotel_room_types_hotel_id FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id);
ALTER TABLE hotel_room_types ADD CONSTRAINT fk_hotel_room_types_currency FOREIGN KEY (currency) REFERENCES currencies(iso4217);
ALTER TABLE trips ADD CONSTRAINT fk_trips_owner_user_id FOREIGN KEY (owner_user_id) REFERENCES users(user_id);
ALTER TABLE trips ADD CONSTRAINT fk_trips_origin_city_id FOREIGN KEY (origin_city_id) REFERENCES cities(city_id);
ALTER TABLE trips ADD CONSTRAINT fk_trips_destination_city_id FOREIGN KEY (destination_city_id) REFERENCES cities(city_id);
ALTER TABLE trips ADD CONSTRAINT fk_trips_home_currency FOREIGN KEY (home_currency) REFERENCES currencies(iso4217);
ALTER TABLE user_interactions ADD CONSTRAINT fk_user_interactions_user_id FOREIGN KEY (user_id) REFERENCES users(user_id);
ALTER TABLE user_interactions ADD CONSTRAINT fk_user_interactions_query_language FOREIGN KEY (query_language) REFERENCES languages(bcp47);
ALTER TABLE hotel_media ADD CONSTRAINT fk_hotel_media_hotel_id FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id);
ALTER TABLE hotel_media ADD CONSTRAINT fk_hotel_media_room_type_id FOREIGN KEY (room_type_id) REFERENCES hotel_room_types(room_type_id);
ALTER TABLE hotel_rate_plans ADD CONSTRAINT fk_hotel_rate_plans_room_type_id FOREIGN KEY (room_type_id) REFERENCES hotel_room_types(room_type_id);
ALTER TABLE hotel_rate_plans ADD CONSTRAINT fk_hotel_rate_plans_currency FOREIGN KEY (currency) REFERENCES currencies(iso4217);
ALTER TABLE hotel_reviews ADD CONSTRAINT fk_hotel_reviews_hotel_id FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id);
ALTER TABLE hotel_reviews ADD CONSTRAINT fk_hotel_reviews_user_id FOREIGN KEY (user_id) REFERENCES users(user_id);
ALTER TABLE hotel_reviews ADD CONSTRAINT fk_hotel_reviews_language FOREIGN KEY (language) REFERENCES languages(bcp47);
ALTER TABLE hotel_reviews ADD CONSTRAINT fk_hotel_reviews_room_type_id FOREIGN KEY (room_type_id) REFERENCES hotel_room_types(room_type_id);
ALTER TABLE itineraries ADD CONSTRAINT fk_itineraries_trip_id FOREIGN KEY (trip_id) REFERENCES trips(trip_id);
ALTER TABLE itineraries ADD CONSTRAINT fk_itineraries_currency FOREIGN KEY (currency) REFERENCES currencies(iso4217);
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_user_id FOREIGN KEY (user_id) REFERENCES users(user_id);
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_trip_id FOREIGN KEY (trip_id) REFERENCES trips(trip_id);
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_itinerary_id FOREIGN KEY (itinerary_id) REFERENCES itineraries(itinerary_id);
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_currency FOREIGN KEY (currency) REFERENCES currencies(iso4217);
ALTER TABLE payments ADD CONSTRAINT fk_payments_booking_id FOREIGN KEY (booking_id) REFERENCES bookings(booking_id);
ALTER TABLE payments ADD CONSTRAINT fk_payments_currency FOREIGN KEY (currency) REFERENCES currencies(iso4217);

-- indexes
CREATE INDEX idx_inventory_calendar_currency ON inventory_calendar(currency);
CREATE INDEX idx_countries_default_currency ON countries(default_currency);
CREATE INDEX idx_cities_country_id ON cities(country_id);
CREATE INDEX idx_cities_primary_language ON cities(primary_language);
CREATE INDEX idx_eval_nl_search_set_language ON eval_nl_search_set(language);
CREATE INDEX idx_eval_nl_search_set_expected_city_id ON eval_nl_search_set(expected_city_id);
CREATE INDEX idx_hotels_city_id ON hotels(city_id);
CREATE INDEX idx_hotels_base_currency ON hotels(base_currency);
CREATE INDEX idx_users_home_city_id ON users(home_city_id);
CREATE INDEX idx_users_home_currency ON users(home_currency);
CREATE INDEX idx_users_locale ON users(locale);
CREATE INDEX idx_eval_queries_language ON eval_queries(language);
CREATE INDEX idx_eval_queries_city_id ON eval_queries(city_id);
CREATE INDEX idx_eval_queries_persona_user_id ON eval_queries(persona_user_id);
CREATE INDEX idx_hotel_amenities_hotel_id ON hotel_amenities(hotel_id);
CREATE INDEX idx_hotel_amenities_amenity_id ON hotel_amenities(amenity_id);
CREATE INDEX idx_hotel_policies_extra_bed_currency ON hotel_policies(extra_bed_currency);
CREATE INDEX idx_hotel_room_types_hotel_id ON hotel_room_types(hotel_id);
CREATE INDEX idx_hotel_room_types_currency ON hotel_room_types(currency);
CREATE INDEX idx_trips_owner_user_id ON trips(owner_user_id);
CREATE INDEX idx_trips_origin_city_id ON trips(origin_city_id);
CREATE INDEX idx_trips_destination_city_id ON trips(destination_city_id);
CREATE INDEX idx_trips_home_currency ON trips(home_currency);
CREATE INDEX idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX idx_user_interactions_query_language ON user_interactions(query_language);
CREATE INDEX idx_hotel_media_hotel_id ON hotel_media(hotel_id);
CREATE INDEX idx_hotel_media_room_type_id ON hotel_media(room_type_id);
CREATE INDEX idx_hotel_rate_plans_room_type_id ON hotel_rate_plans(room_type_id);
CREATE INDEX idx_hotel_rate_plans_currency ON hotel_rate_plans(currency);
CREATE INDEX idx_hotel_reviews_hotel_id ON hotel_reviews(hotel_id);
CREATE INDEX idx_hotel_reviews_user_id ON hotel_reviews(user_id);
CREATE INDEX idx_hotel_reviews_language ON hotel_reviews(language);
CREATE INDEX idx_hotel_reviews_room_type_id ON hotel_reviews(room_type_id);
CREATE INDEX idx_itineraries_trip_id ON itineraries(trip_id);
CREATE INDEX idx_itineraries_currency ON itineraries(currency);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_trip_id ON bookings(trip_id);
CREATE INDEX idx_bookings_itinerary_id ON bookings(itinerary_id);
CREATE INDEX idx_bookings_currency ON bookings(currency);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_currency ON payments(currency);