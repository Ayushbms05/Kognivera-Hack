"use client";

import { useState, useEffect } from "react";
import {
  TrendingDown,
  Activity,
  Zap,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  Clock,
  Layers,
  Lock,
} from "lucide-react";
import confetti from "canvas-confetti";
import { api } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { ArbitrageQuoteResponse, ArbitrageOrderResponse } from "@/types";

interface AlgorithmicYieldWidgetProps {
  hotelId: string;
  roomTypeId: string;
  roomName: string;
  baseRate: number;
  checkInDate?: string;
}

export function AlgorithmicYieldWidget({
  hotelId,
  roomTypeId,
  roomName,
  baseRate,
  checkInDate,
}: AlgorithmicYieldWidgetProps) {
  const { formatPrice, currentCurrencyItem } = useCurrency();
  const dateStr = checkInDate || "2026-09-24";

  const [quote, setQuote] = useState<ArbitrageQuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [discountPct, setDiscountPct] = useState(12); // default 12% discount
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<ArbitrageOrderResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadQuote();
  }, [hotelId, roomTypeId, dateStr]);

  async function loadQuote() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getArbitrageQuote(hotelId, roomTypeId, dateStr);
      setQuote(res);
      if (res.recommended_discount_pct) {
        setDiscountPct(res.recommended_discount_pct);
      }
    } catch (err: any) {
      console.error("Failed to load arbitrage quote:", err);
      setErrorMsg("Yield arbitrage data currently optimizing.");
    } finally {
      setLoading(false);
    }
  }

  // Calculate dynamic fill probability based on discount slider
  // P(fill) = P(drop) * (1 - 0.75 * d)
  const baseDropProb = quote ? quote.base_drop_probability : 0.65;
  const currentBaseRate = quote ? quote.base_rate : baseRate;
  const targetPrice = Math.round(currentBaseRate * (1 - discountPct / 100));
  const rawProb = baseDropProb * (1.0 - 0.75 * (discountPct / 100));
  const fillProbabilityPct = Math.max(5, Math.min(95, Math.round(rawProb * 100)));
  const isEligible = fillProbabilityPct > 50;

  async function handlePlaceLimitOrder() {
    if (!isEligible) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const activeUid = localStorage.getItem("sf_active_user_id") || "usr_guest";
      const res = await api.submitArbitrageOrder(hotelId, {
        room_type_id: roomTypeId,
        user_id: activeUid,
        for_date: dateStr,
        target_price: targetPrice,
        target_currency: currentCurrencyItem.iso4217,
      });

      setOrderResult(res);

      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 },
        colors: ["#10B981", "#3B82F6", "#D97706"],
      });
    } catch (err: any) {
      console.error("Failed to place limit order:", err);
      setErrorMsg(err.message || "Failed to submit limit order.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 rounded-2xl bg-slate-950 text-slate-400 font-mono text-xs border border-emerald-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>INITIALIZING YIELD ARBITRAGE MATRIX...</span>
        </div>
        <span className="text-[10px] text-slate-500">MKT-FEED // ZERO-TOKEN MATH</span>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-slate-950 border border-emerald-500/30 text-white font-mono shadow-2xl overflow-hidden transition-all">
      {/* Terminal Header Bar */}
      <div className="px-5 py-3.5 bg-slate-900/90 border-b border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-extrabold text-emerald-400 tracking-wider">
            LIMIT-ORDER YIELD ARBITRAGE
          </span>
          <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-bold text-emerald-300">
            AUTO-UPI MANDATE
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span>DATE: {dateStr}</span>
          <span>•</span>
          <span className="text-emerald-400">LIVE FEED</span>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5 font-sans">
        {/* Market Matrix Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              Market Rate
            </span>
            <span className="text-sm font-bold text-slate-100">
              {formatPrice(currentBaseRate)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              Fill Rate
            </span>
            <span className="text-sm font-bold text-slate-100">
              {quote ? `${Math.round(quote.fill_rate * 100)}%` : "35%"}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              {quote?.unsold_units ?? 5} units unsold
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              Cancellation Risk
            </span>
            <span className="text-sm font-bold text-emerald-400">
              {quote ? quote.cancellation_policy.split(" ")[0] : "Flexible"}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              +{Math.round((quote?.cancellation_rate_prob ?? 0.15) * 100)}% churn prob
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              Base Drop Odds
            </span>
            <span className="text-sm font-bold text-amber-400">
              {quote?.base_drop_probability_pct ?? 65}%
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              {quote?.days_until_checkin ?? 3}d to check-in
            </span>
          </div>
        </div>

        {orderResult ? (
          /* Order Confirmation Card */
          <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 space-y-3 font-mono">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                LIMIT ORDER ACTIVE
              </span>
              <span className="text-[10px] text-slate-400">
                ORD ID: {orderResult.order_id}
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <p className="text-slate-200">
                Target Execution Price:{" "}
                <span className="font-bold text-emerald-300">
                  {formatPrice(orderResult.target_price)}
                </span>{" "}
                <span className="text-slate-400">({orderResult.discount_pct}% off base rate)</span>
              </p>
              <p className="text-slate-200">
                Probability of Filling:{" "}
                <span className="font-bold text-emerald-400">
                  {orderResult.fill_probability_pct}%
                </span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                UPI Mandate ID:{" "}
                <span className="font-mono text-slate-300">{orderResult.upi_mandate_id}</span>
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30 text-[11px] text-emerald-300/90 leading-relaxed font-sans">
              ⚡ <strong>Simulated UPI AutoPay Mandate Registered:</strong> If {roomName} drops its
              rate to {formatPrice(orderResult.target_price)} on or before {orderResult.for_date}, StayFinder's
              escrow engine will automatically capture the room without manual checkout friction.
            </div>

            <button
              onClick={() => setOrderResult(null)}
              className="text-xs text-slate-400 hover:text-white underline transition"
            >
              Modify Target Price
            </button>
          </div>
        ) : (
          /* Interactive Target Price Slider & Dynamic Fill Probability */
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-bold">
                  Set Your Target Limit Price:
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-extrabold text-emerald-400 font-mono">
                    {formatPrice(targetPrice)}
                  </span>
                  <span className="text-xs font-bold text-amber-300 font-mono">
                    (-{discountPct}%)
                  </span>
                </div>
              </div>

              {/* Range Slider (0% to 30% discount) */}
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={discountPct}
                onChange={(e) => setDiscountPct(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
              />

              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Market Price (0% off)</span>
                <span>15% Optimal</span>
                <span>Max Arbitrage (30% off)</span>
              </div>
            </div>

            {/* Dynamic Green Text Indicator */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                isEligible
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                  : "bg-rose-950/30 border-rose-500/40 text-rose-200"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {isEligible ? (
                  <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5 animate-bounce" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="text-xs leading-relaxed">
                  <p className="font-bold text-emerald-400">
                    Probability of filling: {fillProbabilityPct}%.
                  </p>
                  <p className="text-slate-300 text-[11px] mt-0.5">
                    {isEligible
                      ? "We will automatically execute a UPI mandate if the hotel drops the rate to your limit price."
                      : "Probability is below the 50% arbitrage threshold. Drag the slider closer to market rate to activate."}
                  </p>
                </div>
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-400 font-mono">{errorMsg}</p>
            )}

            {/* CTA Button */}
            <button
              onClick={handlePlaceLimitOrder}
              disabled={submitting || !isEligible}
              className={`w-full py-3.5 rounded-2xl font-heading font-extrabold text-xs shadow-lg transition flex items-center justify-center gap-2 ${
                isEligible
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:scale-102 active:scale-98 shadow-emerald-500/20"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                {submitting
                  ? "AUTHORIZING UPI MANDATE..."
                  : `Place Limit Order at ${formatPrice(targetPrice)}`}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
