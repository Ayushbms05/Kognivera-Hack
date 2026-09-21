"use client";

import React, { useState } from "react";
import { Download, Check, Loader2, Plane, HardDrive, Trash2 } from "lucide-react";
import { useFlightMode } from "@/context/FlightModeContext";

interface SaveCityOfflineButtonProps {
  cityId: string;
  cityName: string;
  variant?: "badge" | "button" | "compact";
}

export function SaveCityOfflineButton({
  cityId,
  cityName,
  variant = "button",
}: SaveCityOfflineButtonProps) {
  const { isCitySaved, saveCityForOffline, syncingCityId, removeOfflineCity } = useFlightMode();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const isSaved = isCitySaved(cityId) || isCitySaved(cityName);
  const isSyncing = syncingCityId === cityId || syncingCityId === cityName;

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSaved) {
      if (confirm(`Remove offline package for ${cityName} from IndexedDB?`)) {
        await removeOfflineCity(cityId);
      }
      return;
    }

    const res = await saveCityForOffline(cityId);
    setFeedbackMessage(res.message);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  if (variant === "compact") {
    return (
      <button
        onClick={handleSave}
        disabled={isSyncing}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all shadow-2xs ${
          isSaved
            ? "bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
            : isSyncing
            ? "bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse"
            : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-white hover:border-brand-300"
        }`}
        title={isSaved ? "Saved in IndexedDB. Click to remove." : "Save city for zero-latency offline browsing"}
      >
        {isSyncing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
        ) : isSaved ? (
          <Check className="w-3.5 h-3.5 text-emerald-600" />
        ) : (
          <Download className="w-3.5 h-3.5 text-slate-500" />
        )}
        <span>{isSyncing ? "Saving..." : isSaved ? "Offline Ready" : "Save Offline"}</span>
      </button>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleSave}
        disabled={isSyncing}
        id={`btn-save-offline-${cityId}`}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm ${
          isSaved
            ? "bg-emerald-500 text-white border border-emerald-600 hover:bg-emerald-600 shadow-emerald-500/20"
            : isSyncing
            ? "bg-indigo-600 text-white border border-indigo-700 cursor-wait shadow-indigo-500/20"
            : "bg-white/90 hover:bg-white text-slate-800 border border-slate-300/80 hover:border-brand-400 hover:text-brand-600"
        }`}
        title={isSaved ? `Click to remove ${cityName} from IndexedDB cache` : `Save ${cityName} for Zero-Latency Flight Mode`}
      >
        {isSyncing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Syncing Hotels & Rate Plans...</span>
          </>
        ) : isSaved ? (
          <>
            <Check className="w-4 h-4" />
            <span>Saved for Flight Mode</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4 text-brand-600" />
            <span>Save City for Offline</span>
          </>
        )}
      </button>

      {feedbackMessage && (
        <p className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 animate-in fade-in duration-200">
          {feedbackMessage}
        </p>
      )}
    </div>
  );
}
