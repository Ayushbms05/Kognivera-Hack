# PS-02 — your data model

**StayFinder — Hotel Discovery & Booking**  
Kognivera Hackathon 2026 · Travel & Tourism · data model v1.1.0-rc1

> **The problem statement itself, the 24-hour MVP scope and the XR device requirement live in the hackathon application**, on your statement's page. This document is the data you have been given to build it with: every table, every field, and what each one is for.

---

You have **49,985 rows across 21 tables**. 18 of them are the tables this statement is built on; the remaining 3 are reference tables the others point at, included so the database works on its own.

All of it is in the `data/` folder beside this document: as `PS-02.db` (SQLite, indexed, ready to query), as CSV, and as DDL for Postgres and SQLite.

## What the data gives you

300 hotels with **25 reviews each in eight languages** — the single ratio that decides whether your pros-and-cons summary is a feature or a parlour trick — plus 90 days of dated availability and a 100-case natural-language search evaluation set.

## Watch out for this one

`hotel_reviews.language` is a BCP-47 tag and the bodies really are in that script. A summariser that assumes English will produce nonsense on about 58% of the corpus.

## The tables this statement is built on

| Table | Rows | What you use it for |
|---|---|---|
| `bookings` | 1,996 | The order header — where inventory, payment and itinerary meet. Idempotency key is mandatory, not optional. |
| `cities` | 60 | The geographic anchor of the whole model. 60 cities; every hotel, POI, package, advisory and weather row hangs off one. |
| `countries` | 30 | ISO country reference. Every city, currency default and calling code resolves here. |
| `currencies` | 25 | carries the true minor-unit exponent so JPY/KWD display correctly even though storage is always DECIMAL(12,2). |
| `hotel_room_types` | 1,200 | The bookable unit. APS-05's no-oversell guarantee is defended at this grain. |
| `hotels` | 300 | Fewer, richer properties. Depth (reviews, room types, media) matters more than catalogue size —. |
| `inventory_calendar` | 15,030 | Entity x date availability with a database-level no-oversell CHECK. Deliberately scarce units so APS-05's load test has something to defend. |
| `users` | 1,200 | The traveller identity every personalisation hangs off. Segmented heavy / light / cold_start so APS-04 can prove cold start. |
| `amenities` | 60 | Replaces the pipe-separated amenity string. Filters in PS-02 join here. |
| `eval_nl_search_set` | 100 | 100 natural-language hotel searches paired with the structured filters a correct parser should produce. Makes PS-02's NL search testable in seconds. |
| `eval_queries` | 120 | 120 shared natural-language queries. Without them we get thirteen incomparable precision@k numbers. |
| `hotel_amenities` | 2,400 | Join table to the amenity master — the thing PS-02's amenity filter actually queries. |
| `hotel_media` | 1,500 | Image references with role and alt text. PS-05 uses hero/room rows as the fallback when no XR scene exists. |
| `hotel_policies` | 300 | Grounding material for PS-02's AI concierge — 'is it good for a family with a toddler?' is answered from here. |
| `hotel_rate_plans` | 2,400 | Makes rate selection a real choice rather than a single price. |
| `hotel_reviews` | 7,500 | the single most important density ratio in the pack. ~25 per hotel, mixed languages and traveller types, because PS-02's flagship feature is summarising them into balanced pros and cons. |
| `payments` | 1,996 | Mock payment records — authorised and captured amounts held separately so a partial capture is representable. |
| `user_interactions` | 12,339 | heavy users with long histories plus a deliberate cold-start cohort with none. One event per user makes everyone cold and APS-04 undemonstrable. |

## Reference tables, included so the database is valid

You will mostly join through these rather than think about them.

| Table | Rows | What it is |
|---|---|---|
| `itineraries` | 803 | A versioned plan belonging to a trip. version is what makes PS-11's conflict handling tractable. |
| `languages` | 26 | Rule R6: BCP-47 is the only legal way to say 'language' anywhere in the model. |
| `trips` | 600 | The container that gives dates, party, destination and budget to everything else. Seven statements produce or consume one. |

## How they fit together

Open `02_DATA_MODEL_DIAGRAM.html` in a browser for the clickable version — it shows these tables and nothing else. Download it first; it will not render inside SharePoint.

