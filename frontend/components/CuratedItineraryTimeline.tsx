"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
  Compass,
  Calendar,
  Sun,
  SunMedium,
  Moon,
  Sparkles,
  MapPin,
  CheckCircle2,
  Layers,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Cpu,
} from "lucide-react";
import { CuratedItineraryResponse, ItineraryDaySchedule, ItinerarySlot } from "@/types";
import { api } from "@/lib/api";

interface CuratedItineraryTimelineProps {
  hotelId: string;
  hotelName: string;
  city: string;
  userId?: string;
}

export function CuratedItineraryTimeline({
  hotelId,
  hotelName,
  city,
  userId = "usr_001",
}: CuratedItineraryTimelineProps) {
  const [data, setData] = useState<CuratedItineraryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDayTab, setActiveDayTab] = useState<number>(0); // 0 = all days, 1 = Day 1, 2 = Day 2, 3 = Day 3

  async function fetchItinerary() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCuratedItinerary(hotelId, 3, userId);
      setData(res);
    } catch (err: any) {
      console.error("Failed to load curated itinerary:", err);
      setError("Unable to load the curated itinerary at this moment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItinerary();
  }, [hotelId, userId]);

  function getSlotIcon(slot: string) {
    switch (slot.toLowerCase()) {
      case "morning":
        return <Sun className="w-4 h-4 text-amber-500" />;
      case "afternoon":
        return <SunMedium className="w-4 h-4 text-orange-500" />;
      case "evening":
        return <Moon className="w-4 h-4 text-indigo-400" />;
      default:
        return <Compass className="w-4 h-4 text-emerald-500" />;
    }
  }

  function getSlotTimeLabel(slot: string) {
    switch (slot.toLowerCase()) {
      case "morning":
        return "08:30 AM – 12:00 PM";
      case "afternoon":
        return "01:30 PM – 05:00 PM";
      case "evening":
        return "06:30 PM – 09:30 PM";
      default:
        return "Flexible Time";
    }
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.35,
        ease: "easeOut",
      },
    },
  };

  const filteredDays: ItineraryDaySchedule[] =
    activeDayTab === 0
      ? data?.days || []
      : (data?.days || []).filter((d) => d.day === activeDayTab);

  return (
    <section
      id="curated-itinerary"
      className="p-6 sm:p-8 rounded-3.5xl bg-white border border-slate-100 shadow-soft space-y-6"
    >
      {/* Header with Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="p-1.5 rounded-xl bg-slate-900 text-white shadow-2xs">
              <Compass className="w-4 h-4 text-emerald-400" />
            </span>
            <h2 className="font-heading font-extrabold text-2xl text-slate-900 tracking-tight">
              Curated 3-Day Trip Itinerary
            </h2>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Cpu className="w-3 h-3" />
              <span>Local KNN Spatial ML</span>
            </div>
            {data?.travel_style && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-amber-50 text-amber-800 border border-amber-200">
                {data.travel_style} Style
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Spatially scheduled exploration centered around <strong className="text-slate-800">{hotelName}</strong> in {data?.city_name || city}.
          </p>
        </div>

        {/* Action / Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchItinerary}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition"
            title="Refresh ML Schedule"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Recalculate</span>
          </button>
        </div>
      </div>

      {/* Contextual Narrative Banner if available */}
      {data?.contextual_transition && (
        <div className="p-4 rounded-2.5xl bg-gradient-to-r from-slate-900 via-[#1E293B] to-slate-900 text-white shadow-sm flex items-start gap-3 border border-slate-800">
          <div className="p-2 rounded-xl bg-white/10 text-emerald-400 mt-0.5 flex-shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-emerald-400 mb-0.5">
              Curator Insight
            </p>
            <p className="text-xs text-slate-200 leading-relaxed italic">
              "{data.contextual_transition}"
            </p>
          </div>
        </div>
      )}

      {/* Day Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-100">
        <button
          onClick={() => setActiveDayTab(0)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeDayTab === 0
              ? "bg-[#0F172A] text-white shadow-sm"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Full 3-Day Journey</span>
        </button>

        {[1, 2, 3].map((d) => (
          <button
            key={d}
            onClick={() => setActiveDayTab(d)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeDayTab === d
                ? "bg-[#0F172A] text-white shadow-sm"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Day {d}</span>
          </button>
        ))}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4 py-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="p-5 rounded-2.5xl bg-slate-50 animate-pulse flex items-start gap-4 border border-slate-100"
            >
              <div className="w-10 h-10 rounded-2xl bg-slate-200 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="w-1/4 h-3.5 bg-slate-200 rounded-md" />
                <div className="w-3/4 h-4 bg-slate-200 rounded-md" />
                <div className="w-1/2 h-3 bg-slate-200 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="p-6 rounded-2.5xl bg-rose-50 border border-rose-200 text-rose-700 text-center">
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={fetchItinerary}
            className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Vertical Animated Timeline */}
      {!loading && data && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative pl-6 sm:pl-8 border-l-2 border-slate-200/90 ml-3 sm:ml-4 space-y-10 py-2"
        >
          {filteredDays.map((dayObj) => (
            <div key={dayObj.day} className="space-y-6">
              {/* Day Header Marker */}
              <div className="relative flex items-center gap-3">
                {/* Deep Slate Node with Emerald Pulse */}
                <div className="absolute -left-[37px] sm:-left-[45px] w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center border-4 border-white shadow-md z-10">
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-[#10B981] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]" />
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-sm">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Day {dayObj.day} Itinerary</span>
                </div>
              </div>

              {/* Slots List for this Day */}
              <div className="grid grid-cols-1 gap-4">
                {dayObj.slots.map((slot: ItinerarySlot, sIdx: number) => (
                  <motion.div
                    key={`${dayObj.day}-${slot.time_slot}-${sIdx}`}
                    variants={itemVariants}
                    className="relative group p-5 rounded-2.5xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition-all duration-200"
                  >
                    {/* Node Dot on spine */}
                    <div className="absolute -left-[30px] sm:-left-[38px] top-6 w-3 h-3 rounded-full bg-[#0F172A] border-2 border-white shadow-xs group-hover:scale-125 transition-transform" />

                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold capitalize bg-slate-100 text-slate-800 border border-slate-200">
                          {getSlotIcon(slot.time_slot)}
                          <span>{slot.time_slot} Slot</span>
                        </span>

                        <span className="text-[11px] font-medium text-slate-400">
                          {getSlotTimeLabel(slot.time_slot)}
                        </span>
                      </div>

                      {/* Verified Trip Ref Badge */}
                      {slot.trip_id_ref && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 self-start">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Ref: {slot.trip_id_ref}</span>
                        </div>
                      )}
                    </div>

                    {/* Real Activity Title & Description from 19_itineraries.csv */}
                    <h3 className="font-heading font-extrabold text-base sm:text-lg text-slate-900 group-hover:text-terracotta-600 transition-colors">
                      {slot.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-1.5 font-normal">
                      {slot.description}
                    </p>

                    {/* Subtle Activity Footer Tags */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>Spatially clustered near {hotelName}</span>
                      </div>
                      <span className="font-semibold text-slate-500 capitalize">
                        Verified Destination Activity
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Footer Credentials */}
      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Strictly Real Data from <code className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded text-[11px]">19_itineraries.csv</code> &amp; <code className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded text-[11px]">14_trips.csv</code></span>
        </div>
        <span>Zero Gemini Token Exhaustion on Core Scheduling</span>
      </div>
    </section>
  );
}
