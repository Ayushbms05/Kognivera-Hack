"use client";

import { X, Sparkles, SlidersHorizontal, Check } from "lucide-react";
import { SearchFilterChip } from "@/types";

interface FilterChipsProps {
  chips: SearchFilterChip[];
  onRemoveChip: (field: string) => void;
  selectedType?: string;
  onSelectType: (type: string | undefined) => void;
  selectedSort?: string;
  onSelectSort: (sort: string) => void;
  selectedAmenities: string[];
  onToggleAmenity: (amenity: string) => void;
}

const PROPERTY_TYPES = [
  { id: "heritage", label: "Heritage Haveli" },
  { id: "resort", label: "Luxury Resort" },
  { id: "boutique", label: "Boutique Stay" },
  { id: "homestay", label: "Homestay" },
  { id: "hotel", label: "Hotel" },
];

const POPULAR_AMENITIES = [
  { id: "swimming_pool", label: "Pool" },
  { id: "spa", label: "Spa" },
  { id: "free_wifi", label: "Free Wi-Fi" },
  { id: "vegetarian_kitchen", label: "Pure Veg" },
  { id: "beach_access", label: "Beach Access" },
  { id: "free_parking", label: "Free Parking" },
];

export function FilterChips({
  chips,
  onRemoveChip,
  selectedType,
  onSelectType,
  selectedSort,
  onSelectSort,
  selectedAmenities,
  onToggleAmenity,
}: FilterChipsProps) {
  return (
    <div className="space-y-4">
      {/* Active AI Parsed Chips */}
      {chips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-slate-200">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200/80">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>AI Extracted Filters:</span>
          </div>
          {chips.map((chip, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs group"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={() => onRemoveChip(chip.field)}
                className="w-3.5 h-3.5 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-slate-600 transition"
                aria-label={`Remove ${chip.label}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filter Options Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Property Type Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => onSelectType(undefined)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex-shrink-0 ${
              !selectedType
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            All Types
          </button>
          {PROPERTY_TYPES.map((pt) => (
            <button
              key={pt.id}
              type="button"
              onClick={() => onSelectType(selectedType === pt.id ? undefined : pt.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex-shrink-0 ${
                selectedType === pt.id
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {pt.label}
            </button>
          ))}
        </div>

        {/* Sort and Amenity Controls */}
        <div className="flex items-center gap-3 self-end lg:self-auto">
          {/* Amenities Quick Toggles */}
          <div className="hidden sm:flex items-center gap-1.5">
            {POPULAR_AMENITIES.slice(0, 3).map((a) => {
              const active = selectedAmenities.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onToggleAmenity(a.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1 ${
                    active
                      ? "bg-brand-50 border-brand-300 text-brand-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {active && <Check className="w-3 h-3 text-brand-600" />}
                  <span>{a.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedSort || "relevance"}
              onChange={(e) => onSelectSort(e.target.value)}
              className="bg-transparent border-none outline-none cursor-pointer font-bold text-slate-700 text-xs"
            >
              <option value="relevance">Top Match / Relevance</option>
              <option value="rating">Highest Rated</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
