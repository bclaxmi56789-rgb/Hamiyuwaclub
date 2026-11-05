import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useWorkspace, WorkspacePage, money } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { useTeamLocationBroadcast } from "@/lib/team-location";
import {
  MapPin,
  Navigation,
  ExternalLink,
  LocateFixed,
  Phone,
  Search,
  Filter,
  Layers,
  ChevronRight,
  Receipt,
  Car,
  Compass,
  AlertTriangle,
  MousePointer,
  Maximize2,
  Minimize2,
  EyeOff,
  Eye,
} from "lucide-react";
import {
  todayBS,
  np,
  getDueMonths,
  mergeOpeningDues,
  getCustomerTotalRate,
  DEFAULT_PLANS,
  type Person,
  type PlanItem,
  type DueMonth,
} from "@/lib/receipt-rules";
import {
  NEPAL_CENTER,
  BIRENDRANAGAR_CENTER,
  getDistanceInMeters,
  formatDistance,
  formatDrivingTime,
  resolveCustomerLocation,
} from "@/lib/geo";
import { natureEmoji } from "@/lib/nature";

export const Route = createFileRoute("/collection-map")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Collection & Driver Map — Sangstha" },
      {
        name: "description",
        content:
          "Interactive map for waste collectors and drivers showing customer dues, bubble sizes, live location and direct receipt creation.",
      },
      { property: "og:title", content: "Waste Collection Map — Sangstha" },
    ],
  }),
  component: CollectionMapPage,
});

// Compact amount label e.g. 500 -> "500", 2500 -> "2.5k", 15000 -> "15k"
function formatCompactAmount(amt: number): string {
  if (amt <= 0) return "✓";
  if (amt < 1000) return String(amt);
  if (amt < 10000) return `${(amt / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(amt / 1000)}k`;
}

interface CustomerWithDue extends Person {
  dueMonths: DueMonth[];
  dueAmount: number;
  overdueCount: number;
  monthlyFee: number;
  displayLat: number;
  displayLng: number;
  isApproximateArea: boolean;
  distanceFromDriver?: number | undefined;
}

