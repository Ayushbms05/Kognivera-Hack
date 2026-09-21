import { notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatCurrency, getHotelImage } from "@/lib/utils";
import { ReviewSummary } from "@/components/ReviewSummary";
import { ConciergeWidget } from "@/components/ConciergeWidget";
import { PriceAnalyticsGraph } from "@/components/PriceAnalyticsGraph";
import { ItineraryTimeline } from "@/components/ItineraryTimeline";
import { CuratedItineraryTimeline } from "@/components/CuratedItineraryTimeline";
import { HotelDetailTabs } from "@/components/HotelDetailTabs";
import { RoomCard } from "@/components/RoomCard";
import { HotelProximitySection } from "@/components/HotelProximitySection";
import { HotelDigitalTwinHeroButton } from "@/components/HotelDigitalTwinHeroButton";
import { BioclimaticRoomOptimizer } from "@/components/BioclimaticRoomOptimizer";
import { GroupConsensusRadar } from "@/components/GroupConsensusRadar";

import {
  Star,
  MapPin,
  Clock,
  ShieldCheck,
  Sparkles,
  Wifi,
  Waves,
  Utensils,
  Car,
  Dog,
  Baby,
  BedDouble,
  Maximize2,
  Check,
  ChevronRight,
  Phone,
  Mail,
  Compass,
  Footprints,
} from "lucide-react";

export const revalidate = 0;

interface HotelPageProps {
  params: { id: string };
  searchParams: { check_in?: string; check_out?: string };
}

