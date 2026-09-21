import { openDB, IDBPDatabase } from "idb";
import { getHotelImage } from "./utils";

export interface OfflineCityMetadata {
  city_id: string;
  name: string;
  state?: string;
  country_code?: string;
  lat?: number | null;
  lng?: number | null;
  description?: string;
  timezone?: string;
  region?: string;
  hotel_count: number;
  saved_at: string;
}

export interface OfflineHotelRecord {
  hotel_id: string;
  city_id: string;
  city_name: string;
  state: string;
  name: string;
  property_type: string;
  star_rating: number;
  guest_score: number;
  review_count: number;
  address_line?: string;
  lat?: number | null;
  lng?: number | null;
  distance_to_centre_km?: number | null;
  description?: string;
  min_price: number;
  currency: string;
  checkin_time: string;
  checkout_time: string;
  hero_images: Array<{
    media_id: string;
    file_path: string;
    media_role: string;
    alt_text?: string;
  }>;
  hero_image?: string | null;
  cached_image_url?: string;
  rooms: any[];
  room_types: any[];
  amenities: any[];
  policies: Record<string, any>;
  saved_at: string;
}

export interface OfflineCityPackage {
  city: OfflineCityMetadata;
  hotels: OfflineHotelRecord[];
  total_hotels: number;
  image_urls: string[];
  synced_at: string;
  package_version?: string;
}

const DB_NAME = "stayfinder_offline_db";
const DB_VERSION = 1;
const CACHE_NAME = "stayfinder-offline-v1";

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getOfflineDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is only available in browser"));
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 1. Cities store
        if (!db.objectStoreNames.contains("cities")) {
          const cityStore = db.createObjectStore("cities", { keyPath: "city_id" });
          cityStore.createIndex("by_name", "name", { unique: false });
        }

        // 2. Hotels store
        if (!db.objectStoreNames.contains("hotels")) {
          const hotelStore = db.createObjectStore("hotels", { keyPath: "hotel_id" });
          hotelStore.createIndex("by_city_id", "city_id", { unique: false });
          hotelStore.createIndex("by_city_name", "city_name", { unique: false });
          hotelStore.createIndex("by_property_type", "property_type", { unique: false });
        }

        // 3. Packages meta store
        if (!db.objectStoreNames.contains("packages")) {
          db.createObjectStore("packages", { keyPath: "city_id" });
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Saves all hotels, rooms, rate plans, and caches top hero images for a city.
 */
export async function saveCityOfflinePackage(pkg: OfflineCityPackage): Promise<{
  success: boolean;
  hotelsSaved: number;
  imagesCached: number;
}> {
  const db = await getOfflineDB();
  const tx = db.transaction(["cities", "hotels", "packages"], "readwrite");

  const now = new Date().toISOString();
  const cityRecord: OfflineCityMetadata = {
    ...pkg.city,
    saved_at: now,
  };

  // 1. Save City
  await tx.objectStore("cities").put(cityRecord);

  // 2. Collect images to cache in Cache Storage
  const imagesToCache: string[] = [];

  // 3. Save Hotels
  for (const hotel of pkg.hotels) {
    const imageUrl = getHotelImage(hotel.hotel_id, hotel.property_type, 0, hotel.hero_image);
    imagesToCache.push(imageUrl);

    // Also collect top 3 hero images
    if (hotel.hero_images && hotel.hero_images.length > 0) {
      hotel.hero_images.slice(0, 3).forEach((img, idx) => {
        const url = getHotelImage(hotel.hotel_id, hotel.property_type, idx, img.file_path);
        imagesToCache.push(url);
      });
    }

    const hotelRecord: OfflineHotelRecord = {
      ...hotel,
      cached_image_url: imageUrl,
      saved_at: now,
    };
    await tx.objectStore("hotels").put(hotelRecord);
  }

  // 4. Save Package meta
  await tx.objectStore("packages").put({
    city_id: pkg.city.city_id,
    name: pkg.city.name,
    total_hotels: pkg.hotels.length,
    saved_at: now,
  });

  await tx.done;

  // 5. Cache images in Service Worker / CacheStorage
  let cachedCount = 0;
  if ("caches" in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const uniqueUrls = Array.from(new Set(imagesToCache.filter(Boolean)));
      for (const url of uniqueUrls) {
        try {
          const match = await cache.match(url);
          if (!match) {
            const res = await fetch(url, { mode: "no-cors" });
            if (res) {
              await cache.put(url, res);
              cachedCount++;
            }
          } else {
            cachedCount++;
          }
        } catch (e) {
          console.warn("[PWA Offline] Could not cache image:", url, e);
        }
      }

      // If service worker is active, notify it
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "CACHE_IMAGE_URLS",
          urls: uniqueUrls,
        });
      }
    } catch (err) {
      console.warn("[PWA Offline] Cache storage error:", err);
    }
  }

  return {
    success: true,
    hotelsSaved: pkg.hotels.length,
    imagesCached: cachedCount,
  };
}

/**
 * Queries IndexedDB for hotels in an offline-saved city with zero latency.
 */
export async function getOfflineHotelsByCity(
  cityIdOrName: string,
  query?: string
): Promise<OfflineHotelRecord[]> {
  const db = await getOfflineDB();
  const allHotels: OfflineHotelRecord[] = await db.getAll("hotels");

  const term = (cityIdOrName || "").toLowerCase().trim();
  const qTerm = (query || "").toLowerCase().trim();

  return allHotels.filter((h) => {
    const matchesCity =
      h.city_id.toLowerCase() === term ||
      h.city_name.toLowerCase() === term ||
      h.city_name.toLowerCase().includes(term);

    if (!matchesCity && term.length > 0) return false;

    if (!qTerm) return true;

    return (
      h.name.toLowerCase().includes(qTerm) ||
      h.property_type.toLowerCase().includes(qTerm) ||
      (h.address_line && h.address_line.toLowerCase().includes(qTerm)) ||
      (h.description && h.description.toLowerCase().includes(qTerm))
    );
  });
}

/**
 * Gets offline hotel detail from IndexedDB.
 */
export async function getOfflineHotelDetail(
  hotelId: string
): Promise<OfflineHotelRecord | undefined> {
  const db = await getOfflineDB();
  return db.get("hotels", hotelId);
}

/**
 * Gets all saved offline cities.
 */
export async function getAllSavedOfflineCities(): Promise<OfflineCityMetadata[]> {
  try {
    const db = await getOfflineDB();
    return await db.getAll("cities");
  } catch {
    return [];
  }
}

/**
 * Checks if a city is saved offline.
 */
export async function isCitySavedOffline(cityIdOrName: string): Promise<boolean> {
  try {
    const db = await getOfflineDB();
    const cities: OfflineCityMetadata[] = await db.getAll("cities");
    const term = (cityIdOrName || "").toLowerCase().trim();
    return cities.some(
      (c) => c.city_id.toLowerCase() === term || c.name.toLowerCase() === term
    );
  } catch {
    return false;
  }
}

/**
 * Deletes an offline saved city from IndexedDB.
 */
export async function deleteOfflineCity(cityId: string): Promise<boolean> {
  const db = await getOfflineDB();
  const tx = db.transaction(["cities", "hotels", "packages"], "readwrite");

  // Remove hotels for this city
  const hotels = await tx.objectStore("hotels").index("by_city_id").getAll(cityId);
  for (const h of hotels) {
    await tx.objectStore("hotels").delete(h.hotel_id);
  }

  await tx.objectStore("cities").delete(cityId);
  await tx.objectStore("packages").delete(cityId);
  await tx.done;
  return true;
}
