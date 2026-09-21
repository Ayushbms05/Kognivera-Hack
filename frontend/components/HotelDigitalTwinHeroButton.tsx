"use client";

import React, { useState, useEffect } from "react";
import { Box, Sparkles } from "lucide-react";
import { VirtualTourModal } from "./VirtualTourModal";
import { api } from "@/lib/api";
import { HotelXRStatusResponse } from "@/types";

interface HotelDigitalTwinHeroButtonProps {
  hotelId: string;
  hotelName: string;
  cityName?: string;
  defaultImageUrl: string;
  variant?: "badge" | "overlay" | "pill";
}

export function HotelDigitalTwinHeroButton({
  hotelId,
  hotelName,
  cityName,
  defaultImageUrl,
  variant = "badge",
}: HotelDigitalTwinHeroButtonProps) {
  const [xrStatus, setXrStatus] = useState<HotelXRStatusResponse | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getHotelXRStatus(hotelId)
      .then((status) => {
        if (active) {
          setXrStatus(status);
          setChecked(true);
        }
      })
      .catch((err) => {
        console.warn("Failed to check XR status:", err);
        if (active) setChecked(true);
      });

    return () => {
      active = false;
    };
  }, [hotelId]);

  // If not checked yet or does not have XR scene, render nothing
  if (!checked || !xrStatus?.has_xr_scene) {
    return null;
  }

  const textureUrl = xrStatus.scene_url || defaultImageUrl;

  if (variant === "overlay") {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-stone-950/85 hover:bg-stone-900 border border-amber-400/60 backdrop-blur-md text-amber-300 hover:text-amber-200 text-xs sm:text-sm font-bold shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          title="Open 360° Virtual Tour Digital Twin"
        >
          <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Box className="w-4 h-4 animate-[spin_6s_linear_infinite]" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span>360° Digital Twin Available</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </div>
            <p className="text-[10px] text-stone-300 font-normal">
              Explore room in full WebGL 3D
            </p>
          </div>
        </button>

        <VirtualTourModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          hotelName={hotelName}
          cityName={cityName}
          imageUrl={textureUrl}
          altText={xrStatus.alt_text}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900 hover:bg-stone-800 border border-amber-400/50 text-amber-300 hover:text-amber-200 text-xs font-bold shadow-sm transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
        title="Open 360° Virtual Tour"
      >
        <Box className="w-3.5 h-3.5 text-amber-400 animate-[spin_6s_linear_infinite]" />
        <span>360° Digital Twin Available</span>
      </button>

      <VirtualTourModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        hotelName={hotelName}
        cityName={cityName}
        imageUrl={textureUrl}
        altText={xrStatus.alt_text}
      />
    </>
  );
}
