"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Volume2,
  VolumeX,
  Compass,
  Calendar,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
  Info,
  Clock,
  Layers,
} from "lucide-react";
import { api } from "@/lib/api";
import { RoomOptimizerResponse, SolarPoint } from "@/types";

interface BioclimaticRoomOptimizerProps {
  hotelId: string;
  hotelName: string;
  initialDate?: string;
}

export const BioclimaticRoomOptimizer: React.FC<BioclimaticRoomOptimizerProps> = ({
  hotelId,
  hotelName,
  initialDate,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || new Date().toISOString().split("T")[0]
  );
  const [activeTimePhase, setActiveTimePhase] = useState<"morning" | "evening">("morning");
  const [data, setData] = useState<RoomOptimizerResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [compassRotation, setCompassRotation] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    async function fetchOptimization() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getRoomOptimization(hotelId, selectedDate);
        if (isMounted) {
          setData(res);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "Failed to calculate bioclimatic room optimization.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchOptimization();
    return () => {
      isMounted = false;
    };
  }, [hotelId, selectedDate]);

  // Compass geometry constants
  const size = 320;
  const center = size / 2;
  const radius = 120;

  // Convert azimuth (0 = North, 90 = East, 180 = South, 270 = West)
  // to SVG (x, y) coordinates with 0° at the top (12 o'clock)
  const polarToSvg = (azimuthDeg: number, altDeg: number = 0) => {
    // Clamping altitude so higher sun is slightly more inward
    const effectiveR = radius * (1 - Math.max(0, altDeg) / 180 * 0.4);
    const rad = ((azimuthDeg - 90) * Math.PI) / 180;
    return {
      x: center + effectiveR * Math.cos(rad),
      y: center + effectiveR * Math.sin(rad),
    };
  };

  // Generate SVG path for the solar trajectory arc
  const generateTrajectoryPath = (trajectory: SolarPoint[]) => {
    if (!trajectory || trajectory.length === 0) return "";
    const points = trajectory.map((p) => polarToSvg(p.azimuth, p.altitude));
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  // Noise vector point and cone
  const noiseBearing = data?.acoustic.bearing_degrees || 0;
  const noisePoint = polarToSvg(noiseBearing, 0);

  // Optimal facing direction azimuth in degrees
  const facingAzimuths: Record<string, number> = {
    North: 0,
    "North-East": 45,
    East: 90,
    "South-East": 135,
    South: 180,
    "South-West": 225,
    West: 270,
    "North-West": 315,
  };
  const optimalFacingDeg = data ? facingAzimuths[data.optimal_facing] ?? 90 : 90;
  const optimalPoint = polarToSvg(optimalFacingDeg, 0);

  return (
    <section
      id="bioclimatic-optimizer-section"
      className="relative overflow-hidden rounded-3xl border border-slate-700/60 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-6 md:p-8 shadow-2xl backdrop-blur-xl"
    >
      {/* Ambient background glow elements */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
              <Sun className="h-3.5 w-3.5 animate-spin-slow text-amber-400" />
              Physics & Spatial Math Engine
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              Zero-LLM Deterministic
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Bioclimatic Room Optimizer
            <Sparkles className="h-5 w-5 text-amber-400" />
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Simulates astronomical solar trajectories (Spencer/NOAA equations) and spatial acoustic
            attenuation against verified urban transit hubs to prescribe the quietest, sunniest room orientation.
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-2 px-3 shadow-inner">
          <Calendar className="h-4 w-4 text-amber-400" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Simulation Date
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Main Interactive Workspace */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
            <Sun className="absolute inset-0 m-auto h-6 w-6 text-amber-400 animate-pulse" />
          </div>
          <p className="text-sm font-medium text-slate-300">
            Calculating solar declination, azimuth curves, and inverse-square decibel fields...
          </p>
        </div>
      ) : error || !data ? (
        <div className="my-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-6 text-center text-rose-300">
          <Info className="h-8 w-8 mx-auto mb-2 text-rose-400" />
          <p className="text-sm font-semibold">{error || "Unable to compute room optimization."}</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Compass Dial Column (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            {/* Phase Selector Tabs */}
            <div className="mb-4 flex items-center p-1 rounded-xl bg-slate-800/70 border border-slate-700/70 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTimePhase("morning")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTimePhase === "morning"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
                Morning (08:00 AM)
              </button>
              <button
                type="button"
                onClick={() => setActiveTimePhase("evening")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTimePhase === "evening"
                    ? "bg-amber-600 text-white font-bold shadow-md shadow-amber-600/20"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                Evening (17:00 PM)
              </button>
            </div>

            {/* Compass Container */}
            <div className="relative select-none flex items-center justify-center p-2">
              <motion.div
                className="relative"
                animate={{ rotate: compassRotation }}
                transition={{ type: "spring", damping: 20 }}
              >
                <svg
                  width={size}
                  height={size}
                  viewBox={`0 0 ${size} ${size}`}
                  className="overflow-visible drop-shadow-[0_0_25px_rgba(0,0,0,0.8)]"
                >
                  <defs>
                    {/* Glowing Sun Filters */}
                    <radialGradient id="sunGradientMorning" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#fef08a" />
                      <stop offset="60%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="sunGradientEvening" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#fed7aa" />
                      <stop offset="60%" stopColor="#ea580c" />
                      <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="noiseConeGradient" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
                      <stop offset="80%" stopColor="#f87171" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                    </radialGradient>
                    <filter id="solarGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="5" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Outer Compass Rim */}
                  <circle
                    cx={center}
                    cy={center}
                    r={radius + 20}
                    fill="none"
                    stroke="#334155"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="#0f172a"
                    stroke="#475569"
                    strokeWidth="2"
                    className="opacity-90"
                  />
                  <circle
                    cx={center}
                    cy={center}
                    r={radius - 40}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="1"
                  />

                  {/* Crosshairs */}
                  <line
                    x1={center}
                    y1={center - radius}
                    x2={center}
                    y2={center + radius}
                    stroke="#334155"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <line
                    x1={center - radius}
                    y1={center}
                    x2={center + radius}
                    y2={center}
                    stroke="#334155"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />

                  {/* Cardinal Direction Ticks & Labels */}
                  {/* North */}
                  <text
                    x={center}
                    y={center - radius + 18}
                    textAnchor="middle"
                    className="fill-amber-400 font-extrabold text-xs tracking-wider"
                  >
                    N
                  </text>
                  {/* East */}
                  <text
                    x={center + radius - 16}
                    y={center + 4}
                    textAnchor="middle"
                    className="fill-slate-300 font-extrabold text-xs tracking-wider"
                  >
                    E
                  </text>
                  {/* South */}
                  <text
                    x={center}
                    y={center + radius - 10}
                    textAnchor="middle"
                    className="fill-slate-300 font-extrabold text-xs tracking-wider"
                  >
                    S
                  </text>
                  {/* West */}
                  <text
                    x={center - radius + 16}
                    y={center + 4}
                    textAnchor="middle"
                    className="fill-slate-300 font-extrabold text-xs tracking-wider"
                  >
                    W
                  </text>

                  {/* Intercardinals */}
                  <text
                    x={center + 60}
                    y={center - 60}
                    textAnchor="middle"
                    className="fill-slate-600 font-medium text-[9px]"
                  >
                    NE
                  </text>
                  <text
                    x={center + 60}
                    y={center + 65}
                    textAnchor="middle"
                    className="fill-slate-600 font-medium text-[9px]"
                  >
                    SE
                  </text>
                  <text
                    x={center - 60}
                    y={center + 65}
                    textAnchor="middle"
                    className="fill-slate-600 font-medium text-[9px]"
                  >
                    SW
                  </text>
                  <text
                    x={center - 60}
                    y={center - 60}
                    textAnchor="middle"
                    className="fill-slate-600 font-medium text-[9px]"
                  >
                    NW
                  </text>

                  {/* Acoustic Noise Hub Cone Indicator */}
                  {data?.acoustic && (
                    <g className="transition-all duration-700">
                      {/* Radiating sound cone towards the transit hub bearing */}
                      <circle
                        cx={noisePoint.x}
                        cy={noisePoint.y}
                        r="22"
                        fill="url(#noiseConeGradient)"
                        className="animate-pulse"
                      />
                      <line
                        x1={center}
                        y1={center}
                        x2={noisePoint.x}
                        y2={noisePoint.y}
                        stroke="#ef4444"
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                        opacity="0.8"
                      />
                      <circle
                        cx={noisePoint.x}
                        cy={noisePoint.y}
                        r="6"
                        fill="#ef4444"
                        stroke="#fca5a5"
                        strokeWidth="1.5"
                      />
                      <text
                        x={noisePoint.x}
                        y={noisePoint.y - 10}
                        textAnchor="middle"
                        className="fill-rose-400 font-bold text-[9px] drop-shadow"
                      >
                        🔊 {data.acoustic.direction} ({data.acoustic.distance_km}km)
                      </text>
                    </g>
                  )}

                  {/* Glowing Solar Trajectory Arc */}
                  {data?.solar.trajectory && (
                    <g>
                      {/* Thick background glow track */}
                      <path
                        d={generateTrajectoryPath(data.solar.trajectory)}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="5"
                        opacity="0.3"
                        strokeLinecap="round"
                        filter="url(#solarGlow)"
                      />
                      {/* Crisp foreground trajectory line */}
                      <path
                        d={generateTrajectoryPath(data.solar.trajectory)}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="2"
                        strokeDasharray="5 3"
                        strokeLinecap="round"
                      />
                    </g>
                  )}

                  {/* 08:00 AM Sun Marker */}
                  {data?.solar.morning_8am && (
                    <g>
                      {(() => {
                        const pt = polarToSvg(
                          data.solar.morning_8am.azimuth,
                          data.solar.morning_8am.altitude
                        );
                        const isSelected = activeTimePhase === "morning";
                        return (
                          <g
                            className="cursor-pointer transition-transform duration-300"
                            onClick={() => setActiveTimePhase("morning")}
                          >
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isSelected ? 14 : 9}
                              fill="url(#sunGradientMorning)"
                              className="animate-ping opacity-75"
                            />
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isSelected ? 10 : 7}
                              fill="#f59e0b"
                              stroke="#fef08a"
                              strokeWidth={isSelected ? 2.5 : 1.5}
                            />
                            <text
                              x={pt.x}
                              y={pt.y + (isSelected ? 20 : 16)}
                              textAnchor="middle"
                              className="fill-amber-300 font-bold text-[9px] tracking-tight"
                            >
                              08:00 ({data.solar.morning_8am.azimuth}°)
                            </text>
                          </g>
                        );
                      })()}
                    </g>
                  )}

                  {/* 17:00 PM Sun Marker */}
                  {data?.solar.evening_5pm && (
                    <g>
                      {(() => {
                        const pt = polarToSvg(
                          data.solar.evening_5pm.azimuth,
                          data.solar.evening_5pm.altitude
                        );
                        const isSelected = activeTimePhase === "evening";
                        return (
                          <g
                            className="cursor-pointer transition-transform duration-300"
                            onClick={() => setActiveTimePhase("evening")}
                          >
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isSelected ? 14 : 9}
                              fill="url(#sunGradientEvening)"
                              className="animate-ping opacity-75"
                            />
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isSelected ? 10 : 7}
                              fill="#ea580c"
                              stroke="#fed7aa"
                              strokeWidth={isSelected ? 2.5 : 1.5}
                            />
                            <text
                              x={pt.x}
                              y={pt.y + (isSelected ? 20 : 16)}
                              textAnchor="middle"
                              className="fill-orange-400 font-bold text-[9px] tracking-tight"
                            >
                              17:00 ({data.solar.evening_5pm.azimuth}°)
                            </text>
                          </g>
                        );
                      })()}
                    </g>
                  )}

                  {/* Optimal Facing Room Vector Indicator (Emerald Beacon) */}
                  {data && (
                    <g>
                      <line
                        x1={center}
                        y1={center}
                        x2={optimalPoint.x}
                        y2={optimalPoint.y}
                        stroke="#10b981"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                      <circle
                        cx={optimalPoint.x}
                        cy={optimalPoint.y}
                        r="8"
                        fill="#10b981"
                        stroke="#a7f3d0"
                        strokeWidth="2"
                        className="animate-pulse"
                      />
                      <text
                        x={optimalPoint.x}
                        y={optimalPoint.y - 12}
                        textAnchor="middle"
                        className="fill-emerald-300 font-black text-[10px] tracking-wider uppercase drop-shadow"
                      >
                        ✓ Optimal: {data.optimal_facing}
                      </text>
                    </g>
                  )}

                  {/* Center Pivot Point (Hotel Location) */}
                  <circle cx={center} cy={center} r="7" fill="#38bdf8" stroke="#0284c7" strokeWidth="2" />
                  <circle cx={center} cy={center} r="2.5" fill="#ffffff" />
                </svg>
              </motion.div>
            </div>

            {/* Compass Legend */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-400/50" />
                Sun Trajectory Arc
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" />
                Transit Noise Hub
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                Prescribed Room Facade
              </span>
            </div>
          </div>

          {/* Analytics & Insight Cards (7 Cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Primary Recommendation Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 p-6 shadow-xl backdrop-blur-md"
            >
              <div className="absolute top-0 right-0 h-32 w-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider">
                      Bioclimatic Recommendation
                    </span>
                    <h3 className="text-xl font-extrabold text-white">
                      Target: {data.optimal_facing}-Facing Room
                    </h3>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {data.noise_shielding ? "🛡️ Acoustically Shielded" : "⚠️ Partial Shielding"}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 font-mono">
                    Direct {data.sunlight_time} Sunlight
                  </span>
                </div>
              </div>

              {/* Exact Recommendation Text Required */}
              <div className="mt-4 rounded-xl bg-emerald-900/20 border border-emerald-500/20 p-4">
                <p className="text-sm md:text-base font-semibold text-emerald-100 leading-relaxed">
                  {data.recommendation_text}
                </p>
              </div>

              {/* Real-time Math Evidence Cards */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Solar Trajectory Evidence */}
                <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                      <Sun className="h-3.5 w-3.5" />
                      Solar Vector (08:00 AM)
                    </span>
                    <span className="font-mono text-white">
                      {data.solar.morning_8am.azimuth}° Az / {data.solar.morning_8am.altitude}° Alt
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-orange-400 font-semibold">
                      <Clock className="h-3.5 w-3.5" />
                      Solar Vector (17:00 PM)
                    </span>
                    <span className="font-mono text-white">
                      {data.solar.evening_5pm.azimuth}° Az / {data.solar.evening_5pm.altitude}° Alt
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                    Direct morning sun arrives from{" "}
                    <strong className="text-amber-300">{data.solar.morning_8am.azimuth}°</strong> azimuth,
                    illuminating the {data.optimal_facing} facade without afternoon heat load.
                  </p>
                </div>

                {/* Acoustic Attenuation Evidence */}
                <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-rose-400 font-semibold">
                      <Volume2 className="h-3.5 w-3.5" />
                      Nearest Noise Source
                    </span>
                    <span className="font-mono text-white">{data.acoustic.direction}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="text-slate-400">Distance & Transit Decibels</span>
                    <span className="font-mono text-rose-300 font-bold">
                      {data.acoustic.distance_km} km ({data.acoustic.estimated_decibels} dBA)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                    Hub: <strong className="text-slate-200">{data.acoustic.nearest_landmark_name}</strong>.
                    An {data.optimal_facing}-facing unit orients the building mass as a physical sound barrier.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Micro-Features / Concierge Request Helper */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Apply to Booking Notes</h4>
                  <p className="text-xs text-slate-400">
                    Copies your customized bioclimatic preference into the hotel special requests field.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `Please assign a quiet ${data.optimal_facing}-facing room on an upper floor (shielded from transit noise, direct ${data.sunlight_time.toLowerCase()} sunlight).`
                  );
                  alert(
                    `Copied to clipboard!\n"Please assign a quiet ${data.optimal_facing}-facing room on an upper floor (shielded from transit noise, direct ${data.sunlight_time.toLowerCase()} sunlight)."`
                  );
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                Copy Room Request Note
                <ArrowUpRight className="h-3.5 w-3.5 text-amber-400" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
