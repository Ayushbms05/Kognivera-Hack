"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { HotelListItem } from "@/types";
import { formatCurrency, getHotelImage } from "@/lib/utils";
import { api } from "@/lib/api";

interface MapProps {
  hotels: HotelListItem[];
  hoveredHotelId?: string | null;
  onHotelSelect?: (hotelId: string) => void;
}

function getCoords(hotel: HotelListItem): [number, number] | null {
  const rawLng = hotel.lng ?? hotel.longitude;
  const rawLat = hotel.lat ?? hotel.latitude;
  if (rawLng === undefined || rawLat === undefined || rawLng === null || rawLat === null) {
    return null;
  }
  const lng = Number(rawLng);
  const lat = Number(rawLat);
  if (isNaN(lng) || isNaN(lat) || (lng === 0 && lat === 0)) return null;
  return [lng, lat];
}

/**
 * Generate a 64-point circular GeoJSON polygon centered at [lng, lat]
 * with radiusInKm (defaults to 2.0 km walkability radius).
 */
function createGeoJSONCircle(center: [number, number], radiusInKm = 1.5, points = 64) {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  const distanceX = radiusInKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusInKm / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]); // close polygon loop

  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [coords],
    },
    properties: {},
  };
}

export function Map({ hotels, hoveredHotelId, onHotelSelect }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(new globalThis.Map());
  const landmarkMarkersRef = useRef<maplibregl.Marker[]>([]);
  const isMapLoaded = useRef<boolean>(false);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current) return;

    // Default center (Jaipur: [75.7873, 26.9124]) or first valid hotel coordinates
    let initialCenter: [number, number] = [75.7873, 26.9124];
    for (const h of hotels) {
      const c = getCoords(h);
      if (c) {
        initialCenter = c;
        break;
      }
    }

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
      center: initialCenter,
      zoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      isMapLoaded.current = true;

      // Add walkability GeoJSON source and layers
      if (!map.getSource("walkability-radius-source")) {
        map.addSource("walkability-radius-source", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        // Soft translucent circular polygon
        map.addLayer({
          id: "walkability-radius-fill",
          type: "fill",
          source: "walkability-radius-source",
          paint: {
            "fill-color": "#3B82F6",
            "fill-opacity": 0.12,
          },
        });

        // Crisp border
        map.addLayer({
          id: "walkability-radius-stroke",
          type: "line",
          source: "walkability-radius-source",
          paint: {
            "line-color": "#2563EB",
            "line-width": 1.5,
          },
        });
      }
    });

    mapInstance.current = map;

    return () => {
      landmarkMarkersRef.current.forEach((m) => m.remove());
      landmarkMarkersRef.current = [];
      map.remove();
      mapInstance.current = null;
      isMapLoaded.current = false;
    };
  }, []);

  // Update Markers when hotels change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    if (hotels.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    let validCount = 0;

    hotels.forEach((hotel) => {
      const coords = getCoords(hotel);
      if (!coords) return;

      validCount++;
      bounds.extend(coords);

      // Create custom HTML element for price pill marker
      const el = document.createElement("div");
      el.className = `hotel-marker transition-transform duration-200 cursor-pointer ${
        hoveredHotelId === hotel.hotel_id ? "scale-125 z-30" : "scale-100 z-10"
      }`;
      el.innerHTML = `
        <div class="px-2.5 py-1 rounded-full text-xs font-bold shadow-md border border-white flex items-center gap-1 ${
          hoveredHotelId === hotel.hotel_id
            ? "bg-terracotta-600 text-white shadow-terracotta-glow"
            : "bg-white text-slate-800 hover:bg-terracotta-50"
        }">
          <span>${formatCurrency(hotel.min_price || 4000, hotel.currency)}</span>
        </div>
      `;

      // Popup content
      const imgUrl = hotel.hero_image || getHotelImage(hotel.hotel_id, hotel.property_type);
      const popupHtml = `
        <div class="w-60 overflow-hidden rounded-2xl bg-white font-sans">
          <div class="h-28 w-full relative">
            <img src="${imgUrl}" alt="${hotel.name}" class="w-full h-full object-cover" />
            <div class="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">
              ${hotel.star_rating}★
            </div>
          </div>
          <div class="p-3">
            <p class="text-[10px] uppercase font-bold text-terracotta-600">${hotel.property_type}</p>
            <h4 class="font-bold text-xs text-slate-900 line-clamp-1 mt-0.5">${hotel.name}</h4>
            <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
              <span class="text-xs font-extrabold text-slate-900">${formatCurrency(
                hotel.min_price || 4000,
                hotel.currency
              )}/nt</span>
              <a href="/hotel/${hotel.hotel_id}" class="text-[11px] font-bold text-terracotta-600 hover:underline">View &rarr;</a>
            </div>
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 25, closeButton: true }).setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(map);

      el.addEventListener("click", () => {
        if (onHotelSelect) onHotelSelect(hotel.hotel_id);
      });

      markersRef.current.set(hotel.hotel_id, marker);
    });

    // Fit map to bounds
    if (validCount > 0 && !bounds.isEmpty()) {
      try {
        map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
      } catch (e) {
        console.error("fitBounds error:", e);
      }
    }
  }, [hotels]);

  // Update highlighted marker and draw 2km walkability circle on hover
  useEffect(() => {
    const map = mapInstance.current;

    // Highlight marker
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      if (id === hoveredHotelId) {
        el.classList.add("scale-125", "z-30");
        const inner = el.querySelector("div");
        if (inner) {
          inner.className =
            "px-2.5 py-1 rounded-full text-xs font-bold shadow-terracotta-glow border border-white flex items-center gap-1 bg-terracotta-600 text-white";
        }
      } else {
        el.classList.remove("scale-125", "z-30");
        const inner = el.querySelector("div");
        if (inner) {
          inner.className =
            "px-2.5 py-1 rounded-full text-xs font-bold shadow-md border border-white flex items-center gap-1 bg-white text-slate-800 hover:bg-terracotta-50";
        }
      }
    });

    // Update walkability polygon and landmark markers
    if (!map) return;

    const updatePolygonAndLandmarks = async () => {
      // Clear previous landmark markers
      landmarkMarkersRef.current.forEach((m) => m.remove());
      landmarkMarkersRef.current = [];

      const source = map.getSource("walkability-radius-source") as maplibregl.GeoJSONSource | undefined;
      if (!source) return;

      if (!hoveredHotelId) {
        source.setData({
          type: "FeatureCollection",
          features: [],
        });
        return;
      }

      const targetHotel = hotels.find((h) => h.hotel_id === hoveredHotelId);
      if (!targetHotel) {
        source.setData({ type: "FeatureCollection", features: [] });
        return;
      }

      const coords = getCoords(targetHotel);
      if (!coords) {
        source.setData({ type: "FeatureCollection", features: [] });
        return;
      }

      // Fetch proximity & landmark points from backend API
      try {
        const prox = await api.getHotelProximity(hoveredHotelId);

        // Accurate 64-vertex 1.5km isochrone polygon
        const polyFeature = prox?.isochrone_1_5km
          ? { type: "Feature" as const, geometry: prox.isochrone_1_5km, properties: {} }
          : createGeoJSONCircle(coords, 1.5, 64);

        source.setData({
          type: "FeatureCollection",
          features: [polyFeature],
        });

        // Add small SVG pin markers for all walkable_landmarks inside the 1.5km radius
        if (prox?.walkable_landmarks) {
          prox.walkable_landmarks.forEach((lm) => {
            if (lm.lng && lm.lat) {
              const el = document.createElement("div");
              el.className = "landmark-marker group transition-transform hover:scale-125 z-20 cursor-pointer";
              el.innerHTML = `
                <div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md border border-white text-[10px] font-bold">
                  <svg class="w-3 h-3 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span class="truncate max-w-[90px]">${lm.name}</span>
                </div>
              `;

              const popupHtml = `
                <div class="p-2.5 max-w-[200px] text-xs font-sans">
                  <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
                    ${lm.kind.replace("_", " ")}
                  </span>
                  <h5 class="font-bold text-slate-900 leading-tight mt-1">${lm.name}</h5>
                  <p class="text-[11px] text-slate-600 font-semibold mt-1 flex items-center gap-1.5">
                    <span>${lm.distance_km} km</span>
                    <span>•</span>
                    <span class="text-blue-600">${lm.walk_time_minutes} min walk</span>
                  </p>
                </div>
              `;

              const popup = new maplibregl.Popup({ offset: 15, closeButton: false }).setHTML(popupHtml);
              const lmMarker = new maplibregl.Marker({ element: el })
                .setLngLat([lm.lng, lm.lat])
                .setPopup(popup)
                .addTo(map);

              landmarkMarkersRef.current.push(lmMarker);
            }
          });
        }
      } catch (err) {
        // Fallback circle
        const circle = createGeoJSONCircle(coords, 1.5, 64);
        source.setData({
          type: "FeatureCollection",
          features: [circle],
        });
      }
    };

    if (map.isStyleLoaded()) {
      updatePolygonAndLandmarks();
    } else {
      map.once("load", updatePolygonAndLandmarks);
    }
  }, [hoveredHotelId, hotels]);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-3.5xl overflow-hidden border border-slate-200/80 shadow-soft">
      <div ref={mapContainer} className="w-full h-full" />
      {/* 1.5km Walkability Radius Pill Overlay */}
      <div className="absolute bottom-4 left-4 z-20 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 shadow-soft flex items-center gap-2 text-[11px] font-semibold text-slate-700 pointer-events-none">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-200 animate-pulse" />
        <span>Hover hotel for 1.5km Walkability Isochrone &amp; Attractions</span>
      </div>
    </div>
  );
}
