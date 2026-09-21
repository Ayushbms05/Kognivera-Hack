"use client";

import { useState } from "react";
import { Compass, BedDouble, TrendingUp, Star, Sparkles, Cpu } from "lucide-react";

interface HotelDetailTabsProps {
  roomsContent: React.ReactNode;
  priceGraphContent: React.ReactNode;
  itineraryContent: React.ReactNode;
  reviewsContent: React.ReactNode;
  defaultTab?: "rooms" | "itinerary" | "prices" | "reviews";
}

export function HotelDetailTabs({
  roomsContent,
  priceGraphContent,
  itineraryContent,
  reviewsContent,
  defaultTab = "rooms",
}: HotelDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"rooms" | "itinerary" | "prices" | "reviews">(defaultTab);

  const tabs = [
    {
      id: "rooms" as const,
      label: "Rooms & Suites",
      icon: <BedDouble className="w-4 h-4" />,
      badge: null,
    },
    {
      id: "itinerary" as const,
      label: "Curated 3-Day Trip Itinerary",
      icon: <Compass className="w-4 h-4 text-emerald-400" />,
      badge: (
        <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Local ML</span>
        </span>
      ),
    },
    {
      id: "prices" as const,
      label: "30-Day Price & Scarcity Analytics",
      icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
      badge: (
        <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Scarcity ML</span>
        </span>
      ),
    },
    {
      id: "reviews" as const,
      label: "Guest Reviews & AI Summary",
      icon: <Star className="w-4 h-4" />,
      badge: null,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Sticky / Floating Luxury Tabs Header */}
      <div className="bg-slate-900 text-white p-2 rounded-2.5xl shadow-xl border border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-white text-slate-900 shadow-md scale-[1.02]"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/80"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge}
            </button>
          );
        })}
      </div>

      {/* Tab Content Panels */}
      <div className="transition-opacity duration-300">
        {activeTab === "rooms" && (
          <div className="space-y-10">
            {roomsContent}
            <div className="border-t border-slate-200/80 pt-10">
              {itineraryContent}
            </div>
            <div className="border-t border-slate-200/80 pt-10">
              {priceGraphContent}
            </div>
            <div className="border-t border-slate-200/80 pt-10">
              {reviewsContent}
            </div>
          </div>
        )}

        {activeTab === "itinerary" && (
          <div className="space-y-6">
            {itineraryContent}
          </div>
        )}

        {activeTab === "prices" && (
          <div className="space-y-6">
            {priceGraphContent}
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-6">
            {reviewsContent}
          </div>
        )}
      </div>
    </div>
  );
}
