"""
Review Summariser Service — synthesise multilingual reviews into Pros/Cons using Gemini.

Fetches exactly 25 reviews per hotel (mixed languages), sends raw multilingual text
to Gemini with instructions to summarise (NOT translate) in the user's language.
Returns structured Pros/Cons with review_id citations.
"""

from __future__ import annotations

import json
import logging

import google.generativeai as genai

from core.config import get_settings
from core.schemas import ReviewSummaryResponse, ReviewSummaryPoint, ReviewCitation

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a hotel review analyst for StayFinder. You will receive a set of multilingual hotel reviews (in Hindi, Tamil, English, Bengali, etc.).

Your job: Synthesise them into a structured summary with Pros and Cons.

## Critical Rules
1. DO NOT translate individual reviews. Summarise themes across all reviews.
2. Write the summary in the REQUESTED LANGUAGE (e.g., if asked for "hi", write in Hindi; if "en-IN", write in English).
3. Each Pro and Con MUST cite specific review IDs that support the point.
4. Provide 3-5 Pros and 2-4 Cons. Be specific (not generic).
5. Include a one-line "overall" impression with the average sentiment.
6. Use the exact review_ids provided — do not invent IDs.

## Output Format (strict JSON)
{
  "pros": [
    {
      "text": "The summary point in the requested language",
      "cited_reviews": ["rvw_xxx", "rvw_yyy"]
    }
  ],
  "cons": [
    {
      "text": "The summary point in the requested language",
      "cited_reviews": ["rvw_xxx"]
    }
  ],
  "overall": "One-line overall impression in the requested language"
}"""


async def summarise_hotel_reviews(hotel_id: str, language: str, db) -> ReviewSummaryResponse:
    """
    Fetch 25 reviews, synthesise into pros/cons via Gemini.
    Falls back to sentiment-grouped summaries if Gemini unavailable.
    """
    # Fetch 25 reviews, mixing languages for diversity
    cursor = await db.execute("""
        SELECT review_id, rating, title, body, language, sentiment_hint
        FROM hotel_reviews
        WHERE hotel_id = ?
        ORDER BY helpful_votes DESC, created_at DESC
        LIMIT 25
    """, [hotel_id])
    rows = await cursor.fetchall()

    if not rows:
        return ReviewSummaryResponse(hotel_id=hotel_id, language=language)

    settings = get_settings()

    if not settings.ai_available:
        logger.info("Gemini API not configured, using sentiment fallback")
        return _sentiment_fallback(hotel_id, language, rows)

    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(
            model_name=settings.gemini_model,
            system_instruction=SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )

        # Build the review block
        lang_names = {
            "en-IN": "English", "en-GB": "English", "hi": "Hindi",
            "ta": "Tamil", "te": "Telugu", "kn": "Kannada",
            "ml": "Malayalam", "mr": "Marathi", "bn": "Bengali", "gu": "Gujarati",
        }

        reviews_text = ""
        review_map: dict[str, dict] = {}
        for r in rows:
            rid = r["review_id"]
            review_map[rid] = r
            lang_label = lang_names.get(r["language"], r["language"])
            title_part = f' - "{r["title"]}"' if r.get("title") else ""
            reviews_text += f"[{rid}] (lang={lang_label}, rating={r['rating']}/10){title_part}\n{r['body']}\n\n"

        target_lang = lang_names.get(language, "English")
        prompt = f"Summarise these {len(rows)} hotel reviews. Write the summary in {target_lang} ({language}).\n\n{reviews_text}"

        response = model.generate_content(prompt)
        parsed = json.loads(response.text.strip())

        # Build structured response
        pros = []
        for p in parsed.get("pros", []):
            citations = []
            for rid in p.get("cited_reviews", []):
                if rid in review_map:
                    snippet = (review_map[rid]["body"] or "")[:120]
                    citations.append(ReviewCitation(review_id=rid, snippet=snippet))
            pros.append(ReviewSummaryPoint(text=p["text"], citations=citations))

        cons = []
        for c in parsed.get("cons", []):
            citations = []
            for rid in c.get("cited_reviews", []):
                if rid in review_map:
                    snippet = (review_map[rid]["body"] or "")[:120]
                    citations.append(ReviewCitation(review_id=rid, snippet=snippet))
            cons.append(ReviewSummaryPoint(text=c["text"], citations=citations))

        overall = parsed.get("overall", "")

        logger.info(f"Gemini summarised {len(rows)} reviews for {hotel_id}: {len(pros)} pros, {len(cons)} cons")

        return ReviewSummaryResponse(
            hotel_id=hotel_id,
            language=language,
            pros=pros,
            cons=cons,
            overall=overall,
        )

    except Exception as e:
        logger.warning(f"Gemini review summarisation failed: {e}, using fallback")
        return _sentiment_fallback(hotel_id, language, rows)


def _sentiment_fallback(hotel_id: str, language: str, rows: list[dict]) -> ReviewSummaryResponse:
    """Group reviews by sentiment when Gemini is unavailable."""
    pros = []
    cons = []

    for r in rows:
        sentiment = r.get("sentiment_hint", 0.5) or 0.5
        snippet = (r["body"] or "")[:120]
        citation = ReviewCitation(review_id=r["review_id"], snippet=snippet)

        if sentiment >= 0.6 and len(pros) < 5:
            title = r.get("title") or "Positive experience"
            # Avoid duplicate titles
            if not any(p.text == title for p in pros):
                pros.append(ReviewSummaryPoint(text=title, citations=[citation]))
            elif pros:
                pros[-1].citations.append(citation)

        elif sentiment <= 0.4 and len(cons) < 4:
            title = r.get("title") or "Could be improved"
            if not any(c.text == title for c in cons):
                cons.append(ReviewSummaryPoint(text=title, citations=[citation]))
            elif cons:
                cons[-1].citations.append(citation)

    avg_rating = sum(r["rating"] for r in rows) / len(rows)
    overall = f"Guests rate this property {avg_rating:.1f}/10 based on {len(rows)} recent reviews."

    return ReviewSummaryResponse(
        hotel_id=hotel_id,
        language=language,
        pros=pros,
        cons=cons,
        overall=overall,
    )
