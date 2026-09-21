"""
StayFinder Backend — FastAPI Application Entry Point.

Run with: uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from core.database import init_db, close_db


# ── Lifespan ─────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    settings = get_settings()
    print("[StayFinder] Backend starting...")
    print(f"  Database: {settings.db_abs_path}")
    print(f"  Debug: {settings.debug}")
    print(f"  AI Model: {settings.gemini_model} ({'configured' if settings.ai_available else 'NO API KEY'})")
    await init_db()
    print("  [OK] Database initialised (WAL mode)")
    yield
    await close_db()
    print("[StayFinder] Backend shutting down")


# ── App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="StayFinder API",
    description="Hotel discovery and booking platform with AI-powered features",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ───────────────────────────────────────────────────────────

from api.hotels import router as hotels_router
from api.search import router as search_router
from api.bookings import router as bookings_router
from api.users import router as users_router
from api.concierge import router as concierge_router
from api.reviews import router as reviews_router
from api.itinerary import router as itinerary_router
from api.price_trends import router as price_trends_router
from api.currencies import router as currencies_router
from api.pricing import router as pricing_router
from api.auth import router as auth_router
from api.onboarding import router as onboarding_router
from api.arbitrage import router as arbitrage_router
from api.room_optimizer import router as room_optimizer_router
from api.group_consensus import router as group_consensus_router
from api.offline_sync import router as offline_sync_router

app.include_router(group_consensus_router)
app.include_router(offline_sync_router)
app.include_router(hotels_router)
app.include_router(search_router)
app.include_router(bookings_router)
app.include_router(users_router)
app.include_router(concierge_router)
app.include_router(reviews_router)
app.include_router(itinerary_router)
app.include_router(price_trends_router)
app.include_router(currencies_router)
app.include_router(pricing_router)
app.include_router(auth_router)
app.include_router(onboarding_router)
app.include_router(arbitrage_router)
app.include_router(room_optimizer_router)





# ── Health ───────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "stayfinder-api", "version": "1.0.0"}
