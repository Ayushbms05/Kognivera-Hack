"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Sparkles,
  Mic,
  MicOff,
  MapPin,
  Calendar,
  Users,
  ArrowRight,
  Loader2,
  Camera,
  UploadCloud,
  X,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";

const PRESET_AI_QUERIES = [
  "quiet 4-star pure veg under 8000 in Jaipur",
  "luxury heritage resort with pool in Udaipur",
  "budget beach homestay with wifi in Goa",
  "wellness retreat with ayurvedic spa in Munnar",
];

const PRESET_VIBES = [
  { label: "Colonial Heritage", query: "colonial heritage architecture with courtyard and arched verandas" },
  { label: "Misty Mountain Retreat", query: "misty mountain view pine trees wooden cottage retreat" },
  { label: "Infinity Pool Haven", query: "luxury infinity pool overlooking valley or ocean at sunset" },
  { label: "Royal Palace Courtyard", query: "royal palace carved sandstone courtyard fountains and gardens" },
  { label: "Lakeside Serenity", query: "tranquil lakeside resort waterfront dining peaceful waters" },
  { label: "Kerala Backwaters", query: "kerala traditional wooden houseboat coconut palms backwaters" },
];

export function SearchBar({
  initialQuery = "",
  initialCity = "",
  variant = "hero",
}: {
  initialQuery?: string;
  initialCity?: string;
  variant?: "hero" | "compact";
}) {
  const router = useRouter();
  const [nlQuery, setNlQuery] = useState(initialQuery);
  const [city, setCity] = useState(initialCity);
  const [checkIn, setCheckIn] = useState("2026-09-22");
  const [checkOut, setCheckOut] = useState("2026-09-24");
  const [guests, setGuests] = useState(2);
  const [isListening, setIsListening] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; state: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);

  // Visual Vibe Inspiration State
  const [showVibeModal, setShowVibeModal] = useState(false);
  const [vibeImageFile, setVibeImageFile] = useState<File | null>(null);
  const [vibeImagePreview, setVibeImagePreview] = useState<string | null>(null);
  const [isUploadingVibe, setIsUploadingVibe] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Suggestions debounced fetch
  useEffect(() => {
    if (city.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.getSuggestions(city);
        setSuggestions(res.cities.map((c) => ({ name: c.name, state: c.state })));
      } catch (e) {
        console.error("Suggestions error:", e);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [city]);

  // Handle outside click for suggestions dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Web Speech API Voice Search
  const toggleVoiceSearch = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser. Please type your search query.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN";

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setNlQuery(transcript);
        setIsListening(false);
        executeSearch(transcript, city);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const executeSearch = async (queryText?: string, explicitCity?: string) => {
    setIsSearching(true);
    const targetQuery = queryText !== undefined ? queryText : nlQuery;
    const targetCity = explicitCity !== undefined ? explicitCity : city;

    const params = new URLSearchParams();
    if (targetQuery.trim()) {
      params.set("q", targetQuery.trim());
    }
    if (targetCity.trim()) {
      params.set("city", targetCity.trim());
    }
    if (checkIn) params.set("check_in", checkIn);
    if (checkOut) params.set("check_out", checkOut);
    if (guests) params.set("guests", String(guests));

    router.push(`/search?${params.toString()}`);
  };

  // Visual Vibe Search Actions
  const handleSelectPresetVibe = (presetQuery: string, presetLabel: string) => {
    setShowVibeModal(false);
    router.push(`/search?vibe=${encodeURIComponent(presetQuery)}&vibe_label=${encodeURIComponent(presetLabel)}`);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedImage(e.dataTransfer.files[0]);
    }
  };

  const processSelectedImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file (JPG, PNG, WebP).");
      return;
    }
    setVibeImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setVibeImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitVibeImage = async () => {
    if (!vibeImageFile) return;
    setIsUploadingVibe(true);
    try {
      const results = await api.searchVibe({ file: vibeImageFile });
      if (typeof window !== "undefined") {
        sessionStorage.setItem("sf_vibe_results", JSON.stringify(results));
        sessionStorage.setItem("sf_vibe_label", vibeImageFile.name.replace(/\.[^/.]+$/, ""));
      }
      setShowVibeModal(false);
      router.push(`/search?vibe=custom_upload&vibe_label=${encodeURIComponent(vibeImageFile.name)}`);
    } catch (err) {
      console.error("Vibe image upload failed:", err);
      alert("Failed to analyze image vibe. Falling back to text presets.");
    } finally {
      setIsUploadingVibe(false);
    }
  };

  if (variant === "compact") {
    return (
      <div className="w-full bg-white rounded-2xl shadow-md border border-slate-200 p-2 flex flex-col md:flex-row items-center gap-2 relative">
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 w-full">
          <Sparkles className="w-4 h-4 text-brand-600 flex-shrink-0" />
          <input
            type="text"
            value={nlQuery}
            onChange={(e) => setNlQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && executeSearch()}
            placeholder="Search naturally (e.g. 'pure veg 4-star under 6000')..."
            className="w-full text-sm font-medium text-slate-800 placeholder-slate-400 outline-none bg-transparent"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Visual Vibe Inspiration Button */}
          <button
            type="button"
            onClick={() => setShowVibeModal(true)}
            title="Upload an inspiration photo or match aesthetic vibes"
            className="px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold flex items-center gap-1.5 transition flex-shrink-0"
          >
            <Camera className="w-3.5 h-3.5 text-purple-600" />
            <span>Visual Vibe</span>
          </button>

          <button
            onClick={() => executeSearch()}
            disabled={isSearching}
            className="w-full md:w-auto px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-sm"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search</span>
          </button>
        </div>

        {/* Visual Vibe Modal */}
        {showVibeModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-purple-700">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-lg text-slate-900 leading-tight">
                      Visual Vibe Search
                    </h3>
                    <p className="text-xs text-slate-500">
                      Match hotel architecture & amenities with local TF-IDF
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVibeModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 rounded-2xl border-2 border-dashed cursor-pointer transition text-center flex flex-col items-center justify-center gap-3 ${
                  isDragOver
                    ? "border-purple-500 bg-purple-50/60 scale-[1.01]"
                    : "border-slate-200 hover:border-purple-300 hover:bg-slate-50/60"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processSelectedImage(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {vibeImagePreview ? (
                  <div className="space-y-3">
                    <img
                      src={vibeImagePreview}
                      alt="Inspiration Preview"
                      className="w-44 h-28 object-cover rounded-xl mx-auto shadow-sm border border-slate-200"
                    />
                    <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{vibeImageFile?.name}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Drag & drop your travel inspiration photo
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Supports JPG, PNG, WebP • Auto-hashed with SHA-256
                      </p>
                    </div>
                  </>
                )}
              </div>

              {vibeImageFile && (
                <button
                  type="button"
                  onClick={handleSubmitVibeImage}
                  disabled={isUploadingVibe}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs shadow-glow flex items-center justify-center gap-2 transition"
                >
                  {isUploadingVibe ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Vectorizing Aesthetics with TF-IDF...</span>
                    </>
                  ) : (
                    <span>Search Properties Matching This Photo &rarr;</span>
                  )}
                </button>
              )}

              {/* Curated Preset Vibe Tags */}
              <div className="pt-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Or pick a curated aesthetic vibe:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_VIBES.map((vibe) => (
                    <button
                      key={vibe.label}
                      type="button"
                      onClick={() => handleSelectPresetVibe(vibe.query, vibe.label)}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-900 text-slate-700 text-left text-xs font-semibold transition flex items-center justify-between"
                    >
                      <span className="truncate">{vibe.label}</span>
                      <Sparkles className="w-3 h-3 text-purple-500 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Main Search Panel */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-4 sm:p-6 shadow-2xl border border-white/60 ring-1 ring-slate-900/5">
        {/* Natural Language AI prompt bar */}
        <div className="relative mb-4">
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-brand-50/70 via-indigo-50/40 to-amber-50/40 border border-brand-200/60 shadow-inner focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
            <div className="flex items-center gap-1 text-brand-700">
              <Sparkles className="w-5 h-5 animate-pulse text-brand-600" />
            </div>
            <input
              type="text"
              value={nlQuery}
              onChange={(e) => setNlQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && executeSearch()}
              placeholder="Ask anything naturally: 'quiet 4-star pure veg under 8000 in Jaipur' or in Hindi/Tamil..."
              className="w-full text-sm sm:text-base font-medium text-slate-800 placeholder-slate-400 bg-transparent outline-none"
            />

            {/* Inspiration Visual Vibe Button */}
            <button
              type="button"
              onClick={() => setShowVibeModal(true)}
              title="Upload inspiration photo or match aesthetic vibes"
              className="px-3 py-2 rounded-xl bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 hover:border-purple-300 text-xs font-bold flex items-center gap-1.5 transition flex-shrink-0 shadow-sm"
            >
              <Camera className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline">Inspiration</span>
            </button>

            {/* Voice button */}
            <button
              type="button"
              onClick={toggleVoiceSearch}
              title={isListening ? "Listening..." : "Click to speak"}
              className={`p-2 rounded-xl transition-all ${
                isListening
                  ? "bg-rose-500 text-white animate-pulse shadow-glow"
                  : "bg-white text-slate-600 hover:text-brand-600 hover:bg-brand-50 border border-slate-200"
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Structured Filter Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Destination */}
          <div className="relative" ref={suggestRef}>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Destination
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/60 focus-within:bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10 transition">
              <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Where to? (e.g. Jaipur)"
                className="w-full text-xs font-semibold text-slate-800 placeholder-slate-400 bg-transparent outline-none"
              />
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCity(s.name);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between text-xs transition"
                  >
                    <span className="font-bold text-slate-800">{s.name}</span>
                    <span className="text-[11px] text-slate-400 font-medium">{s.state}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Check-In */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Check-in
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/60 focus-within:bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10 transition">
              <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full text-xs font-semibold text-slate-800 bg-transparent outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Check-Out */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Check-out
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/60 focus-within:bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10 transition">
              <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full text-xs font-semibold text-slate-800 bg-transparent outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Guests & Action Button */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Guests
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/60 transition">
                <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <select
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  className="w-full text-xs font-semibold text-slate-800 bg-transparent outline-none cursor-pointer"
                >
                  <option value={1}>1 Guest</option>
                  <option value={2}>2 Guests</option>
                  <option value={3}>3 Guests</option>
                  <option value={4}>4 Guests</option>
                  <option value={5}>5+ Guests</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => executeSearch()}
                disabled={isSearching}
                className="h-[38px] px-5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shadow-glow flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Search</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Preset Prompt Badges */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Try asking:
          </span>
          {PRESET_AI_QUERIES.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setNlQuery(preset);
                executeSearch(preset);
              }}
              className="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 border border-slate-200/60 text-slate-600 whitespace-nowrap transition"
            >
              "{preset}"
            </button>
          ))}
        </div>
      </div>

      {/* Visual Vibe Modal */}
      {showVibeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-purple-700">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-lg text-slate-900 leading-tight">
                    Visual Vibe Search
                  </h3>
                  <p className="text-xs text-slate-500">
                    Grounded local TF-IDF & Vision NLP matching
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVibeModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 rounded-2xl border-2 border-dashed cursor-pointer transition text-center flex flex-col items-center justify-center gap-3 ${
                isDragOver
                  ? "border-purple-500 bg-purple-50/60 scale-[1.01]"
                  : "border-slate-200 hover:border-purple-300 hover:bg-slate-50/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processSelectedImage(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {vibeImagePreview ? (
                <div className="space-y-3">
                  <img
                    src={vibeImagePreview}
                    alt="Inspiration Preview"
                    className="w-48 h-32 object-cover rounded-xl mx-auto shadow-sm border border-slate-200"
                  />
                  <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="truncate max-w-xs">{vibeImageFile?.name}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Upload or Drag & Drop Inspiration Photo
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Supports JPG, PNG, WebP • Hashed with SHA-256
                    </p>
                  </div>
                </>
              )}
            </div>

            {vibeImageFile && (
              <button
                type="button"
                onClick={handleSubmitVibeImage}
                disabled={isUploadingVibe}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs shadow-glow flex items-center justify-center gap-2 transition"
              >
                {isUploadingVibe ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Vectorizing Aesthetics with TF-IDF...</span>
                  </>
                ) : (
                  <span>Search Properties Matching This Photo &rarr;</span>
                )}
              </button>
            )}

            {/* Curated Preset Vibe Tags */}
            <div className="pt-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Or pick a curated aesthetic vibe:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_VIBES.map((vibe) => (
                  <button
                    key={vibe.label}
                    type="button"
                    onClick={() => handleSelectPresetVibe(vibe.query, vibe.label)}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-900 text-slate-700 text-left text-xs font-semibold transition flex items-center justify-between"
                  >
                    <span className="truncate">{vibe.label}</span>
                    <Sparkles className="w-3 h-3 text-purple-500 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
