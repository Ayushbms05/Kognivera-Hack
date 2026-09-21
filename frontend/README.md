# StayFinder — Luxury Frontend Web Application

> **Next.js 14 (App Router) · Tailwind CSS · MapLibre GL · Recharts · Lucide React · decimal.js**  
> Luxury-grade hotel discovery, visual booking, dynamic pricing intelligence, and itinerary planning interface.

---

## 1. Key Features & Components

- **Luxury Design System:**
  - Bespoke warm palette: Signature Terracotta (`#E05C3A`), Warm Sand/Linen (`#FAF9F6`), Deep Forest Slate (`#1A2421`), and Gold Highlights.
  - Editorial typography using Google Fonts (*Plus Jakarta Sans* for UI, *Outfit* for headings).
  - Subtle micro-animations, glassmorphism (`backdrop-blur-md`), and glowing elevations.
- **Dynamic Price Intelligence (`PriceGraph.tsx`):**
  - Interactive Recharts area graph displaying 30-day forward price fluctuations with gradient fills, custom tooltips, and peak savings badges.
- **AI 3-Day Itinerary Builder (`ItineraryTimeline.tsx`):**
  - Gemini-powered custom travel timeline with vibe selectors (Cultural, Romantic, Foodie, Adventure) and recommended dining spots.
- **Interactive Map with Walkability Radius (`Map.tsx`):**
  - MapLibre GL JS with custom interactive price pill markers.
  - Generates a **2.0 km geodesic walkability circle** on card hover or selection to preview immediate neighborhood walkability.
- **Live Multi-Currency Engine (`CurrencyContext.tsx`):**
  - Zero-page-reload instant currency converter supporting INR, USD, EUR, GBP, AED, SGD, AUD, CAD, and JPY.
  - High-precision monetary calculations via `decimal.js` with persistent `localStorage` memory.
- **Multilingual Review Synthesizer (`ReviewSummary.tsx`):**
  - Real-time guest review distillation into structured Pros & Cons with clickable citations to raw reviews.
- **Conversational Search Bar (`SearchBar.tsx`):**
  - Natural language input with voice search capabilities (Web Speech API) and dismissable criteria filter chips.
- **Statutory GST Checkout & Voucher (`book/` & `confirmation/`):**
  - Transparent Indian hospitality GST computation (12% vs 18%).
  - Booking confirmation voucher with celebratory confetti (`canvas-confetti`), one-click WhatsApp share link, and printable boarding-style pass.

---

## 2. Directory Structure

```
frontend/
├── app/
│   ├── globals.css                # Typography imports, design tokens, utility classes
│   ├── layout.tsx                 # Root layout, fonts, CurrencyProvider, Navbar & Footer
│   ├── page.tsx                   # Landing page, hero search, curated stays & vibe recommendations
│   ├── search/
│   │   └── page.tsx               # Split-view search: filterable hotel list & interactive map
│   ├── hotel/
│   │   └── [id]/
│   │       └── page.tsx           # Hotel details, room selection, price trends, AI itinerary
│   ├── book/
│   │   └── [id]/
│   │       └── page.tsx           # Checkout form, guest info, and statutory GST calculation
│   └── confirmation/
│       └── [bookingId]/
│           └── page.tsx           # Digital booking pass, WhatsApp share, print pass
│
├── components/
│   ├── Navbar.tsx                 # Brand navigation, live currency picker, user persona
│   ├── Footer.tsx                 # Luxury footer with links and hackathon credentials
│   ├── SearchBar.tsx              # Dual-mode AI conversational & voice search
│   ├── HotelCard.tsx              # Hotel card with Vibe Match affinity & FOMO badge
│   ├── RoomCard.tsx               # Room type selection card with live currency formatting
│   ├── Map.tsx                    # MapLibre GL map with 2km geodesic walkability radius
│   ├── PriceGraph.tsx             # Recharts 30-day dynamic price trend area graph
│   ├── ItineraryTimeline.tsx      # Gemini 3-day itinerary planner timeline
│   ├── ReviewSummary.tsx          # Multilingual review synthesizer with verified citations
│   ├── ConciergeWidget.tsx        # Floating property concierge Q&A modal
│   └── FilterChips.tsx            # Dismissable AI filter tag chips
│
├── context/
│   └── CurrencyContext.tsx        # Global currency state, FX rates, and decimal.js formatter
│
├── lib/
│   ├── api.ts                     # Typed API client for FastAPI backend
│   └── utils.ts                   # GST calculations, formatting, image fallback resolver
│
├── types/
│   └── index.ts                   # Strict TypeScript interfaces matching backend models
│
├── tailwind.config.ts             # Tailwind CSS theme configuration and custom colors
├── tsconfig.json                  # TypeScript compiler settings
└── package.json                   # Dependencies and scripts
```

---

## 3. Getting Started

### Installation
```bash
cd frontend
npm install
```

### Development Server
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

### Production Build & Serve
```bash
npm run build
npm run start -- -p 3001
```
Open **`http://localhost:3001`** in your browser.

---

## 4. Design Palette & Tokens

| Token | Hex Value | Usage |
|---|---|---|
| **Terracotta Primary** | `#E05C3A` | Brand accent, primary CTAs, active states |
| **Sand / Linen** | `#FAF9F6` | App background, soft cards, warm neutral canvas |
| **Forest Slate** | `#1A2421` | High-contrast luxury headings, dark cards, footer |
| **Gold / Amber** | `#D97706` | Star ratings, peak savings badges, VIP highlights |
| **Muted Slate** | `#64748B` | Secondary descriptions, metadata, subtitles |
