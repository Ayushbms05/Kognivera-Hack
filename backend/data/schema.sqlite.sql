-- KV Hackathon 2026 · travel data model v1.1.0-rc1
-- Only the 21 tables this problem statement needs.

-- SQLite has no DECIMAL type, and NUMERIC affinity would turn '8500.00' into the
-- float 8500.0. Money columns are therefore TEXT so the exact value survives.
PRAGMA foreign_keys = ON;

-- amenities  (Reference & geography)
CREATE TABLE amenities (
  amenity_id                   TEXT PRIMARY KEY,
  code                         TEXT NOT NULL UNIQUE,
  label                        TEXT NOT NULL,
  amenity_group                TEXT NOT NULL,
  icon_hint                    TEXT,
  updated_at                   TEXT NOT NULL
);

-- currencies  (Reference & geography)
CREATE TABLE currencies (
  currency_id                  TEXT PRIMARY KEY,
  iso4217                      TEXT NOT NULL UNIQUE,
  name                         TEXT NOT NULL,
  symbol                       TEXT NOT NULL,
  minor_unit_exponent          INTEGER NOT NULL,
  display_locale               TEXT NOT NULL,
  updated_at                   TEXT NOT NULL
);

-- inventory_calendar  (Availability & pricing)
CREATE TABLE inventory_calendar (
  inventory_id                 TEXT PRIMARY KEY,
  entity_type                  TEXT NOT NULL,
  entity_id                    TEXT NOT NULL,
  for_date                     TEXT NOT NULL,
  total_units                  INTEGER NOT NULL,
  booked_units                 INTEGER NOT NULL,
  held_units                   INTEGER NOT NULL,
  price                        TEXT NOT NULL,
  currency                     TEXT NOT NULL,
  min_stay_nights              INTEGER NOT NULL,
  closed_to_arrival            INTEGER NOT NULL,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (currency) REFERENCES currencies(iso4217),
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
  rtl                          INTEGER NOT NULL,
  tts_supported                INTEGER NOT NULL,
  updated_at                   TEXT NOT NULL
);

-- countries  (Reference & geography)
CREATE TABLE countries (
  country_id                   TEXT PRIMARY KEY,
  iso2                         TEXT NOT NULL UNIQUE,
  iso3                         TEXT NOT NULL UNIQUE,
  name                         TEXT NOT NULL,
  default_currency             TEXT NOT NULL,
  calling_code                 TEXT NOT NULL,
  region                       TEXT NOT NULL,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (default_currency) REFERENCES currencies(iso4217)
);

-- cities  (Reference & geography)
CREATE TABLE cities (
  city_id                      TEXT PRIMARY KEY,
  name                         TEXT NOT NULL,
  state                        TEXT,
  country_id                   TEXT NOT NULL,
  country_code                 TEXT NOT NULL,
  lat                          NUMERIC(9,6) NOT NULL,
  lng                          NUMERIC(9,6) NOT NULL,
  timezone                     TEXT NOT NULL,
  region                       TEXT NOT NULL,
  population                   INTEGER,
  season_profile               TEXT NOT NULL,
  peak_months                  TEXT NOT NULL,
  primary_language             TEXT NOT NULL,
  description                  TEXT,
  status                       TEXT NOT NULL,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (country_id) REFERENCES countries(country_id),
  FOREIGN KEY (primary_language) REFERENCES languages(bcp47)
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
  has_negation                 INTEGER NOT NULL,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (language) REFERENCES languages(bcp47),
  FOREIGN KEY (expected_city_id) REFERENCES cities(city_id)
);

-- hotels  (Supply & catalogue)
CREATE TABLE hotels (
  hotel_id                     TEXT PRIMARY KEY,
  city_id                      TEXT NOT NULL,
  name                         TEXT NOT NULL,
  property_type                TEXT NOT NULL,
  star_rating                  INTEGER NOT NULL,
  guest_score                  NUMERIC(2,1),
  review_count                 INTEGER NOT NULL,
  address_line                 TEXT NOT NULL,
  lat                          NUMERIC(9,6) NOT NULL,
  lng                          NUMERIC(9,6) NOT NULL,
  distance_to_centre_km        NUMERIC(6,2) NOT NULL,
  description                  TEXT NOT NULL,
  base_currency                TEXT NOT NULL,
  checkin_time                 TEXT NOT NULL,
  checkout_time                TEXT NOT NULL,
  chain_code                   TEXT,
  has_xr_scene                 INTEGER NOT NULL,
  status                       TEXT NOT NULL,
  created_at                   TEXT NOT NULL,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (city_id) REFERENCES cities(city_id),
  FOREIGN KEY (base_currency) REFERENCES currencies(iso4217)
);

