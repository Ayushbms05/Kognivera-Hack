"use client";

import { useState } from "react";
import {
  Compass,
  Sparkles,
  Clock,
  MapPin,
  Utensils,
  Wallet,
  Calendar,
  Layers,
  ChevronRight,
  RefreshCw,
  Info,
} from "lucide-react";
import { ItineraryResponse, ItineraryDay, ItineraryActivity } from "@/types";
import { api } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";

interface ItineraryTimelineProps {
  hotelId: string;
  hotelName: string;
  city: string;
}

const TRAVEL_STYLES = [
  { id: "balanced", label: "Balanced Discovery" },
  { id: "cultural", label: "Heritage & Culture" },
  { id: "culinary", label: "Foodie & Culinary" },
  { id: "leisure", label: "Slow & Relaxed" },
  { id: "adventure", label: "Active Exploration" },
];

export function ItineraryTimeline({ hotelId, hotelName, city }: ItineraryTimelineProps) {
  const { formatPrice } = useCurrency();
  const [itinerary, setItinerary] = useState<ItineraryResponse | null>(null);
  const [selectedStyle, setSelectedStyle] = useState("balanced");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  async function handleGenerate(style = selectedStyle) {
    setLoading(true);
    try {
      const res = await api.generateItinerary({
        hotel_id: hotelId,
        days: 3,
        travel_style: style,
      });
      setItinerary(res);
      setHasGenerated(true);
      setSelectedDayIndex(0);
    } catch (err) {
      console.error("Failed to build itinerary:", err);
    } finally {
      setLoading(false);
    }
  }

  // Pre-generate on mount or provide attractive initial trigger banner
  return (
    <div className="p-6 sm:p-8 rounded-3.5xl bg-white border border-slate-100 shadow-soft space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-xl bg-forest-50 text-forest-700 border border-forest-100">
              <Compass className="w-4 h-4" />
            </span>
            <h3 className="font-heading font-extrabold text-xl text-slate-900 tracking-tight">
              AI 3-Day Curated Itinerary
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Personalized hyper-local adventures crafted from {hotelName} in {city}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sand-50 border border-slate-200 text-slate-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-terracotta-500" />
            <span>Gemini AI Driven</span>
          </div>
          {hasGenerated && (
            <button
              onClick={() => handleGenerate()}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              title="Regenerate Itinerary"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Style Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex-shrink-0 mr-1">
          Vibe:
        </span>
        {TRAVEL_STYLES.map((style) => (
          <button
            key={style.id}
            onClick={() => {
              setSelectedStyle(style.id);
              if (hasGenerated) handleGenerate(style.id);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedStyle === style.id
                ? "bg-slate-900 text-white shadow-subtle scale-102"
                : "bg-sand-50 text-slate-600 hover:bg-slate-100 border border-slate-100"
            }`}
          >
            {style.label}
          </button>
        ))}
      </div>

      {/* Initial Call To Action if not yet generated */}
      {!hasGenerated && !loading && (
        <div className="p-8 rounded-3xl bg-gradient-to-br from-sand-50/90 via-sand-50/40 to-terracotta-50/40 border border-terracotta-100/60 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-terracotta-700 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Instant Smart Trip Planning
            </div>
            <h4 className="font-heading font-extrabold text-lg text-slate-900">
              Discover {city} like a seasoned local
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Gemini AI models will cross-reference regional historical routes, verified food spots, and
              transit times directly from {hotelName}.
            </p>
          </div>
          <button
            onClick={() => handleGenerate()}
            className="px-6 py-3 rounded-2xl bg-terracotta-600 hover:bg-terracotta-700 text-white font-heading font-bold text-xs shadow-terracotta-glow transition hover:scale-105 active:scale-95 flex items-center gap-2 flex-shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate 3-Day Plan</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            <div className="h-10 w-28 skeleton-shimmer rounded-xl" />
            <div className="h-10 w-28 skeleton-shimmer rounded-xl" />
            <div className="h-10 w-28 skeleton-shimmer rounded-xl" />
          </div>
          <div className="space-y-4 pt-4">
            <div className="h-24 w-full skeleton-shimmer rounded-2xl" />
            <div className="h-24 w-full skeleton-shimmer rounded-2xl" />
            <div className="h-24 w-full skeleton-shimmer rounded-2xl" />
          </div>
        </div>
      )}

      {/* Generated Itinerary Display */}
      {itinerary && !loading && (
        <div className="space-y-6">
          {/* Day Selector Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-sand-50/80 border border-slate-100">
            {itinerary.days.map((day, idx) => (
              <button
                key={day.day}
                onClick={() => setSelectedDayIndex(idx)}
                className={`py-2.5 px-3 rounded-xl text-left transition-all ${
                  selectedDayIndex === idx
                    ? "bg-white shadow-soft text-slate-900 font-bold border border-slate-100"
                    : "text-slate-500 hover:text-slate-900 font-medium"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-heading font-extrabold uppercase tracking-wider">
                    Day {day.day}
                  </span>
                  {selectedDayIndex === idx && (
                    <span className="w-1.5 h-1.5 rounded-full bg-terracotta-500" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{day.theme}</p>
              </button>
            ))}
          </div>

          {/* Current Day Itinerary Timeline */}
          {itinerary.days[selectedDayIndex] && (
            <div className="space-y-4">
              {/* Day Header Banner */}
              <div className="p-4 rounded-2xl bg-sand-50/50 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-terracotta-600 uppercase tracking-wider">
                    Day {itinerary.days[selectedDayIndex].day} Focus
                  </span>
                  <h4 className="font-heading font-bold text-base text-slate-900">
                    {itinerary.days[selectedDayIndex].theme}
                  </h4>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {itinerary.days[selectedDayIndex].activities.length} Curated Stops
                </span>
              </div>

              {/* Vertical Timeline Track */}
              <div className="relative pl-6 space-y-6 before:absolute before:top-3 before:bottom-3 before:left-2.5 before:w-0.5 before:bg-slate-200">
                {itinerary.days[selectedDayIndex].activities.map((act, actIdx) => (
                  <div key={actIdx} className="relative group">
                    {/* Node Dot */}
                    <div className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-terracotta-500 group-hover:scale-125 transition-transform" />

                    {/* Card */}
                    <div className="p-4 sm:p-5 rounded-2.5xl bg-white border border-slate-100/90 shadow-2xs hover:shadow-soft transition-shadow space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sand-100 text-slate-700">
                            {act.time_slot}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-terracotta-50 text-terracotta-700 border border-terracotta-100">
                            {act.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          {act.distance_from_hotel_km > 0 && (
                            <span className="flex items-center gap-1 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {act.distance_from_hotel_km} km from stay
                            </span>
                          )}
                          <span className="flex items-center gap-1 font-bold text-slate-700">
                            <Wallet className="w-3.5 h-3.5 text-slate-400" />
                            {act.estimated_cost_inr > 0
                              ? formatPrice(act.estimated_cost_inr)
                              : "Free Entry"}
                          </span>
                        </div>
                      </div>

                      <h5 className="font-heading font-bold text-base text-slate-900">{act.title}</h5>
                      <p className="text-xs text-slate-600 leading-relaxed">{act.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dining Recommendation of the Day */}
              {itinerary.days[selectedDayIndex].dining_tip && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-800 flex-shrink-0 mt-0.5">
                    <Utensils className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Culinary Recommendation
                    </p>
                    <p className="text-xs text-amber-950 font-medium leading-relaxed mt-0.5">
                      {itinerary.days[selectedDayIndex].dining_tip}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Summary Bar */}
          <div className="p-4 rounded-2xl bg-sand-50/80 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600 font-medium">
              <Info className="w-4 h-4 text-terracotta-600 flex-shrink-0" />
              <span>{itinerary.curator_note}</span>
            </div>
            <div className="flex items-center gap-1 font-extrabold text-slate-900 whitespace-nowrap self-end sm:self-auto">
              <span>Total Est. Budget:</span>
              <span className="text-terracotta-600">
                {formatPrice(itinerary.total_estimated_budget_inr)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
