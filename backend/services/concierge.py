"""
Property Concierge Service — grounded Q&A using Gemini.

Retrieves hotel_policies + hotel_amenities + basic hotel info as context,
then uses Gemini to answer questions STRICTLY from that context.
Refuses to answer if the data isn't available.
"""

from __future__ import annotations

import json
import logging

import google.generativeai as genai

from core.config import get_settings
from core.schemas import ConciergeQuery, ConciergeResponse

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are StayFinder's Property Concierge — a helpful, friendly hotel assistant.

## Your ONLY Job
Answer guest questions about a SPECIFIC hotel using ONLY the factual data provided below. You are NOT a general travel assistant.

## Strict Rules
1. ONLY use information from the CONTEXT provided. Never invent facts.
2. If the context does not contain the answer, say: "I don't have that specific information. Please contact the hotel directly for assistance."
3. Be concise, warm, and helpful. Use 1-3 sentences max.
4. If asked about things like room service hours, specific restaurant menus, or real-time availability — these are not in your context, so politely decline.
5. Respond in the same language as the question. If asked in Hindi, respond in Hindi.
6. At the end, suggest 2-3 related questions the guest might want to ask.

## Output Format (strict JSON)
{
  "answer": "Your answer here",
  "sources": ["hotel_policies.pet_policy", "amenities.swimming_pool"],
  "suggested_questions": ["Question 1?", "Question 2?", "Question 3?"]
}"""


async def answer_question(req: ConciergeQuery, db) -> ConciergeResponse:
    """
    Answer a hotel question using Gemini with strict grounding.
    Falls back to keyword matching if Gemini unavailable.
    """
    # Fetch all context for this hotel
    context = await _build_hotel_context(req.hotel_id, db)

    if not context:
        return ConciergeResponse(
            answer="I couldn't find information about this hotel.",
            sources=[],
            suggested_questions=[],
        )

    settings = get_settings()

    if not settings.ai_available:
        logger.info("Gemini API not configured, using keyword fallback")
        return _keyword_fallback(req.question, context)

    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(
            model_name=settings.gemini_model,
            system_instruction=SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )

        # Build context block
        context_text = f"""## Hotel: {context['name']}

### Basic Info
- Check-in: {context['checkin_time']}
- Check-out: {context['checkout_time']}
- Star Rating: {context['star_rating']}
- Property Type: {context['property_type']}
- Address: {context['address_line']}

### Policies
- Child Policy: {context.get('child_policy', 'Not specified')}
- Pet Policy: {context.get('pet_policy', 'Not specified')}
- Extra Bed: {context.get('extra_bed_policy', 'Not specified')}
- Extra Bed Charge: {context.get('extra_bed_charge', 'Not specified')}
- Payment Methods: {context.get('payment_methods', 'Not specified')}
- Airport Pickup: {'Available' if context.get('airport_pickup') else 'Not available/unknown'}
- Early Check-in: {'May be available on request' if context.get('early_checkin_possible') else 'Not available'}
- Accessibility: {context.get('accessibility_notes', 'Not specified')}