Some tables point at "any bookable thing" using an `(entity_type, entity_id)` pair rather than a typed foreign key. That is deliberate: it is what lets one feature refer to a hotel, a flight, a point of interest or a package without a separate join table for each. The legal values of `entity_type` are in `data/enums.json`.

---

## Every field, table by table

Columns marked **PK** are the primary key. **FK** shows what a column points at. Enum columns list their legal values — anything else is rejected by the conformance check.

### `amenities`

*Reference & geography · 60 rows · IDs start `amn_`*

Replaces the pipe-separated amenity string. Filters in PS-02 join here.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `amenity_id` | text | **PK** | amn_ prefixed. |
| `code` | text | UNIQUE · NOT NULL | snake_case machine code, e.g. free_wifi. |
| `label` | text | NOT NULL | Display label. |
| `amenity_group` | text | NOT NULL · one of `connectivity`, `wellness`, `food_beverage`, `family`, `accessibility`, `transport`, `business`, `outdoor` |  |
| `icon_hint` | text |  | Suggested icon name, purely advisory. |
| `updated_at` | timestamptz | NOT NULL |  |

### `currencies`

*Reference & geography · 25 rows · IDs start `cur_`*

carries the true minor-unit exponent so JPY/KWD display correctly even though storage is always DECIMAL(12,2).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `currency_id` | text | **PK** | cur_ prefixed. |
| `iso4217` | char(3) | UNIQUE · NOT NULL | e.g. INR. |
| `name` | text | NOT NULL |  |
| `symbol` | text | NOT NULL |  |
| `minor_unit_exponent` | smallint | NOT NULL | 0 for JPY/KRW, 2 default, 3 for KWD/BHD. |
| `display_locale` | text | NOT NULL | BCP-47 locale used for formatting. |
| `updated_at` | timestamptz | NOT NULL |  |

### `inventory_calendar`

*Availability & pricing · 15,030 rows · IDs start `inv_`*

Entity x date availability with a database-level no-oversell CHECK. Deliberately scarce units so APS-05's load test has something to defend.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `inventory_id` | text | **PK** | inv_ prefixed. |
| `entity_type` | text | NOT NULL · one of `room_type`, `flight_fare`, `guide`, `poi` |  |
| `entity_id` | text | NOT NULL | room_type_id or fare_id. |
| `for_date` | date | NOT NULL |  |
| `total_units` | int | NOT NULL |  |
| `booked_units` | int | NOT NULL |  |
| `held_units` | int | NOT NULL |  |
| `price` | decimal(12,2) | NOT NULL | the price for that date. |
| `currency` | char(3) | FK → `currencies.iso4217` · NOT NULL |  |
| `min_stay_nights` | smallint | NOT NULL |  |
| `closed_to_arrival` | bool | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

*Unique together:* `(entity_type, entity_id, for_date)`

*Enforced by the database:* `booked_units + held_units <= total_units`

### `languages`

*Reference & geography · 26 rows · IDs start `lng_` · reference table*

Rule R6: BCP-47 is the only legal way to say 'language' anywhere in the model.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `language_id` | text | **PK** | lng_ prefixed. |
| `bcp47` | text | UNIQUE · NOT NULL | e.g. ta, hi, en-IN — never 'Tamil'. |
| `english_name` | text | NOT NULL |  |
| `native_name` | text | NOT NULL |  |
| `script` | text | NOT NULL | ISO-15924, e.g. Taml, Deva, Latn. |
| `rtl` | bool | NOT NULL | Right-to-left rendering flag. |
| `tts_supported` | bool | NOT NULL | Relevant to PS-13 voice output. |
| `updated_at` | timestamptz | NOT NULL |  |

### `countries`

*Reference & geography · 30 rows · IDs start `cnt_`*

ISO country reference. Every city, currency default and calling code resolves here.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `country_id` | text | **PK** | Canonical ID, cnt_ prefixed. |
| `iso2` | char(2) | UNIQUE · NOT NULL | ISO-3166-1 alpha-2, e.g. IN. |
| `iso3` | char(3) | UNIQUE · NOT NULL | ISO-3166-1 alpha-3, e.g. IND. |
| `name` | text | NOT NULL | English short name. |
| `default_currency` | char(3) | FK → `currencies.iso4217` · NOT NULL | ISO-4217 code. |
| `calling_code` | text | NOT NULL | E.164 country calling code, e.g. +91. |
| `region` | text | NOT NULL | UN sub-region grouping. |
| `updated_at` | timestamptz | NOT NULL | Rule R4: UTC, ISO-8601 with offset. |

