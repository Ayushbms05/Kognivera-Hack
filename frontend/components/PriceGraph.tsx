"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TrendingDown, Sparkles, Calendar, ArrowDownRight, Tag } from "lucide-react";
import { PriceTrendsResponse, PricePoint } from "@/types";
import { api } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";

interface PriceGraphProps {
  hotelId: string;
}

export function PriceGraph({ hotelId }: PriceGraphProps) {
  const { formatPrice, convertPrice, currentCurrencyItem } = useCurrency();
  const [data, setData] = useState<PriceTrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrends() {
      try {
        const res = await api.getPriceTrends(hotelId);
        setData(res);
      } catch (err) {
        console.error("Failed to load price trends:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTrends();
  }, [hotelId]);

  if (loading) {
    return (
      <div className="p-8 rounded-3.5xl bg-white border border-slate-100 shadow-soft space-y-5">
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 skeleton-shimmer" />
          <div className="h-6 w-32 skeleton-shimmer" />
        </div>
        <div className="h-64 w-full skeleton-shimmer rounded-2xl" />
      </div>
    );
  }

  if (!data || data.trend_data.length === 0) return null;

  // Format data for chart display with dynamic conversion
  const chartPoints = data.trend_data.map((p) => {
    const d = new Date(p.date);
    const shortDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return {
      rawDate: p.date,
      dateLabel: shortDate,
      price: convertPrice(p.price),
      originalInr: p.price,
      isWeekend: p.is_weekend,
      availableUnits: p.available_units,
    };
  });

  return (
    <div className="p-6 sm:p-8 rounded-3.5xl bg-white border border-slate-100 shadow-soft space-y-6">
      {/* Header & AI Insight Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-xl bg-terracotta-50 text-terracotta-600 border border-terracotta-100">
              <TrendingDown className="w-4 h-4" />
            </span>
            <h3 className="font-heading font-extrabold text-xl text-slate-900 tracking-tight">
              30-Day Price Insights
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Historical & inventory-calendar dynamic trajectory
          </p>
        </div>

        {/* AI Insight Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-terracotta-50 to-amber-50/70 border border-terracotta-200/70 text-terracotta-800 text-xs font-bold shadow-subtle self-start sm:self-auto">
          <Sparkles className="w-3.5 h-3.5 text-terracotta-600 animate-pulse flex-shrink-0" />
          <span className="text-[11px] leading-snug">
            Book now: Current rates are {data.savings_vs_peak_pct}% lower than peak dates
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-sand-50/70 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Current Rate
          </span>
          <p className="font-heading font-extrabold text-lg text-slate-900 mt-0.5">
            {formatPrice(data.current_price)}
          </p>
          <span className="text-[10px] text-forest-700 font-semibold flex items-center gap-0.5 mt-0.5">
            <ArrowDownRight className="w-3 h-3" /> Best entry window
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-sand-50/70 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            30-Day Average
          </span>
          <p className="font-heading font-extrabold text-lg text-slate-900 mt-0.5">
            {formatPrice(data.average_price)}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">Standard baseline</span>
        </div>

        <div className="p-4 rounded-2xl bg-sand-50/70 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Lowest Deal
          </span>
          <p className="font-heading font-extrabold text-lg text-forest-700 mt-0.5">
            {formatPrice(data.cheapest_price)}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">{data.cheapest_date}</span>
        </div>

        <div className="p-4 rounded-2xl bg-sand-50/70 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Peak Rate
          </span>
          <p className="font-heading font-extrabold text-lg text-slate-800 mt-0.5">
            {formatPrice(data.highest_price)}
          </p>
          <span className="text-[10px] text-rose-500 font-medium">High weekend demand</span>
        </div>
      </div>

      {/* Recharts Area Chart */}
      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="terracottaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E05C3A" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#E05C3A" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />

            <XAxis
              dataKey="dateLabel"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 500 }}
              interval={4}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 500 }}
              tickFormatter={(val) =>
                `${currentCurrencyItem.symbol}${val >= 1000 ? (val / 1000).toFixed(1) + "k" : val}`
              }
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].payload;
                  return (
                    <div className="p-3.5 rounded-2xl bg-slate-900 text-white shadow-float text-xs space-y-1 font-sans border border-slate-800">
                      <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {p.rawDate} {p.isWeekend ? "(Weekend)" : ""}
                      </p>
                      <p className="font-heading font-extrabold text-base text-terracotta-400">
                        {formatPrice(p.originalInr)}
                      </p>
                      <p className="text-[10px] text-slate-300 font-medium">
                        {p.availableUnits} room(s) available
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Area
              type="monotone"
              dataKey="price"
              stroke="#E05C3A"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#terracottaGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
