"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import {
  Compass,
  Footprints,
  MapPin,
  Train,
  ShoppingBag,
  Trees,
  Landmark as LandmarkIcon,
  Navigation,
  Clock,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { HotelProximityResponse, WalkableLandmark } from "@/types";
import { api } from "@/lib/api";

interface HotelProximitySectionProps {
  hotelId: string;
  hotelName: string;
  hotelCoords: { lat: number; lng: number };
}

export function HotelProximitySection({
  hotelId,
  hotelName,
  hotelCoords,
}: HotelProximitySectionProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const landmarkMarkersRef = useRef<maplibregl.Marker[]>([]);
  const hotelMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [data, setData] = useState<HotelProximityResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [radiusMode, setRadiusMode] = useState<"1.5km" | "5km">("1.5km");
  const [selectedLandmark, setSelectedLandmark] = useState<WalkableLandmark | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getHotelProximity(hotelId)
      .then((res) => {
        if (active) {
          setData(res);
          if (res.walkable_landmarks.length > 0) {
            setSelectedLandmark(res.walkable_landmarks[0]);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load hotel proximity:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hotelId]);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current) return;

    const lat = data?.coordinates?.lat || hotelCoords.lat;
    const lng = data?.coordinates?.lng || hotelCoords.lng;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
          },
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [lng, lat],
      zoom: 14,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      // Add Walkability Isochrone Polygon Source
      if (!map.getSource("isochrone-source")) {
        map.addSource("isochrone-source", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        // Soft translucent blue fill: #3B82F6, opacity: 0.12
        map.addLayer({
          id: "isochrone-fill",
          type: "fill",
          source: "isochrone-source",
          paint: {
            "fill-color": "#3B82F6",
            "fill-opacity": 0.12,
          },
        });

        // Crisp blue border: #2563EB, width: 1.5px
        map.addLayer({
          id: "isochrone-stroke",
          type: "line",
          source: "isochrone-source",
          paint: {
            "line-color": "#2563EB",
            "line-width": 1.5,
          },
        });
      }

      // Add Hotel Marker
      const hotelEl = document.createElement("div");
      hotelEl.className = "hotel-central-pin z-30 cursor-pointer";
      hotelEl.innerHTML = `
        <div class="px-3 py-1 rounded-full bg-slate-900 text-white shadow-xl border-2 border-white flex items-center gap-1.5 text-xs font-black">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>${hotelName}</span>
        </div>
      `;
      hotelMarkerRef.current = new maplibregl.Marker({ element: hotelEl })
        .setLngLat([lng, lat])
        .addTo(map);
    });

    mapInstance.current = map;

    return () => {
      landmarkMarkersRef.current.forEach((m) => m.remove());
      landmarkMarkersRef.current = [];
      if (hotelMarkerRef.current) hotelMarkerRef.current.remove();
      map.remove();
      mapInstance.current = null;
    };
  }, [hotelCoords, hotelName]);

  // Update Polygon & Landmark Markers when data or radiusMode changes
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !data) return;

    const renderLayers = () => {
      const source = map.getSource("isochrone-source") as maplibregl.GeoJSONSource | undefined;
      if (!source) return;

      const poly =
        radiusMode === "1.5km"
          ? data.isochrone_1_5km
          : data.isochrone_5_0km || data.isochrone_1_5km;

      if (poly) {
        source.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: poly,
              properties: {},
            },
          ],
        });
      }

      // Remove previous landmark pins
      landmarkMarkersRef.current.forEach((m) => m.remove());
      landmarkMarkersRef.current = [];

      const activeLandmarks =
        radiusMode === "1.5km"
          ? data.walkable_landmarks
          : data.transit_landmarks_5km || data.walkable_landmarks;

      // Add small SVG pin markers for all walkable_landmarks inside the radius
      activeLandmarks.forEach((lm) => {
        if (!lm.lat || !lm.lng) return;

        const pinEl = document.createElement("div");
        pinEl.className =
          "landmark-pin group transition-all duration-200 hover:scale-125 z-20 cursor-pointer";
        pinEl.innerHTML = `
          <div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md border border-white text-[10px] font-bold">
            <svg class="w-3 h-3 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span class="truncate max-w-[100px]">${lm.name}</span>
          </div>
        `;

        const popupHtml = `
          <div class="p-2.5 max-w-[210px] text-xs font-sans">
            <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
              ${lm.kind.replace("_", " ")}
            </span>
            <h5 class="font-bold text-slate-900 leading-tight mt-1">${lm.name}</h5>
            <p class="text-[11px] text-slate-600 font-semibold mt-1 flex items-center gap-1">
              <span>${lm.distance_km} km</span> • <span class="text-blue-600 font-bold">${lm.walk_time_minutes} min walk</span>
            </p>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false }).setHTML(popupHtml);

        const marker = new maplibregl.Marker({ element: pinEl })
          .setLngLat([lm.lng, lm.lat])
          .setPopup(popup)
          .addTo(map);

        pinEl.addEventListener("click", () => {
          setSelectedLandmark(lm);
        });

        landmarkMarkersRef.current.push(marker);
      });

      // Zoom appropriately
      if (radiusMode === "5km") {
        map.flyTo({ zoom: 12.2, essential: true });
      } else {
        map.flyTo({ zoom: 14.1, essential: true });
      }
    };

    if (map.isStyleLoaded()) {
      renderLayers();
    } else {
      map.once("load", renderLayers);
    }
  }, [data, radiusMode]);

  const maxWalkTime =
    data?.walkable_landmarks && data.walkable_landmarks.length > 0
      ? Math.max(...data.walkable_landmarks.map((l) => l.walk_time_minutes))
      : 15;

  return (
    <div className="p-6 sm:p-8 rounded-3.5xl bg-white border border-slate-100 shadow-soft space-y-6">
      {/* Header & Walkability Index Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="p-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <Compass className="w-4 h-4" />
            </span>
            <h3 className="font-heading font-extrabold text-xl text-slate-900 tracking-tight">
              Walkability Isochrone &amp; Attraction Proximity
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Spatial Geodesic Math
            </span>
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Real geodesic boundary &amp; pedestrian transit time to nearby heritage, markets, and metro hubs.
          </p>
        </div>

        {/* Walkability Index Badge */}
        {data && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold shadow-2xs self-start md:self-auto">
            <Footprints className="w-4 h-4 text-blue-600" />
            <span>
              {data.walkability_score}/100 Walk Score • {data.walkable_landmarks.length} attractions within {maxWalkTime} mins
            </span>
          </div>
        )}
      </div>

      {/* Radius Mode Toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setRadiusMode("1.5km")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              radiusMode === "1.5km"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            15-Min Walkable Radius (1.5 km)
          </button>
          <button
            onClick={() => setRadiusMode("5km")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              radiusMode === "5km"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Transit Radius (5.0 km)
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500/20 border border-blue-600" />
            <span>Isochrone Polygon</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <span>Walkable Landmark Pin</span>
          </span>
        </div>
      </div>

      {/* Interactive Map & Nearby List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map Container */}
        <div className="lg:col-span-8 h-[380px] sm:h-[440px] rounded-3xl overflow-hidden border border-slate-200/90 relative shadow-2xs">
          <div ref={mapContainer} className="w-full h-full" />
        </div>

        {/* Walkable Landmarks Sidebar */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-3 bg-slate-50 p-4 sm:p-5 rounded-3xl border border-slate-100">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                {radiusMode === "1.5km" ? "Walkable Attractions" : "District Attractions"}
              </span>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded-full">
                {data?.walkable_landmarks.length || 0} Nearby
              </span>
            </div>

            <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto scrollbar-none pr-1">
              {(radiusMode === "1.5km"
                ? data?.walkable_landmarks
                : data?.transit_landmarks_5km || data?.walkable_landmarks
              )?.map((lm, idx) => {
                const isSelected = selectedLandmark?.name === lm.name;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedLandmark(lm);
                      if (mapInstance.current && lm.lng && lm.lat) {
                        mapInstance.current.flyTo({
                          center: [lm.lng, lm.lat],
                          zoom: 14.5,
                          essential: true,
                        });
                      }
                    }}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? "bg-white border-blue-400 shadow-sm"
                        : "bg-white/70 hover:bg-white border-slate-200/80"
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-[9px] font-extrabold uppercase tracking-wide text-blue-600 block">
                        {lm.kind.replace("_", " ")}
                      </span>
                      <h5 className="font-bold text-xs text-slate-900 truncate">{lm.name}</h5>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="font-extrabold text-xs text-blue-700 block">
                        {lm.walk_time_minutes} min
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {lm.distance_km} km
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Landmark Highlight Card */}
          {selectedLandmark && (
            <div className="p-3.5 rounded-2xl bg-white border border-blue-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-blue-600">
                <span>Selected Destination</span>
                <span>{selectedLandmark.walk_time_minutes} min walk</span>
              </div>
              <h6 className="font-bold text-xs text-slate-900">{selectedLandmark.name}</h6>
              <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                {selectedLandmark.description ||
                  `Located ${selectedLandmark.distance_km} km from the hotel entrance.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
