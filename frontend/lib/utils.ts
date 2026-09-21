import Decimal from "decimal.js";

/**
 * Format currency strictly adhering to Indian Rupee standards.
 * Uses decimal.js for financial accuracy.
 */
export function formatCurrency(amount: number | string, currency: string = "INR"): string {
  try {
    const dec = new Decimal(amount || 0);
    const rounded = dec.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(rounded);
  } catch {
    return `₹${amount}`;
  }
}

/**
 * Combine CSS class names safely.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Compute the number of nights between two ISO dates (YYYY-MM-DD).
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 1;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 1;
}

/**
 * Indian GST calculation rules for hotels:
 * <= ₹7,500/night -> 12% GST
 * > ₹7,500/night -> 18% GST
 */
export function calculateHotelTaxes(baseRatePerNight: number, nights: number, rooms: number = 1) {
  const baseRate = new Decimal(baseRatePerNight);
  const subtotal = baseRate.times(nights).times(rooms);
  
  const gstRate = baseRate.greaterThan(7500) ? 0.18 : 0.12;
  const gstAmount = subtotal.times(gstRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const serviceFee = new Decimal(250); // Nominal platform convenience fee
  const total = subtotal.plus(gstAmount).plus(serviceFee).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  return {
    subtotal: subtotal.toNumber(),
    gstRate: gstRate * 100,
    gstAmount: gstAmount.toNumber(),
    serviceFee: serviceFee.toNumber(),
    total: total.toNumber(),
  };
}

/**
 * High-definition fallback photography for luxury Indian properties
 * Curated Unsplash images for distinct property styles
 */
const CURATED_HOTEL_PHOTOS: Record<string, string[]> = {
  heritage: [
    "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  ],
  resort: [
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
  ],
  boutique: [
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
  ],
  hotel: [
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1200&q=80",
  ],
  homestay: [
    "https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=80",
  ],
  guesthouse: [
    "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80",
  ],
};

export function getHotelImage(
  hotelId: string,
  propertyType: string = "hotel",
  index: number = 0,
  rawHeroPath?: string | null
): string {
  if (rawHeroPath && rawHeroPath.startsWith("http")) {
    return rawHeroPath;
  }
  const typeKey = (propertyType || "hotel").toLowerCase();
  const list = CURATED_HOTEL_PHOTOS[typeKey] || CURATED_HOTEL_PHOTOS.hotel;
  // Deterministic selection based on hotelId hash
  let hash = 0;
  for (let i = 0; i < hotelId.length; i++) {
    hash = (hash << 5) - hash + hotelId.charCodeAt(i);
    hash |= 0;
  }
  const selectedIndex = (Math.abs(hash) + index) % list.length;
  return list[selectedIndex];
}