### `cities`

*Reference & geography · 60 rows · IDs start `cty_`*

The geographic anchor of the whole model. 60 cities; every hotel, POI, package, advisory and weather row hangs off one.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `city_id` | text | **PK** | cty_ prefixed. |
| `name` | text | NOT NULL | City name. |
| `state` | text |  | State / province, nullable for city-states. |
| `country_id` | text | FK → `countries.country_id` · NOT NULL |  |
| `country_code` | char(2) | NOT NULL | Denormalised ISO2 for convenient joins. |
| `lat` | decimal(9,6) | NOT NULL | Rule R7: WGS-84, 6dp. |
| `lng` | decimal(9,6) | NOT NULL | Rule R7: WGS-84, 6dp. |
| `timezone` | text | NOT NULL | IANA zone, e.g. Asia/Kolkata. |
| `region` | text | NOT NULL | Domestic region grouping, e.g. South India. |
| `population` | int |  | Approximate, for demand weighting. |
| `season_profile` | text | NOT NULL · one of `winter`, `summer`, `monsoon`, `post_monsoon`, `spring`, `autumn` | Dominant season at the peak travel window. |
| `peak_months` | text | NOT NULL | Comma-separated month numbers, e.g. 10,11,12. |
| `primary_language` | text | FK → `languages.bcp47` · NOT NULL | Rule R6: BCP-47 tag. |
| `description` | text |  | One-paragraph orientation blurb, used by PS-13. |
| `status` | text | NOT NULL · one of `active`, `inactive`, `archived`, `draft` |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `eval_nl_search_set`

*Signals & evaluation · 100 rows · IDs start `ens_`*

100 natural-language hotel searches paired with the structured filters a correct parser should produce. Makes PS-02's NL search testable in seconds.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `case_id` | text | **PK** | ens_ prefixed. |
| `utterance` | text | NOT NULL | e.g. quiet 4-star near the beach with a pool under 8000. |
| `language` | text | FK → `languages.bcp47` · NOT NULL |  |
| `expected_city_id` | text | FK → `cities.city_id` |  |
| `expected_filters_json` | text | NOT NULL | JSON string: star_min, price_max, amenities[], distance_km, etc. |
| `expected_sort` | text | NOT NULL | price_asc | rating_desc | distance_asc | relevance. |
| `difficulty` | text | NOT NULL | easy | medium | hard. |
| `has_negation` | bool | NOT NULL | e.g. 'not near the airport' — the cases parsers usually fail. |
| `updated_at` | timestamptz | NOT NULL |  |

### `hotels`

*Supply & catalogue · 300 rows · IDs start `htl_`*

Fewer, richer properties. Depth (reviews, room types, media) matters more than catalogue size —.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `hotel_id` | text | **PK** | htl_ prefixed. |
| `city_id` | text | FK → `cities.city_id` · NOT NULL |  |
| `name` | text | NOT NULL | ~3% near-duplicate names injected deliberately. |
| `property_type` | text | NOT NULL · one of `hotel`, `resort`, `homestay`, `hostel`, `apartment`, `boutique`, `heritage`, `guesthouse` |  |
| `star_rating` | smallint | NOT NULL | 1–5, CHECK constrained. |
| `guest_score` | decimal(2,1) |  | 0.0–10.0; null for a handful of new properties. |
| `review_count` | int | NOT NULL | Denormalised count, must agree with hotel_reviews. |
| `address_line` | text | NOT NULL |  |
| `lat` | decimal(9,6) | NOT NULL |  |
| `lng` | decimal(9,6) | NOT NULL |  |
| `distance_to_centre_km` | decimal(6,2) | NOT NULL | PS-02 filter: distance to a landmark. |
| `description` | text | NOT NULL | Plausible prose, embeddable. |
| `base_currency` | char(3) | FK → `currencies.iso4217` · NOT NULL |  |
| `checkin_time` | text | NOT NULL | Local HH:MM at the property. |
| `checkout_time` | text | NOT NULL |  |
| `chain_code` | text |  | Null for independents. |
| `has_xr_scene` | bool | NOT NULL | PS-05 / APS-07 — does an immersive preview exist. |
| `status` | text | NOT NULL · one of `active`, `inactive`, `archived`, `draft` |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `users`

