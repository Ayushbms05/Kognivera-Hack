import {
  HotelListResponse,
  HotelDetail,
  HotelListItem,
  NLSearchResponse,
  ConciergeQuery,
  ConciergeResponse,
  ReviewSummaryResponse,
  BookingRequest,
  BookingResponse,
  UserProfile,
  HotelProximityResponse,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const isFormData = typeof FormData !== "undefined" && options?.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string> || {}),
    };
    if (!isFormData && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      ...options,
      headers,
      cache: "no-store", // ensure dynamic data during hackathon demo
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API Error ${res.status}: ${errText}`);
    }

    return await res.json();
  } catch (error) {
    console.error(`Fetch failed for ${url}:`, error);
    throw error;
  }
}

// Proximity in-memory cache
const proximityCache = new Map<string, Promise<HotelProximityResponse>>();

export const api = {
  // Hotels
  async getHotels(params?: Record<string, any>): Promise<HotelListResponse> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          if (Array.isArray(val)) {
            val.forEach((item) => query.append(key, String(item)));
          } else {
            query.set(key, String(val));
          }
        }
      });
    }
    const qs = query.toString() ? `?${query.toString()}` : "";
    return fetchJson<HotelListResponse>(`/hotels${qs}`);
  },

  async getHotelDetail(hotelId: string, checkIn?: string, checkOut?: string): Promise<HotelDetail> {
    const query = new URLSearchParams();
    if (checkIn) query.set("check_in", checkIn);
    if (checkOut) query.set("check_out", checkOut);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return fetchJson<HotelDetail>(`/hotels/${hotelId}${qs}`);
  },

  async getCities(): Promise<{ cities: Array<{ city_id: string; name: string; state: string; hotel_count: number }> }> {
    return fetchJson(`/hotels/cities/list`);
  },

  // Search & AI NL Query
  async nlSearch(query: string, language: string = "en-IN"): Promise<NLSearchResponse> {
    return fetchJson<NLSearchResponse>(`/search/nl`, {
      method: "POST",
      body: JSON.stringify({ query, language }),
    });
  },

  async getSuggestions(query: string): Promise<{ cities: Array<{ city_id: string; name: string; state: string }>; hotels: Array<{ hotel_id: string; name: string; city_name: string }> }> {
    return fetchJson(`/search/suggestions?q=${encodeURIComponent(query)}`);
  },

  // Property Concierge (Gemini-powered Grounded Q&A)
  async askConcierge(payload: ConciergeQuery): Promise<ConciergeResponse> {
    return fetchJson<ConciergeResponse>(`/concierge`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Multilingual Review Summaries (Gemini-powered)
  async getReviewSummary(hotelId: string, language: string = "en-IN"): Promise<ReviewSummaryResponse> {
    return fetchJson<ReviewSummaryResponse>(`/reviews/summarise`, {
      method: "POST",
      body: JSON.stringify({ hotel_id: hotelId, language }),
    });
  },

  // Bookings
  async createBooking(payload: BookingRequest): Promise<BookingResponse> {
    return fetchJson<BookingResponse>(`/bookings`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getBooking(bookingId: string): Promise<BookingResponse> {
    return fetchJson<BookingResponse>(`/bookings/${bookingId}`);
  },

  // Users & Personalisation
  async getUser(userId: string = "usr_001"): Promise<UserProfile> {
    return fetchJson<UserProfile>(`/users/${userId}`);
  },

  async getRecommendations(userId: string = "usr_001", cityId?: string, limit: number = 6): Promise<{ user_id: string; items: HotelListItem[] }> {
    const qs = cityId ? `?city_id=${cityId}&limit=${limit}` : `?limit=${limit}`;
    return fetchJson(`/users/${userId}/recommendations${qs}`);
  },

  // Price Trends
  async getPriceTrends(hotelId: string): Promise<import("@/types").PriceTrendsResponse> {
    return fetchJson(`/hotels/${hotelId}/price-trends`);
  },

  // AI Auto-Itinerary
  async generateItinerary(payload: {
    hotel_id: string;
    user_id?: string;
    travel_style?: string;
    days?: number;
  }): Promise<import("@/types").ItineraryResponse> {
    return fetchJson(`/itinerary/generate`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Local ML-Powered Curated Itinerary (KNN + Haversine)
  async getCuratedItinerary(hotelId: string, days: number = 3, userId?: string): Promise<import("@/types").CuratedItineraryResponse> {
    const params = new URLSearchParams({ days: String(days) });
    if (userId) params.append("user_id", userId);
    return fetchJson(`/hotels/${hotelId}/itinerary?${params.toString()}`);
  },

  // Currencies
  async getCurrencies(): Promise<{ base_currency: string; currencies: import("@/types").CurrencyItem[] }> {
    return fetchJson(`/currencies`);
  },

  // Local Numerical ML Price Analytics
  async getPriceAnalytics(hotelId: string, roomTypeId?: string): Promise<import("@/types").PriceAnalyticsResponse> {
    const qs = roomTypeId ? `?room_type_id=${roomTypeId}` : "";
    return fetchJson(`/hotels/${hotelId}/price-analytics${qs}`);
  },

  // Dynamic Walkability Isochrone & Attraction Proximity
  getHotelProximity(hotelId: string): Promise<import("@/types").HotelProximityResponse> {
    if (!proximityCache.has(hotelId)) {
      proximityCache.set(
        hotelId,
        fetchJson<import("@/types").HotelProximityResponse>(`/hotels/${hotelId}/proximity`)
      );
    }
    return proximityCache.get(hotelId)!;
  },

  // Multi-Currency Engine & Statutory Indian GST Apportionment
  async calculatePricing(payload: {
    room_type_id: string;
    rate_plan_id?: string | null;
    target_currency: string;
    nights: number;
  }): Promise<import("@/types").PricingCalculateResponse> {
    return fetchJson(`/pricing/calculate`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Visual Vibe Search (Local TF-IDF & Vision NLP)
  async searchVibe(params: {
    query_text?: string;
    file?: File | Blob;
  }): Promise<import("@/types").VibeSearchItem[]> {
    if (params.file) {
      const formData = new FormData();
      formData.append("file", params.file);
      if (params.query_text) formData.append("query_text", params.query_text);
      return fetchJson(`/search/vibe`, {
        method: "POST",
        body: formData,
      });
    } else {
      return fetchJson(`/search/vibe`, {
        method: "POST",
        body: JSON.stringify({ query_text: params.query_text || "" }),
      });
    }
  },

  // 360° Virtual Tour XR Status
  async getHotelXRStatus(hotelId: string): Promise<import("@/types").HotelXRStatusResponse> {
    return fetchJson<import("@/types").HotelXRStatusResponse>(`/hotels/${hotelId}/xr-status`);
  },

  // Live Persona Switcher & Re-Ranking
  async getPersonas(): Promise<import("@/types").PersonaInfo[]> {
    return fetchJson<import("@/types").PersonaInfo[]>(`/hotels/personas`);
  },

  async getRankedHotels(params: {
    user_id?: string;
    city?: string;
    city_id?: string;
    personalization?: boolean;
    property_type?: string;
    amenities?: string[];
    limit?: number;
  }): Promise<import("@/types").RankedSearchResponse> {
    const query = new URLSearchParams();
    if (params.user_id) query.set("user_id", params.user_id);
    if (params.city) query.set("city", params.city);
    if (params.city_id) query.set("city_id", params.city_id);
    if (params.personalization !== undefined) {
      query.set("personalization", String(params.personalization));
    }
    if (params.property_type) query.set("property_type", params.property_type);
    if (params.amenities && params.amenities.length > 0) {
      query.set("amenities", params.amenities.join(","));
    }
    if (params.limit) query.set("limit", String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : "";
    return fetchJson<import("@/types").RankedSearchResponse>(`/hotels/search/ranked${qs}`);
  },

  // Edge-Case Policy Simulator
  async checkHotelFeasibility(
    hotelId: string,
    payload: import("@/types").FeasibilityRequest
  ): Promise<import("@/types").FeasibilityResponse> {
    return fetchJson<import("@/types").FeasibilityResponse>(`/hotels/${hotelId}/check-feasibility`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Group Split & UPI Settlement
  async splitBooking(
    bookingId: string,
    partySize: number
  ): Promise<import("@/types").GroupSplitResponse> {
    return fetchJson<import("@/types").GroupSplitResponse>(`/bookings/${bookingId}/split`, {
      method: "POST",
      body: JSON.stringify({ party_size: partySize }),
    });
  },

  // Visual Onboarding & Travel DNA Calibrator
  async getOnboardingImages(): Promise<import("@/types").OnboardingImagesResponse> {
    return fetchJson<import("@/types").OnboardingImagesResponse>(`/onboarding/images`);
  },

  async submitPreferences(
    payload: import("@/types").PreferencesSubmissionRequest
  ): Promise<import("@/types").PreferencesSubmissionResponse> {
    return fetchJson<import("@/types").PreferencesSubmissionResponse>(`/onboarding/preferences`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getUserPreferences(
    userId: string
  ): Promise<import("@/types").UserPreferencesData> {
    return fetchJson<import("@/types").UserPreferencesData>(`/onboarding/preferences/${userId}`);
  },

  // WebAuthn Biometric Passkey Authentication
  async generatePasskeyRegistrationOptions(
    username?: string,
    displayName?: string
  ): Promise<import("@/types").PasskeyRegistrationOptionsResponse> {
    return fetchJson<import("@/types").PasskeyRegistrationOptionsResponse>(
      `/auth/generate-registration-options`,
      {
        method: "POST",
        body: JSON.stringify({ username, display_name: displayName }),
      }
    );
  },

  async verifyPasskeyRegistration(
    userId: string,
    username: string,
    credential: any
  ): Promise<{ verified: boolean; user_id: string; message: string }> {
    return fetchJson(`/auth/verify-registration`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, username, credential }),
    });
  },

  async quickPasskeyLogin(
    username?: string,
    displayName?: string
  ): Promise<import("@/types").QuickPasskeyLoginResponse> {
    return fetchJson<import("@/types").QuickPasskeyLoginResponse>(`/auth/quick-passkey-login`, {
      method: "POST",
      body: JSON.stringify({ username, display_name: displayName }),
    });
  },

  // Limit-Order Yield Arbitrage Engine
  async getArbitrageQuote(
    hotelId: string,
    roomTypeId: string,
    forDate?: string
  ): Promise<import("@/types").ArbitrageQuoteResponse> {
    const qs = forDate ? `&for_date=${forDate}` : "";
    return fetchJson<import("@/types").ArbitrageQuoteResponse>(
      `/hotels/${hotelId}/arbitrage-quote?room_type_id=${roomTypeId}${qs}`
    );
  },

  async submitArbitrageOrder(
    hotelId: string,
    payload: import("@/types").ArbitrageOrderRequest
  ): Promise<import("@/types").ArbitrageOrderResponse> {
    return fetchJson<import("@/types").ArbitrageOrderResponse>(
      `/hotels/${hotelId}/arbitrage-order`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  async getLimitOrders(
    hotelId: string,
    userId?: string
  ): Promise<{ count: number; orders: import("@/types").ArbitrageOrderResponse[] }> {
    const qs = userId ? `?user_id=${userId}` : "";
    return fetchJson(`/hotels/${hotelId}/limit-orders${qs}`);
  },

  // Bioclimatic Solar & Acoustic Room Optimizer
  async getRoomOptimization(
    hotelId: string,
    date?: string
  ): Promise<import("@/types").RoomOptimizerResponse> {
    const qs = date ? `?date=${date}` : "";
    return fetchJson<import("@/types").RoomOptimizerResponse>(
      `/hotels/${hotelId}/room-optimizer${qs}`
    );
  },

  // Multiplayer Group Travel Consensus Radar
  async getGroupConsensus(
    hotelId: string,
    userIds: string[]
  ): Promise<import("@/types").GroupConsensusResponse> {
    return fetchJson<import("@/types").GroupConsensusResponse>(
      `/hotels/${hotelId}/group-consensus?users=${userIds.join(",")}`
    );
  },

  async getSquadCandidates(
    limit = 8
  ): Promise<{ candidates: import("@/types").SquadMember[]; count: number }> {
    return fetchJson(`/hotels/squad-candidates?limit=${limit}`);
  },
};