export default async function HotelDetailPage({ params, searchParams }: HotelPageProps) {
  let hotel;
  try {
    hotel = await api.getHotelDetail(params.id, searchParams.check_in, searchParams.check_out);
  } catch (err) {
    notFound();
  }

  let proximity: import("@/types").HotelProximityResponse | null = null;
  try {
    proximity = await api.getHotelProximity(params.id);
  } catch (err) {
    // Graceful fallback
  }

  const heroImg1 = hotel.hero_image || getHotelImage(hotel.hotel_id, hotel.property_type, 0);
  const heroImg2 = getHotelImage(hotel.hotel_id, hotel.property_type, 1);
  const heroImg3 = getHotelImage(hotel.hotel_id, hotel.property_type, 2);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Link href="/" className="hover:text-brand-600 transition">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link
          href={`/search?city=${encodeURIComponent(hotel.city_name)}`}
          className="hover:text-brand-600 transition"
        >
          {hotel.city_name}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-900 truncate max-w-xs">{hotel.name}</span>
      </nav>

      {/* Title & Quick Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-900 text-white">
              {hotel.property_type}
            </span>
            <div className="flex items-center gap-1 text-amber-500 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>{hotel.star_rating} Star Property</span>
            </div>
            {hotel.vibe_match_pct && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-brand-700 border border-brand-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>{hotel.vibe_match_pct}% Vibe Match</span>
              </span>
            )}
            {proximity && proximity.walkable_landmarks.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <Footprints className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {proximity.walkability_score}/100 Walk Score • {proximity.walkable_landmarks.length} attractions within {Math.max(...proximity.walkable_landmarks.map((l) => l.walk_time_minutes))} mins
                </span>
              </span>
            )}
            <HotelDigitalTwinHeroButton
              hotelId={hotel.hotel_id}
              hotelName={hotel.name}
              cityName={hotel.city_name}
              defaultImageUrl={heroImg1}
              variant="badge"
            />
          </div>

          <h1 className="font-heading font-black text-3xl sm:text-4xl text-slate-900">
            {hotel.name}
          </h1>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-2">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>
              {hotel.address_line}, {hotel.city_name}, {hotel.state} {hotel.postal_code || ""}
            </span>
          </div>
        </div>

        {/* Rating Score Badge */}
        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs self-start md:self-auto">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
            {hotel.guest_score ? hotel.guest_score.toFixed(1) : "8.8"}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">
              {hotel.guest_score >= 9 ? "Exceptional" : "Very Good"}
            </p>
            <p className="text-xs text-slate-400 font-medium">
              Based on {hotel.review_count || 120} verified reviews
            </p>
          </div>
        </div>
      </div>

      {/* Image Gallery Mosaic */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 h-[380px] sm:h-[460px] rounded-3xl overflow-hidden shadow-md">
        <div className="md:col-span-2 h-full relative overflow-hidden group">
          <img
            src={heroImg1}
            alt={hotel.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {/* 360° Digital Twin overlay button on hero photo */}
          <div className="absolute bottom-4 left-4 z-10">
            <HotelDigitalTwinHeroButton
              hotelId={hotel.hotel_id}
              hotelName={hotel.name}
              cityName={hotel.city_name}
              defaultImageUrl={heroImg1}
              variant="overlay"
            />
          </div>
        </div>
        <div className="hidden md:flex flex-col gap-3 h-full">
          <div className="h-1/2 relative overflow-hidden group">
            <img
              src={heroImg2}
              alt="Gallery 2"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
          <div className="h-1/2 relative overflow-hidden group">
            <img
              src={heroImg3}
              alt="Gallery 3"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        </div>
        <div className="hidden md:flex flex-col gap-3 h-full">
          <div className="h-1/2 relative overflow-hidden group">
            <img
              src={heroImg3}
              alt="Gallery 4"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
          <div className="h-1/2 relative overflow-hidden group bg-slate-900 flex items-center justify-center text-white cursor-pointer hover:bg-slate-800 transition">
            <span className="font-heading font-bold text-sm">View All Photos &rarr;</span>
          </div>
        </div>
      </div>

      {/* Key Info Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Check-in / Out</p>
            <p className="text-xs font-bold text-slate-800">
              {hotel.checkin_time} / {hotel.checkout_time}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Dog className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Pet Policy</p>
            <p className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
              {hotel.policies?.pet_policy || "Contact hotel"}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Baby className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Child Policy</p>
            <p className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
              {hotel.policies?.child_policy || "Children welcome"}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Airport Transfer</p>
            <p className="text-xs font-bold text-slate-800">
              {hotel.policies?.airport_pickup ? "Available" : "On Request"}
            </p>
          </div>
        </div>
      </div>

      {/* Description & Amenities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h3 className="font-heading font-extrabold text-xl text-slate-900 mb-3">
              About This Property
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {hotel.description ||
                `Immerse yourself in authentic Indian hospitality at ${hotel.name}. Situated in the prime location of ${hotel.city_name}, this ${hotel.property_type} provides exquisite comfort, rich regional character, and top-tier hospitality for leisure and business travelers alike.`}
            </p>
          </div>

          {/* Amenities Grid */}
          <div>
            <h3 className="font-heading font-extrabold text-xl text-slate-900 mb-4">
              Featured Amenities
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {hotel.amenities.map((a, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-white border border-slate-200/90 flex items-center gap-2.5 text-xs font-semibold text-slate-700"
                >
                  <div className="w-2 h-2 rounded-full bg-brand-500" />
                  <span className="truncate">{a.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contact & Support Card */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4 self-start">
          <h4 className="font-heading font-bold text-base text-slate-900">Direct Hotel Info</h4>
          {hotel.phone && (
            <div className="flex items-center gap-2.5 text-xs text-slate-600">
              <Phone className="w-4 h-4 text-brand-600" />
              <span>{hotel.phone}</span>
            </div>
          )}
          {hotel.email && (
            <div className="flex items-center gap-2.5 text-xs text-slate-600">
              <Mail className="w-4 h-4 text-brand-600" />
              <span>{hotel.email}</span>
            </div>
          )}
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 font-medium">
              Have questions about reservations or specific dietary food? Use our AI concierge at the bottom right!
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Walkability Isochrone & Attraction Proximity Map */}
      <HotelProximitySection
        hotelId={hotel.hotel_id}
        hotelName={hotel.name}
        hotelCoords={{
          lat: Number(hotel.lat || hotel.latitude || 26.9124),
          lng: Number(hotel.lng || hotel.longitude || 75.7873),
        }}
      />

      {/* Feature 3: Bioclimatic Solar & Acoustic Room Optimizer */}
      <BioclimaticRoomOptimizer
        hotelId={hotel.hotel_id}
        hotelName={hotel.name}
        initialDate={searchParams.check_in}
      />

      {/* Feature 4: Multiplayer Group Travel Consensus Radar */}
      <div id="group-consensus-radar-section" className="space-y-4">
        <GroupConsensusRadar
          hotelId={hotel.hotel_id}
          hotelName={hotel.name}
          compact={false}
        />
      </div>

      {/* Interactive Hotel Detail Sections with "Curated 3-Day Trip Itinerary" Tab */}

      <HotelDetailTabs
        defaultTab="itinerary"
        roomsContent={
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading font-extrabold text-2xl text-slate-900">
                  Available Rooms & Suites
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your preferred room type with clear pricing and tax breakdown.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {(hotel.room_types || hotel.rooms || []).map((room) => (
                <RoomCard
                  key={room.room_type_id}
                  room={room}
                  hotelId={hotel.hotel_id}
                  checkIn={searchParams.check_in}
                  checkOut={searchParams.check_out}
                />
              ))}
            </div>
          </div>
        }
        itineraryContent={
          <CuratedItineraryTimeline
            hotelId={hotel.hotel_id}
            hotelName={hotel.name}
            city={hotel.city_name}
          />
        }
        priceGraphContent={<PriceAnalyticsGraph hotelId={hotel.hotel_id} />}
        reviewsContent={<ReviewSummary hotelId={hotel.hotel_id} />}
      />

      {/* Floating Property Concierge Widget */}
      <ConciergeWidget hotelId={hotel.hotel_id} hotelName={hotel.name} />
    </div>
  );
}