function CollectionMapPage() {
  const { query, ward, setWard, signedIn, userId } = useWorkspace();
  const navigate = useNavigate();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);

  // Driver/Collector Location
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [trackingLocation, setTrackingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locatingStatus, setLocatingStatus] = useState("");
  const [settingDriverMode, setSettingDriverMode] = useState(false);
  const settingDriverModeRef = useRef(false);
  settingDriverModeRef.current = settingDriverMode;

  const watchIdRef = useRef<number | null>(null);
  const firstFixRef = useRef(false);

  // ── Broadcast this collector's live location to the dashboard map ──────
  const broadcastToDashboard = useTeamLocationBroadcast({
    userId: userId ?? null,
    name: "संकलक",
    role: "collector",
    active: trackingLocation,
  });

  // Selected customer for navigation / route
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithDue | null>(null);

  // ─── Map view controls: fullscreen & hide overlay boxes ───
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const [mapFull, setMapFull] = useState(false);
  const [hideBoxes, setHideBoxes] = useState(false);

  const toggleMapFullscreen = () => {
    const el = mapWrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      setMapFull(false);
    } else if (el.requestFullscreen) {
      void el.requestFullscreen()
        .then(() => setMapFull(true))
        .catch(() => setMapFull(true));
    } else {
      setMapFull(true); // Fallback: CSS full-viewport mode (mobile Safari)
    }
    if (mapRef.current) setTimeout(() => mapRef.current!.invalidateSize(), 350);
  };

  useEffect(() => {
    const onFsChange = () => setMapFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Filter states; the section drawer (बक्यौता/थेली tabs) starts open on desktop
  const [filterOnlyDues, setFilterOnlyDues] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024,
  );

  const plans: PlanItem[] =
    query.data?.plans && query.data.plans.length > 0 ? query.data.plans : DEFAULT_PLANS;
  const allPeople: Person[] = query.data?.people ?? [];
  const allReceipts = query.data?.receipts ?? [];

  // Compute customers with their calculated dues and GPS coordinates
  const customersWithDues: CustomerWithDue[] = useMemo(() => {
    return allPeople.map((person) => {
      const customerPaidSet = new Set(
        allReceipts
          .filter(
            (r) => r.ward === person.ward && r.card.toLowerCase() === person.card.toLowerCase(),
          )
          .flatMap((r) => r.months.map((m) => `${m.year ?? r.year}:${m.m}`)),
      );

      const autoDues = person.joining_date
        ? getDueMonths(person.joining_date, customerPaidSet, todayBS())
        : [];
      const dueMonths = mergeOpeningDues(autoDues, person.opening_dues, customerPaidSet);
      const monthlyFee = getCustomerTotalRate(person, plans);
      const dueAmount = dueMonths.reduce((s, dm) => s + (dm.amount ?? monthlyFee), 0);
      const overdueCount = dueMonths.filter((d) => d.isOverdue).length;

      const loc = resolveCustomerLocation(person);

      let distanceFromDriver: number | undefined;
      if (driverLocation) {
        distanceFromDriver = getDistanceInMeters(
          driverLocation.latitude,
          driverLocation.longitude,
          loc.lat,
          loc.lng,
        );
      }

      return {
        ...person,
        dueMonths,
        dueAmount,
        overdueCount,
        monthlyFee,
        displayLat: loc.lat,
        displayLng: loc.lng,
        isApproximateArea: loc.isApproximateArea,
        distanceFromDriver,
      };
    });
  }, [allPeople, allReceipts, plans, driverLocation]);

  // Filtered customers for map and list
  const filteredCustomers = useMemo(() => {
    return customersWithDues.filter((c) => {
      if (ward && c.ward !== ward) return false;
      if (filterOnlyDues && c.dueAmount <= 0) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          c.name.toLowerCase().includes(q) ||
          c.card.toLowerCase().includes(q) ||
          c.tole.toLowerCase().includes(q) ||
          (c.nature && c.nature.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [customersWithDues, ward, filterOnlyDues, searchQuery]);

  // Count exact GPS vs approximate Ward area
  const exactGpsCount = useMemo(() => {
    return filteredCustomers.filter((c) => !c.isApproximateArea).length;
  }, [filteredCustomers]);

  const approximateCount = useMemo(() => {
    return filteredCustomers.filter((c) => c.isApproximateArea).length;
  }, [filteredCustomers]);

  // Statistics
  const totalDuesAmount = useMemo(() => {
    return filteredCustomers.reduce((acc, c) => acc + c.dueAmount, 0);
  }, [filteredCustomers]);

  const customersWithDueCount = useMemo(() => {
    return filteredCustomers.filter((c) => c.dueAmount > 0).length;
  }, [filteredCustomers]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      // Start centered on Nepal, will smoothly zoom in
      const map = L.map(mapContainerRef.current, {
        center: NEPAL_CENTER,
        zoom: 7,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapRef.current = map;

      // Click on map: if setting driver mode, sets vehicle position; otherwise clears selection
      map.on("click", (e) => {
        if (settingDriverModeRef.current) {
          const lat = Number(e.latlng.lat.toFixed(7));
          const lng = Number(e.latlng.lng.toFixed(7));
          setDriverLocation({ latitude: lat, longitude: lng });
          setSettingDriverMode(false);
          setLocationError("");
          setLocatingStatus("गाडीको स्थान नक्सामा तोकियो (Vehicle location set).");
          setTimeout(() => setLocatingStatus(""), 4000);
        }
      });

      // Smooth zoom into Birendranagar after brief delay
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.flyTo(BIRENDRANAGAR_CENTER, 14, { duration: 1.8 });
        }
      }, 500);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Driver Marker on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !driverLocation) {
      if (driverMarkerRef.current && map) {
        map.removeLayer(driverMarkerRef.current);
        driverMarkerRef.current = null;
      }
      return;
    }

    const { latitude, longitude } = driverLocation;

    const driverIcon = L.divIcon({
      className: "driver-live-location-icon",
      html: `
        <div style="position: relative; width: 44px; height: 44px; cursor: grab;">
          <div style="position: absolute; inset: 0; border-radius: 9999px; background-color: #2563eb; opacity: 0.3; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 44px; height: 44px; border-radius: 9999px; background-color: #1e40af; border: 3px solid #ffffff; box-shadow: 0 4px 14px rgba(37,99,235,0.6); display: flex; align-items: center; justify-content: center; font-size: 20px;">
            🚚
          </div>
          <div style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); background-color: #1e3a8a; color: #ffffff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
            चालक / संकलक (तानेर सार्नुहोस्)
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([latitude, longitude]);
    } else {
      const marker = L.marker([latitude, longitude], {
        icon: driverIcon,
        zIndexOffset: 2000,
        draggable: true,
      }).addTo(map);

      marker.on("dragend", (e) => {
        const ll = (e.target as L.Marker).getLatLng();
        setDriverLocation({ latitude: ll.lat, longitude: ll.lng });
      });

      driverMarkerRef.current = marker;
    }
  }, [driverLocation]);

  // Update Customer Bubbles on Map (both exact GPS & Ward area)
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    filteredCustomers.forEach((c) => {
      const lat = c.displayLat;
      const lng = c.displayLng;
      const isSelected = selectedCustomer?.card === c.card && selectedCustomer?.ward === c.ward;
      const hasDue = c.dueAmount > 0;

      // Determine bubble size based on due amount:
      let size = 26; // default
      let color = "#ef4444"; // red
      let zIndex = 100;

      if (!hasDue) {
        size = 18;
        color = "#10b981"; // green (no due)
        zIndex = 50;
      } else if (c.dueAmount < 2000) {
        size = 24;
        color = "#f87171"; // soft red
        zIndex = 150;
      } else if (c.dueAmount < 5000) {
        size = 30;
        color = "#ef4444"; // red
        zIndex = 200;
      } else if (c.dueAmount < 10000) {
        size = 36;
        color = "#dc2626"; // deeper red
        zIndex = 300;
      } else {
        size = 44;
        color = "#991b1b"; // big overdue crimson
        zIndex = 400;
      }

      if (isSelected) {
        size += 6;
        zIndex = 1000;
      }

      const compactText = formatCompactAmount(c.dueAmount);

      const bubbleIcon = L.divIcon({
        className: "customer-due-bubble-container",
        html: `
          <div style="position: relative; width: ${size}px; height: ${size}px; cursor: pointer; z-index: ${zIndex};">
            ${
              hasDue && c.dueAmount >= 5000
                ? `<div style="position: absolute; inset: -4px; border-radius: 9999px; background-color: ${color}; opacity: 0.35; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
                : ""
            }
            <div style="
              width: ${size}px;
              height: ${size}px;
              border-radius: 9999px;
              background-color: ${color};
              border: ${isSelected ? "3px solid #2563eb" : c.isApproximateArea ? "2px dashed #fbbf24" : "2px solid #ffffff"};
              box-shadow: 0 4px 10px rgba(0,0,0,0.35);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-weight: 800;
              font-size: ${size >= 36 ? "11px" : size >= 28 ? "10px" : "9px"};
              letter-spacing: -0.5px;
            ">
              ${compactText}
            </div>
            ${
              natureEmoji(c.nature)
                ? `<span style="position: absolute; top: -6px; right: -6px; display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; font-size: 11px; line-height: 1; background-color: #ffffff; border: 1px solid #d4d4d8; border-radius: 9999px; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">${natureEmoji(c.nature)}</span>`
                : ""
            }
            ${
              isSelected
                ? `<div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #2563eb;"></div>`
                : ""
            }
            ${
              c.isApproximateArea
                ? `<div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background-color: #78350f; color: #fef3c7; font-size: 8px; font-weight: bold; padding: 1px 4px; border-radius: 3px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">वडा ${c.ward}</div>`
                : ""
            }
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([lat, lng], { icon: bubbleIcon });

      // Click customer bubble
      marker.on("click", () => {
        handleSelectCustomer(c);
      });

      // Tooltip hover
      marker.bindTooltip(
        `<b>${c.name}</b> (कार्ड: ${c.card})<br/>वडा ${c.ward}, ${c.tole}${c.isApproximateArea ? ' <span style="color:#d97706;font-weight:bold;">(वडा क्षेत्र)</span>' : ""}${c.nature ? `<br/>🏷️ व्यवसाय: ${natureEmoji(c.nature)} ${c.nature}` : ""}<br/>${
          hasDue
            ? `<span style="color:#ef4444;font-weight:bold;">बाँकी रकम: रु. ${c.dueAmount.toLocaleString("en-IN")}</span>`
            : `<span style="color:#10b981;">✓ सबै चुक्ता</span>`
        }${c.distanceFromDriver !== undefined ? `<br/><span style="color:#2563eb;font-weight:bold;">🚗 दुरी: ${formatDistance(c.distanceFromDriver)}</span>` : ""}`,
        { direction: "top", offset: [0, -size / 2 - 4] },
      );

      markersLayer.addLayer(marker);
    });
  }, [filteredCustomers, selectedCustomer]);

  // Update Route Polyline and Distance Display on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    if (driverLocation && selectedCustomer) {
      const cLat = selectedCustomer.displayLat;
      const cLng = selectedCustomer.displayLng;
      const dist = getDistanceInMeters(
        driverLocation.latitude,
        driverLocation.longitude,
        cLat,
        cLng,
      );

      const line = L.polyline(
        [
          [driverLocation.latitude, driverLocation.longitude],
          [cLat, cLng],
        ],
        {
          color: "#2563eb",
          weight: 4,
          dashArray: "8, 8",
          opacity: 0.9,
        },
      ).addTo(map);

      // Tooltip showing driving distance & time directly on the map line
      line
        .bindTooltip(
          `<div style="font-size:11px; font-weight:800; color:#1e40af; background:#eff6ff; border:1.5px solid #60a5fa; padding:3px 8px; border-radius:6px; box-shadow:0 3px 8px rgba(37,99,235,0.25); white-space:nowrap;">
          🚗 ${formatDistance(dist)} (${formatDrivingTime(dist)})
        </div>`,
          { permanent: true, direction: "center", className: "route-distance-tooltip" },
        )
        .openTooltip();

      routeLineRef.current = line;

      // Fit map bounds nicely to show both driver and customer
      map.fitBounds(
        [
          [driverLocation.latitude, driverLocation.longitude],
          [cLat, cLng],
        ],
        { padding: [70, 70], maxZoom: 16 },
      );
    }
  }, [driverLocation, selectedCustomer]);

  // Driver Location Tracking with 3-Stage Fallback (eliminates Timeout expired)
  const toggleLocationTracking = () => {
    if (trackingLocation) {
      // Stop tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setTrackingLocation(false);
      setLocatingStatus("");
      firstFixRef.current = false;
    } else {
      // Start tracking
      if (!navigator.geolocation) {
        setLocationError(
          "तपाईंको ब्राउजरमा GPS लोकेसन सुविधा उपलब्ध छैन। कृपया 'नक्सामा गाडी राख्नुहोस्' प्रयोग गर्नुहोस्।",
        );
        return;
      }

      setLocationError("");
      setLocatingStatus("GPS लोकेसन खोज्दैछ...");
      setTrackingLocation(true);
      firstFixRef.current = false;

      const updatePos = (position: GeolocationPosition, msg = "") => {
        const { latitude, longitude } = position.coords;
        setDriverLocation({ latitude, longitude });
        setLocatingStatus(msg || "✓ लोकेसन सक्रिय छ");

        // Broadcast to dashboard live map
        broadcastToDashboard(latitude, longitude);

        // Center on the driver only once (the first fix); watch updates must not
        // keep dragging the map while the driver moves or pans manually.
        const map = mapRef.current;
        if (map && !firstFixRef.current && !selectedCustomer) {
          firstFixRef.current = true;
          map.flyTo([latitude, longitude], 16, { duration: 1.2 });
        }
      };

      // Stage 1: Try high accuracy with 8s timeout
      navigator.geolocation.getCurrentPosition(
        (pos) => updatePos(pos, "✓ GPS लोकेसन प्राप्त भयो"),
        (errHigh) => {
          // Stage 2: Automatic fallback to standard network GPS (no timeout!)
          setLocatingStatus("सामान्य नेटवर्क GPS खोजिँदैछ...");
          navigator.geolocation.getCurrentPosition(
            (pos) => updatePos(pos, "✓ सामान्य GPS/नेटवर्क मार्फत स्थान प्राप्त भयो"),
            async (errLow) => {
              // Stage 3: Network IP geolocation fallback
              setLocatingStatus("इन्टरनेट नेटवर्क स्थान खोजिँदैछ...");
              try {
                const ipRes = await fetch("https://get.geojs.io/v1/ip/geo.json", {
                  signal: AbortSignal.timeout(4000),
                });
                if (ipRes.ok) {
                  const ipData = await ipRes.json();
                  if (ipData.latitude && ipData.longitude) {
                    const lat = Number(Number(ipData.latitude).toFixed(7));
                    const lng = Number(Number(ipData.longitude).toFixed(7));
                    setDriverLocation({ latitude: lat, longitude: lng });
                    setLocatingStatus(
                      "✓ नेटवर्क आधारित स्थान प्राप्त (गाडी तानेर स्थान मिलाउन सक्नुहुन्छ)",
                    );
                    if (mapRef.current && !firstFixRef.current && !selectedCustomer) {
                      firstFixRef.current = true;
                      mapRef.current.flyTo([lat, lng], 15, { duration: 1.2 });
                    }
                    return;
                  }
                }
              } catch {
                // Fall through to error
              }

              setTrackingLocation(false);
              setLocatingStatus("");
              setLocationError(
                "GPS समय समाप्त भयो। कृपया तलको '📍 नक्सामा गाडी राख्नुहोस्' बटन थिचेर नक्सामा जहाँ हुनुहुन्छ त्यहाँ क्लिक गर्नुहोस्।",
              );
            },
            {
              enableHighAccuracy: false,
              timeout: 15000,
              maximumAge: 120000, // accept recent cached position
            },
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 30000,
        },
      );

      // Watch continuously for movement
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => updatePos(pos),
        (err) => console.warn("Watch pos error:", err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
      );
    }
  };

  // Center on Driver location
  const centerOnDriver = () => {
    if (driverLocation && mapRef.current) {
      mapRef.current.flyTo([driverLocation.latitude, driverLocation.longitude], 17, {
        duration: 1,
      });
    }
  };

  // Zoom to Nepal view
  const zoomToNepal = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(NEPAL_CENTER, 7, { duration: 1.5 });
    }
  };

  // Zoom to Birendranagar
  const zoomToBirendranagar = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(BIRENDRANAGAR_CENTER, 14, { duration: 1.2 });
    }
  };

  // Select customer & zoom to them
  const handleSelectCustomer = (c: CustomerWithDue) => {
    setSelectedCustomer(c);
    const map = mapRef.current;
    if (!map) return;

    if (driverLocation) {
      // Zoom to fit both driver and customer
      map.fitBounds(
        [
          [driverLocation.latitude, driverLocation.longitude],
          [c.displayLat, c.displayLng],
        ],
        { padding: [70, 70], maxZoom: 16 },
      );
    } else {
      // Zoom to customer location
      map.flyTo([c.displayLat, c.displayLng], 16, { duration: 1 });
    }
  };

  // One-click Navigate to New Receipt
  const handleCreateReceipt = (c: CustomerWithDue) => {
    void navigate({
      to: "/",
      search: {
        card: c.card,
        ward: c.ward,
      },
    });
  };

  // Open Driving Directions safely without Google Maps API errors
  const handleOpenDirections = (c: CustomerWithDue) => {
    const destLat = c.displayLat;
    const destLng = c.displayLng;
    if (
      typeof destLat !== "number" ||
      typeof destLng !== "number" ||
      isNaN(destLat) ||
      isNaN(destLng)
    ) {
      return;
    }

    // 1. Zoom and highlight route in our in-app map
    const map = mapRef.current;
    if (map) {
      if (driverLocation) {
        map.fitBounds(
          [
            [driverLocation.latitude, driverLocation.longitude],
            [destLat, destLng],
          ],
          { padding: [80, 80], maxZoom: 16 },
        );
      } else {
        map.flyTo([destLat, destLng], 16, { duration: 1 });
      }
    }

    // 2. Open Google Maps safely with explicit coordinates (never throws directions error)
    let mapsUrl = "";
    if (
      driverLocation &&
      typeof driverLocation.latitude === "number" &&
      typeof driverLocation.longitude === "number"
    ) {
      mapsUrl = `https://www.google.com/maps/dir/${driverLocation.latitude},${driverLocation.longitude}/${destLat},${destLng}`;
    } else {
      mapsUrl = `https://www.google.com/maps?q=${destLat},${destLng}`;
    }

    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <WorkspacePage title="संकलन तथा चालक नक्सा (Collection & Driver Map)">
      {/* Top Controls & Metrics Bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border bg-card p-3 shadow-xs">
        {/* Left: Quick Metrics */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-red-700 dark:text-red-300 font-bold">
            <span className="size-2 rounded-full bg-red-500 animate-pulse" />
            <span>कुल बाँकी: {money(totalDuesAmount)}</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-muted-foreground font-semibold">
            <AlertTriangle className="size-3 text-amber-500" />
            <span>{customersWithDueCount} ग्राहकको बक्यौता</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-muted-foreground font-semibold">
            <MapPin className="size-3 text-primary" />
            <span>
              {filteredCustomers.length} नक्सामा ({exactGpsCount > 0 ? `${exactGpsCount} GPS` : ""}
              {exactGpsCount > 0 && approximateCount > 0 ? " • " : ""}
              {approximateCount > 0 ? `${approximateCount} वडा क्षेत्र` : ""})
            </span>
          </div>
        </div>

        {/* Right: Driver Location & Map Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Driver Location Toggle Button */}
          <Button
            type="button"
            size="sm"
            variant={trackingLocation ? "default" : "outline"}
            onClick={toggleLocationTracking}
            className={`gap-1.5 text-xs font-bold ${
              trackingLocation
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                : "border-primary/40 text-primary hover:bg-primary/10"
            }`}
          >
            <LocateFixed className={`size-3.5 ${trackingLocation ? "animate-spin" : ""}`} />
            {trackingLocation
              ? "लोकेसन सक्रिय छ (GPS ON)"
              : "मेरो लोकेसन सुरु गर्नुहोस् (Access GPS)"}
          </Button>

          {/* Manual Placement Button */}
          <Button
            type="button"
            size="sm"
            variant={settingDriverMode ? "secondary" : "outline"}
            onClick={() => {
              setSettingDriverMode(!settingDriverMode);
              if (!settingDriverMode) {
                setLocationError("");
                setLocatingStatus("👉 नक्सामा चालक/गाडी भएको ठाउँमा क्लिक गर्नुहोस्...");
              } else {
                setLocatingStatus("");
              }
            }}
            className={`h-8 text-xs gap-1 ${settingDriverMode ? "border-amber-500 bg-amber-50 text-amber-900 font-bold dark:bg-amber-950/50 dark:text-amber-200" : ""}`}
            title="नक्सामा जहाँ हुनुहुन्छ त्यहाँ क्लिक गरेर गाडी राख्न सक्नुहुन्छ"
          >
            <MousePointer className="size-3.5" />
            {settingDriverMode ? "नक्सामा थिच्नुहोस्..." : "📍 नक्सामा गाडी राख्नुहोस्"}
          </Button>

          {driverLocation && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={centerOnDriver}
              className="h-8 text-xs gap-1 text-blue-600 border-blue-400/50 hover:bg-blue-50"
              title="गाडी भएको ठाउँमा जानुहोस्"
            >
              <Car className="size-3.5" /> म भएको ठाउँ
            </Button>
          )}

          {/* Quick Zoom Buttons */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={zoomToBirendranagar}
            className="h-8 text-xs gap-1"
            title="वीरेन्द्रनगर जुम"
          >
            <Compass className="size-3.5 text-primary" /> वीरेन्द्रनगर
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={zoomToNepal}
            className="h-8 text-xs gap-1 text-muted-foreground"
            title="सम्पूर्ण नेपाल दृश्य"
          >
            नेपाल नक्सा
          </Button>

          <Button
            type="button"
            size="sm"
            variant={sidebarOpen ? "secondary" : "outline"}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 text-xs gap-1"
          >
            <Filter className="size-3" /> ग्राहक सूची ({filteredCustomers.length})
          </Button>
        </div>
      </div>

      {locatingStatus && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-2 text-xs text-blue-700 dark:text-blue-300 font-medium">
          <LocateFixed className="size-3.5 shrink-0 animate-spin text-blue-600" />
          <span>{locatingStatus}</span>
        </div>
      )}

      {locationError && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            <span>{locationError}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[11px] font-bold border-amber-600/50 text-amber-900 hover:bg-amber-100"
            onClick={() => {
              setSettingDriverMode(true);
              setLocationError("");
              setLocatingStatus("👉 नक्सामा चालक/गाडी भएको ठाउँमा क्लिक गर्नुहोस्...");
            }}
          >
            नक्सामा थिच्नुहोस्
          </Button>
        </div>
      )}

      {/* Main Map View Area with Floating Overlay Panels */}
      {/* leaflet-map-wrapper creates an isolated stacking context so Leaflet's
          internal z-indexes don't bleed above the sticky app navbar on mobile. */}
      <div
        ref={mapWrapperRef}
        className={`leaflet-map-wrapper relative w-full overflow-hidden rounded-xl border-2 border-border shadow-lg ${
          mapFull ? "map-fullscreen" : ""
        }`}
      >
        {/* Leaflet Map Canvas */}
        <div
          ref={mapContainerRef}
          className={`h-full w-full bg-muted ${settingDriverMode ? "cursor-crosshair" : ""}`}
        />

        {/* Map view controls: navigate, hide boxes, fullscreen */}
        <div className="absolute top-3 right-3 z-[1001] flex flex-col gap-1.5">
          {selectedCustomer && (
            <button
              type="button"
              title="ग्राहकसम्म Google Maps navigation (Navigate)"
              onClick={() => handleOpenDirections(selectedCustomer)}
              className="rounded-full bg-primary p-2 text-white shadow-lg hover:bg-primary/90"
            >
              <Navigation className="size-4" />
            </button>
          )}
          <button
            type="button"
            title={hideBoxes ? "बक्सहरू देखाउनुहोस् (Show info boxes)" : "नक्सामा बक्सहरू लुकाउनुहोस् (Hide boxes)"}
            onClick={() => setHideBoxes((v) => !v)}
            className="rounded-full bg-card p-2 text-foreground shadow-lg border hover:bg-accent"
          >
            {hideBoxes ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
          <button
            type="button"
            title={mapFull ? "फुल स्क्रिन बन्द (Exit full screen)" : "फुल स्क्रिन (Full screen)"}
            onClick={toggleMapFullscreen}
            className="rounded-full bg-card p-2 text-foreground shadow-lg border hover:bg-accent"
          >
            {mapFull ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>

        {/* Floating Bubble Legend on Top-Left */}
        {!hideBoxes && (
        <div className="absolute top-3 left-3 z-[1000] rounded-lg bg-card/95 backdrop-blur-md p-2.5 shadow-lg border border-border/80 text-[11px] max-w-[210px]">
          <div className="font-bold text-foreground mb-1.5 flex items-center gap-1">
            <span className="size-2 rounded-full bg-red-600" />
            <span>बक्यौता रकम अनुसार बबल (Dues)</span>
          </div>
          <div className="space-y-1 text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="size-6 rounded-full bg-red-700 text-white font-mono text-[9px] font-bold flex items-center justify-center shrink-0">
                15k
              </span>
              <span>धेरै बक्यौता (&gt; १० हजार)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-5 rounded-full bg-red-600 text-white font-mono text-[8px] font-bold flex items-center justify-center shrink-0">
                5k
              </span>
              <span>मध्यम (५ - १० हजार)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-4 rounded-full bg-red-400 text-white font-mono text-[7px] font-bold flex items-center justify-center shrink-0">
                1k
              </span>
              <span>सामान्य (&lt; ५ हजार)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-emerald-500 shrink-0" />
              <span>चुक्ता / कुनै बाँकी छैन</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border border-amber-500 bg-amber-100" />
              <span>पहेँलो किनारा: वडा/टोल क्षेत्र</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="size-2.5 rounded-full border border-white bg-red-500" />
              <span>सेतो किनारा: निश्चित GPS पिन</span>
            </div>
          </div>
        </div>
        )}

        {/* Setting Driver Mode Alert Banner on Map */}
        {settingDriverMode && (
          <div className="absolute top-3 right-14 z-[1000] rounded-lg bg-amber-500 text-amber-950 font-bold text-xs px-3 py-1.5 shadow-xl animate-bounce flex items-center gap-1.5">
            <MousePointer className="size-4" />
            <span>नक्सामा जहाँ गाडी छ त्यहाँ क्लिक गर्नुहोस्</span>
          </div>
        )}

        {/* Selected Customer Floating Card (Bottom-Center / Bottom-Left) */}
        {selectedCustomer && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-[1000] rounded-xl bg-card/95 backdrop-blur-md p-4 shadow-2xl border-2 border-primary/50 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-start justify-between gap-2 border-b pb-2 mb-2.5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-base text-foreground">
                    {selectedCustomer.name}
                  </h3>
                  <span className="rounded bg-primary/10 border border-primary/30 px-1.5 py-0.5 font-mono text-xs font-bold text-primary">
                    कार्ड: {selectedCustomer.card}
                  </span>
                  {selectedCustomer.isApproximateArea && (
                    <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      वडा {selectedCustomer.ward} क्षेत्र
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  वडा {selectedCustomer.ward}, टोल: {selectedCustomer.tole}
                  {selectedCustomer.full_address && ` • ${selectedCustomer.full_address}`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {/* Customer Due Highlight & Distance */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-center">
                <span className="block text-[10px] text-muted-foreground">
                  बाँकी बक्यौता (Due Amount)
                </span>
                <span className="font-mono text-base font-extrabold text-red-600 dark:text-red-400">
                  {selectedCustomer.dueAmount > 0
                    ? money(selectedCustomer.dueAmount)
                    : "✓ कुनै छैन"}
                </span>
                {selectedCustomer.dueMonths.length > 0 && (
                  <span className="block text-[10px] font-semibold text-red-600">
                    {selectedCustomer.dueMonths.length} महिना बाँकी ({selectedCustomer.overdueCount}{" "}
                    Overdue)
                  </span>
                )}
              </div>

              <div className="rounded-lg bg-muted/60 p-2 text-center flex flex-col justify-center">
                <span className="block text-[10px] text-muted-foreground">
                  मासिक दर (Monthly Rate)
                </span>
                <span className="font-mono text-sm font-bold text-foreground">
                  {money(selectedCustomer.monthlyFee)}/महिना
                </span>
                {selectedCustomer.distanceFromDriver !== undefined ? (
                  <div className="mt-1 pt-1 border-t border-border/60">
                    <span className="block text-xs font-extrabold text-blue-600 dark:text-blue-400">
                      📍 {formatDistance(selectedCustomer.distanceFromDriver)} टाढा
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {formatDrivingTime(selectedCustomer.distanceFromDriver)}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSettingDriverMode(true);
                      setLocatingStatus("👉 नक्सामा चालक/गाडी भएको ठाउँमा क्लिक गर्नुहोस्...");
                    }}
                    className="mt-1 text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    + गाडीको स्थान तोक्नुहोस्
                  </button>
                )}
              </div>
            </div>

            {/* Actions: Navigation & Receipt Creation */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
              {/* Phone Call */}
              {selectedCustomer.phone && (
                <Button asChild size="sm" variant="outline" className="h-9 gap-1 text-xs">
                  <a href={`tel:${selectedCustomer.phone}`}>
                    <Phone className="size-3.5 text-emerald-600" />
                    <span>फोन ({selectedCustomer.phone})</span>
                  </a>
                </Button>
              )}

              {/* Google Maps Turn-by-Turn Driving Navigation */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleOpenDirections(selectedCustomer)}
                className="h-9 gap-1 text-xs border-blue-400/40 text-blue-600 hover:bg-blue-50"
                title="Google Maps मा दिशा हेर्नुहोस्"
              >
                <Navigation className="size-3.5" />
                <span>दिशा (Drive)</span>
              </Button>

              {/* ONE-CLICK CREATE RECEIPT */}
              <Button
                type="button"
                size="sm"
                onClick={() => handleCreateReceipt(selectedCustomer)}
                className="flex-1 h-9 gap-1.5 bg-primary font-extrabold text-primary-foreground hover:opacity-90 shadow-md"
              >
                <Receipt className="size-4" />
                <span>रसिद काट्नुहोस्</span>
              </Button>
            </div>
          </div>
        )}

        {/* Customer List Drawer (Collapsible Right Side) */}
        {sidebarOpen && (
          <div
            className={`absolute top-0 right-0 bottom-0 z-[1000] w-full sm:w-80 bg-card/95 backdrop-blur-md shadow-2xl border-l border-border flex flex-col animate-in slide-in-from-right duration-200`}
          >
            <div className="p-3 border-b">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">बक्यौता (Dues)</span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <>
                <div className="p-3 border-b space-y-2 bg-muted/20">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      className="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      placeholder="नाम, कार्ड वा टोल खोज्नुहोस्..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={filterOnlyDues}
                        onChange={(e) => setFilterOnlyDues(e.target.checked)}
                        className="rounded border"
                      />
                      <span>बाँकी बक्यौता मात्र</span>
                    </label>

                    <select
                      aria-label="Filter ward"
                      className="rounded border bg-background px-2 py-1 text-xs"
                      value={ward}
                      onChange={(e) => setWard(e.target.value)}
                    >
                      <option value="">सबै वडा (All)</option>
                      {Array.from({ length: 16 }, (_, i) => String(i + 1)).map((w) => (
                        <option key={w} value={w}>
                          वडा {w}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Scrollable Customer Rows */}
                <div className="flex-1 overflow-y-auto divide-y divide-border">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      कुनै ग्राहक फेला परेन।
                    </div>
                  ) : (
                    filteredCustomers.map((c) => {
                      const isSelected =
                        selectedCustomer?.card === c.card && selectedCustomer?.ward === c.ward;

                      return (
                        <div
                          key={`${c.ward}-${c.card}`}
                          onClick={() => handleSelectCustomer(c)}
                          className={`p-3 text-xs cursor-pointer transition-colors hover:bg-accent/60 ${
                            isSelected ? "bg-primary/10 border-l-4 border-primary" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <div className="font-bold text-foreground flex items-center gap-1.5">
                                <span>{c.name}</span>
                                {!c.isApproximateArea ? (
                                  <span title="निश्चित GPS पिन">
                                    <MapPin className="size-3 text-emerald-600" />
                                  </span>
                                ) : (
                                  <span
                                    title="वडा क्षेत्र अनुसार"
                                    className="text-[10px] text-amber-600 font-normal"
                                  >
                                    (वडा {c.ward})
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                कार्ड: <b>{c.card}</b> • वडा {c.ward}, {c.tole}
                              </div>
                            </div>

                            <div className="text-right">
                              <span
                                className={`font-mono font-bold block ${
                                  c.dueAmount > 0
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-emerald-600"
                                }`}
                              >
                                {c.dueAmount > 0 ? money(c.dueAmount) : "चुक्ता"}
                              </span>
                              {c.distanceFromDriver !== undefined && (
                                <span className="text-[10px] font-semibold text-blue-600">
                                  {formatDistance(c.distanceFromDriver)}
                                </span>
                              )}
                            </div>
                          </div>

                          {c.dueMonths.length > 0 && (
                            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>{c.dueMonths.length} महिना बाँकी</span>
                              <span className="text-primary font-semibold flex items-center gap-0.5">
                                नक्सामा दुरी हेर्नुहोस् <ChevronRight className="size-3" />
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            </div>
          </div>
        )}
      </div>
    </WorkspacePage>
  );
}
