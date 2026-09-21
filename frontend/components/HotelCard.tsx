"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Star,
  MapPin,
  Sparkles,
  Heart,
  ShieldCheck,
  Wifi,
  Utensils,
  Waves,
  Flame,
  Compass,
  Camera,
  Box,
  Plane,
} from "lucide-react";
import { HotelListItem, HotelProximityResponse } from "@/types";
import { getHotelImage } from "@/lib/utils";
import { useCurrency } from "@/context/CurrencyContext";
import { useFlightMode } from "@/context/FlightModeContext";
import { api } from "@/lib/api";

import { VirtualTourModal } from "./VirtualTourModal";
import { GroupConsensusRadar } from "./GroupConsensusRadar";

interface HotelCardProps {
  hotel: HotelListItem;
  onHover?: (hotelId: string | null) => void;
  squadMode?: boolean;
  squadUsers?: string[];
}

export function HotelCard({ hotel, onHover, squadMode, squadUsers }: HotelCardProps) {
  const { formatPrice } = useCurrency();
  const { effectiveFlightMode, isCitySaved } = useFlightMode();
  const [isSaved, setIsSaved] = useState(false);
  const [proximity, setProximity] = useState<HotelProximityResponse | null>(null);
  const [showTourModal, setShowTourModal] = useState(false);

  const isOfflineReady = effectiveFlightMode || (Boolean(hotel.city_name) && isCitySaved(hotel.city_name));


  // Use matching photo from hotel_media if visual vibe search matched a specific photo
  const matchedPhoto =
    hotel.matching_media && hotel.matching_media.length > 0
      ? hotel.matching_media[0]
      : null;

  const imageUrl = getHotelImage(
    hotel.hotel_id,
    hotel.property_type,
    0,
    matchedPhoto?.file_path || hotel.hero_image
  );

  useEffect(() => {
    let active = true;
    api
      .getHotelProximity(hotel.hotel_id)
      .then((data) => {
        if (active) setProximity(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [hotel.hotel_id]);

  // Generate deterministic FOMO indicators
  const roomsLeft =
    hotel.rooms_left_fomo || ((parseInt(hotel.hotel_id.slice(-2), 16) % 4) + 1);

  // Meal preference or special highlights
  const isVeg = hotel.amenities?.some((a) =>
    ["vegetarian_kitchen", "jain_food", "veg"].includes(a.code.toLowerCase())
  );
  const hasPool = hotel.amenities?.some((a) =>
    ["swimming_pool", "infinity_pool"].includes(a.code.toLowerCase())
  );
  const hasWifi = hotel.amenities?.some((a) =>
    ["free_wifi", "high_speed_wifi"].includes(a.code.toLowerCase())
  );

  return (
    <div
      onMouseEnter={() => onHover && onHover(hotel.hotel_id)}
      onMouseLeave={() => onHover && onHover(null)}
      className="group bg-white rounded-3xl overflow-hidden border border-slate-200/90 hover:border-brand-300 shadow-sm hover:shadow-card-hover transition-all duration-300 flex flex-col"
    >
      {/* Media Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        <Link href={`/hotel/${hotel.hotel_id}`} className="absolute inset-0 z-0 block cursor-pointer">
          <img
            src={imageUrl}
            alt={hotel.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-black/25" />
        </Link>

        {/* Top Badges */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10">
          {/* Property Type & Offline Badge */}
          <div className="flex items-center gap-1.5">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/90 backdrop-blur-md text-slate-800 shadow-sm">
              {hotel.property_type}
            </span>
            {isOfflineReady && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 shadow-sm flex items-center gap-1">
                <Plane className="w-3 h-3 text-slate-950" />
                <span>0ms Offline</span>
              </span>
            )}
          </div>

          {/* Wishlist Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsSaved(!isSaved);
            }}
            className="w-9 h-9 rounded-full bg-white/80 hover:bg-white backdrop-blur-md flex items-center justify-center text-slate-700 hover:text-rose-500 shadow-sm transition"
            aria-label="Save to Wishlist"
          >
            <Heart
              className={`w-4 h-4 transition ${isSaved ? "fill-rose-500 text-rose-500" : ""}`}
            />
          </button>
        </div>

        {/* Highlighted Matched Photo Caption Pill (From hotel_media) */}
        {matchedPhoto && (
          <div className="absolute top-12 left-3.5 right-3.5 z-10 pointer-events-none">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-950/90 border border-purple-400/40 backdrop-blur-md text-purple-100 text-[10px] font-bold shadow-glow max-w-full">
              <Camera className="w-3 h-3 text-purple-300 flex-shrink-0" />
              <span className="truncate">Photo Match: {matchedPhoto.caption}</span>
            </div>
          </div>
        )}

        {/* 360° Digital Twin Available Badge */}
        {Boolean(hotel.has_xr_scene) && (
          <div className="absolute bottom-3 left-3 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowTourModal(true);
              }}
              className="group/xr inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-950/85 hover:bg-stone-900 border border-amber-400/60 backdrop-blur-md text-amber-300 hover:text-amber-200 text-xs font-bold shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
              title="Open 360° Virtual Tour"
            >
              <Box className="w-3.5 h-3.5 text-amber-400 animate-[spin_6s_linear_infinite]" />
              <span>360° Digital Twin Available</span>
            </button>
          </div>
        )}

        {/* Star Rating Badge */}
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          <span>{hotel.star_rating}★</span>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Location & FOMO */}
          <div className="flex items-center justify-between gap-2 text-xs mb-2">
            <div className="flex items-center gap-1 text-slate-500 font-medium">
              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="truncate">
                {hotel.city_name}, {hotel.state}
              </span>
            </div>

            {roomsLeft <= 3 && (
              <div className="flex items-center gap-1 text-rose-600 font-bold text-[11px] bg-rose-50 px-2 py-0.5 rounded-md flex-shrink-0">
                <Flame className="w-3 h-3 text-rose-500" />
                <span>Only {roomsLeft} left!</span>
              </div>
            )}
          </div>

          {/* Hotel Name */}
          <Link href={`/hotel/${hotel.hotel_id}`}>
            <h3 className="font-heading font-bold text-lg text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-1">
              {hotel.name}
            </h3>
          </Link>

          {/* Personalization Explainability Badge */}
          {hotel.explainability && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300/80 text-amber-900 text-xs font-bold shadow-2xs max-w-full">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span className="truncate">{hotel.explainability}</span>
              {hotel.final_score !== undefined && (
                <span className="ml-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-200/60 text-amber-950 flex-shrink-0">
                  {(hotel.final_score * 100).toFixed(0)} pts
                </span>
              )}
            </div>
          )}

          {/* Visual Vibe Similarity Score Bar */}
          {hotel.vibe_similarity !== undefined && (
            <div className="mt-2.5 p-2.5 rounded-2xl bg-gradient-to-r from-purple-50/90 via-indigo-50/70 to-pink-50/80 border border-purple-200/80 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-extrabold text-purple-900">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>{hotel.vibe_similarity}% Visual Vibe Match</span>
                </span>
                <span className="text-[9px] uppercase tracking-wider text-purple-700 font-bold bg-white px-2 py-0.5 rounded-full border border-purple-200">
                  Local TF-IDF
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-purple-200/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(15, hotel.vibe_similarity))}%` }}
                />
              </div>
              {hotel.matched_vibes && hotel.matched_vibes.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  {hotel.matched_vibes.map((v) => (
                    <span
                      key={v}
                      className="px-1.5 py-0.5 rounded-md bg-white text-[9px] font-bold text-purple-800 border border-purple-200/80 shadow-2xs"
                    >
                      #{v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Walkability Index Badge */}
          {proximity && proximity.walkable_landmarks.length > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-[11px] font-bold shadow-2xs">
              <Compass className="w-3 h-3 text-blue-600 flex-shrink-0" />
              <span className="truncate">
                {proximity.walkability_score}/100 Walk Score • {proximity.walkable_landmarks.length} attraction{proximity.walkable_landmarks.length > 1 ? "s" : ""} within {Math.max(...proximity.walkable_landmarks.map((l) => l.walk_time_minutes))} mins
              </span>
            </div>
          )}

          {/* Feature Badges */}
          <div className="flex flex-wrap items-center gap-2 my-2.5">
            {isVeg && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Utensils className="w-3 h-3" />
                Pure Veg
              </span>
            )}
            {hasPool && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                <Waves className="w-3 h-3" />
                Pool
              </span>
            )}
            {hasWifi && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600">
                <Wifi className="w-3 h-3" />
                Free Wi-Fi
              </span>
            )}
          </div>

          {/* Multiplayer Travel Squad Consensus Radar */}
          {squadMode && (
            <div className="my-2.5">
              <GroupConsensusRadar
                hotelId={hotel.hotel_id}
                hotelName={hotel.name}
                userIds={squadUsers}
                compact={true}
              />
            </div>
          )}
        </div>

        {/* Footer: Guest Score & Price */}

        <div className="pt-3 border-t border-slate-100 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-extrabold text-xs">
                {hotel.guest_score ? hotel.guest_score.toFixed(1) : "8.5"}
              </span>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800 leading-tight">
                  {hotel.guest_score >= 9
                    ? "Exceptional"
                    : hotel.guest_score >= 8
                    ? "Fabulous"
                    : "Very Good"}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {hotel.review_count || 85} reviews
                </p>
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="text-right">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Starting from
            </p>
            <div className="flex items-baseline justify-end gap-1">
              <span className="font-heading font-extrabold text-xl text-slate-900">
                {formatPrice(hotel.min_price || 4500)}
              </span>
              <span className="text-xs font-medium text-slate-500">/ night</span>
            </div>
            <p className="text-[10px] text-slate-400">+ taxes & fees</p>
          </div>
        </div>
      </div>

      {/* 360 Virtual Tour Modal */}
      {Boolean(hotel.has_xr_scene) && (
        <VirtualTourModal
          isOpen={showTourModal}
          onClose={() => setShowTourModal(false)}
          hotelName={hotel.name}
          cityName={hotel.city_name}
          imageUrl={imageUrl}
          altText="Official 360° Scene from StayFinder Collection"
        />
      )}
    </div>
  );
}
