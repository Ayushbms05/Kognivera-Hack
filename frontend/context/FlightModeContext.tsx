"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  saveCityOfflinePackage,
  getAllSavedOfflineCities,
  isCitySavedOffline,
  deleteOfflineCity,
  OfflineCityMetadata,
  OfflineCityPackage,
} from "@/lib/offline-db";
import { api } from "@/lib/api";

interface FlightModeContextType {
  isOnline: boolean;
  isFlightModeForced: boolean;
  effectiveFlightMode: boolean;
  toggleForceFlightMode: () => void;
  savedCities: OfflineCityMetadata[];
  isCitySaved: (cityIdOrName: string) => boolean;
  saveCityForOffline: (cityId: string) => Promise<{ success: boolean; message: string }>;
  syncingCityId: string | null;
  refreshSavedCities: () => Promise<void>;
  removeOfflineCity: (cityId: string) => Promise<void>;
}

const FlightModeContext = createContext<FlightModeContextType | undefined>(undefined);

export function FlightModeProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isFlightModeForced, setIsFlightModeForced] = useState<boolean>(false);
  const [savedCities, setSavedCities] = useState<OfflineCityMetadata[]>([]);
  const [syncingCityId, setSyncingCityId] = useState<string | null>(null);

  // Effective Flight Mode is active if device is actually offline OR user forced Flight Mode
  const effectiveFlightMode = !isOnline || isFlightModeForced;

  // Refresh list of saved cities from IndexedDB
  const refreshSavedCities = useCallback(async () => {
    try {
      const cities = await getAllSavedOfflineCities();
      setSavedCities(cities);
    } catch (err) {
      console.warn("[FlightMode] Could not load saved cities:", err);
    }
  }, []);

  // Initialize service worker & online/offline listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check initial online status
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      console.log("[StayFinder PWA] Network restored: Online");
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log("[StayFinder PWA] Network lost: Flight Mode automatically triggered");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Register PWA Service Worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV !== "development") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("[StayFinder PWA] Service Worker registered:", reg.scope))
        .catch((err) => console.warn("[StayFinder PWA] Service Worker failed:", err));
    } else if ("serviceWorker" in navigator) {
      // In dev mode also register so Cache Storage works
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("[StayFinder PWA Dev] Service Worker registered:", reg.scope))
        .catch(console.warn);
    }

    refreshSavedCities();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshSavedCities]);

  const toggleForceFlightMode = () => {
    setIsFlightModeForced((prev) => !prev);
  };

  const isCitySaved = (cityIdOrName: string): boolean => {
    const term = (cityIdOrName || "").toLowerCase().trim();
    return savedCities.some(
      (c) => c.city_id.toLowerCase() === term || c.name.toLowerCase() === term
    );
  };

  // Background Sync: Fetch all hotels, rooms, rate plans, top 3 hero images & store in IndexedDB + Cache Storage
  const saveCityForOffline = async (
    cityId: string
  ): Promise<{ success: boolean; message: string }> => {
    setSyncingCityId(cityId);
    try {
      // 1. Fetch offline package from FastAPI backend
      const res = await fetch(`http://127.0.0.1:8000/api/cities/${cityId}/offline-package`);
      if (!res.ok) {
        throw new Error(`Failed to download offline package for city ${cityId} (${res.status})`);
      }
      const pkg: OfflineCityPackage = await res.json();

      // 2. Save into IndexedDB and cache images
      const result = await saveCityOfflinePackage(pkg);

      await refreshSavedCities();

      return {
        success: true,
        message: `Saved ${pkg.city.name} for Flight Mode! ${result.hotelsSaved} hotels, rate plans & ${result.imagesCached} hero images stored in IndexedDB.`,
      };
    } catch (err: any) {
      console.error("[FlightMode] Sync failed:", err);
      return {
        success: false,
        message: err.message || "Failed to download offline city package.",
      };
    } finally {
      setSyncingCityId(null);
    }
  };

  const removeOfflineCity = async (cityId: string) => {
    await deleteOfflineCity(cityId);
    await refreshSavedCities();
  };

  return (
    <FlightModeContext.Provider
      value={{
        isOnline,
        isFlightModeForced,
        effectiveFlightMode,
        toggleForceFlightMode,
        savedCities,
        isCitySaved,
        saveCityForOffline,
        syncingCityId,
        refreshSavedCities,
        removeOfflineCity,
      }}
    >
      {children}
    </FlightModeContext.Provider>
  );
}

export function useFlightMode() {
  const context = useContext(FlightModeContext);
  if (!context) {
    throw new Error("useFlightMode must be used within a FlightModeProvider");
  }
  return context;
}