### Amenities
{chr(10).join(f"- {a['label']}: {'Free' if a['is_free'] else 'Paid'}{' (' + a['note'] + ')' if a.get('note') else ''}" for a in context.get('amenities', []))}
"""

        # Include conversation history if any
        history_text = ""
        if req.conversation_history:
            history_text = "\n### Previous conversation:\n"
            for turn in req.conversation_history[-4:]:  # Last 4 turns
                history_text += f"Guest: {turn.get('question', '')}\nConcierge: {turn.get('answer', '')}\n\n"

        prompt = f"{context_text}{history_text}\n\nGuest question: {req.question}"

        response = model.generate_content(prompt)
        parsed = json.loads(response.text.strip())

        logger.info(f"Gemini concierge answered for {req.hotel_id}: {parsed.get('sources', [])}")

        return ConciergeResponse(
            answer=parsed.get("answer", "I'm not sure about that. Please contact the hotel."),
            sources=parsed.get("sources", []),
            suggested_questions=parsed.get("suggested_questions", []),
        )

    except Exception as e:
        logger.warning(f"Gemini concierge failed: {e}, using keyword fallback")
        return _keyword_fallback(req.question, context)


async def _build_hotel_context(hotel_id: str, db) -> dict | None:
    """Build a complete context dict for a hotel from DB."""
    # Basic hotel info
    cursor = await db.execute(
        "SELECT name, checkin_time, checkout_time, star_rating, property_type, address_line FROM hotels WHERE hotel_id = ?",
        [hotel_id],
    )
    hotel = await cursor.fetchone()
    if not hotel:
        return None

    context = dict(hotel)

    # Policies
    cursor = await db.execute(
        "SELECT * FROM hotel_policies WHERE hotel_id = ?", [hotel_id]
    )
    policy = await cursor.fetchone()
    if policy:
        context.update({
            "child_policy": policy.get("child_policy"),
            "pet_policy": policy.get("pet_policy"),
            "extra_bed_policy": policy.get("extra_bed_policy"),
            "extra_bed_charge": policy.get("extra_bed_charge"),
            "payment_methods": policy.get("payment_methods"),
            "airport_pickup": bool(policy.get("airport_pickup", 0)),
            "early_checkin_possible": bool(policy.get("early_checkin_possible", 0)),
            "accessibility_notes": policy.get("accessibility_notes"),
        })

    # Amenities
    cursor = await db.execute("""
        SELECT a.code, a.label, ha.is_free, ha.note
        FROM hotel_amenities ha
        JOIN amenities a ON ha.amenity_id = a.amenity_id
        WHERE ha.hotel_id = ?
    """, [hotel_id])
    amenities = await cursor.fetchall()
    context["amenities"] = amenities

    return context


def _keyword_fallback(question: str, context: dict) -> ConciergeResponse:
    """Simple keyword-based fallback when Gemini is unavailable."""
    q = question.lower()
    answer = ""
    sources = []

    if any(kw in q for kw in ["pet", "dog", "cat", "animal"]):
        answer = context.get("pet_policy") or "No pet policy information available."
        sources = ["hotel_policies.pet_policy"]
    elif any(kw in q for kw in ["child", "kid", "baby", "infant", "family"]):
        answer = context.get("child_policy") or "No child policy information available."
        sources = ["hotel_policies.child_policy"]
    elif any(kw in q for kw in ["extra bed", "rollaway", "cot"]):
        answer = context.get("extra_bed_policy") or "No extra bed information available."
        sources = ["hotel_policies.extra_bed_policy"]
    elif any(kw in q for kw in ["check-in", "checkin", "check in", "arrival"]):
        answer = f"Check-in time is {context.get('checkin_time', 'not specified')}."
        if context.get("early_checkin_possible"):
            answer += " Early check-in may be available upon request."
        sources = ["hotels.checkin_time"]
    elif any(kw in q for kw in ["check-out", "checkout", "check out", "departure"]):
        answer = f"Check-out time is {context.get('checkout_time', 'not specified')}."
        sources = ["hotels.checkout_time"]
    elif any(kw in q for kw in ["payment", "pay", "card", "upi"]):
        methods = context.get("payment_methods", "")
        answer = f"Accepted payment methods: {methods.replace(',', ', ')}." if methods else "Please contact the hotel for payment options."
        sources = ["hotel_policies.payment_methods"]
    elif any(kw in q for kw in ["airport", "pickup", "transfer", "shuttle"]):
        if context.get("airport_pickup"):
            answer = "Airport pickup is available. Please contact the hotel to arrange."
        else:
            answer = "Airport pickup information is not available for this property."
        sources = ["hotel_policies.airport_pickup"]
    elif any(kw in q for kw in ["accessible", "wheelchair", "disability"]):
        answer = context.get("accessibility_notes") or "No accessibility information available."
        sources = ["hotel_policies.accessibility_notes"]
    elif any(kw in q for kw in ["wifi", "internet", "wi-fi"]):
        wifi = [a for a in context.get("amenities", []) if "wifi" in a.get("code", "")]
        if wifi:
            w = wifi[0]
            answer = f"{w['label']} is {'complimentary' if w['is_free'] else 'available for a fee'}."
        else:
            answer = "Wi-Fi availability is not confirmed for this property."
        sources = ["hotel_amenities"]
    elif any(kw in q for kw in ["pool", "swimming"]):
        pool = [a for a in context.get("amenities", []) if "pool" in a.get("code", "")]
        if pool:
            answer = f"Yes, the property has a {pool[0]['label'].lower()}."
        else:
            answer = "This property does not appear to have a swimming pool."
        sources = ["hotel_amenities"]
    elif any(kw in q for kw in ["amenity", "amenities", "facility", "facilities"]):
        labels = [a["label"] for a in context.get("amenities", [])]
        if labels:
            answer = f"Available amenities include: {', '.join(labels)}."
        else:
            answer = "No amenity information available."
        sources = ["hotel_amenities"]
    else:
        answer = "I don't have that specific information. Please contact the hotel directly for assistance."

    return ConciergeResponse(
        answer=answer,
        sources=sources,
        suggested_questions=[
            "What's the check-in time?",
            "Is the hotel pet-friendly?",
            "What payment methods are accepted?",
            "Is there airport pickup?",
        ],
    )
