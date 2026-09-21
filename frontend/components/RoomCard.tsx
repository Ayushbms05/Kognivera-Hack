"use client";

import { useState } from "react";
import Link from "next/link";
import { BedDouble, Maximize2, Coffee, ShieldCheck, Check, ChevronDown, ChevronUp, Zap, TrendingDown } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import { AlgorithmicYieldWidget } from "@/components/AlgorithmicYieldWidget";

interface RatePlan {
  rate_plan_id: string;
  name: string;
  price_delta: number | string;
  includes_breakfast?: boolean;
}

interface RoomCardProps {
  room: any;
  hotelId: string;
  checkIn?: string;
  checkOut?: string;
}

export function RoomCard({ room, hotelId, checkIn, checkOut }: RoomCardProps) {
  const { formatPrice, currentCurrencyItem } = useCurrency();
  const [showYieldWidget, setShowYieldWidget] = useState(false);
  const hasAc = room.has_ac;
  const hasBalcony = room.has_balcony;
  const hasBathtub = room.has_bathtub;

  const ratePlans: RatePlan[] = room.rate_plans || [];
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    ratePlans.length > 0 ? ratePlans[0].rate_plan_id : ""
  );

  const activePlan = ratePlans.find((p) => p.rate_plan_id === selectedPlanId);
  const planDelta = activePlan ? Number(activePlan.price_delta || 0) : 0;
  const baseRate = Number(room.base_rate || 0);
  const effectiveNightlyRate = baseRate + planDelta;

  // Statutory Indian GST Slab Rule:
  // <= 7500 INR -> 12% GST
  // > 7500 INR -> 18% GST
  const gstSlabPct = effectiveNightlyRate <= 7500 ? 12 : 18;

  return (
    <div className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-terracotta-300 shadow-sm transition flex flex-col md:flex-row md:items-start justify-between gap-6">
      <div className="space-y-3 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-heading font-bold text-lg text-slate-900">{room.name}</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            Up to {room.capacity_adults || 2} Adults
          </span>
          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              gstSlabPct === 18
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            {gstSlabPct}% Statutory GST
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
          {room.description ||
            "Equipped with plush bedding, private ensuite bathroom, and modern guest amenities."}
        </p>

        {/* Room Amenities */}
        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap pt-1">
          {room.bed_type && (
            <span className="flex items-center gap-1 font-medium">
              <BedDouble className="w-3.5 h-3.5 text-slate-400" />
              {room.bed_type}
            </span>
          )}
          {room.size_sqm && (
            <span className="flex items-center gap-1 font-medium">
              <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
              {room.size_sqm} m²
            </span>
          )}
          {hasAc && (
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[11px] font-semibold">
              Air Conditioned
            </span>
          )}
          {hasBalcony && (
            <span className="text-terracotta-700 bg-terracotta-50 px-2 py-0.5 rounded-md text-[11px] font-semibold">
              Private Balcony
            </span>
          )}
          {hasBathtub && (
            <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px] font-semibold">
              Bathtub
            </span>
          )}
        </div>

        {/* Rate Plan Selection (From 17_hotel_rate_plans.csv) */}
        {ratePlans.length > 0 && (
          <div className="pt-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Select Rate Option
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
              {ratePlans.map((plan) => {
                const deltaNum = Number(plan.price_delta || 0);
                const isSelected = plan.rate_plan_id === selectedPlanId;
                return (
                  <button
                    key={plan.rate_plan_id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.rate_plan_id)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition flex items-center justify-between gap-2 ${
                      isSelected
                        ? "border-brand-600 bg-brand-50/50 text-brand-900 font-bold shadow-2xs"
                        : "border-slate-200 bg-slate-50/60 hover:bg-white text-slate-700 font-medium"
                    }`}
                  >
                    <div className="truncate">
                      <p className="truncate text-xs font-semibold">{plan.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {deltaNum === 0
                          ? "Standard rate"
                          : deltaNum > 0
                          ? `+${formatPrice(deltaNum)}`
                          : `-${formatPrice(Math.abs(deltaNum))}`}
                        {plan.includes_breakfast && " • Breakfast incl."}
                      </p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-brand-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Limit-Order Yield Arbitrage Trigger */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowYieldWidget(!showYieldWidget)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-950 text-emerald-400 hover:bg-slate-900 border border-emerald-500/30 transition hover:scale-102 active:scale-98 shadow-sm font-mono"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Yield Arbitrage Limit Order</span>
            {showYieldWidget ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
          </button>
        </div>
      </div>

      {/* Price & Booking CTA */}
      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 flex-shrink-0">
        <div className="text-left md:text-right">
          <div className="flex items-baseline md:justify-end gap-1">
            <span className="font-heading font-extrabold text-2xl text-slate-900">
              {formatPrice(effectiveNightlyRate)}
            </span>
            <span className="text-xs text-slate-500 font-medium">/ night</span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">
            + {gstSlabPct}% statutory GST at checkout
          </p>
          <span className="text-[9px] font-semibold text-slate-400 tracking-wide uppercase">
            {currentCurrencyItem.iso4217} • {currentCurrencyItem.minor_unit_exponent} Decimals
          </span>
        </div>

        <Link
          href={`/book/${hotelId}?room_id=${room.room_type_id}${
            selectedPlanId ? `&rate_plan_id=${selectedPlanId}` : ""
          }&check_in=${checkIn || "2026-09-22"}&check_out=${checkOut || "2026-09-24"}`}
          className="px-6 py-2.5 rounded-xl bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold text-xs shadow-sm transition hover:scale-105 active:scale-95 text-center whitespace-nowrap"
        >
          Select & Reserve
        </Link>
      </div>

      {/* Expandable Algorithmic Yield Terminal */}
      {showYieldWidget && (
        <div className="w-full pt-4 border-t border-slate-100 mt-2">
          <AlgorithmicYieldWidget
            hotelId={hotelId}
            roomTypeId={room.room_type_id}
            roomName={room.name}
            baseRate={effectiveNightlyRate}
            checkInDate={checkIn}
          />
        </div>
      )}
    </div>
  );
}