-- users  (Identity & preference)
CREATE TABLE users (
  user_id                      TEXT PRIMARY KEY,
  display_name                 TEXT NOT NULL,
  email                        TEXT NOT NULL UNIQUE,
  home_city_id                 TEXT NOT NULL,
  home_currency                TEXT NOT NULL,
  locale                       TEXT NOT NULL,
  budget_band                  TEXT NOT NULL,
  travel_style                 TEXT NOT NULL,
  traveller_type               TEXT NOT NULL,
  segment                      TEXT NOT NULL,
  date_of_signup               TEXT NOT NULL,
  loyalty_tier                 TEXT,
  status                       TEXT NOT NULL,
  created_at                   TEXT NOT NULL,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (home_city_id) REFERENCES cities(city_id),
  FOREIGN KEY (home_currency) REFERENCES currencies(iso4217),
  FOREIGN KEY (locale) REFERENCES languages(bcp47)
);

-- eval_queries  (Signals & evaluation)
CREATE TABLE eval_queries (
  query_id                     TEXT PRIMARY KEY,
  query_text                   TEXT NOT NULL,
  language                     TEXT NOT NULL,
  intent                       TEXT NOT NULL,
  target_entity_type           TEXT NOT NULL,
  city_id                      TEXT,
  persona_user_id              TEXT,
  filters_json                 TEXT NOT NULL,
  k                            INTEGER NOT NULL,
  notes                        TEXT,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (language) REFERENCES languages(bcp47),
  FOREIGN KEY (city_id) REFERENCES cities(city_id),
  FOREIGN KEY (persona_user_id) REFERENCES users(user_id)
);

-- hotel_amenities  (Supply & catalogue)
CREATE TABLE hotel_amenities (
  hotel_amenity_id             TEXT PRIMARY KEY,
  hotel_id                     TEXT NOT NULL,
  amenity_id                   TEXT NOT NULL,
  is_free                      INTEGER NOT NULL,
  note                         TEXT,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id),
  FOREIGN KEY (amenity_id) REFERENCES amenities(amenity_id),
  UNIQUE (hotel_id, amenity_id)
);

-- hotel_policies  (Supply & catalogue)
CREATE TABLE hotel_policies (
  policy_id                    TEXT PRIMARY KEY,
  hotel_id                     TEXT NOT NULL UNIQUE,
  child_policy                 TEXT NOT NULL,
  pet_policy                   TEXT NOT NULL,
  extra_bed_policy             TEXT NOT NULL,
  extra_bed_charge             TEXT,
  extra_bed_currency           TEXT,
  payment_methods              TEXT NOT NULL,
  airport_pickup               INTEGER NOT NULL,
  early_checkin_possible       INTEGER NOT NULL,
  accessibility_notes          TEXT,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id),
  FOREIGN KEY (extra_bed_currency) REFERENCES currencies(iso4217)
);

-- hotel_room_types  (Supply & catalogue)
CREATE TABLE hotel_room_types (
  room_type_id                 TEXT PRIMARY KEY,
  hotel_id                     TEXT NOT NULL,
  name                         TEXT NOT NULL,
  max_occupancy                INTEGER NOT NULL,
  max_adults                   INTEGER NOT NULL,
  max_children                 INTEGER NOT NULL,
  bed_config                   TEXT NOT NULL,
  size_sqm                     INTEGER,
  base_rate                    TEXT NOT NULL,
  currency                     TEXT NOT NULL,
  total_units                  INTEGER NOT NULL,
  smoking_allowed              INTEGER NOT NULL,
  status                       TEXT NOT NULL,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id),
  FOREIGN KEY (currency) REFERENCES currencies(iso4217)
);

-- trips  (Trip & itinerary)
CREATE TABLE trips (
  trip_id                      TEXT PRIMARY KEY,
  owner_user_id                TEXT NOT NULL,
  title                        TEXT NOT NULL,
  origin_city_id               TEXT,
  destination_city_id          TEXT NOT NULL,
  start_date                   TEXT NOT NULL,
  end_date                     TEXT NOT NULL,
  party_size                   INTEGER NOT NULL,
  adults                       INTEGER NOT NULL,
  children                     INTEGER NOT NULL,
  trip_type                    TEXT NOT NULL,
  is_group_trip                INTEGER NOT NULL,
  status                       TEXT NOT NULL,
  home_currency                TEXT NOT NULL,
  notes                        TEXT,
  created_at                   TEXT NOT NULL,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(user_id),
  FOREIGN KEY (origin_city_id) REFERENCES cities(city_id),
  FOREIGN KEY (destination_city_id) REFERENCES cities(city_id),
  FOREIGN KEY (home_currency) REFERENCES currencies(iso4217)
);

-- user_interactions  (Signals & evaluation)
CREATE TABLE user_interactions (
  interaction_id               TEXT PRIMARY KEY,
  user_id                      TEXT NOT NULL,
  entity_type                  TEXT NOT NULL,
  entity_id                    TEXT NOT NULL,
  interaction_type             TEXT NOT NULL,
  occurred_at                  TEXT NOT NULL,
  dwell_seconds                INTEGER,
  position_in_list             INTEGER,
  query_text                   TEXT,
  query_language               TEXT,
  channel                      TEXT NOT NULL,
  session_id                   TEXT NOT NULL,
  implicit_rating              NUMERIC(3,2),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (query_language) REFERENCES languages(bcp47)
);