*Identity & preference · 1,200 rows · IDs start `usr_`*

The traveller identity every personalisation hangs off. Segmented heavy / light / cold_start so APS-04 can prove cold start.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | text | **PK** | usr_ prefixed. |
| `display_name` | text | NOT NULL | Synthetic — no real people (content policy). |
| `email` | text | UNIQUE · NOT NULL | Synthetic @example.invalid addresses only. |
| `home_city_id` | text | FK → `cities.city_id` · NOT NULL |  |
| `home_currency` | char(3) | FK → `currencies.iso4217` · NOT NULL |  |
| `locale` | text | FK → `languages.bcp47` · NOT NULL | UI language, BCP-47. |
| `budget_band` | text | NOT NULL · one of `shoestring`, `value`, `mid`, `premium`, `luxury` |  |
| `travel_style` | text | NOT NULL · one of `budget`, `comfort`, `luxury`, `adventure`, `slow`, `cultural`, `wellness` |  |
| `traveller_type` | text | NOT NULL · one of `solo`, `couple`, `family`, `business`, `friends`, `senior`, `backpacker` |  |
| `segment` | text | NOT NULL · one of `heavy`, `light`, `cold_start` | heavy / light / cold_start cohorts. |
| `date_of_signup` | date | NOT NULL |  |
| `loyalty_tier` | text |  | none | silver | gold — nullable by design. |
| `status` | text | NOT NULL · one of `active`, `inactive`, `archived`, `draft` |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `eval_queries`

*Signals & evaluation · 120 rows · IDs start `evq_`*

120 shared natural-language queries. Without them we get thirteen incomparable precision@k numbers.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `query_id` | text | **PK** | evq_ prefixed. |
| `query_text` | text | NOT NULL |  |
| `language` | text | FK → `languages.bcp47` · NOT NULL | Includes hi and ta queries for the multilingual requirement. |
| `intent` | text | NOT NULL · one of `budget_stay`, `family_stay`, `luxury_stay`, `heritage_poi`, `nature_poi`, `food_poi`, `adventure_package`, `honeymoon_package`, `accessibility`, `pet_friendly` |  |
| `target_entity_type` | text | NOT NULL · one of `hotel`, `room_type`, `rate_plan`, `flight`, `flight_fare`, `poi`, `package`, `package_component`, `guide`, `transfer`, `event`, `xr_scene` |  |
| `city_id` | text | FK → `cities.city_id` | Null for city-agnostic queries. |
| `persona_user_id` | text | FK → `users.user_id` | The user whose profile the query should be personalised to. |
| `filters_json` | text | NOT NULL | JSON string of the hard filters a correct system must apply. |
| `k` | smallint | NOT NULL | The k at which precision@k is reported. |
| `notes` | text |  |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `hotel_amenities`

*Supply & catalogue · 2,400 rows · IDs start `ham_`*

Join table to the amenity master — the thing PS-02's amenity filter actually queries.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `hotel_amenity_id` | text | **PK** | ham_ prefixed. |
| `hotel_id` | text | FK → `hotels.hotel_id` · NOT NULL |  |
| `amenity_id` | text | FK → `amenities.amenity_id` · NOT NULL |  |
| `is_free` | bool | NOT NULL |  |
| `note` | text |  |  |
| `updated_at` | timestamptz | NOT NULL |  |

*Unique together:* `(hotel_id, amenity_id)`

### `hotel_policies`

*Supply & catalogue · 300 rows · IDs start `hpo_`*

Grounding material for PS-02's AI concierge — 'is it good for a family with a toddler?' is answered from here.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `policy_id` | text | **PK** | hpo_ prefixed. |
| `hotel_id` | text | FK → `hotels.hotel_id` · UNIQUE · NOT NULL |  |
| `child_policy` | text | NOT NULL | Prose. |
| `pet_policy` | text | NOT NULL | Prose. |
| `extra_bed_policy` | text | NOT NULL |  |
| `extra_bed_charge` | decimal(12,2) |  |  |
| `extra_bed_currency` | char(3) | FK → `currencies.iso4217` |  |
| `payment_methods` | text | NOT NULL | Comma-separated payment_method enum values. |
| `airport_pickup` | bool | NOT NULL | Directly answers a scripted concierge question. |
| `early_checkin_possible` | bool | NOT NULL |  |
| `accessibility_notes` | text |  |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `hotel_room_types`

