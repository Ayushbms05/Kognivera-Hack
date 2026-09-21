"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  AlertCircle,
  Sparkles,
  Calendar,
  Layers,
  Flame,
  CheckCircle2,
  Cpu,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import Decimal from "decimal.js";
import { PriceAnalyticsResponse, PriceAnalyticsPoint } from "@/types";
import { api } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";

interface PriceAnalyticsGraphProps {
  hotelId: string;
  initialRoomTypeId?: string;
}

export function PriceAnalyticsGraph({ hotelId, initialRoomTypeId }: PriceAnalyticsGraphProps) {
  const { formatPrice } = useCurrency();
  const [data, setData] = useState<PriceAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchAnalytics() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPriceAnalytics(hotelId, initialRoomTypeId);
      setData(res);
    } catch (err: any) {
      console.error("Failed to load price analytics:", err);
      setError("Unable to compute price analytics at this time.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnalytics();
  }, [hotelId, initialRoomTypeId]);

  // Format monetary value with Decimal.js
  function formatExactMoney(amount: number) {
    try {
      const d = new Decimal(amount);
      return formatPrice(d.toNumber());
    } catch {
      return formatPrice(amount);
    }
  }

  function formatShortDate(dateStr: string) {
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const m = parseInt(parts[1], 10) - 1;
        return `${monthNames[m]} ${parseInt(parts[2], 10)}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  // Custom Tooltip showing date, rate, and free units
  function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
      const pt: PriceAnalyticsPoint = payload[0].payload;
      return (
        <div className="bg-slate-950 text-white p-3.5 rounded-2xl shadow-xl border border-slate-800 text-xs space-y-2 min-w-[200px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-slate-300 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>{formatShortDate(pt.date)}</span>
            </span>
            <span className="text-[10px] text-slate-400">{pt.date}</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Base Rate:</span>
              <span className="font-extrabold text-white text-sm">
                {formatExactMoney(pt.rate)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">7-Day Rolling Avg:</span>
              <span className="font-semibold text-emerald-400">
                {formatExactMoney(pt.rolling_avg)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Remaining Units:</span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                  pt.free_units <= 2
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : "bg-emerald-500/20 text-emerald-300"
                }`}
              >
                {pt.free_units} units left
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <section className="p-6 sm:p-8 rounded-3.5xl bg-white border border-slate-100 shadow-soft space-y-6">
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </span>
            <h3 className="font-heading font-extrabold text-xl text-slate-900 tracking-tight">
              30-Day Price Insights &amp; Scarcity Analytics
            </h3>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Cpu className="w-3 h-3" />
              <span>NumPy / Pandas ML Engine</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Statistical time-series forecasting &amp; inventory exhaustion analysis for{" "}
            <strong className="text-slate-800">{data?.room_type_name || "Primary Suite"}</strong>.
          </p>
        </div>

        {/* Pulsing Scarcity Alert & Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {data?.is_scarcity && (
            <div className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600" />
              </span>
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span>High Demand / Scarcity Alert</span>
              </span>
            </div>
          )}

          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition"
            title="Recalculate Numerical Model"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Analytical Recommendation Banner */}
      {data?.price_recommendation && (
        <div className="p-4 rounded-2.5xl bg-slate-900 text-white shadow-sm flex items-center justify-between gap-4 border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                Statistical Pricing Insight
              </p>
              <p className="text-xs sm:text-sm font-bold text-slate-100">
                {data.price_recommendation}
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 text-right text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Lowest Window</span>
              <span className="font-bold text-emerald-300">{formatShortDate(data.lowest_date)}</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Highest Window</span>
              <span className="font-bold text-amber-300">{formatShortDate(data.highest_date)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="h-[280px] w-full bg-slate-50 animate-pulse rounded-2.5xl flex items-center justify-center text-slate-400 text-xs font-semibold">
          Computing 7-day rolling average &amp; trend velocity...
        </div>
      )}

      {/* Error View */}
      {!loading && error && (
        <div className="p-6 rounded-2.5xl bg-rose-50 border border-rose-200 text-rose-700 text-center text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Recharts AreaChart with Emerald Gradient & Stroke */}
      {!loading && data && (
        <div className="h-[280px] sm:h-[320px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data.historical_trend}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <defs>
                {/* Emerald Gradient Fill */}
                <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />

              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />

              <YAxis
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${Math.round(v)}`}
                domain={["dataMin - 200", "dataMax + 200"]}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* 7-Day Rolling Average Line (Subtle Guide) */}
              <Area
                type="monotone"
                dataKey="rolling_avg"
                stroke="#047857"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
                isAnimationActive={true}
              />

              {/* Main Daily Base Rate Area */}
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#059669"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#emeraldGradient)"
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stat Metric Cards */}
      {!loading && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400">Lowest Rate</span>
            <p className="font-heading font-extrabold text-sm text-slate-900 mt-0.5">
              {formatExactMoney(Math.min(...data.historical_trend.map((p) => p.rate)))}
            </p>
            <span className="text-[10px] text-emerald-600 font-semibold">
              on {formatShortDate(data.lowest_date)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400">Highest Rate</span>
            <p className="font-heading font-extrabold text-sm text-slate-900 mt-0.5">
              {formatExactMoney(Math.max(...data.historical_trend.map((p) => p.rate)))}
            </p>
            <span className="text-[10px] text-amber-600 font-semibold">
              on {formatShortDate(data.highest_date)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400">Min Free Rooms</span>
            <p className="font-heading font-extrabold text-sm text-slate-900 mt-0.5">
              {Math.min(...data.historical_trend.map((p) => p.free_units))} Units
            </p>
            <span className="text-[10px] text-slate-500 font-semibold">Real-time inventory</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400">ML Trend Model</span>
            <p className="font-heading font-extrabold text-sm text-emerald-700 mt-0.5">
              Polyfit Linear + MA7
            </p>
            <span className="text-[10px] text-slate-500 font-semibold">Zero LLM latency</span>
          </div>
        </div>
      )}
    </section>
  );
}
