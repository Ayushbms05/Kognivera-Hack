"use client";

import React from "react";
import { PersonaInfo } from "@/types";
import { Sparkles, Sliders, ToggleLeft, ToggleRight, User, ShieldCheck, Zap, Layers } from "lucide-react";

interface PersonaSwitcherBarProps {
  personas: PersonaInfo[];
  activePersonaId: string;
  onSelectPersona: (userId: string) => void;
  personalizationEnabled: boolean;
  onTogglePersonalization: (enabled: boolean) => void;
  isLoading?: boolean;
}

export function PersonaSwitcherBar({
  personas,
  activePersonaId,
  onSelectPersona,
  personalizationEnabled,
  onTogglePersonalization,
  isLoading = false,
}: PersonaSwitcherBarProps) {
  const activePersona = personas.find((p) => p.user_id === activePersonaId) || personas[0];

  const getPersonaTheme = (color: string) => {
    switch (color) {
      case "purple":
        return {
          activeBg: "bg-purple-950/90 border-purple-400 text-purple-200 shadow-purple-500/20",
          badge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
          dot: "bg-purple-400",
        };
      case "amber":
        return {
          activeBg: "bg-amber-950/90 border-amber-400 text-amber-200 shadow-amber-500/20",
          badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
          dot: "bg-amber-400",
        };
      case "blue":
      default:
        return {
          activeBg: "bg-blue-950/90 border-blue-400 text-blue-200 shadow-blue-500/20",
          badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
          dot: "bg-blue-400",
        };
    }
  };

  return (
    <div className="sticky top-20 z-30 rounded-3xl bg-stone-900/95 border border-stone-700/80 backdrop-blur-xl shadow-2xl p-4 text-stone-100 transition-all">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left: Section Header & Concept Tag */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-brand-500/20 to-purple-500/20 text-amber-300 border border-amber-400/30 shadow-inner">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">
                Live Persona Switcher
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                On-Stage Demo
              </span>
            </div>
            <p className="text-xs text-stone-400">
              Offline collaborative & stated-preference vector affinity • Zero LLM tokens
            </p>
          </div>
        </div>

        {/* Center: The 3 Real Stage Personas */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {personas.map((p) => {
            const isSelected = p.user_id === activePersonaId;
            const theme = getPersonaTheme(p.avatar_color);

            return (
              <button
                key={p.user_id}
                type="button"
                onClick={() => onSelectPersona(p.user_id)}
                className={`relative flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? `${theme.activeBg} shadow-lg scale-102`
                    : "bg-stone-800/80 hover:bg-stone-800 border-stone-700/70 text-stone-300 hover:text-white"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isSelected ? "bg-white/20 text-white" : "bg-stone-700 text-stone-300"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5 leading-tight">
                    <span className="font-bold text-white">{p.name}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? theme.dot : "bg-stone-500"}`} />
                  </div>
                  <div className="text-[10px] text-stone-400 font-normal">
                    {p.label}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Personalization ON / OFF Toggle */}
        <div className="flex items-center justify-between w-full lg:w-auto gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-stone-800">
          <div className="text-right hidden sm:block">
            <div className="text-[11px] font-semibold text-stone-300">
              Personalization
            </div>
            <div className="text-[10px] text-stone-400">
              {personalizationEnabled ? "Vector Affinity Active" : "Standard Neutral Ranking"}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onTogglePersonalization(!personalizationEnabled)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-extrabold transition-all duration-200 cursor-pointer ${
              personalizationEnabled
                ? "bg-emerald-950/90 border-emerald-400/80 text-emerald-300 shadow-lg shadow-emerald-900/30"
                : "bg-stone-800 border-stone-600 text-stone-400 hover:text-stone-200"
            }`}
          >
            {personalizationEnabled ? (
              <>
                <ToggleRight className="w-5 h-5 text-emerald-400" />
                <span>ON</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-5 h-5 text-stone-400" />
                <span>OFF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Active Persona Weight Telemetry Ribbon */}
      {activePersona && personalizationEnabled && (
        <div className="mt-3 pt-3 border-t border-stone-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-stone-400 flex items-center gap-1 font-mono">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Active Vector Biases:
            </span>
            {activePersona.key_weights &&
              Object.entries(activePersona.key_weights).map(([k, v]) => (
                <span
                  key={k}
                  className="px-2 py-0.5 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 font-mono"
                >
                  <span className="text-stone-400">{k}:</span>{" "}
                  <span className="font-bold text-amber-300">+{v.toFixed(1)}</span>
                </span>
              ))}
          </div>
          <div className="text-[10px] text-stone-400 italic">
            0.55× Filter + 0.20× Cosine + 0.15× Score + 0.10× Proximity
          </div>
        </div>
      )}
    </div>
  );
}
