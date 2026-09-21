"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Compass, Sparkles, User, Globe, Heart, ShieldCheck, Coins, Fingerprint, Plane, WifiOff } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import { useFlightMode } from "@/context/FlightModeContext";
import { AuthModal } from "@/components/AuthModal";
import { OnboardingModal } from "@/components/OnboardingModal";

export function Navbar() {
  const [selectedLang, setSelectedLang] = useState("en-IN");
  const { currency, setCurrency, currencies } = useCurrency();
  const { effectiveFlightMode, isFlightModeForced, toggleForceFlightMode, savedCities } = useFlightMode();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);


  const [activeUser, setActiveUser] = useState({
    name: "Aarav Kumar",
    initials: "AK",
    vibe: "Cultural • Mid",
    userId: "usr_f855344d",
  });

  useEffect(() => {
    function syncUser() {
      const storedName = localStorage.getItem("sf_active_user_name");
      const storedVibe = localStorage.getItem("sf_active_user_vibe");
      const storedUid = localStorage.getItem("sf_active_user_id");

      if (storedName || storedVibe) {
        const name = storedName || "StayFinder Member";
        const initials = name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        setActiveUser({
          name,
          initials,
          vibe: storedVibe || "Personalized",
          userId: storedUid || "usr_f855344d",
        });
      }
    }

    syncUser();
    window.addEventListener("sf_user_updated", syncUser);
    return () => window.removeEventListener("sf_user_updated", syncUser);
  }, []);

  return (
    <>
      <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        effectiveFlightMode
          ? "bg-slate-900/98 backdrop-blur-xl border-b border-amber-500/40 text-white shadow-2xl shadow-slate-950/40"
          : "glass border-b border-slate-200/80"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-glow group-hover:scale-105 transition-transform duration-300 ${
              effectiveFlightMode
                ? "bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-600 text-slate-950 shadow-amber-400/30"
                : "bg-gradient-to-tr from-brand-600 via-brand-500 to-amber-500"
            }`}>
              {effectiveFlightMode ? (
                <Plane className="w-6 h-6 text-slate-950" />
              ) : (
                <Compass className="w-6 h-6 animate-pulse_slow" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-heading font-extrabold text-2xl tracking-tight ${
                  effectiveFlightMode
                    ? "text-white"
                    : "bg-gradient-to-r from-slate-900 via-brand-950 to-brand-700 bg-clip-text text-transparent"
                }`}>
                  StayFinder
                </span>
                {effectiveFlightMode ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/60 text-amber-300 text-xs font-black shadow-lg shadow-amber-400/20 animate-pulse">
                    <Plane className="w-3.5 h-3.5 text-amber-300 rotate-45" />
                    <span>Flight Mode Active</span>
                    <span className="text-[9px] bg-amber-400/30 text-amber-200 px-1.5 py-0.2 rounded font-extrabold uppercase tracking-wider">0ms PWA</span>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                    AI
                  </span>
                )}
              </div>
              <p className={`text-[11px] font-medium tracking-wider uppercase -mt-0.5 ${
                effectiveFlightMode ? "text-amber-200/80" : "text-slate-500"
              }`}>
                {effectiveFlightMode ? "Zero-Latency IndexedDB Offline Engine" : "Discover • Match • Experience"}
              </p>
            </div>
          </Link>

          {/* Navigation Quick Links */}
          <nav className={`hidden md:flex items-center gap-7 text-sm font-medium ${
            effectiveFlightMode ? "text-slate-300" : "text-slate-600"
          }`}>
            <Link href="/search?city=Jaipur" className={effectiveFlightMode ? "hover:text-amber-300 transition-colors" : "hover:text-brand-600 transition-colors"}>
              Jaipur
            </Link>
            <Link href="/search?city=Hyderabad" className={effectiveFlightMode ? "hover:text-amber-300 transition-colors" : "hover:text-brand-600 transition-colors"}>
              Hyderabad
            </Link>
            <Link href="/search?city=Udaipur" className={effectiveFlightMode ? "hover:text-amber-300 transition-colors" : "hover:text-brand-600 transition-colors"}>
              Udaipur
            </Link>
            <Link href="/search?property_type=heritage" className={`flex items-center gap-1.5 ${effectiveFlightMode ? "hover:text-amber-300 transition-colors" : "hover:text-brand-600 transition-colors"}`}>
              <span>Heritage Stays</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            </Link>
            <button
              onClick={() => setIsOnboardingOpen(true)}
              className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border transition ${
                effectiveFlightMode
                  ? "text-amber-300 bg-amber-950/40 border-amber-500/40 hover:bg-amber-900/50"
                  : "text-terracotta-600 bg-terracotta-50 hover:bg-terracotta-100/70 border-terracotta-200"
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Travel DNA</span>
            </button>
          </nav>

          {/* Right Section: Flight Mode Toggle, Currency, User Profile */}
          <div className="flex items-center gap-3">
            {/* Flight Mode Simulation / Status Toggle */}
            <button
              onClick={toggleForceFlightMode}
              type="button"
              id="btn-flight-mode-toggle"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                effectiveFlightMode
                  ? "bg-amber-400 text-slate-950 border-amber-300 hover:bg-amber-300 font-black shadow-lg shadow-amber-400/25"
                  : "bg-white/80 hover:bg-white text-slate-700 border-slate-200 hover:border-slate-300"
              }`}
              title={effectiveFlightMode ? "Flight Mode Active (IndexedDB PWA). Click to exit." : "Simulate Flight Mode (Test Zero-Latency Offline Search)"}
            >
              <Plane className={`w-3.5 h-3.5 ${effectiveFlightMode ? "text-slate-950" : "text-amber-600"}`} />
              <span className="hidden sm:inline font-bold">
                {effectiveFlightMode ? "Flight Mode Active" : "Flight Mode"}
              </span>
            </button>

            {/* Dynamic Currency Toggle */}
            <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white/70 hover:bg-white text-xs font-semibold text-slate-700 shadow-sm cursor-pointer transition">
              <span className="font-extrabold text-terracotta-600 text-xs">
                {currencies.find((c) => c.iso4217 === currency)?.symbol || "₹"}
              </span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="bg-transparent border-none outline-none cursor-pointer pr-1 text-xs font-bold text-slate-700"
                aria-label="Select Currency"
              >
                {currencies.map((c) => (
                  <option key={c.iso4217} value={c.iso4217}>
                    {c.iso4217} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Language Selector */}
            <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white/70 hover:bg-white text-xs font-semibold text-slate-700 shadow-sm cursor-pointer transition">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="bg-transparent border-none outline-none cursor-pointer pr-1 text-xs font-semibold text-slate-700"
                aria-label="Select Language"
              >
                <option value="en-IN">English (IN)</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="te">తెలుగు (Telugu)</option>
                <option value="bn">বাংলা (Bengali)</option>
              </select>
            </div>

            {/* User Persona & Passkey Button */}
            <button
              onClick={() => setIsAuthOpen(true)}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-2xl bg-gradient-to-r from-slate-50 to-indigo-50/50 hover:from-slate-100 hover:to-indigo-100/60 border border-slate-200/80 shadow-sm transition hover:scale-102 active:scale-98 text-left"
              title="Click to view profile or sign in with Biometric Passkey"
            >
              <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {activeUser.initials}
              </div>
              <div className="hidden sm:block text-left">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold text-slate-800 leading-tight">
                    {activeUser.name}
                  </p>
                  <Fingerprint className="w-3 h-3 text-emerald-600" />
                </div>
                <p className="text-[10px] font-semibold text-brand-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {activeUser.vibe}
                </p>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        userId={activeUser.userId}
      />
    </>
  );
}