*Supply & catalogue · 1,200 rows · IDs start `rmt_`*

The bookable unit. APS-05's no-oversell guarantee is defended at this grain.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `room_type_id` | text | **PK** | rmt_ prefixed. |
| `hotel_id` | text | FK → `hotels.hotel_id` · NOT NULL |  |
| `name` | text | NOT NULL | e.g. Deluxe Garden View. |
| `max_occupancy` | smallint | NOT NULL |  |
| `max_adults` | smallint | NOT NULL |  |
| `max_children` | smallint | NOT NULL |  |
| `bed_config` | text | NOT NULL · one of `single`, `twin`, `double`, `queen`, `king`, `bunk`, `twin_double` |  |
| `size_sqm` | smallint |  |  |
| `base_rate` | decimal(12,2) | NOT NULL | NUMERIC, never FLOAT. |
| `currency` | char(3) | FK → `currencies.iso4217` · NOT NULL | always paired with the amount. |
| `total_units` | int | NOT NULL | Deliberately scarce on some rows so APS-05 has contention. |
| `smoking_allowed` | bool | NOT NULL |  |
| `status` | text | NOT NULL · one of `active`, `inactive`, `archived`, `draft` |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `trips`

*Trip & itinerary · 600 rows · IDs start `trp_` · reference table*

The container that gives dates, party, destination and budget to everything else. Seven statements produce or consume one.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `trip_id` | text | **PK** | trp_ prefixed. |
| `owner_user_id` | text | FK → `users.user_id` · NOT NULL |  |
| `title` | text | NOT NULL |  |
| `origin_city_id` | text | FK → `cities.city_id` |  |
| `destination_city_id` | text | FK → `cities.city_id` · NOT NULL |  |
| `start_date` | date | NOT NULL | Rule R4: zoneless calendar date. |
| `end_date` | date | NOT NULL |  |
| `party_size` | smallint | NOT NULL |  |
| `adults` | smallint | NOT NULL |  |
| `children` | smallint | NOT NULL |  |
| `trip_type` | text | NOT NULL · one of `solo`, `couple`, `family`, `business`, `friends`, `senior`, `backpacker` |  |
| `is_group_trip` | bool | NOT NULL | PS-11 / PS-08 filter. |
| `status` | text | NOT NULL · one of `draft`, `planning`, `confirmed`, `in_progress`, `completed`, `cancelled` |  |
| `home_currency` | char(3) | FK → `currencies.iso4217` · NOT NULL |  |
| `notes` | text |  |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `user_interactions`

*Signals & evaluation · 12,339 rows · IDs start `uix_`*

heavy users with long histories plus a deliberate cold-start cohort with none. One event per user makes everyone cold and APS-04 undemonstrable.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `interaction_id` | text | **PK** | uix_ prefixed. |
| `user_id` | text | FK → `users.user_id` · NOT NULL |  |
| `entity_type` | text | NOT NULL · one of `hotel`, `room_type`, `rate_plan`, `flight`, `flight_fare`, `poi`, `package`, `package_component`, `guide`, `transfer`, `event`, `xr_scene` |  |
| `entity_id` | text | NOT NULL |  |
| `interaction_type` | text | NOT NULL · one of `view`, `click`, `like`, `save`, `book`, `dismiss`, `share`, `search` |  |
| `occurred_at` | timestamptz | NOT NULL |  |
| `dwell_seconds` | int |  | Null for non-view events. |
| `position_in_list` | smallint |  | Rank at which the item was shown — needed for unbiased offline eval. |
| `query_text` | text |  | Set for interaction_type = search. |
| `query_language` | text | FK → `languages.bcp47` |  |
| `channel` | text | NOT NULL · one of `web`, `mobile_app`, `partner`, `call_centre`, `agent` |  |
| `session_id` | text | NOT NULL |  |
| `implicit_rating` | decimal(3,2) |  | Derived signal, provided for convenience. |

### `hotel_media`

