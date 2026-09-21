"use client";

import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
} from "recharts";
import { api } from "@/lib/api";
import { GroupConsensusResponse } from "@/types";
import { Users, Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

interface GroupConsensusRadarProps {
  hotelId: string;
  hotelName?: string;
  userIds?: string[];
  initialData?: GroupConsensusResponse | null;
  compact?: boolean;
}

const USER_COLORS = [
  { stroke: "#10b981", fill: "#10b981", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" }, // Emerald
  { stroke: "#f59e0b", fill: "#f59e0b", badge: "bg-amber-50 text-amber-700 border-amber-200" },     // Amber
  { stroke: "#06b6d4", fill: "#06b6d4", badge: "bg-cyan-50 text-cyan-700 border-cyan-200" },        // Cyan
  { stroke: "#ec4899", fill: "#ec4899", badge: "bg-pink-50 text-pink-700 border-pink-200" },        // Pink
];

export function GroupConsensusRadar({
  hotelId,
  hotelName,
  userIds = ["usr_6afe5712", "usr_05c1346c", "usr_c75aefa2"],
  initialData = null,
  compact = false,
}: GroupConsensusRadarProps) {
  const [data, setData] = useState<GroupConsensusResponse | null>(initialData);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean>(!compact);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    api
      .getGroupConsensus(hotelId, userIds)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Could not calculate group consensus");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [hotelId, JSON.stringify(userIds), initialData]);

  if (loading) {
    return (
      <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-center gap-2 text-indigo-700 text-xs font-semibold animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
        <span>Computing Squad Consensus Vector Algebra...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span>Squad consensus requires at least 2 active profiles.</span>
      </div>
    );
  }

  // Transform data for Recharts RadarChart
  // Axes: Budget, Luxury, Wellness, Heritage, Nightlife
  const chartData = data.axes.map((axis) => {
    const point: Record<string, any> = {
      axis,
      Hotel: data.hotel_features[axis] || 0,
      GroupAvg: data.group_centroid[axis] || 0,
    };
    data.users.forEach((u, idx) => {
      point[u.display_name] = u.vector[axis] || 0;
    });
    return point;
  });

  return (
    <div className="group-consensus-container bg-gradient-to-br from-indigo-950/5 via-slate-900/5 to-purple-950/5 rounded-2xl border border-indigo-200/80 p-3.5 sm:p-4 transition-all duration-300">
      {/* Header / Consensus Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
            <Users className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider">
                Travel Squad Radar
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs">
                {data.consensus_badge}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium line-clamp-1 mt-0.5">
              {data.compromise_summary}
            </p>
          </div>
        </div>

        {compact && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="self-end sm:self-auto text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-white/80 px-2 py-1 rounded-lg border border-indigo-200 transition-colors"
          >
            <span>{expanded ? "Hide Radar" : "View Radar"}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Individual Satisfaction Avatars */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-indigo-100/80">
        {data.users.map((user, idx) => {
          const colorMeta = USER_COLORS[idx % USER_COLORS.length];
          return (
            <div
              key={user.user_id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${colorMeta.badge} shadow-2xs`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: colorMeta.stroke }}
              />
              <span>{user.display_name}:</span>
              <span className="font-extrabold text-slate-900">
                {user.satisfaction_pct}% match
              </span>
            </div>
          );
        })}
      </div>

      {/* Expandable Recharts Radar Chart */}
      {expanded && (
        <div className="mt-3.5 pt-3 border-t border-indigo-100/80">
          <div className="w-full h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={chartData} outerRadius="75%">
                <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fill: "#334155", fontSize: 11, fontWeight: 700 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: "#94a3b8", fontSize: 9 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "12px",
                    color: "#f8fafc",
                    fontSize: "12px",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
                  }}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: "11px",
                    fontWeight: 600,
                    paddingTop: "6px",
                  }}
                />

                {/* Overlapping Translucent Polygons for Each Squad User */}
                {data.users.map((user, idx) => {
                  const colorMeta = USER_COLORS[idx % USER_COLORS.length];
                  return (
                    <Radar
                      key={user.user_id}
                      name={user.display_name}
                      dataKey={user.display_name}
                      stroke={colorMeta.stroke}
                      fill={colorMeta.fill}
                      fillOpacity={0.25}
                      strokeWidth={1.5}
                    />
                  );
                })}

                {/* Hotel's Offerings Overlaid as a Bold Stroke */}
                <Radar
                  name={`${hotelName || "Hotel"} Offerings`}
                  dataKey="Hotel"
                  stroke="#4f46e5"
                  fill="#4f46e5"
                  fillOpacity={0.12}
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#4f46e5" }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* 5-Axis Alignment Breakdown Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mt-2 text-center">
            {data.axis_scores.map((score) => (
              <div
                key={score.axis}
                className="bg-white/90 rounded-xl p-1.5 border border-slate-200/80 shadow-2xs"
              >
                <span className="text-[10px] text-slate-500 font-bold block uppercase">
                  {score.axis}
                </span>
                <span className="text-xs font-black text-indigo-900 block">
                  {score.alignment_pct}%
                </span>
                <span className="text-[9px] text-slate-400 block">
                  Grp {score.group_avg} vs Htl {score.hotel_offering}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
