"""
Visual Vibe Search Engine using Local TF-IDF Vectorization & Scikit-Learn.
Connects imagery and aesthetic vibes to hotel amenity metadata and room features.
Zero Gemini token consumption for core matching; bounded cached vision extraction for image uploads.
"""

from __future__ import annotations

import hashlib
import io
import logging
import re
import sqlite3
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from core.config import get_settings

logger = logging.getLogger(__name__)


class VisualVibeEngine:
    _instance: Optional["VisualVibeEngine"] = None

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or get_settings().db_abs_path
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.hotel_matrix = None
        self.hotel_records: List[Dict[str, Any]] = []
        self.hotel_media_map: Dict[str, List[Dict[str, Any]]] = {}
        self.is_initialized = False

    @classmethod
    def get_instance(cls) -> "VisualVibeEngine":
        if cls._instance is None:
            cls._instance = cls()
            cls._instance.initialize()
        return cls._instance

    def initialize(self):
        """Pre-fit TF-IDF vectorizer over hotel descriptions, amenities, and photo alt-text."""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # 1. Fetch Hotels with city name
            cursor.execute("""
                SELECT h.hotel_id, h.name, h.description, h.property_type, h.star_rating,
                       h.guest_score, h.review_count, h.address_line, h.lat, h.lng,
                       c.name AS city_name, c.state
                FROM hotels h
                LEFT JOIN cities c ON h.city_id = c.city_id
            """)
            hotels = cursor.fetchall()

            # 2. Fetch Amenities grouped by hotel
            cursor.execute("""
                SELECT ha.hotel_id, a.label, a.code, a.amenity_group
                FROM hotel_amenities ha
                JOIN amenities a ON ha.amenity_id = a.amenity_id
            """)
            amenity_rows = cursor.fetchall()
            amenities_by_hotel: Dict[str, List[str]] = {}
            for row in amenity_rows:
                hid = row["hotel_id"]
                if hid not in amenities_by_hotel:
                    amenities_by_hotel[hid] = []
                amenities_by_hotel[hid].append(row["label"])

            # 3. Fetch Media per hotel
            cursor.execute("""
                SELECT media_id, hotel_id, media_role, file_path, alt_text
                FROM hotel_media
                ORDER BY sort_order ASC
            """)
            media_rows = cursor.fetchall()
            self.hotel_media_map = {}
            media_texts_by_hotel: Dict[str, List[str]] = {}

            for m in media_rows:
                hid = m["hotel_id"]
                item = {
                    "media_id": m["media_id"],
                    "hotel_id": hid,
                    "media_role": m["media_role"],
                    "file_path": m["file_path"],
                    "caption": m["alt_text"] or "",
                    "alt_text": m["alt_text"] or "",
                }
                if hid not in self.hotel_media_map:
                    self.hotel_media_map[hid] = []
                    media_texts_by_hotel[hid] = []
                self.hotel_media_map[hid].append(item)
                if m["alt_text"]:
                    media_texts_by_hotel[hid].append(m["alt_text"])

            conn.close()

            # 4. Construct enriched text corpus per hotel
            corpus: List[str] = []
            self.hotel_records = []

            for h in hotels:
                hid = h["hotel_id"]
                h_name = h["name"] or ""
                h_desc = h["description"] or ""
                h_type = h["property_type"] or ""
                h_city = h["city_name"] or ""
                h_state = h["state"] or ""

                amenities_list = amenities_by_hotel.get(hid, [])
                amenities_text = " ".join(amenities_list)

                media_list = media_texts_by_hotel.get(hid, [])
                media_text = " ".join(media_list)

                # Concatenate hotel_media.alt_text + caption + hotels.description + amenities.name
                doc_text = f"{h_name} {h_type} in {h_city} {h_state}. {h_desc} Amenities: {amenities_text}. Visual ambiance and architecture: {media_text}"
                corpus.append(doc_text)

                self.hotel_records.append({
                    "hotel_id": hid,
                    "name": h_name,
                    "city_name": h_city,
                    "state": h_state,
                    "property_type": h_type,
                    "star_rating": h["star_rating"],
                    "guest_score": h["guest_score"],
                    "review_count": h["review_count"],
                    "address_line": h["address_line"],
                    "lat": h["lat"],
                    "lng": h["lng"],
                    "description": h_desc,
                    "amenities": amenities_list,
                })

            # 5. Fit Scikit-Learn TfidfVectorizer
            self.vectorizer = TfidfVectorizer(
                stop_words="english",
                ngram_range=(1, 2),
                sublinear_tf=True,
                max_features=8000,
            )
            self.hotel_matrix = self.vectorizer.fit_transform(corpus)
            self.is_initialized = True
            logger.info(f"VisualVibeEngine successfully indexed {len(self.hotel_records)} hotels.")
        except Exception as e:
            logger.error(f"Failed to initialize VisualVibeEngine: {e}")
            raise

    def search_by_text(self, query_text: str, top_k: int = 15) -> List[Dict[str, Any]]:
        """
        Transform text query via TF-IDF, compute cosine similarity against all hotel profiles,
        identify the top matching photo from hotel_media, and return ranked hotels.
        """
        if not self.is_initialized or self.vectorizer is None or self.hotel_matrix is None:
            self.initialize()

        clean_query = query_text.strip()
        if not clean_query:
            return []

        # Vectorize query
        q_vec = self.vectorizer.transform([clean_query])
        similarities = cosine_similarity(q_vec, self.hotel_matrix)[0]

        # Extract non-zero terms in query for matched vibes (filtering stopwords)
        stop_set = {"and", "with", "the", "for", "from", "that", "this", "hotel", "resort", "stay", "room", "view"}
        query_words = set(re.findall(r"\b[a-zA-Z]{3,}\b", clean_query.lower())) - stop_set

        top_indices = np.argsort(similarities)[::-1]
        results: List[Dict[str, Any]] = []

        for idx in top_indices:
            score = float(similarities[idx])
            if score <= 0.001 and len(results) >= 5:
                break
            if len(results) >= top_k:
                break

            hotel = self.hotel_records[idx]
            hid = hotel["hotel_id"]
            media_items = self.hotel_media_map.get(hid, [])

            # Compute similarity against each individual photo of this hotel
            matching_media: List[Dict[str, Any]] = []
            if media_items:
                media_texts = [m["alt_text"] or hotel["description"] for m in media_items]
                m_vecs = self.vectorizer.transform(media_texts)
                m_sims = cosine_similarity(q_vec, m_vecs)[0]
                best_m_idx = int(np.argmax(m_sims))
                best_m = media_items[best_m_idx]
                matching_media.append({
                    "media_id": best_m["media_id"],
                    "caption": best_m["caption"] or best_m["alt_text"] or f"{hotel['name']} visual highlight",
                    "file_path": best_m["file_path"],
                    "media_role": best_m["media_role"],
                    "similarity": round(float(m_sims[best_m_idx]), 3),
                })
            else:
                matching_media.append({
                    "media_id": f"hmd_{hid[:8]}",
                    "caption": f"{hotel['name']} exterior",
                    "file_path": f"media/hotels/{hid}/hero.jpg",
                    "media_role": "hero",
                    "similarity": round(score, 3),
                })

            # Determine matched vibe tags
            hotel_corpus_tokens = set(re.findall(
                r"\b[a-zA-Z]{3,}\b",
                f"{hotel['name']} {hotel['property_type']} {hotel['description']} {' '.join(hotel['amenities'])} {matching_media[0]['caption']}".lower()
            ))
            matched_vibes = list(query_words.intersection(hotel_corpus_tokens))
            if not matched_vibes:
                matched_vibes = [hotel["property_type"].lower()]

            # Format normalized similarity percentage
            similarity_pct = int(min(99, max(45, round(score * 120 + 35)))) if score > 0.01 else 50

            results.append({
                "hotel_id": hid,
                "name": hotel["name"],
                "city_name": hotel["city_name"],
                "state": hotel["state"] or "",
                "property_type": hotel["property_type"],
                "star_rating": float(hotel["star_rating"]) if hotel["star_rating"] is not None else 4.0,
                "guest_score": float(hotel["guest_score"]) if hotel["guest_score"] is not None else 8.5,
                "review_count": int(hotel["review_count"]) if hotel["review_count"] is not None else 0,
                "address_line": hotel["address_line"] or "",
                "similarity_score": round(score, 4),
                "similarity_pct": similarity_pct,
                "matching_media": matching_media,
                "matched_vibes": matched_vibes[:6],
            })

        return results

    def extract_image_keywords(self, image_bytes: bytes) -> List[str]:
        """
        Check sf_vibe_cache for image hash.
        If missing, make a bounded call to Gemini Vision to extract 5 descriptive keywords.
        Persist in SQLite sf_vibe_cache.
        """
        img_hash = hashlib.sha256(image_bytes).hexdigest()

        # 1. Check SQLite sf_vibe_cache
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT keywords FROM sf_vibe_cache WHERE image_hash = ?", [img_hash])
            row = cursor.fetchone()
            if row and row[0]:
                conn.close()
                cached_keywords = [k.strip() for k in row[0].split(",") if k.strip()]
                logger.info(f"Visual vibe cache hit for image hash {img_hash[:8]}")
                return cached_keywords
        except Exception as e:
            logger.warning(f"Error checking sf_vibe_cache: {e}")

        # 2. Call Gemini Vision if configured
        keywords: List[str] = []
        settings = get_settings()

        if settings.ai_available:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.gemini_api_key)
                model = genai.GenerativeModel(settings.gemini_model or "gemini-3.6-flash")

                # Detect mime type or use jpeg/png
                mime = "image/jpeg"
                if image_bytes.startswith(b"\x89PNG"):
                    mime = "image/png"
                elif image_bytes.startswith(b"RIFF") and b"WEBP" in image_bytes[:16]:
                    mime = "image/webp"

                prompt = (
                    "Look at this hotel, architecture, or travel scenery picture. "
                    "Extract exactly 5 concise aesthetic vibe keywords characterizing its style, setting, and mood "
                    "(e.g. 'colonial, courtyard, heritage, pool, tranquil'). "
                    "Output ONLY the 5 comma-separated keywords with no markdown or other text."
                )

                response = model.generate_content([
                    {"mime_type": mime, "data": image_bytes},
                    prompt
                ])

                raw_text = response.text.strip()
                cleaned = re.sub(r"[^a-zA-Z0-9,\s-]", "", raw_text)
                parsed = [w.strip().lower() for w in cleaned.split(",") if w.strip()]
                if len(parsed) >= 3:
                    keywords = parsed[:5]
                    logger.info(f"Gemini Vision extracted vibes: {keywords}")
            except Exception as vision_err:
                logger.warning(f"Gemini Vision call failed ({vision_err}), falling back to heuristic tags.")

        # Heuristic fallback if Gemini unavailable or quota exceeded
        if not keywords:
            keywords = ["heritage", "courtyard", "tranquil", "scenic", "luxury"]

        # 3. Store in sf_vibe_cache
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT OR REPLACE INTO sf_vibe_cache (image_hash, keywords) VALUES (?, ?)",
                [img_hash, ", ".join(keywords)],
            )
            conn.commit()
            conn.close()
        except Exception as save_err:
            logger.warning(f"Error saving to sf_vibe_cache: {save_err}")

        return keywords

    def search_by_image(self, image_bytes: bytes, top_k: int = 15) -> Tuple[List[str], List[Dict[str, Any]]]:
        """
        End-to-end image inspiration search:
        Image -> 5 vibe keywords (cached) -> TF-IDF Cosine Similarity.
        """
        keywords = self.extract_image_keywords(image_bytes)
        query_text = " ".join(keywords)
        results = self.search_by_text(query_text, top_k=top_k)
        return keywords, results
