"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/context/CurrencyContext";
import { BookingResponse } from "@/types";
import GroupSplitCard from "@/components/GroupSplitCard";
import {
  CheckCircle2,
  Calendar,
  MapPin,
  Share2,
  Printer,
  ChevronRight,
  ShieldCheck,
  Building,
  QrCode,
  ArrowRight,
  Loader2,
} from "lucide-react";

export default function ConfirmationPage({
  params,
}: {
  params: { bookingId: string };
}) {
  const { formatPrice } = useCurrency();
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fire confetti on successful mount
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#6366F1", "#F59E0B", "#10B981", "#3B82F6"],
      });
    } catch {}

    async function loadBooking() {
      try {
        const data = await api.getBooking(params.bookingId);
        setBooking(data);
      } catch (err) {
        console.error("Error loading booking:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBooking();
  }, [params.bookingId]);

  const handleShareWhatsApp = () => {
    if (!booking) return;
    const totalPaid = booking.pricing?.total ?? Number(booking.total_amount ?? 0);
    const guestName = booking.guest_name || "Verified Guest";
    const text = `🎉 *StayFinder Booking Confirmed!*\n\n🏨 *Hotel:* ${booking.hotel_name}\n🛏️ *Room:* ${booking.room_name || "Deluxe Room"}\n📅 *Dates:* ${booking.check_in} to ${booking.check_out}\n🔖 *Booking ID:* ${booking.confirmation_code}\n👤 *Guest:* ${guestName}\n💰 *Total Paid:* ${formatPrice(totalPaid)}\n\nLooking forward to an amazing stay! ✨`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="h-12 w-64 skeleton-shimmer rounded-2xl mx-auto" />
        <div className="h-96 w-full skeleton-shimmer rounded-3.5xl" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Booking Voucher</h2>
        <p className="text-sm text-slate-600">Booking reference: {params.bookingId}</p>
        <Link href="/" className="inline-block px-5 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs">
          Return to Home
        </Link>
      </div>
    );
  }

  const nightsCount = booking.pricing?.nights ?? booking.nights ?? 1;
  const totalVal = booking.pricing?.total ?? Number(booking.total_amount ?? 0);
  const taxVal = booking.pricing?.gst_amount ?? Number(booking.tax_amount ?? 0);
  const subtotalVal = booking.pricing?.subtotal ?? Math.max(0, totalVal - taxVal);
  const baseRateVal = booking.pricing?.base_rate_per_night ?? (subtotalVal / nightsCount);
  const gstRateVal = booking.pricing?.gst_rate ?? (baseRateVal <= 7500 ? 12 : 18);
  const serviceFeeVal = booking.pricing?.service_fee ?? 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Success Banner */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm animate-bounce">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h1 className="font-heading font-black text-3xl sm:text-4xl text-slate-900">
          Booking Confirmed!
        </h1>
        <p className="text-sm text-slate-500">
          A confirmation SMS and email have been sent to{" "}
          <span className="font-bold text-slate-800">{booking.guest_email || "your registered email"}</span>
        </p>
      </div>

      {/* Luxury Printable Voucher Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden print:border-none print:shadow-none">
        {/* Voucher Header Banner */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-brand-950 text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
              StayFinder Hospitality Voucher
            </span>
            <h2 className="font-heading font-black text-2xl tracking-tight mt-0.5">
              {booking.confirmation_code}
            </h2>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5" />
              Guaranteed
            </span>
          </div>
        </div>

        {/* Voucher Body Details */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Property Details
              </p>
              <h3 className="font-heading font-bold text-lg text-slate-900 mt-1">
                {booking.hotel_name}
              </h3>
              <p className="text-xs text-brand-700 font-semibold mt-0.5">{booking.room_name || "Deluxe Suite"}</p>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Primary Guest
              </p>
              <h3 className="font-heading font-bold text-lg text-slate-900 mt-1">
                {booking.guest_name || "Verified Guest"}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{booking.guest_phone || "+91 98765 43210"}</p>
            </div>
          </div>

          {/* Stay Dates & Rooms */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Check-in</span>
              <p className="font-heading font-bold text-sm text-slate-900 mt-0.5">
                {booking.check_in}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Check-out</span>
              <p className="font-heading font-bold text-sm text-slate-900 mt-0.5">
                {booking.check_out}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Rooms</span>
              <p className="font-heading font-bold text-sm text-slate-900 mt-0.5">
                {booking.num_rooms || 1} Room(s)
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Guests</span>
              <p className="font-heading font-bold text-sm text-slate-900 mt-0.5">
                {booking.num_adults || 2} Adult(s)
              </p>
            </div>
          </div>

          {/* Financial Breakdown Receipt */}
          <div className="space-y-2 pt-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>
                Room Charges ({nightsCount} nights &times;{" "}
                {formatPrice(baseRateVal)})
              </span>
              <span className="font-semibold text-slate-900">
                {formatPrice(subtotalVal)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Hospitality GST ({gstRateVal}%)</span>
              <span className="font-semibold text-slate-900">
                {formatPrice(taxVal)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Convenience & Booking Fee</span>
              <span className="font-semibold text-slate-900">
                {formatPrice(serviceFeeVal)}
              </span>
            </div>
            <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
              <span className="font-heading font-extrabold text-base text-slate-900">
                Total Amount Paid / Payable
              </span>
              <span className="font-heading font-black text-2xl text-slate-900">
                {formatPrice(totalVal)}
              </span>
            </div>
          </div>
        </div>

        {/* Voucher Footer with simulated QR Code */}
        <div className="p-6 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-800">
              <QrCode className="w-7 h-7" />
            </div>
            <p className="text-[11px] text-slate-500 max-w-xs">
              Show this digital pass at hotel check-in desk along with any valid Govt ID (Aadhaar / Passport).
            </p>
          </div>
          <p className="text-[11px] font-bold text-slate-400">24x7 Support: 1800-STAY-FINDER</p>
        </div>
      </div>

      {/* Group Split & UPI Payment Settlement */}
      <GroupSplitCard
        bookingId={booking.booking_id}
        totalAmount={Number(booking.pricing?.total ?? booking.total_amount ?? 0)}
        currency={booking.pricing?.currency || booking.currency || "INR"}
      />

      {/* Action Buttons: WhatsApp Share & Print */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 print:hidden">
        <button
          onClick={handleShareWhatsApp}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
        >
          <Share2 className="w-4 h-4" />
          <span>Share Voucher on WhatsApp</span>
        </button>

        <button
          onClick={handlePrint}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
        >
          <Printer className="w-4 h-4 text-slate-500" />
          <span>Print / Save as PDF</span>
        </button>

        <Link
          href="/"
          className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5"
        >
          <span>Find More Stays</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