*Supply & catalogue · 1,500 rows · IDs start `hmd_`*

Image references with role and alt text. PS-05 uses hero/room rows as the fallback when no XR scene exists.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `media_id` | text | **PK** | hmd_ prefixed. |
| `hotel_id` | text | FK → `hotels.hotel_id` · NOT NULL |  |
| `room_type_id` | text | FK → `hotel_room_types.room_type_id` | Null for property-level media. |
| `media_role` | text | NOT NULL · one of `hero`, `room`, `lobby`, `exterior`, `dining`, `pool`, `bathroom`, `view`, `landmark`, `menu`, `sign`, `receipt` |  |
| `file_path` | text | NOT NULL | Relative path inside the media pack. |
| `alt_text` | text | NOT NULL | Accessibility and multimodal grounding. |
| `width_px` | int | NOT NULL |  |
| `height_px` | int | NOT NULL |  |
| `sort_order` | smallint | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `hotel_rate_plans`

*Supply & catalogue · 2,400 rows · IDs start `rtp_`*

Makes rate selection a real choice rather than a single price.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `rate_plan_id` | text | **PK** | rtp_ prefixed. |
| `room_type_id` | text | FK → `hotel_room_types.room_type_id` · NOT NULL |  |
| `plan_type` | text | NOT NULL · one of `refundable`, `non_refundable`, `breakfast_included`, `half_board`, `full_board`, `long_stay` |  |
| `name` | text | NOT NULL |  |
| `price_delta` | decimal(12,2) | NOT NULL | Signed delta applied to the room base_rate. |
| `currency` | char(3) | FK → `currencies.iso4217` · NOT NULL |  |
| `cancellation_window_hours` | int | NOT NULL | 0 for non-refundable. |
| `cancellation_penalty_pct` | smallint | NOT NULL |  |
| `includes_breakfast` | bool | NOT NULL |  |
| `min_stay_nights` | smallint | NOT NULL |  |
| `status` | text | NOT NULL · one of `active`, `inactive`, `archived`, `draft` |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `hotel_reviews`

*Supply & catalogue · 7,500 rows · IDs start `rvw_`*

the single most important density ratio in the pack. ~25 per hotel, mixed languages and traveller types, because PS-02's flagship feature is summarising them into balanced pros and cons.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `review_id` | text | **PK** | rvw_ prefixed. |
| `hotel_id` | text | FK → `hotels.hotel_id` · NOT NULL |  |
| `user_id` | text | FK → `users.user_id` | Nullable — some reviews are from non-registered guests. |
| `rating` | smallint | NOT NULL | 1–10. |
| `title` | text |  |  |
| `body` | text | NOT NULL | Plausible prose, 40–120 words. |
| `language` | text | FK → `languages.bcp47` · NOT NULL | Rule R6: mixed en-IN / hi / ta / ml / bn. |
| `traveller_type` | text | NOT NULL · one of `solo`, `couple`, `family`, `business`, `friends`, `senior`, `backpacker` |  |
| `stay_date` | date | NOT NULL | Rule R4: zoneless. |
| `room_type_id` | text | FK → `hotel_room_types.room_type_id` |  |
| `helpful_votes` | int | NOT NULL |  |
| `has_photo` | bool | NOT NULL |  |
| `sentiment_hint` | decimal(3,2) |  | -1.00..1.00, provided for calibration only. |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `itineraries`

*Trip & itinerary · 803 rows · IDs start `itn_` · reference table*

A versioned plan belonging to a trip. version is what makes PS-11's conflict handling tractable.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `itinerary_id` | text | **PK** | itn_ prefixed. |
| `trip_id` | text | FK → `trips.trip_id` · NOT NULL |  |
| `name` | text | NOT NULL |  |
| `version` | int | NOT NULL | Monotonic per itinerary. |
| `is_active` | bool | NOT NULL | Exactly one active version per trip. |
| `generated_by` | text | NOT NULL · one of `user`, `ai_planner`, `optimizer`, `agent`, `vote`, `import` | Which subsystem produced this version. |
| `total_cost` | decimal(12,2) | NOT NULL | sum of item costs, half-up at the end. |
| `currency` | char(3) | FK → `currencies.iso4217` · NOT NULL |  |
| `total_duration_minutes` | int | NOT NULL |  |
| `total_carbon_kg` | decimal(10,3) | NOT NULL | APS-09 objective. |
| `optimizer_weights` | text |  | JSON string: {cost, time, carbon} weights that produced it. |
| `status` | text | NOT NULL · one of `active`, `inactive`, `archived`, `draft` |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `bookings`

