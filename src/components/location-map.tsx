import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Navigation,
  ExternalLink,
  LocateFixed,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { natureEmoji } from "@/lib/nature";

// Pin icon that shows the customer's business nature emoji as a bubble marker.
// Without a nature it falls back to a crisp SVG pin (no external image assets).
const createPinIcon = (color = "#e11d48", nature?: string) => {
  const emoji = natureEmoji(nature);
  if (emoji) {
    return L.divIcon({
      className: "custom-leaflet-pin custom-leaflet-nature-pin",
      html: `
        <div style="position: relative; width: 34px; height: 42px; transform: translate(-50%, -100%);">
          <div style="display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; font-size: 20px; line-height: 1; background-color: #ffffff; border: 2.5px solid ${color}; border-radius: 9999px; box-shadow: 0 3px 8px rgba(0,0,0,0.35); cursor: pointer;">${emoji}</div>
          <div style="margin-left: 50%; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 9px solid ${color}; transform: translateX(-50%); filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));"></div>
        </div>
      `,
      iconSize: [34, 46],
      iconAnchor: [17, 46],
    });
  }
  return L.divIcon({
    className: "custom-leaflet-pin",
    html: `
      <div style="position: relative; width: 32px; height: 32px; transform: translate(-50%, -100%);">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="${color}" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [0, 0],
  });
};

export type LocationAddressResult = {
  district?: string;
  municipality?: string;
  ward?: string;
  tole?: string;
  full_address?: string;
};

interface LocationMapProps {
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  onChange?: (coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    address?: LocationAddressResult;
  }) => void;
  readOnly?: boolean;
  customerName?: string;
  nature?: string;
  addressInfo?: string;
  height?: string;
}

// Default center: Birendranagar, Surkhet (28.6019, 81.6167)
const DEFAULT_CENTER: [number, number] = [28.6019, 81.6167];

/**
 * Reverse geocodes coordinates into Nepali district, municipality, ward, tole and full address.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<LocationAddressResult | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ne,en`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      },
    );
    clearTimeout(timer);

    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};

    // 1. District
    let district = addr.county || addr.state_district || addr.district || "";
    if (district.toLowerCase().includes("surkhet") || district.includes("सुर्खेत")) {
      district = "सुर्खेत";
    } else if (district) {
      district = district.replace(/\s*(District|जिल्ला)/gi, "").trim();
    }

    // 2. Municipality
    let municipality =
      addr.municipality || addr.city || addr.town || addr.village || addr.city_district || "";
    if (
      municipality.toLowerCase().includes("birendranagar") ||
      municipality.includes("वीरेन्द्रनगर")
    ) {
      municipality = "वीरेन्द्रनगर";
    } else if (municipality) {
      municipality = municipality.replace(/\s*(Municipality|नगरपालिका|गाउँपालिका)/gi, "").trim();
    }

    // 3. Ward detection (e.g., from "Ward 4", "Ward-04", "वडा ४", etc.)
    let ward = "";
    const textPool = `${data.display_name || ""} ${addr.suburb || ""} ${addr.neighbourhood || ""} ${addr.quarter || ""}`;
    const enText = textPool.replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d)));
    const wardMatch = enText.match(/(?:ward|वडा)\s*(?:no\.?|नं\.?)?\s*([1-9]|1[0-6])/i);
    if (wardMatch && wardMatch[1]) {
      ward = String(Number(wardMatch[1]));
    }

    // 4. Tole / Neighborhood
    let tole =
      addr.neighbourhood ||
      addr.suburb ||
      addr.road ||
      addr.quarter ||
      addr.hamlet ||
      addr.residential ||
      "";
    if (tole) {
      tole = tole.replace(/\s*(?:ward|वडा)\s*\d+/gi, "").trim();
    }

    // 5. Full address
    const parts = [tole, ward ? `वडा नं. ${ward}` : "", municipality, district].filter(Boolean);
    const full_address = parts.join(", ") || data.display_name || "";

    return {
      district: district || undefined,
      municipality: municipality || undefined,
      ward: ward || undefined,
      tole: tole || undefined,
      full_address: full_address || undefined,
    };
  } catch (err) {
    console.warn("Reverse geocode warning:", err);
    return null;
  }
}

