"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { calculateNights, getHotelImage } from "@/lib/utils";
import { useCurrency } from "@/context/CurrencyContext";
import { HotelDetail, RoomType, PricingCalculateResponse } from "@/types";
import {
  ShieldCheck,
  CreditCard,
  Lock,
  Calendar,
  Users,
  ChevronRight,
  Loader2,
  Info,
  CheckCircle2,
  Sparkles,
  Check,
} from "lucide-react";

export default function BookingPage({ params }: { params: { id: string } }) {
  const { currency, formatPrice, currentCurrencyItem, calculatePricing } = useCurrency();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomIdParam = searchParams.get("room_id") || "";
  const ratePlanIdParam = searchParams.get("rate_plan_id") || "";
  const initialCheckIn = searchParams.get("check_in") || "2026-09-22";
  const initialCheckOut = searchParams.get("check_out") || "2026-09-24";

  const [hotel, setHotel] = useState<HotelDetail | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(ratePlanIdParam);
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [numRooms, setNumRooms] = useState(1);
  const [numAdults, setNumAdults] = useState(2);

  // Live Statutory Indian GST & Multi-Currency Engine Breakdown
  const [pricingBreakdown, setPricingBreakdown] = useState<PricingCalculateResponse | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  // Guest Details
  const [guestName, setGuestName] = useState("Aarav Kumar");
  const [guestEmail, setGuestEmail] = useState("aarav.kumar@example.com");
  const [guestPhone, setGuestPhone] = useState("+91 98765 43210");
  const [specialRequests, setSpecialRequests] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1. Initial Data Fetch
  useEffect(() => {
    async function loadData() {
      try {
        const h = await api.getHotelDetail(params.id, checkIn, checkOut);
        setHotel(h);
        const rooms = h.room_types || h.rooms || [];
        const rm =
          rooms.find((r) => r.room_type_id === roomIdParam) || rooms[0] || null;
        setSelectedRoom(rm);
        if (!selectedPlanId && rm && rm.rate_plans && rm.rate_plans.length > 0) {
          setSelectedPlanId(rm.rate_plans[0].rate_plan_id);
        }
      } catch (err) {
        console.error("Failed to load booking hotel details:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.id, roomIdParam]);

  const nights = calculateNights(checkIn, checkOut);

  // 2. Reactive Multi-Currency & GST Engine Call
  useEffect(() => {
    if (!selectedRoom) return;

    let isMounted = true;
    async function fetchStatutoryPricing() {
      setPricingLoading(true);
      try {
        const res = await calculatePricing(
          selectedRoom!.room_type_id,
          selectedPlanId || null,
          nights
        );
        if (isMounted && res) {
          setPricingBreakdown(res);
        }
      } catch (err) {
        console.error("Error calculating statutory pricing breakdown:", err);
      } finally {
        if (isMounted) setPricingLoading(false);
      }
    }

    fetchStatutoryPricing();

    return () => {
      isMounted = false;
    };
  }, [selectedRoom, selectedPlanId, nights, currency, calculatePricing]);

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotel || !selectedRoom) return;

    setIsSubmitting(true);
    try {
      const payload = {
        user_id: "usr_001",
        hotel_id: hotel.hotel_id,
        room_type_id: selectedRoom.room_type_id,
        rate_plan_id: selectedPlanId || undefined,
        check_in: checkIn,
        check_out: checkOut,
        num_rooms: numRooms,
        num_adults: numAdults,
        special_requests: specialRequests,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
      };

      const booking = await api.createBooking(payload);
      router.push(`/confirmation/${booking.booking_id}`);
    } catch (err) {
      alert("Failed to confirm reservation. Please review inputs.");
      setIsSubmitting(false);
    }
  };

  if (loading || !hotel || !selectedRoom) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="h-6 w-48 skeleton-shimmer rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 h-96 skeleton-shimmer rounded-3.5xl" />
          <div className="lg:col-span-5 h-80 skeleton-shimmer rounded-3.5xl" />
        </div>
      </div>
    );
  }

  const roomPlans = selectedRoom.rate_plans || [];
  const currentPlan = roomPlans.find((p) => p.rate_plan_id === selectedPlanId);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-6">
        <Link href="/" className="hover:text-brand-600">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href={`/hotel/${hotel.hotel_id}`} className="hover:text-brand-600">
          {hotel.name}
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900">Statutory Compliant Checkout</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Guest & Payment Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="font-heading font-extrabold text-2xl text-slate-900">
                Guest Information
              </h2>
              <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Instant Guaranteed Confirmation</span>
              </div>
            </div>

            <form onSubmit={handleSubmitBooking} id="booking-form" className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name (as per Govt ID)
                </label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number (for WhatsApp Voucher)
                  </label>
                  <input
                    type="tel"
                    required
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
                  />
                </div>
              </div>

              {/* Rate Plan Selector if multiple rate plans available */}
              {roomPlans.length > 1 && (
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Chosen Rate Plan
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {roomPlans.map((plan) => {
                      const deltaNum = Number(plan.price_delta || 0);
                      const isSelected = plan.rate_plan_id === selectedPlanId;
                      return (
                        <div
                          key={plan.rate_plan_id}
                          onClick={() => setSelectedPlanId(plan.rate_plan_id)}
                          className={`p-3 rounded-xl border cursor-pointer text-xs transition flex items-center justify-between ${
                            isSelected
                              ? "border-brand-600 bg-brand-50/60 font-bold text-brand-900"
                              : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                          }`}
                        >
                          <div>
                            <p className="font-semibold">{plan.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {deltaNum === 0
                                ? "Standard rate"
                                : deltaNum > 0
                                ? `+${formatPrice(deltaNum)}`
                                : `-${formatPrice(Math.abs(deltaNum))}`}
                              {plan.includes_breakfast ? " • Breakfast Included" : ""}
                            </p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-brand-600" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Special Requests (Optional)
                </label>
                <textarea
                  rows={3}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="e.g. Quiet room away from elevator, Jain food meal preference, early check-in request..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 resize-none"
                />
              </div>

              {/* Payment Mode Simulation */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-3">
                  Payment Preference
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl border-2 border-brand-600 bg-brand-50/50 flex items-center gap-2.5 cursor-pointer">
                    <CheckCircle2 className="w-4 h-4 text-brand-600" />
                    <div>
                      <p className="text-xs font-bold text-brand-900">Pay at Hotel</p>
                      <p className="text-[10px] text-brand-700 font-medium">No advance payment</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center gap-2.5 cursor-pointer hover:border-slate-300">
                    <CreditCard className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Card / NetBanking</p>
                      <p className="text-[10px] text-slate-400 font-medium">Instant confirmation</p>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-xs justify-center">
            <Lock className="w-3.5 h-3.5" />
            <span>256-bit encrypted secure reservation engine</span>
          </div>
        </div>

        {/* Right Column: Order & Pricing Summary Card */}
        <div className="lg:col-span-5 sticky top-28 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-5">
            {/* Hotel Mini Preview */}
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <img
                src={hotel.hero_image || getHotelImage(hotel.hotel_id, hotel.property_type)}
                alt={hotel.name}
                className="w-20 h-20 rounded-2xl object-cover"
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                  {hotel.property_type}
                </p>
                <h3 className="font-heading font-bold text-base text-slate-900 line-clamp-1">
                  {hotel.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {hotel.city_name}, {hotel.state}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{selectedRoom.name}</span>
                  {currentPlan && (
                    <span className="text-slate-400 font-normal">({currentPlan.name})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Dates & Rooms Selector */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Check-in</span>
                <p className="font-bold text-slate-800 mt-0.5">{checkIn}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Check-out</span>
                <p className="font-bold text-slate-800 mt-0.5">{checkOut}</p>
              </div>
              <div className="pt-2 border-t border-slate-200/60 col-span-2 flex items-center justify-between">
                <span className="font-medium text-slate-600">Total Duration:</span>
                <span className="font-bold text-slate-900">
                  {nights} {nights === 1 ? "Night" : "Nights"} &times; {numRooms} Room
                </span>
              </div>
            </div>

            {/* Transparent Financial Tax Breakdown from Multi-Currency Engine */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-500">
                  Financial Breakdown
                </h4>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-brand-50 text-brand-700 border border-brand-200">
                    {currentCurrencyItem.iso4217} ({currentCurrencyItem.symbol})
                  </span>
                  {pricingBreakdown && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                        pricingBreakdown.gst_slab_pct === 18
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {pricingBreakdown.gst_slab_pct}% GST Slab
                    </span>
                  )}
                </div>
              </div>

              {pricingLoading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
                  <span>Calculating exact fractional apportionment...</span>
                </div>
              ) : pricingBreakdown ? (
                <div className="space-y-2 text-xs">
                  {/* Subtotal */}
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Base Room Rate ({nights} nights)</span>
                    <span className="font-bold text-slate-800">
                      {pricingBreakdown.formatted.subtotal}
                    </span>
                  </div>

                  {/* Rate Plan Delta */}
                  {Number(pricingBreakdown.breakdown.rate_plan_delta) !== 0 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Rate Plan Adjustment ({pricingBreakdown.rate_plan_name || "Option"})</span>
                      <span className="font-bold text-slate-800">
                        {pricingBreakdown.formatted.rate_plan_delta}
                      </span>
                    </div>
                  )}

                  {/* Indian Statutory GST */}
                  <div className="flex items-center justify-between text-slate-600">
                    <div className="flex items-center gap-1">
                      <span>Hospitality GST ({pricingBreakdown.gst_slab_pct}%)</span>
                      <span
                        title={`Indian Statutory GST: Effective nightly rate ₹${pricingBreakdown.effective_nightly_rate_inr} -> ${pricingBreakdown.gst_slab_pct}% GST`}
                        className="cursor-help text-slate-400"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <span className="font-bold text-slate-800">
                      {pricingBreakdown.formatted.tax_gst}
                    </span>
                  </div>

                  {/* Apportionment Guarantee Pill */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[10px] text-slate-500 flex items-center justify-between">
                    <span className="font-medium">Apportionment Check:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {pricingBreakdown.breakdown.subtotal} + {pricingBreakdown.breakdown.rate_plan_delta} + {pricingBreakdown.breakdown.tax_gst} = {pricingBreakdown.breakdown.total}
                    </span>
                  </div>

                  {/* Grand Total */}
                  <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between">
                    <div>
                      <span className="font-heading font-extrabold text-base text-slate-900">
                        Grand Total
                      </span>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Zero-drift fractional match • All taxes incl.
                      </p>
                    </div>
                    <span className="font-heading font-black text-2xl text-slate-900">
                      {pricingBreakdown.formatted.total}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Base Rate ({nights} nights)</span>
                    <span className="font-bold text-slate-800">
                      {formatPrice(selectedRoom.base_rate * nights)}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between">
                    <span className="font-heading font-extrabold text-base text-slate-900">
                      Grand Total
                    </span>
                    <span className="font-heading font-black text-2xl text-slate-900">
                      {formatPrice(selectedRoom.base_rate * nights * 1.12)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm CTA */}
            <button
              type="submit"
              form="booking-form"
              disabled={isSubmitting || pricingLoading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-amber-500 hover:opacity-95 text-white font-bold text-sm shadow-glow transition hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Securing Reservation...</span>
                </>
              ) : (
                <span>Confirm & Reserve Room</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