*Booking & money · 1,996 rows · IDs start `bkg_`*

The order header — where inventory, payment and itinerary meet. Idempotency key is mandatory, not optional.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `booking_id` | text | **PK** | bkg_ prefixed. |
| `user_id` | text | FK → `users.user_id` · NOT NULL |  |
| `trip_id` | text | FK → `trips.trip_id` | Null for standalone bookings. |
| `itinerary_id` | text | FK → `itineraries.itinerary_id` |  |
| `booking_reference` | text | UNIQUE · NOT NULL | Human-quotable 6-char reference. |
| `channel` | text | NOT NULL · one of `web`, `mobile_app`, `partner`, `call_centre`, `agent` |  |
| `total_amount` | decimal(12,2) | NOT NULL | must equal the sum of booking_items. |
| `currency` | char(3) | FK → `currencies.iso4217` · NOT NULL |  |
| `tax_amount` | decimal(12,2) | NOT NULL |  |
| `idempotency_key` | text | UNIQUE · NOT NULL | APS-05 — retried requests resolve to this same row. |
| `status` | text | NOT NULL · one of `pending`, `confirmed`, `partially_confirmed`, `cancelled`, `failed`, `refunded` |  |
| `confirmed_at` | timestamptz |  |  |
| `cancelled_at` | timestamptz |  |  |
| `cancellation_reason` | text |  |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `payments`

*Booking & money · 1,996 rows · IDs start `pay_`*

Mock payment records — authorised and captured amounts held separately so a partial capture is representable.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `payment_id` | text | **PK** | pay_ prefixed. |
| `booking_id` | text | FK → `bookings.booking_id` · NOT NULL |  |
| `method` | text | NOT NULL · one of `card`, `upi`, `netbanking`, `wallet`, `mock` |  |
| `status` | text | NOT NULL · one of `initiated`, `authorised`, `captured`, `failed`, `refunded`, `voided` |  |
| `authorised_amount` | decimal(12,2) | NOT NULL | D3. |
| `captured_amount` | decimal(12,2) | NOT NULL |  |
| `refunded_amount` | decimal(12,2) | NOT NULL |  |
| `currency` | char(3) | FK → `currencies.iso4217` · NOT NULL |  |
| `gateway_reference` | text | NOT NULL | Synthetic mock reference. |
| `idempotency_key` | text | UNIQUE · NOT NULL |  |
| `failure_code` | text | one of `hold_expired`, `sold_out`, `over_budget`, `invalid_id`, `currency_mismatch`, `idempotency_conflict`, `constraint_infeasible`, `low_confidence` |  |
| `authorised_at` | timestamptz |  |  |
| `captured_at` | timestamptz |  |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

---

## The rules that apply to these fields

| # | Rule |
|---|---|
| R1 | **Additive only.** Add columns, tables and stores freely. Never rename, drop or repurpose a field that came with the data. |
| R2 | **IDs are opaque prefixed strings** — `htl_a91f3c`. Never integers, never parsed for meaning. |
| R3 | **Money is a pair**: a 2-place decimal plus an ISO-4217 currency code. Never a float. |
| R4 | **Time is ISO-8601 with an offset.** `_at` fields carry an offset; `_date` fields have no zone. |
| R5 | **Enums are lowercase snake_case** and the legal values are in `data/enums.json`. |
| R6 | **Language is a BCP-47 tag** — `ta`, not "Tamil". |
| R7 | **Geography is WGS-84** to 6 decimal places, `lat` and `lng` together or not at all. |
| R8 | **Nothing is hard-deleted.** Rows carry `status` and `updated_at`. |

Add whatever you like beside these fields — new columns, new tables, your own vector store, your own services. That is the point of R1. What you must not do is rename or re-key the fields that came with the data, because that is what would stop sixteen independent builds being put together afterwards.

`data/WORKING_WITH_THE_DATA.md` has the loading instructions, including how to read money without corrupting it. `tools/validate_conformance.py` tells you in thirty seconds whether you are still conformant.