export function LocationMap({
  latitude,
  longitude,
  accuracy,
  onChange,
  readOnly = false,
  customerName,
  addressInfo,
  height = "260px",
  nature,
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodedNotice, setGeocodedNotice] = useState("");

  const hasCoords =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !isNaN(latitude) &&
    !isNaN(longitude);

  const applyCoordsWithGeocode = async (lat: number, lng: number, acc: number | null) => {
    if (!onChange) return;
    setGpsError("");

    // Step 1: Immediately notify parent of coordinates so map pin updates instantly
    onChange({ latitude: lat, longitude: lng, accuracy: acc });

    // Step 2: Reverse-geocode to auto-fill district, municipality, ward, tole, and address
    setGeocoding(true);
    setGeocodedNotice("नक्साबाट ठेगाना खोजिँदैछ (Looking up address)...");

    const addr = await reverseGeocode(lat, lng);
    setGeocoding(false);

    if (addr && (addr.tole || addr.municipality || addr.ward || addr.district)) {
      onChange({ latitude: lat, longitude: lng, accuracy: acc, address: addr });
      const summary = [addr.tole, addr.ward ? `वडा ${addr.ward}` : "", addr.municipality]
        .filter(Boolean)
        .join(", ");
      setGeocodedNotice(`✓ ठेगाना स्वतः भरियो: ${summary} (तपाईंले सच्याउन पनि सक्नुहुन्छ)`);
      setTimeout(() => setGeocodedNotice(""), 6000);
    } else {
      setGeocodedNotice("");
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const initialCenter: [number, number] = hasCoords ? [latitude, longitude] : DEFAULT_CENTER;
      const initialZoom = hasCoords ? 16 : 14;

      const map = L.map(containerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      mapRef.current = map;

      if (!readOnly && onChange) {
        map.on("click", (e) => {
          const lat = Number(e.latlng.lat.toFixed(7));
          const lng = Number(e.latlng.lng.toFixed(7));
          applyCoordsWithGeocode(lat, lng, null);
        });
      }
    }

    const map = mapRef.current;
    if (!map) return;

    // Update marker position
    if (hasCoords) {
      const pos: [number, number] = [latitude, longitude];

      if (!markerRef.current) {
        const marker = L.marker(pos, {
          icon: createPinIcon(readOnly ? "#2563eb" : "#e11d48", nature),
          draggable: !readOnly,
          zIndexOffset: 1000,
        }).addTo(map);

        if (!readOnly && onChange) {
          marker.on("dragend", () => {
            const ll = marker.getLatLng();
            const lat = Number(ll.lat.toFixed(7));
            const lng = Number(ll.lng.toFixed(7));
            applyCoordsWithGeocode(lat, lng, null);
          });
        }

        markerRef.current = marker;
      } else {
        markerRef.current.setLatLng(pos);
        markerRef.current.setZIndexOffset(1000);
        markerRef.current.setIcon(createPinIcon(readOnly ? "#2563eb" : "#e11d48", nature));
      }

      if (customerName || addressInfo) {
        markerRef.current.bindPopup(`
          <div style="font-family: inherit; font-size: 13px; line-height: 1.4;">
            <strong style="color: #0f172a;">${customerName || "Customer Location"}</strong><br/>
            ${addressInfo ? `<span style="color: #475569;">${addressInfo}</span><br/>` : ""}
            <span style="font-size: 11px; color: #64748b;">GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}</span>
          </div>
        `);
      }

      // Show accuracy circle if provided
      if (typeof accuracy === "number" && accuracy > 0) {
        if (!circleRef.current) {
          circleRef.current = L.circle(pos, {
            radius: accuracy,
            color: "#3b82f6",
            fillColor: "#60a5fa",
            fillOpacity: 0.15,
            weight: 1,
          }).addTo(map);
        } else {
          circleRef.current.setLatLng(pos);
          circleRef.current.setRadius(accuracy);
        }
      } else if (circleRef.current) {
        map.removeLayer(circleRef.current);
        circleRef.current = null;
      }
    } else {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      if (circleRef.current) {
        map.removeLayer(circleRef.current);
        circleRef.current = null;
      }
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [
    latitude,
    longitude,
    accuracy,
    readOnly,
    hasCoords,
    customerName,
    addressInfo,
    nature,
    onChange,
  ]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const handleGetLiveGPS = () => {
    if (!navigator.geolocation) {
      setGpsError(
        "यस ब्राउजरमा Geolocation उपलब्ध छैन (Geolocation not supported). कृपया नक्सामा सिधै क्लिक गर्नुहोस्।",
      );
      return;
    }

    setLocating(true);
    setGpsError("");
    setGpsSuccess(false);

    const onPosSuccess = (pos: GeolocationPosition, infoMsg = "") => {
      const lat = Number(pos.coords.latitude.toFixed(7));
      const lng = Number(pos.coords.longitude.toFixed(7));
      const acc = Math.round(pos.coords.accuracy);

      setLocating(false);
      setGpsSuccess(true);
      if (infoMsg) setGpsError(infoMsg);

      applyCoordsWithGeocode(lat, lng, acc);

      if (mapRef.current) {
        mapRef.current.flyTo([lat, lng], 17, { duration: 1.2 });
      }

      setTimeout(() => setGpsSuccess(false), 4000);
    };

    // Stage 1: Try GPS with 8-second timeout
    navigator.geolocation.getCurrentPosition(
      (pos) => onPosSuccess(pos),
      (errHigh) => {
        // Stage 2: If timed out or unavailable, automatically fall back to standard network accuracy
        if (errHigh.code === 3 || errHigh.code === 2) {
          navigator.geolocation.getCurrentPosition(
            (pos) => onPosSuccess(pos, "सामान्य GPS/नेटवर्क मार्फत लोकेसन प्राप्त भयो।"),
            async (errLow) => {
              // Stage 3: Try network IP geolocation fallback so the user is never stuck
              try {
                const ipRes = await fetch("https://get.geojs.io/v1/ip/geo.json", {
                  signal: AbortSignal.timeout(4000),
                });
                if (ipRes.ok) {
                  const ipData = await ipRes.json();
                  if (ipData.latitude && ipData.longitude) {
                    const lat = Number(Number(ipData.latitude).toFixed(7));
                    const lng = Number(Number(ipData.longitude).toFixed(7));
                    setLocating(false);
                    setGpsSuccess(true);
                    setGpsError("नेटवर्क आधारित अनुमानित लोकेसन (पिन तानेर स्थान मिलाउनुहोस्)।");
                    applyCoordsWithGeocode(lat, lng, 1000);
                    if (mapRef.current) {
                      mapRef.current.flyTo([lat, lng], 15, { duration: 1.2 });
                    }
                    setTimeout(() => setGpsSuccess(false), 5000);
                    return;
                  }
                }
              } catch {
                // Fall through to error
              }

              setLocating(false);
              let msg =
                "GPS समय सकियो (GPS Timeout). कृपया तलको नक्सामा सिधै क्लिक गरेर पिन राख्नुहोस्।";
              if (errLow.code === 1)
                msg =
                  "लोकेसन अनुमति अस्वीकार गरियो (Location permission denied). कृपया नक्सामा क्लिक गर्नुहोस्।";
              setGpsError(msg);
            },
            {
              enableHighAccuracy: false,
              timeout: 15000,
              maximumAge: 120000, // accepts location cached within 2 minutes
            },
          );
        } else {
          setLocating(false);
          let msg = "GPS लोकेसन लिन सकिएन। नक्सामा सिधै क्लिक गरी पिन राख्नुहोस्।";
          if (errHigh.code === 1)
            msg =
              "लोकेसन अनुमति अस्वीकार गरियो (Location permission denied). नक्सामा क्लिक गर्नुहोस्।";
          setGpsError(msg);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000,
      },
    );
  };

  const googleMapsUrl = hasCoords ? `https://www.google.com/maps?q=${latitude},${longitude}` : "";

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-emerald-500/50 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
            onClick={handleGetLiveGPS}
            disabled={locating}
          >
            {locating ? (
              <span className="flex items-center gap-1.5">
                <LocateFixed className="size-4 animate-spin text-emerald-600" />
                लोकेसन लिँदैछ (Getting GPS)…
              </span>
            ) : gpsSuccess ? (
              <span className="flex items-center gap-1.5 text-emerald-700">
                <Check className="size-4" />
                लोकेसन प्राप्त भयो!
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <LocateFixed className="size-4 text-emerald-600" />
                📍 लाइभ GPS लोकेसन लिनुहोस् (Get Live GPS)
              </span>
            )}
          </Button>

          {hasCoords && (
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
              </span>
              {typeof accuracy === "number" && (
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                  ±{accuracy}m
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {geocoding && (
        <div className="flex items-center gap-1.5 rounded border border-blue-500/30 bg-blue-500/10 p-2 text-xs text-blue-700 dark:text-blue-300">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          <span>नक्साबाट ठेगाना पत्ता लगाउँदैछ (Detecting address from map)...</span>
        </div>
      )}

      {geocodedNotice && !geocoding && (
        <div className="flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <Check className="size-4 shrink-0" />
          <span>{geocodedNotice}</span>
        </div>
      )}

      {gpsError && (
        <div className="flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Map Container */}
      <div
        className="relative overflow-hidden rounded-lg border border-border shadow-inner"
        style={{ height }}
      >
        <div ref={containerRef} className="size-full" />

        {!hasCoords && !readOnly && (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[1000] flex justify-center">
            <span className="rounded-full bg-background/90 px-3 py-1 text-[11px] font-medium text-foreground shadow backdrop-blur">
              💡 नक्सामा क्लिक गर्नुहोस् वा माथिको "लाइभ GPS" बटन थिच्नुहोस् (ठेगाना स्वतः भरिनेछ)
            </span>
          </div>
        )}
      </div>

      {hasCoords && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {!readOnly
              ? "पिन तानेर वा नक्सामा क्लिक गरेर स्थान सच्याउन सकिन्छ।"
              : "ग्राहकको भौगोलिक स्थान"}
          </span>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="size-3" /> Google Maps मा खोल्नुहोस्
          </a>
        </div>
      )}
    </div>
  );
}