-- hotel_media  (Supply & catalogue)
CREATE TABLE hotel_media (
  media_id                     TEXT PRIMARY KEY,
  hotel_id                     TEXT NOT NULL,
  room_type_id                 TEXT,
  media_role                   TEXT NOT NULL,
  file_path                    TEXT NOT NULL,
  alt_text                     TEXT NOT NULL,
  width_px                     INTEGER NOT NULL,
  height_px                    INTEGER NOT NULL,
  sort_order                   INTEGER NOT NULL,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id),
  FOREIGN KEY (room_type_id) REFERENCES hotel_room_types(room_type_id)
);

-- hotel_rate_plans  (Supply & catalogue)
CREATE TABLE hotel_rate_plans (
  rate_plan_id                 TEXT PRIMARY KEY,
  room_type_id                 TEXT NOT NULL,
  plan_type                    TEXT NOT NULL,
  name                         TEXT NOT NULL,
  price_delta                  TEXT NOT NULL,
  currency                     TEXT NOT NULL,
  cancellation_window_hours    INTEGER NOT NULL,
  cancellation_penalty_pct     INTEGER NOT NULL,
  includes_breakfast           INTEGER NOT NULL,
  min_stay_nights              INTEGER NOT NULL,
  status                       TEXT NOT NULL,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (room_type_id) REFERENCES hotel_room_types(room_type_id),
  FOREIGN KEY (currency) REFERENCES currencies(iso4217)
);

-- hotel_reviews  (Supply & catalogue)
CREATE TABLE hotel_reviews (
  review_id                    TEXT PRIMARY KEY,
  hotel_id                     TEXT NOT NULL,
  user_id                      TEXT,
  rating                       INTEGER NOT NULL,
  title                        TEXT,
  body                         TEXT NOT NULL,
  language                     TEXT NOT NULL,
  traveller_type               TEXT NOT NULL,
  stay_date                    TEXT NOT NULL,
  room_type_id                 TEXT,
  helpful_votes                INTEGER NOT NULL,
  has_photo                    INTEGER NOT NULL,
  sentiment_hint               NUMERIC(3,2),
  created_at                   TEXT NOT NULL,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (language) REFERENCES languages(bcp47),
  FOREIGN KEY (room_type_id) REFERENCES hotel_room_types(room_type_id)
);

-- itineraries  (Trip & itinerary)
CREATE TABLE itineraries (
  itinerary_id                 TEXT PRIMARY KEY,
  trip_id                      TEXT NOT NULL,
  name                         TEXT NOT NULL,
  version                      INTEGER NOT NULL,
  is_active                    INTEGER NOT NULL,
  generated_by                 TEXT NOT NULL,
  total_cost                   TEXT NOT NULL,
  currency                     TEXT NOT NULL,
  total_duration_minutes       INTEGER NOT NULL,
  total_carbon_kg              NUMERIC(10,3) NOT NULL,
  optimizer_weights            TEXT,
  status                       TEXT NOT NULL,
  created_at                   TEXT NOT NULL,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(trip_id),
  FOREIGN KEY (currency) REFERENCES currencies(iso4217)
);

-- bookings  (Booking & money)
CREATE TABLE bookings (
  booking_id                   TEXT PRIMARY KEY,
  user_id                      TEXT NOT NULL,
  trip_id                      TEXT,
  itinerary_id                 TEXT,
  booking_reference            TEXT NOT NULL UNIQUE,
  channel                      TEXT NOT NULL,
  total_amount                 TEXT NOT NULL,
  currency                     TEXT NOT NULL,
  tax_amount                   TEXT NOT NULL,
  idempotency_key              TEXT NOT NULL UNIQUE,
  status                       TEXT NOT NULL,
  confirmed_at                 TEXT,
  cancelled_at                 TEXT,
  cancellation_reason          TEXT,
  created_at                   TEXT NOT NULL,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (trip_id) REFERENCES trips(trip_id),
  FOREIGN KEY (itinerary_id) REFERENCES itineraries(itinerary_id),
  FOREIGN KEY (currency) REFERENCES currencies(iso4217)
);

-- payments  (Booking & money)
CREATE TABLE payments (
  payment_id                   TEXT PRIMARY KEY,
  booking_id                   TEXT NOT NULL,
  method                       TEXT NOT NULL,
  status                       TEXT NOT NULL,
  authorised_amount            TEXT NOT NULL,
  captured_amount              TEXT NOT NULL,
  refunded_amount              TEXT NOT NULL,
  currency                     TEXT NOT NULL,
  gateway_reference            TEXT NOT NULL,
  idempotency_key              TEXT NOT NULL UNIQUE,
  failure_code                 TEXT,
  authorised_at                TEXT,
  captured_at                  TEXT,
  created_at                   TEXT NOT NULL,
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  FOREIGN KEY (currency) REFERENCES currencies(iso4217)
);
