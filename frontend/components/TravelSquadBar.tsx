"use client";

import React, { useState, useEffect } from "react";
import { Users, Sparkles, UserPlus, Check, X, Shield, Compass } from "lucide-react";
import { SquadMember } from "@/types";
import { api } from "@/lib/api";

interface TravelSquadBarProps {
  squadMode: boolean;
  onToggleSquadMode: (enabled: boolean) => void;
  selectedUserIds: string[];
  onChangeSquad: (userIds: string[]) => void;
}

const DEFAULT_SQUAD_IDS = ["usr_6afe5712", "usr_05c1346c", "usr_c75aefa2"];

export function TravelSquadBar({
  squadMode,
  onToggleSquadMode,
  selectedUserIds,
  onChangeSquad,
}: TravelSquadBarProps) {
  const [candidates, setCandidates] = useState<SquadMember[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getSquadCandidates(8)
      .then((res) => {
        if (active && res.candidates) {
          setCandidates(res.candidates);
        }
      })
      .catch(console.warn);
    return () => {
      active = false;
    };
  }, []);

  const toggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      if (selectedUserIds.length <= 2) {
        alert("Travel squad requires at least 2 members for consensus math.");
        return;
      }
      onChangeSquad(selectedUserIds.filter((id) => id !== userId));
    } else {
      if (selectedUserIds.length >= 4) {
        alert("Squads are currently optimized for up to 4 members.");
        return;
      }
      onChangeSquad([...selectedUserIds, userId]);
    }
  };

  const activeMembers = candidates.filter((c) => selectedUserIds.includes(c.user_id));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3 sm:p-4 space-y-3 transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Squad Mode Switch & Title */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-2xs ${
            squadMode ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
          }`}>
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900">
                Multiplayer Travel Squad
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-colors ${
                squadMode
                  ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                  : "bg-slate-100 text-slate-500"
              }`}>
                {squadMode ? "Active" : "Disabled"}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-normal">
              Consensus Radar overlays multi-user vector centroids against hotel features in real time.
            </p>
          </div>
        </div>

        {/* Right: Toggle Switch + Picker trigger */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {squadMode && (
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Edit Squad ({selectedUserIds.length})</span>
            </button>
          )}

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={squadMode}
              onChange={(e) => onToggleSquadMode(e.target.checked)}
              className="sr-only peer"
              id="travel-squad-toggle"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      {/* Active Squad Members Badges */}
      {squadMode && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Active Squad:
          </span>
          {activeMembers.length > 0 ? (
            activeMembers.map((member, i) => (
              <div
                key={member.user_id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs"
              >
                <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-black">
                  {member.display_name.charAt(0)}
                </div>
                <span>{member.display_name}</span>
                {member.travel_style && (
                  <span className="text-[10px] text-slate-400 font-medium capitalize">
                    • {member.travel_style}
                  </span>
                )}
              </div>
            ))
          ) : (
            selectedUserIds.map((id, i) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700"
              >
                Profile {i + 1} ({id})
              </span>
            ))
          )}
        </div>
      )}

      {/* Candidate Squad Picker Drawer */}
      {squadMode && showPicker && (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700">
              Select 2 to 4 Squad Travelers for Consensus Calculation:
            </p>
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {candidates.map((c) => {
              const isSelected = selectedUserIds.includes(c.user_id);
              return (
                <button
                  type="button"
                  key={c.user_id}
                  onClick={() => toggleUser(c.user_id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-all ${
                    isSelected
                      ? "bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold shadow-2xs"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 font-medium"
                  }`}
                >
                  <div className="truncate pr-1">
                    <p className="font-extrabold truncate">{c.display_name}</p>
                    <p className="text-[10px] text-slate-400 capitalize">
                      {c.budget_band} • {c.travel_style}
                    </p>
                  </div>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isSelected ? "bg-indigo-600 text-white" : "border border-slate-300"
                  }`}>
                    {isSelected && <Check className="w-2.5 h-2.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
