# StayFinder — Backend API & AI Engine

> **FastAPI · SQLite (`PS-02.db`) · Google Gemini (`gemini-3.6-flash`) · Pydantic v2**  
> High-performance asynchronous backend service designed for Indian hospitality, offering semantic search, grounded property concierge, multilingual review synthesis, dynamic pricing analytics, and AI itinerary generation.

---

## 1. Overview & Key Capabilities

- **Conformant SQLite Database:** Connects to `data/PS-02.db` compliant with `CONTRACT v1.1.0-rc1` (verified with `tools/validate_conformance.py`).
- **Google Gemini Integration:** Uses `gemini-3.6-flash` for:
  - Natural language search query parsing into structured filters.
  - Zero-hallucination property concierge Q&A grounded strictly in database policies and amenities.
  - Multilingual review distillation with direct review quote citations.
  - 3-day personalized day-by-day travel itineraries.
- **Dynamic Pricing & Analytics:** Generates 30-day historical and forward price trends with peak savings detection.
- **Multi-Currency Service:** Real-time exchange rates across major international currencies (INR base, USD, EUR, GBP, AED, SGD, AUD, CAD, JPY).
- **Statutory Indian GST Calculation:** Strict 12% ($\le$ ₹7,500/night) and 18% ($>$ ₹7,500/night) hospitality tax engine with non-destructive booking persistence in `sf_bookings`.

---

## 2. Directory Structure

```
backend/
├── main.py                     # FastAPI application factory, CORS, and lifecycle
├── requirements.txt            # Python dependencies
├── .env                        # Local environment variables (GEMINI_API_KEY)
├── .env.example                # Example environment template
│
├── api/                        # Route Handlers
│   ├── hotels.py               # Hotel list, detail, availability, cities
│   ├── search.py               # Natural language parser & autocomplete
│   ├── bookings.py             # Booking reservation engine (sf_bookings)
│   ├── users.py                # User profiles & affinity recommendations
│   ├── concierge.py            # Grounded property concierge Q&A
│   ├── reviews.py              # Multilingual review synthesis
│   ├── itinerary.py            # Gemini 3-day itinerary generation
│   ├── price_trends.py         # 30-day pricing analytics & savings badge
│   ├── currencies.py           # Multi-currency exchange rates (02_currencies.csv)
│   └── pricing.py              # Statutory Indian GST & multi-currency apportionment
│
├── core/                       # Core Configuration & Foundation
│   ├── config.py               # Pydantic Settings with dynamic DB resolution
│   ├── database.py             # aiosqlite async connection manager with WAL mode
│   └── schemas.py              # Pydantic v2 validation & response models
│
├── services/                   # Business & AI Logic
│   ├── nl_search.py            # Gemini conversational search parser
│   ├── review_summariser.py    # Cross-language review distillation engine
│   ├── concierge.py            # Context-bound property Q&A
│   ├── itinerary.py            # AI itinerary generator service
│   ├── ranking.py              # User style & interaction affinity scoring
│   ├── pricing_engine.py       # High-precision Decimal GST & Largest-Remainder math
│   └── vibe_search.py          # Local TF-IDF & Scikit-Learn Visual Vibe Engine
│
└── data/                       # Ingested Dataset & Starter Kit
    ├── PS-02.db                # SQLite database (11 Tier-1 tables, 21,270 rows)
    ├── schema.sql              # PostgreSQL DDL
    ├── schema.sqlite.sql       # SQLite DDL
    ├── enums.json              # Enum definitions
    ├── WORKING_WITH_THE_DATA.md# Dataset documentation
    ├── queries/                # Starter SQL queries
    └── csv/                    # 21 Canonical CSV datasets
        ├── 01_amenities.csv
        ├── 02_currencies.csv
        ├── ...
        └── 21_payments.csv
```

---

## 3. Environment Variables

Create a `backend/.env` file with the following variables:

```ini
# Required: Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Gemini Model Identifier
GEMINI_MODEL=gemini-3.6-flash

# Database path (relative to backend/ or absolute)
DATABASE_PATH=data/PS-02.db

# Allowed CORS Origins
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001

# Debug Mode
DEBUG=True
```

---

## 4. API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Backend service health check |
| `GET` | `/api/hotels` | Paginated hotels with filtering (city, stars, price, amenities, sort) |
| `GET` | `/api/hotels/{id}` | Full hotel details (room types, policies, amenities, media) |
| `GET` | `/api/hotels/{id}/availability` | Date-range room inventory availability & FOMO badge |
| `GET` | `/api/hotels/{id}/price-trends` | 30-day pricing curve, lowest rate, peak savings |
| `GET` | `/api/hotels/{id}/price-analytics` | Local numerical ML time-series analytics (polyfit + 7-day MA + scarcity) |
| `GET` | `/api/hotels/{id}/proximity` | Dynamic walkability isochrone & attraction proximity (spatial geodesic math) |
| `GET` | `/api/hotels/{id}/itinerary` | Local ML-powered (KNN + Haversine) 3-day curated trip itinerary |
| `GET` | `/api/hotels/cities/list` | All 60 destinations with hotel counts |
| `POST` | `/api/search/nl` | Gemini NL parser converting voice/text to structured filters |
| `POST` | `/api/search/vibe` | Visual Vibe Search connecting imagery to amenities via local TF-IDF |
| `GET` | `/api/search/suggestions` | Instant autocomplete matching cities and hotels |
| `POST` | `/api/concierge` | Grounded property Q&A using verified policies & amenities |
| `POST` | `/api/reviews/summarise` | Multilingual review synthesis with quote citations |
| `POST` | `/api/itinerary/generate` | Gemini 3-day custom itinerary generator |
| `GET` | `/api/currencies` | Real-time currency exchange rates (02_currencies.csv) |
| `POST` | `/api/pricing/calculate` | Statutory Indian GST breakdown & zero-drift multi-currency apportionment |
| `POST` | `/api/bookings` | Create reservation with strict Indian GST breakdown |
| `GET` | `/api/bookings/{id}` | Retrieve booking voucher by ID |
| `GET` | `/api/users/{id}/recommendations` | Personalized hotel ranking based on user travel persona |

---

## 5. Running the Backend

### Installation
```bash
cd backend
python -m pip install -r requirements.txt
```

### Start Development Server
```bash
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Interactive API Docs (Swagger UI)
Open **`http://127.0.0.1:8000/docs`** to test all endpoints interactively.

---

## 6. Conformance Testing

To verify data conformance against the competition contract:

```bash
# Run from repository root
python tools/validate_conformance.py backend/data/PS-02.db
```
Expected output: **`PASS`** (11 Tier 1 tables inspected, 21,270 rows, zero failures).
