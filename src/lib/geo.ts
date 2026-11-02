// Shared geo helpers for the collection and trip maps (Birendranagar, Surkhet).

export const NEPAL_CENTER: [number, number] = [28.3949, 84.124];
export const BIRENDRANAGAR_CENTER: [number, number] = [28.6019, 81.6167];

// Central coordinates for Birendranagar wards (1 to 16)
export const BIRENDRANAGAR_WARDS: Record<string, [number, number]> = {
  "1": [28.618, 81.625],
  "2": [28.612, 81.632],
  "3": [28.609, 81.622],
  "4": [28.604, 81.618], // Birendra Chok / Khorke
  "5": [28.599, 81.626], // Chisapani
  "6": [28.598, 81.614], // Buddhapath / Buspark
  "7": [28.594, 81.621], // Itram
  "8": [28.591, 81.633], // Khadkagaun
  "9": [28.588, 81.628], // Lati-koili
  "10": [28.585, 81.642], // Kundi / Airport
  "11": [28.593, 81.655], // Dhullikun
  "12": [28.582, 81.66], // Naya Gau
  "13": [28.575, 81.615], // Matela
  "14": [28.562, 81.595], // Garphu
  "15": [28.625, 81.605], // Ratanangala
  "16": [28.635, 81.595], // Chhinchu boundary
};

// Haversine formula for distance between two lat/lng coordinates in meters
export function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} मिटर`;
  return `${(meters / 1000).toFixed(1)} कि.मी.`;
}

export function formatDrivingTime(meters: number): string {
  // Average city driving speed ~25 km/h ≈ 400 meters/min
  const minutes = Math.max(1, Math.round(meters / 400));
  if (minutes < 60) return `लगभग ${minutes} मिनेट`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `लगभग ${hrs} घण्टा ${mins > 0 ? `${mins} मिनेट` : ""}`;
}

/** Resolve a customer's map position: exact GPS pin, or a deterministic ward-area spread. */
export function resolveCustomerLocation(c: {
  latitude?: number | null;
  longitude?: number | null;
  ward: string;
  card: string;
  name: string;
}): { lat: number; lng: number; isApproximateArea: boolean } {
  if (
    typeof c.latitude === "number" &&
    typeof c.longitude === "number" &&
    !isNaN(c.latitude) &&
    !isNaN(c.longitude)
  ) {
    return { lat: c.latitude, lng: c.longitude, isApproximateArea: false };
  }

  const wardKey = String(parseInt(c.ward || "1", 10));
  const base = BIRENDRANAGAR_WARDS[wardKey] || BIRENDRANAGAR_CENTER;

  const seed = (c.card || c.name || "1")
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const spreadLat = ((seed % 17) - 8) * 0.00065;
  const spreadLng = (((seed * 7) % 19) - 9) * 0.00065;

  return {
    lat: base[0] + spreadLat,
    lng: base[1] + spreadLng,
    isApproximateArea: true,
  };
}
