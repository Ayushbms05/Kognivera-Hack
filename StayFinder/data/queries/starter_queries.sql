-- PS-02 — StayFinder — Hotel Discovery & Booking
-- Starter queries. Every one runs as-is against data/PS-02.db.
--
-- CAST(x AS REAL) appears below only for sorting and rough exploration.
-- Never use it for a value you will show someone or add to another value.

-- ==========================================================================
-- 1. Natural-language search, translated into the filters it means
-- "quiet 4-star with a pool under 8000" is these joins. eval_nl_search_set holds 100 more.
-- ==========================================================================
SELECT h.name, h.star_rating, h.guest_score, h.distance_to_centre_km,
          MIN(rt.base_rate) AS from_rate, rt.currency
     FROM hotels h
     JOIN hotel_room_types rt ON rt.hotel_id = h.hotel_id
     JOIN hotel_amenities ha  ON ha.hotel_id = h.hotel_id
     JOIN amenities a         ON a.amenity_id = ha.amenity_id
    WHERE h.star_rating >= 4 AND a.code = 'swimming_pool'
      AND CAST(rt.base_rate AS REAL) < 8000
    GROUP BY h.hotel_id ORDER BY h.guest_score DESC LIMIT 15;

-- ==========================================================================
-- 2. The review set behind one pros-and-cons summary
-- About 25 per hotel, mixed languages. Summarising one review is not the feature.
-- ==========================================================================
SELECT r.language, r.traveller_type, r.rating, substr(r.body,1,90) AS body
     FROM hotel_reviews r
    WHERE r.hotel_id = (SELECT hotel_id FROM hotels ORDER BY hotel_id LIMIT 1)
    ORDER BY r.rating DESC;

-- ==========================================================================
-- 3. Language mix across the whole review corpus
-- R6 — the tag is telling you the truth. Your summariser has to cope.
-- ==========================================================================
SELECT language, COUNT(*) AS reviews, ROUND(AVG(rating),2) AS avg_rating
     FROM hotel_reviews GROUP BY language ORDER BY reviews DESC;

-- ==========================================================================
-- 4. Availability calendar and dated price for one hotel
-- This is what the room-availability widget reads.
-- ==========================================================================
SELECT rt.name AS room_type, ic.for_date, ic.total_units,
          ic.booked_units, ic.held_units,
          (ic.total_units - ic.booked_units - ic.held_units) AS free,
          ic.price, ic.currency
     FROM inventory_calendar ic
     JOIN hotel_room_types rt ON rt.room_type_id = ic.entity_id
    WHERE ic.entity_type='room_type'
      AND rt.hotel_id = (SELECT hotel_id FROM hotel_room_types
                          JOIN inventory_calendar ON entity_id = room_type_id LIMIT 1)
      AND ic.for_date BETWEEN '2026-09-01' AND '2026-09-14'
    ORDER BY rt.name, ic.for_date;

-- ==========================================================================
-- 5. Everything the AI concierge is allowed to answer from
-- Ground the concierge in exactly this. "Is there airport pickup?" is a column, not a guess.
-- ==========================================================================
SELECT h.name, p.airport_pickup, p.child_policy, p.pet_policy,
          p.early_checkin_possible, p.accessibility_notes, p.payment_methods,
          (SELECT GROUP_CONCAT(a.label, ', ') FROM hotel_amenities ha
             JOIN amenities a ON a.amenity_id = ha.amenity_id
            WHERE ha.hotel_id = h.hotel_id) AS amenities
     FROM hotels h JOIN hotel_policies p ON p.hotel_id = h.hotel_id
    ORDER BY h.hotel_id LIMIT 3;

-- ==========================================================================
-- 6. The shared NL-search evaluation set
-- Parse the utterance, produce expected_filters_json, score yourself. Hard cases carry has_negation=1.
-- ==========================================================================
SELECT case_id, utterance, language, difficulty, has_negation, expected_sort,
          expected_filters_json
     FROM eval_nl_search_set ORDER BY difficulty DESC, case_id LIMIT 12;
