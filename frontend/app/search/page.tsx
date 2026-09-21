"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SearchBar } from "@/components/SearchBar";
import { HotelCard } from "@/components/HotelCard";
import { Map } from "@/components/Map";
import { FilterChips } from "@/components/FilterChips";
import { api } from "@/lib/api";
import { HotelListItem, SearchFilterChip, VibeSearchItem, PersonaInfo } from "@/types";
import { Map as MapIcon, List, Sparkles, Loader2, Compass, Camera, X, Plane, HardDrive, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PersonaSwitcherBar } from "@/components/PersonaSwitcherBar";
import { TravelSquadBar } from "@/components/TravelSquadBar";
import { useFlightMode } from "@/context/FlightModeContext";
import { SaveCityOfflineButton } from "@/components/SaveCityOfflineButton";
import { getOfflineHotelsByCity } from "@/lib/offline-db";

function SearchContent() {

  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const cityParam = searchParams.get("city") || "";
  const propertyTypeParam = searchParams.get("property_type") || "";
  const vibeParam = searchParams.get("vibe") || "";
  const vibeLabelParam = searchParams.get("vibe_label") || "";

  const [hotels, setHotels] = useState<HotelListItem[]>([]);
  const [chips, setChips] = useState<SearchFilterChip[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredHotelId, setHoveredHotelId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | undefined>(propertyTypeParam || undefined);
  const [selectedSort, setSelectedSort] = useState("relevance");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [activeVibeLabel, setActiveVibeLabel] = useState<string>("");

  // Live Persona Switcher State
  const [personas, setPersonas] = useState<PersonaInfo[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string>("usr_f855344d");
  const [personalizationEnabled, setPersonalizationEnabled] = useState<boolean>(true);

  // Multiplayer Travel Squad Consensus State
  const [squadMode, setSquadMode] = useState<boolean>(false);
  const [squadUsers, setSquadUsers] = useState<string[]>([
    "usr_6afe5712",
    "usr_05c1346c",
    "usr_c75aefa2",
  ]);

  // Flight Mode & Offline State
  const { effectiveFlightMode, isCitySaved } = useFlightMode();
  const [isOfflineResults, setIsOfflineResults] = useState<boolean>(false);

  // Load personas on mount
  useEffect(() => {
    let active = true;
    api
      .getPersonas()
      .then((data) => {
        if (active && data && data.length > 0) {
          setPersonas(data);
        }
      })
      .catch(console.warn);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    async function doSearch() {
      setLoading(true);
      try {
        // Zero-Latency Flight Mode Interception: Query client-side IndexedDB directly
        if (effectiveFlightMode || (cityParam && isCitySaved(cityParam) && typeof navigator !== "undefined" && !navigator.onLine)) {
          const offlineHotels = await getOfflineHotelsByCity(cityParam || "Hyderabad", q);
          if (offlineHotels && offlineHotels.length > 0) {
            const mapped: HotelListItem[] = offlineHotels.map((h) => ({
              hotel_id: h.hotel_id,
              name: h.name,
              city_name: h.city_name,
              state: h.state,
              star_rating: h.star_rating,
              property_type: h.property_type,
              guest_score: h.guest_score,
              review_count: h.review_count,
              min_price: h.min_price,
              currency: h.currency,
              hero_image: h.cached_image_url || h.hero_image,
              address_line: h.address_line,
              lat: h.lat || undefined,
              lng: h.lng || undefined,
              amenities: (h.amenities || []).map((a: any) => ({
                code: a.code || "",
                label: a.label || "",
                is_free: a.is_free,
              })),
            }));
            setHotels(mapped);
            setChips([]);
            setIsOfflineResults(true);
            setLoading(false);
            return;
          }
        }

        setIsOfflineResults(false);

        // 1. Visual Vibe Search Mode
        if (vibeParam.trim()) {
          setActiveVibeLabel(vibeLabelParam || vibeParam);
          let vibeItems: VibeSearchItem[] = [];

          if (vibeParam === "custom_upload" && typeof window !== "undefined") {
            const cached = sessionStorage.getItem("sf_vibe_results");
            if (cached) {
              try {
                vibeItems = JSON.parse(cached);
              } catch (e) {
                console.warn("Failed to parse cached vibe results:", e);
              }
            }
          }

          if (vibeItems.length === 0) {
            vibeItems = await api.searchVibe({ query_text: vibeParam });
          }

          // Map to HotelListItem with vibe scoring and matched media
          const mappedHotels: HotelListItem[] = vibeItems.map((v) => ({
            hotel_id: v.hotel_id,
            name: v.name,
            city_name: v.city_name,
            state: v.state || "",
            star_rating: v.star_rating,
            property_type: v.property_type,
            guest_score: v.guest_score,
            review_count: v.review_count,
            min_price: 5200,
            currency: "INR",
            hero_image: v.matching_media?.[0]?.file_path || null,
            amenities: [],
            vibe_similarity: v.similarity_pct,
            matching_media: v.matching_media,
            matched_vibes: v.matched_vibes,
          }));

          setHotels(mappedHotels);
          setChips([
            {
              field: "vibe",
              label: `Visual Vibe: ${vibeLabelParam || "Aesthetic Match"}`,
              value: vibeParam,
            },
          ]);
        } else if (q.trim()) {
          // 2. NL Search Mode
          setActiveVibeLabel("");
          const res = await api.nlSearch(q);
          setHotels(res.hotels || []);
          setChips(res.parsed_chips || []);
          if (res.filters?.property_type) {
            setSelectedType(res.filters.property_type);
          }
        } else {
          // 3. Ranked Search with Persona Re-Ranking
          setActiveVibeLabel("");
          const res = await api.getRankedHotels({
            user_id: activePersonaId,
            city: cityParam || undefined,
            personalization: personalizationEnabled,
            property_type: selectedType,
            amenities: selectedAmenities,
            limit: 20,
          });
          setHotels(res.items || []);
          setChips([]);
        }
      } catch (err) {
        console.warn("Search network failed, attempting IndexedDB offline fallback:", err);
        try {
          const offlineHotels = await getOfflineHotelsByCity(cityParam || "Hyderabad", q);
          if (offlineHotels && offlineHotels.length > 0) {
            const mapped: HotelListItem[] = offlineHotels.map((h) => ({
              hotel_id: h.hotel_id,
              name: h.name,
              city_name: h.city_name,
              state: h.state,
              star_rating: h.star_rating,
              property_type: h.property_type,
              guest_score: h.guest_score,
              review_count: h.review_count,
              min_price: h.min_price,
              currency: h.currency,
              hero_image: h.cached_image_url || h.hero_image,
              address_line: h.address_line,
              lat: h.lat || undefined,
              lng: h.lng || undefined,
              amenities: (h.amenities || []).map((a: any) => ({
                code: a.code || "",
                label: a.label || "",
                is_free: a.is_free,
              })),
            }));
            setHotels(mapped);
            setChips([]);
            setIsOfflineResults(true);
          }
        } catch (offlineErr) {
          console.error("IndexedDB fallback also failed:", offlineErr);
        }
      } finally {
        setLoading(false);
      }
    }
    doSearch();
  }, [
    q,
    cityParam,
    propertyTypeParam,
    vibeParam,
    vibeLabelParam,
    selectedType,
    selectedSort,
    selectedAmenities,
    activePersonaId,
    personalizationEnabled,
    effectiveFlightMode,
  ]);


  const handleRemoveChip = (field: string) => {
    if (field === "vibe") {
      router.push("/search");
      return;
    }
    setChips((prev) => prev.filter((c) => c.field !== field));
    if (field === "property_type") setSelectedType(undefined);
  };

  const handleToggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Search Header */}
      <div className="space-y-4">
        <SearchBar variant="compact" initialQuery={q} initialCity={cityParam} />

        {/* Live Persona Switcher Bar */}
        {personas.length > 0 && (
          <PersonaSwitcherBar
            personas={personas}
            activePersonaId={activePersonaId}
            onSelectPersona={setActivePersonaId}
            personalizationEnabled={personalizationEnabled}
            onTogglePersonalization={setPersonalizationEnabled}
            isLoading={loading}
          />
        )}

        {/* Feature 4: Multiplayer Travel Squad Consensus Bar */}
        <TravelSquadBar
          squadMode={squadMode}
          onToggleSquadMode={setSquadMode}
          selectedUserIds={squadUsers}
          onChangeSquad={setSquadUsers}
        />

        {/* Visual Vibe Active Banner */}
        {activeVibeLabel && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 border border-purple-400/30 text-white flex items-center justify-between shadow-soft">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Visual Vibe Search Active:</span>
                  <span className="text-purple-300">"{activeVibeLabel}"</span>
                </p>
                <p className="text-[10px] text-purple-200/70 font-medium">
                  Ranked by local Scikit-Learn TF-IDF vectorization over hotel media & amenity metadata
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/search")}
              className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-purple-200 flex items-center gap-1 transition"
            >
              <span>Reset</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filters & Pills */}
        <FilterChips
          chips={chips}
          onRemoveChip={handleRemoveChip}
          selectedType={selectedType}
          onSelectType={setSelectedType}
          selectedSort={selectedSort}
          onSelectSort={setSelectedSort}
          selectedAmenities={selectedAmenities}
          onToggleAmenity={handleToggleAmenity}
        />
      </div>

      {/* Mobile Map / List Toggle */}
      <div className="flex md:hidden items-center justify-center gap-2">
        <button
          onClick={() => setMobileView("list")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
            mobileView === "list" ? "bg-slate-900 text-white" : "bg-white text-slate-700 border"
          }`}
        >
          <List className="w-4 h-4" />
          <span>List View</span>
        </button>
        <button
          onClick={() => setMobileView("map")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
            mobileView === "map" ? "bg-slate-900 text-white" : "bg-white text-slate-700 border"
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>Map View</span>
        </button>
      </div>

      {/* Feature 5: Zero-Latency Flight Mode Active Notification Banner */}
      {effectiveFlightMode && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 border border-amber-500/60 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Plane className="w-5 h-5 animate-pulse text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-amber-300 uppercase tracking-wide">
                  Zero-Latency Flight Mode Active
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
                  IndexedDB PWA
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                FastAPI backend bypassed. Search queries, hotel cards, rate plans, and hero images are being served with 0ms latency from local browser storage.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 bg-amber-400/10 px-3 py-1.5 rounded-xl border border-amber-400/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>0ms Local Response</span>
          </div>
        </div>
      )}

      {/* City Header & Feature 5 Save City for Offline Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900">
              {cityParam ? `Hotels in ${cityParam}` : "Explore All Destinations"}
            </h2>
            {isOfflineResults && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                ⚡ 0ms IndexedDB
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Showing <span className="font-bold text-slate-900">{hotels.length}</span> properties
            {cityParam ? ` in ${cityParam}` : ""}
            {activeVibeLabel ? ` matching visual ambiance` : ""}
          </p>
        </div>

        {/* Feature 5: Save City for Offline PWA Button */}
        <SaveCityOfflineButton
          cityId={cityParam || "Hyderabad"}
          cityName={cityParam || "Hyderabad"}
        />
      </div>


      {/* Main Split Layout */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="rounded-3.5xl p-4 bg-white border border-slate-100 shadow-soft space-y-3"
              >
                <div className="h-44 rounded-2xl skeleton-shimmer" />
                <div className="h-5 w-3/4 skeleton-shimmer rounded-lg" />
                <div className="h-4 w-1/2 skeleton-shimmer rounded-lg" />
              </div>
            ))}
          </div>
          <div className="hidden lg:block lg:col-span-5 h-[650px] rounded-3.5xl skeleton-shimmer sticky top-28" />
        </div>
      ) : hotels.length === 0 ? (
        <div className="py-20 text-center space-y-4 bg-white rounded-3.5xl border border-slate-200/80 p-8 max-w-2xl mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="font-heading font-extrabold text-2xl text-slate-900">
            No exact stays found
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Try adjusting your search criteria, clearing some filters, or exploring our curated city collections.
          </p>
          <button
            onClick={() => router.push("/search")}
            className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 shadow-sm transition"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Hotel List */}
          <div
            className={`lg:col-span-7 ${
              mobileView === "list" ? "block" : "hidden md:block"
            }`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {hotels.map((hotel) => (
                  <motion.div
                    key={hotel.hotel_id}
                    layout
                    layoutId={hotel.hotel_id}
                    transition={{
                      type: "spring",
                      damping: 26,
                      stiffness: 220,
                      mass: 0.8,
                    }}
                    className="w-full"
                  >
                    <HotelCard
                      hotel={hotel}
                      onHover={setHoveredHotelId}
                      squadMode={squadMode}
                      squadUsers={squadUsers}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Map */}
          <div
            className={`lg:col-span-5 sticky top-28 h-[calc(100vh-140px)] min-h-[500px] rounded-3.5xl overflow-hidden border border-slate-200/80 shadow-soft ${
              mobileView === "map" ? "block" : "hidden md:block"
            }`}
          >
            <Map
              hotels={hotels}
              hoveredHotelId={hoveredHotelId}
              onHotelSelect={(id) => setHoveredHotelId(id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
