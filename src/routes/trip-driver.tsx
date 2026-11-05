import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkspace, WorkspacePage } from "@/components/workspace";
import {
  logTrip,
  deleteTrip,
  startTripSession,
  endTripSession,
  addTripPoints,
  getActiveTripSession,
  type TripSession,
} from "@/lib/workspace.functions";
import { Button } from "@/components/ui/button";
import {
  useTeamLocationBroadcast,
  useTeamLocationSubscribe,
  TEAM_ROLE_STYLE,
  type TeamMemberLocation,
} from "@/lib/team-location";
import {
  MapPin,
  Navigation,
  LocateFixed,
  Truck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
  MousePointer,
  Plus,
  X,
  Maximize2,
  Minimize2,
  EyeOff,
  Eye,
  RotateCw,
} from "lucide-react";
import {
  todayBS,
  fiscalYear,
  MONTHS,
  np,
  plannedTripsForPerson,
  tripStatus,
  type Person,
  type PlanItem,
  type TripLogEntry,
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

export const Route = createFileRoute("/trip-driver")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Trips & Driver Map — Sangstha" },
      {
        name: "description",
        content:
          "Trip and driver map: the principal driver's live GPS track with each customer's home trip progress (red → orange → green).",
      },
      { property: "og:title", content: "Trips & Driver Map — Sangstha" },
    ],
  }),
  component: TripDriverPage,
});

interface CustomerWithTrips extends Person {
  planned: number;
  done: number;
  extra: number;
  color: string;
  statusLabel: string;
  complete: boolean;
  inProgress: boolean;
  lastTrip: TripLogEntry | null;
  displayLat: number;
  displayLng: number;
  isApproximateArea: boolean;
  distanceFromDriver?: number | undefined;
}

function TripDriverPage() {
  const { query, ward, year, userId, userEmail, activeEmployeeId, employees } = useWorkspace();
  const queryClient = useQueryClient();
  const logTripFn = useServerFn(logTrip);
  const deleteTripFn = useServerFn(deleteTrip);
  const startTripSessionFn = useServerFn(startTripSession);
  const endTripSessionFn = useServerFn(endTripSession);
  const addTripPointsFn = useServerFn(addTripPoints);
  const getActiveTripSessionFn = useServerFn(getActiveTripSession);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const trailLineRef = useRef<L.Polyline | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Driver / principal location + breadcrumb trail while moving
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [driverTrail, setDriverTrail] = useState<Array<[number, number]>>([]);
  const [trackingLocation, setTrackingLocation] = useState(false);
  const firstFixRef = useRef(false);
  const [locationError, setLocationError] = useState("");
  const [locatingStatus, setLocatingStatus] = useState("");
  const [settingDriverMode, setSettingDriverMode] = useState(false);
  const settingDriverModeRef = useRef(false);
  settingDriverModeRef.current = settingDriverMode;

  // ── Trip session (start → GPS shared with admin → end) ──────────────────
  const [activeTrip, setActiveTrip] = useState<TripSession | null>(null);
  const activeTripRef = useRef<TripSession | null>(null);
  activeTripRef.current = activeTrip;
  const [tripType, setTripType] = useState<"collection" | "dumping">("collection");
  const [tripSessionErr, setTripSessionErr] = useState("");
  const [tripSessionBusy, setTripSessionBusy] = useState(false);
  const [tripStartedAt, setTripStartedAt] = useState<number | null>(null);
  const [tripSavedPoints, setTripSavedPoints] = useState(0);
  const [tripPendingPoints, setTripPendingPoints] = useState(0);
  const pendingPointsRef = useRef<
    { lat: number; lng: number; accuracy: number | null; recorded_at: string }[]
  >([]);
  const flushingRef = useRef(false);
  const flushTripPointsRef = useRef<() => Promise<boolean>>(async () => true);
  const [durationSeconds, setDurationSeconds] = useState(0);

  // ── Live team locations from other workers (collectors etc.) ──────────────
  const [teamMembers, setTeamMembers] = useState<TeamMemberLocation[]>([]);
  const teamMemberMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  useTeamLocationSubscribe(userId ?? null, setTeamMembers);

  // Compute broadcaster's actual employee name and designation
  const activeEmployee = employees?.find(
    (e) =>
      e.id === activeEmployeeId ||
      (userEmail && e.name.toLowerCase().includes("nirajan")) ||
      (userEmail && userEmail.toLowerCase().includes("freefly")),
  );
  const broadcasterName =
    activeEmployee?.name ||
    (userEmail?.toLowerCase().includes("freefly")
      ? "nirajanemployee"
      : userEmail
        ? userEmail.split("@")[0]
        : "चालक");
  const broadcasterDesignation = activeEmployee?.designation || "चालक";

  // ── Broadcast this driver's live location to the dashboard map ──────────
  const broadcastToDashboard = useTeamLocationBroadcast({
    userId: userId ?? null,
    userEmail: userEmail ?? null,
    employeeId: activeEmployee?.id || activeEmployeeId || "driver",
    name: broadcasterName,
    designation: broadcasterDesignation,
    role: "driver",
    tripType: activeTrip?.trip_type,
    tripSessionId: activeTrip?.id,
    active: trackingLocation,
  });

  // Always keep dashboard updated whenever driver location updates (GPS, click or drag)
  useEffect(() => {
    if (driverLocation) {
      broadcastToDashboard(driverLocation.latitude, driverLocation.longitude);
    }
  }, [driverLocation, broadcastToDashboard]);

  // Resume an unfinished trip session after reload / returning to the tab
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const session = await getActiveTripSessionFn();
        if (!cancelled && session) {
          setActiveTrip(session);
          setTripType(session.trip_type);
          setTripStartedAt(new Date(session.started_at).getTime());
        }
      } catch {
        // migration not applied yet — ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Periodically flush buffered trip points (even when the trail barely moves)
  useEffect(() => {
    if (!activeTrip) return;
    const t = setInterval(() => {
      void flushTripPointsRef.current();
    }, 20000);
    return () => clearInterval(t);
  }, [activeTrip]);

  // Trip duration ticker
  useEffect(() => {
    if (!tripStartedAt) return;
    const t = setInterval(
      () => setDurationSeconds(Math.floor((Date.now() - tripStartedAt) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [tripStartedAt]);

  // ── Screen Wake Lock: keep the phone screen on while GPS tracking runs so
  // the browser never suspends the tab (which would kill live location sharing) ──
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    let released = !trackingLocation;
    const acquire = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: WakeLock };
        if (!released && wakeLockRef.current === null && nav.wakeLock) {
          wakeLockRef.current = await nav.wakeLock.request("screen");
          wakeLockRef.current.addEventListener("release", () => {
            wakeLockRef.current = null;
          });
        }
      } catch {
        // wake lock unsupported — trip still works without it
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && trackingLocation) {
        released = false;
        void acquire();
      }
    };
    if (trackingLocation) {
      released = false;
      void acquire();
      document.addEventListener("visibilitychange", onVisibility);
    } else {
      released = true;
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    }
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [trackingLocation]);

  // Local ward filter (allows viewing all wards or specific ward independently)
  const [selectedWard, setSelectedWard] = useState<string>("all");

  // Trips month: current BS month by default
  const today = todayBS();
  const [month, setMonth] = useState(Number(today.split("/")[1]) - 1);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithTrips | null>(null);
  const selectedCustomerRef = useRef(selectedCustomer);
  selectedCustomerRef.current = selectedCustomer;
  const [filterComplete, setFilterComplete] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [busyTrip, setBusyTrip] = useState(false);
  const [tripErr, setTripErr] = useState("");

  // ─── Map view controls: fullscreen & hide overlay boxes ───
  // Hidden-boxes preference is remembered for the browser session so switching
  // tabs or reloading doesn't bring the info boxes back.
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const [mapFull, setMapFull] = useState(false);
  const [hideBoxes, setHideBoxes] = useState(() => {
    try {
      return sessionStorage.getItem("hami_map_hide_boxes_v1") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("hami_map_hide_boxes_v1", hideBoxes ? "1" : "0");
    } catch {}
  }, [hideBoxes]);

  // While the map is fullscreen, lock the page scroll so tabs underneath
  // can't drift; restore when leaving.
  useEffect(() => {
    if (!mapFull) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mapFull]);

  const toggleMapFullscreen = () => {
    const el = mapWrapperRef.current;
    if (!el) return;
    if (mapFull) {
      // Exiting: close native fullscreen if active, clear the CSS fallback flag
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      setMapFull(false);
    } else if (el.requestFullscreen) {
      void el
        .requestFullscreen()
        .then(() => setMapFull(true))
        .catch(() => setMapFull(true)); // API blocked (e.g. preview iframe): CSS fallback
    } else {
      setMapFull(true); // Fullscreen API unavailable (e.g. iOS Safari): CSS fallback
    }
    if (mapRef.current) setTimeout(() => mapRef.current!.invalidateSize(), 350);
  };

  useEffect(() => {
    const onFsChange = () => setMapFull(Boolean(document.fullscreenElement));
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mapFull && !document.fullscreenElement) setMapFull(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("keydown", onEsc);
    };
  }, [mapFull]);

  const plans: PlanItem[] = query.data?.plans ?? [];
  const allPeople: Person[] = query.data?.people ?? [];
  const allTrips: TripLogEntry[] = query.data?.trips ?? [];

  // Trips logged for the selected fiscal year + BS month, keyed ward:card
  const { tripCount, lastTrip } = useMemo(() => {
    const count = new Map<string, number>();
    const recentKey = new Map<string, TripLogEntry>();
    for (const t of allTrips) {
      if (t.fiscal_year !== year || t.month !== month) continue;
      const key = `${t.ward}:${t.card}`;
      count.set(key, (count.get(key) ?? 0) + 1);
      if (!recentKey.has(key)) recentKey.set(key, t);
    }
    return { tripCount: count, lastTrip: recentKey };
  }, [allTrips, year, month]);

  const customers: CustomerWithTrips[] = useMemo(() => {
    return allPeople
      .filter((p) => selectedWard === "all" || p.ward === selectedWard)
      .map((person) => {
        const key = `${person.ward}:${person.card}`;
        const done = tripCount.get(key) ?? 0;
        const planned = plannedTripsForPerson(person, plans);
        const status = tripStatus(done, planned);
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
          planned,
          done,
          extra: Math.max(0, done - planned),
          color: status.color,
          statusLabel: status.label,
          complete: done >= planned,
          inProgress: done > 0 && done < planned,
          lastTrip: lastTrip.get(key) ?? null,
          displayLat: loc.lat,
          displayLng: loc.lng,
          isApproximateArea: loc.isApproximateArea,
          distanceFromDriver,
        };
      });
  }, [allPeople, selectedWard, tripCount, lastTrip, plans, driverLocation]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (filterComplete && c.complete) return false;
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
  }, [customers, filterComplete, searchQuery]);

  const stats = useMemo(() => {
    const red = customers.filter((c) => c.done === 0).length;
    const orange = customers.filter((c) => c.inProgress).length;
    const green = customers.filter((c) => c.complete).length;
    const plannedTotal = customers.reduce((s, c) => s + c.planned, 0);
    const doneTotal = customers.reduce((s, c) => s + c.done, 0);
    return { red, orange, green, plannedTotal, doneTotal };
  }, [customers]);

  // Initialize Leaflet map
  // NOTE: on first visit the container is not mounted yet (records still
  // loading), so re-run when the workspace query settles — map inits then.
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || mapRef.current) return;
    let resizeObserver: ResizeObserver | null = null;

    const map = L.map(el, {
      center: NEPAL_CENTER,
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Keep tiles correctly sized when layout changes (sidebar, fullscreen)
    resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    resizeObserver.observe(el);

    map.on("click", (e) => {
      if (settingDriverModeRef.current) {
        const lat = Number(e.latlng.lat.toFixed(7));
        const lng = Number(e.latlng.lng.toFixed(7));
        setDriverLocation({ latitude: lat, longitude: lng });
        setDriverTrail((prev) => [...prev, [lat, lng]]);
        setSettingDriverMode(false);
        setLocationError("");
        setLocatingStatus("प्रमुख चालकको स्थान नक्सामा तोकियो (Principal set on map).");
        setTimeout(() => setLocatingStatus(""), 4000);
      }
    });

    setTimeout(() => {
      if (mapRef.current) mapRef.current.flyTo(BIRENDRANAGAR_CENTER, 14, { duration: 1.8 });
    }, 500);

    return () => {
      resizeObserver?.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersLayerRef.current = null;
      teamMemberMarkersRef.current.clear();
    };
  }, [query.isPending, mapFull]);

  // Render live team members (other workers / collectors) on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const myKey = `${userId}:${activeEmployeeId ?? "driver"}`;
    const liveIds = new Set(teamMembers.map((m) => m.id || `${m.userId}:${m.role}`));
    for (const [id, marker] of teamMemberMarkersRef.current) {
      if (!liveIds.has(id)) {
        map.removeLayer(marker);
        teamMemberMarkersRef.current.delete(id);
      }
    }

    teamMembers.forEach((m) => {
      const markerId = m.id || `${m.userId}:${m.role}`;
      if (markerId === myKey) return; // own marker handled by driverMarkerRef

      const st = TEAM_ROLE_STYLE[m.role] ?? TEAM_ROLE_STYLE.other;
      const stale = Date.now() - m.updatedAt > 90_000;
      const badgeBg = stale ? "#94a3b8" : st.color;
      const label = m.designation ? `${m.name} (${m.designation})` : m.name || st.label;

      const icon = L.divIcon({
        className: "team-vehicle-icon",
        html: `
          <div style="position:relative; width:46px; height:42px; cursor:pointer;">
            ${
              !stale
                ? `<div style="position:absolute; inset:-6px; border-radius:12px; background:${st.color}; opacity:0.25; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>`
                : ""
            }
            <div style="
              width:46px; height:42px; border-radius:12px;
              background:#ffffff;
              border:3px solid ${badgeBg};
              box-shadow:0 4px 14px rgba(0,0,0,0.4);
              display:flex; align-items:center; justify-content:center;
              font-size:24px; line-height:1;
            ">${st.emoji}</div>
            <div style="
              position:absolute; bottom:-20px; left:50%; transform:translateX(-50%);
              background:${badgeBg}; color:#ffffff;
              font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;
              white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.3);
              max-width:140px; overflow:hidden; text-overflow:ellipsis;
            ">${label}</div>
          </div>`,
        iconSize: [46, 42],
        iconAnchor: [23, 21],
      });

      const tooltipHtml = `<b>${m.name}</b>${m.designation ? ` (${m.designation})` : ` (${st.label})`}<br/>
        <span style="font-size:10px;color:${stale ? "#d97706" : "#059669"};">
          ${stale ? "⚠️ पुरानो स्थान" : "🟢 लाइभ GPS सक्रिय"}</span>`;

      const existing = teamMemberMarkersRef.current.get(markerId);
      if (existing) {
        existing.setLatLng([m.lat, m.lng]);
        existing.setIcon(icon);
        existing.setTooltipContent(tooltipHtml);
      } else {
        const marker = L.marker([m.lat, m.lng], { icon, zIndexOffset: 2200 })
          .addTo(map)
          .bindTooltip(tooltipHtml, { direction: "top", offset: [0, -24] });
        teamMemberMarkersRef.current.set(markerId, marker);
      }
    });
  }, [teamMembers, userId, activeEmployeeId]);

  // Driver (principal) marker
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
      className: "principal-driver-icon",
      html: `
        <div style="position: relative; width: 44px; height: 44px; cursor: grab;">
          <div style="position: absolute; inset: 0; border-radius: 9999px; background-color: #2563eb; opacity: 0.3; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 44px; height: 44px; border-radius: 9999px; background-color: #1e40af; border: 3px solid #ffffff; box-shadow: 0 4px 14px rgba(37,99,235,0.6); display: flex; align-items: center; justify-content: center; font-size: 20px;">
            🛻
          </div>
          <div style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); background-color: #1e3a8a; color: #ffffff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
            ${broadcasterName} (${broadcasterDesignation})
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
        const lat = Number(ll.lat.toFixed(7));
        const lng = Number(ll.lng.toFixed(7));
        setDriverLocation({ latitude: lat, longitude: lng });
        setDriverTrail((prev) => [...prev, [lat, lng]]);
      });
      driverMarkerRef.current = marker;
    }
  }, [driverLocation]);

  // Driver GPS breadcrumb trail (the track covered on home trips)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (trailLineRef.current) {
      map.removeLayer(trailLineRef.current);
      trailLineRef.current = null;
    }

    if (driverTrail.length >= 2) {
      const line = L.polyline(driverTrail as L.LatLngExpression[], {
        color: "#7c3aed",
        weight: 3,
        opacity: 0.8,
        dashArray: "2, 6",
        lineCap: "round",
      }).addTo(map);
      line.bindTooltip(
        `<div style="font-size:11px; font-weight:700; color:#5b21b6; background:#f5f3ff; border:1.5px solid #a78bfa; padding:3px 8px; border-radius:6px; white-space:nowrap;">
          🛣️ चालकको यात्रा मार्ग (GPS track) — ${driverTrail.length} बिन्दु
        </div>`,
        { className: "driver-trail-tooltip" },
      );
      trailLineRef.current = line;
    }
  }, [driverTrail]);

  // Trip status bubbles (red = बाँकी, orange = जारी, green = पूरा)
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    filteredCustomers.forEach((c) => {
      const size = c.complete ? 20 : c.inProgress ? 26 : 30;
      const isSelected = selectedCustomer?.card === c.card && selectedCustomer?.ward === c.ward;
      const badge = c.complete
        ? c.extra > 0
          ? `✓+${np(c.extra)}`
          : "✓"
        : `${np(c.done)}/${np(c.planned)}`;
      const zIndex = isSelected
        ? 1000
        : c.complete
          ? c.extra > 0
            ? 150
            : 100
          : c.inProgress
            ? 200
            : 300;

      const bubbleIcon = L.divIcon({
        className: "trip-status-bubble-container",
        html: `
          <div style="position: relative; width: ${size}px; height: ${size}px; cursor: pointer; z-index: ${zIndex};">
            ${
              c.done === 0
                ? `<div style="position: absolute; inset: -4px; border-radius: 9999px; background-color: ${c.color}; opacity: 0.35; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
                : ""
            }
            <div style="
              width: ${size}px; height: ${size}px; border-radius: 9999px;
              background-color: ${c.color};
              border: ${isSelected ? "3px solid #2563eb" : c.isApproximateArea ? "2px dashed #fbbf24" : "2px solid #ffffff"};
              box-shadow: 0 4px 10px rgba(0,0,0,0.35);
              display: flex; align-items: center; justify-content: center;
              color: #ffffff; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-weight: 800; font-size: ${size >= 30 ? "10px" : "9px"}; letter-spacing: -0.5px;
            ">${badge}</div>
            ${
              natureEmoji(c.nature)
                ? `<span style="position: absolute; top: -6px; right: -6px; display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; font-size: 11px; line-height: 1; background-color: #ffffff; border: 1px solid #d4d4d8; border-radius: 9999px; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">${natureEmoji(c.nature)}</span>`
                : ""
            }
            ${
              c.isApproximateArea
                ? `<div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background-color: #78350f; color: #fef3c7; font-size: 8px; font-weight: bold; padding: 1px 4px; border-radius: 3px; white-space: nowrap;">वडा ${c.ward}</div>`
                : ""
            }
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([c.displayLat, c.displayLng], { icon: bubbleIcon });
      marker.on("click", () => handleSelectCustomer(c));
      marker.bindTooltip(
        `<b>${c.name}</b> (कार्ड: ${c.card})<br/>वडा ${c.ward}, ${c.tole}${c.isApproximateArea ? ' <span style="color:#d97706;font-weight:bold;">(वडा क्षेत्र)</span>' : ""}${c.nature ? `<br/>🏷️ व्यवसाय: ${natureEmoji(c.nature)} ${c.nature}` : ""}<br/>
        <span style="color:${c.color};font-weight:bold;">${c.statusLabel}: ${c.done}/${c.planned} ट्रिप${c.extra > 0 ? ` (अतिरिक्त ${np(c.extra)})` : ""}</span>${
          c.distanceFromDriver !== undefined
            ? `<br/><span style="color:#2563eb;font-weight:bold;">🚗 दुरी: ${formatDistance(c.distanceFromDriver)}</span>`
            : ""
        }`,
        { direction: "top", offset: [0, -size / 2 - 4] },
      );
      markersLayer.addLayer(marker);
    });
  }, [filteredCustomers, selectedCustomer]);

  // Route line principal → selected customer's home
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
        { color: "#2563eb", weight: 4, dashArray: "8, 8", opacity: 0.9 },
      ).addTo(map);

      line
        .bindTooltip(
          `<div style="font-size:11px; font-weight:800; color:#1e40af; background:#eff6ff; border:1.5px solid #60a5fa; padding:3px 8px; border-radius:6px; box-shadow:0 3px 8px rgba(37,99,235,0.25); white-space:nowrap;">
           🚗 घरको ट्रिप ट्रयाक: ${formatDistance(dist)} (${formatDrivingTime(dist)})
         </div>`,
          { permanent: true, direction: "center", className: "route-distance-tooltip" },
        )
        .openTooltip();

      routeLineRef.current = line;
    }
  }, [driverLocation, selectedCustomer]);

  // Driver location tracking with 3-stage fallback (same resilient pipeline as collection map)
  const flushTripPoints = async (): Promise<boolean> => {
    if (flushingRef.current) return false;
    const session = activeTripRef.current;
    const buffer = pendingPointsRef.current;
    if (!session || buffer.length === 0) return true;
    flushingRef.current = true;
    const points = buffer.splice(0, buffer.length);
    flushingRef.current = false;
    try {
      await addTripPointsFn({ data: { session_id: session.id, points } });
      setTripSavedPoints((n) => n + points.length);
      setTripPendingPoints(pendingPointsRef.current.length);
      return true;
    } catch (e) {
      // Put the points back so nothing is lost; retry happens on next fix/flush.
      pendingPointsRef.current = [...points, ...pendingPointsRef.current];
      setTripPendingPoints(pendingPointsRef.current.length);
      console.warn("Trip point flush failed:", e);
      return false;
    }
  };
  flushTripPointsRef.current = flushTripPoints;

  const toggleLocationTracking = () => {
    if (trackingLocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setTrackingLocation(false);
      setLocatingStatus("");
      firstFixRef.current = false;
      return;
    }

    if (!navigator.geolocation) {
      setLocationError(
        "तपाईंको ब्राउजरमा GPS लोकेसन सुविधा उपलब्ध छैन। 'नक्सामा प्रमुख राख्नुहोस्' प्रयोग गर्नुहोस्।",
      );
      return;
    }

    setLocationError("");
    setLocatingStatus("GPS लोकेसन खोज्दैछ...");
    setTrackingLocation(true);
    firstFixRef.current = false;
    setDriverTrail([]);

    const updatePos = (position: GeolocationPosition, msg = "") => {
      const lat = Number(position.coords.latitude.toFixed(7));
      const lng = Number(position.coords.longitude.toFixed(7));
      setDriverLocation({ latitude: lat, longitude: lng });

      // Broadcast to dashboard live map
      broadcastToDashboard(lat, lng);

      setDriverTrail((prev) => {
        const last = prev[prev.length - 1];
        if (last && Math.abs(last[0] - lat) < 0.000005 && Math.abs(last[1] - lng) < 0.000005)
          return prev;
        if (last && getDistanceInMeters(last[0], last[1], lat, lng) < 10) return prev;
        return [...prev.slice(-499), [lat, lng] as [number, number]];
      });

      // While a trip session is running, buffer every GPS fix so it can be
      // persisted and shown to admin later on the trip history.
      if (activeTripRef.current) {
        const buffer = pendingPointsRef.current;
        const lastPoint = buffer[buffer.length - 1];
        const accuracy = Number.isFinite(position.coords.accuracy)
          ? Number(position.coords.accuracy.toFixed(1))
          : null;
        if (lastPoint && getDistanceInMeters(lastPoint.lat, lastPoint.lng, lat, lng) < 5) {
          // Same spot — just extend the recording time so duration stays true
          lastPoint.recorded_at = new Date().toISOString();
        } else {
          buffer.push({ lat, lng, accuracy, recorded_at: new Date().toISOString() });
        }
        setTripPendingPoints(buffer.length);
        if (buffer.length >= 10) {
          void flushTripPoints();
        }
      }

      setLocatingStatus(msg || "✓ लोकेसन सक्रिय छ");

      // Center on the driver only on the first fix; later watch updates must not
      // keep dragging the map around while the driver moves or pans manually.
      const current = selectedCustomerRef.current;
      const map = mapRef.current;
      if (map && !firstFixRef.current && !current && !settingDriverModeRef.current) {
        firstFixRef.current = true;
        map.flyTo([lat, lng], 16, { duration: 1.2 });
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => updatePos(pos, "✓ GPS लोकेसन प्राप्त भयो"),
      () => {
        setLocatingStatus("सामान्य नेटवर्क GPS खोजिँदैछ...");
        navigator.geolocation.getCurrentPosition(
          (pos) => updatePos(pos, "✓ सामान्य GPS/नेटवर्क मार्फत स्थान प्राप्त भयो"),
          async () => {
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
                  setDriverTrail((prev) => [...prev, [lat, lng] as [number, number]]);
                  setLocatingStatus(
                    "✓ नेटवर्क आधारित स्थान प्राप्त (पिन तानेर स्थान मिलाउन सक्नुहुन्छ)",
                  );
                  const map = mapRef.current;
                  if (map && !firstFixRef.current) {
                    firstFixRef.current = true;
                    map.flyTo([lat, lng], 15, { duration: 1.2 });
                  }
                  return;
                }
              }
            } catch {
              // fall through
            }

            setTrackingLocation(false);
            setLocatingStatus("");
            setLocationError(
              "GPS समय समाप्त भयो। '📍 नक्सामा प्रमुख राख्नुहोस्' बटन थिचेर नक्सामा क्लिक गर्नुहोस्।",
            );
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 },
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => updatePos(pos),
      (err) => console.warn("Watch pos error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  };

  const handleStartTrip = async () => {
    setTripSessionErr("");
    if (!userId) {
      setTripSessionErr("ट्रिप सुरु गर्न पहिले साइन इन गर्नुहोस्।");
      return;
    }
    if (tripSessionBusy) return;
    setTripSessionBusy(true);
    try {
      const session = await startTripSessionFn({
        data: {
          trip_type: tripType,
          ward,
          fiscal_year: year ?? null,
          employee_id: activeEmployee?.id || activeEmployeeId || "",
          employee_name: broadcasterName,
        },
      });
      setActiveTrip(session);
      pendingPointsRef.current = [];
      setTripSavedPoints(0);
      setTripPendingPoints(0);
      setTripStartedAt(Date.now());
      setDurationSeconds(0);
      // Make sure GPS watch + live broadcast are running while on a trip
      if (!trackingLocation && !watchIdRef.current) toggleLocationTracking();
      setLocatingStatus(
        `✓ ट्रिप सुरु भयो (${session.trip_type === "dumping" ? "मल फाल्ने" : "संकलन"}) — लोकेसन प्रशासकलाई पठाइँदैछ`,
      );
    } catch (e) {
      setTripSessionErr(e instanceof Error ? e.message : "ट्रिप सुरु गर्न सकिएन।");
    } finally {
      setTripSessionBusy(false);
    }
  };

  const handleEndTrip = async () => {
    setTripSessionErr("");
    const session = activeTripRef.current;
    if (!session || tripSessionBusy) return;
    setTripSessionBusy(true);
    try {
      await flushTripPoints();
      const ended = await endTripSessionFn({ data: { session_id: session.id, end_note: "" } });
      const endedAt = ended.ended_at ? new Date(ended.ended_at).getTime() : Date.now();
      setLocatingStatus(
        `✓ ${tripSavedPoints} लोकेसन बिन्दु सुरक्षित गरियो — कुल समय: ${Math.max(1, Math.round((endedAt - (tripStartedAt ?? endedAt)) / 60000))} मिनेट`,
      );
      setActiveTrip(null);
      pendingPointsRef.current = [];
      setTripPendingPoints(0);
      setTripSavedPoints(0);
      setTripStartedAt(null);
      setDurationSeconds(0);
    } catch (e) {
      setTripSessionErr(e instanceof Error ? e.message : "ट्रिप समाप्त गर्न सकिएन।");
    } finally {
      setTripSessionBusy(false);
    }
  };

  const centerOnDriver = () => {
    if (driverLocation && mapRef.current)
      mapRef.current.flyTo([driverLocation.latitude, driverLocation.longitude], 17, {
        duration: 1,
      });
  };

  const handleSelectCustomer = (c: CustomerWithTrips) => {
    setSelectedCustomer(c);
    setTripErr("");
    const map = mapRef.current;
    if (!map) return;
    if (driverLocation) {
      map.fitBounds(
        [
          [driverLocation.latitude, driverLocation.longitude],
          [c.displayLat, c.displayLng],
        ],
        { padding: [70, 70], maxZoom: 16 },
      );
    } else {
      map.flyTo([c.displayLat, c.displayLng], 16, { duration: 1 });
    }
  };

  const handleOpenDirections = (c: CustomerWithTrips) => {
    const destLat = c.displayLat;
    const destLng = c.displayLng;
    if (
      typeof destLat !== "number" ||
      typeof destLng !== "number" ||
      isNaN(destLat) ||
      isNaN(destLng)
    )
      return;

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

  const handleMarkTrip = async (c: CustomerWithTrips) => {
    if (c.complete) {
      setTripErr(
        `तोकिएका सबै ${np(c.planned)} ट्रिप पूरा भएका छन्${c.done > c.planned ? ` (अतिरिक्त ${np(c.done - c.planned)})` : ""}। नयाँ ट्रिप दर्ता गर्न रद्द गरेर People Master मा योजना परिवर्तन गर्नुहोस्।`,
      );
      return;
    }
    setBusyTrip(true);
    setTripErr("");
    try {
      await logTripFn({ data: { ward: c.ward, card: c.card, fiscal_year: year, month, note: "" } });
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    } catch (e) {
      setTripErr(e instanceof Error ? e.message : "ट्रिप सेभ गर्न सकिएन।");
    } finally {
      setBusyTrip(false);
    }
  };

  const handleUndoTrip = async (c: CustomerWithTrips) => {
    if (!c.lastTrip?.id) return;
    setBusyTrip(true);
    setTripErr("");
    try {
      await deleteTripFn({ data: { id: c.lastTrip.id } });
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    } catch (e) {
      setTripErr(e instanceof Error ? e.message : "ट्रिप रद्द गर्न सकिएन।");
    } finally {
      setBusyTrip(false);
    }
  };

  return (
    <WorkspacePage title="ट्रिप तथा चालक नक्सा (Trips & Driver Map)">
      {/* Controls & stats bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <select
            aria-label="Trip month"
            className="rounded-md border bg-card px-2.5 py-1.5 text-xs font-bold"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((label, idx) => (
              <option key={idx} value={idx}>
                {label} {np(monthYearLabel(year, idx))}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-red-700 dark:text-red-300 font-bold">
            <span className="size-2 rounded-full bg-red-500 animate-pulse" />
            <span>सुरु हुन बाँकी: {stats.red}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-amber-700 dark:text-amber-300 font-bold">
            <span className="size-2 rounded-full bg-amber-500" />
            <span>जारी छ: {stats.orange}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-emerald-700 dark:text-emerald-300 font-bold">
            <CheckCircle2 className="size-3.5" />
            <span>पूरा: {stats.green}</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-muted-foreground font-semibold">
            <Truck className="size-3 text-primary" />
            <span>
              मासिक ट्रिप: {np(stats.doneTotal)}/{np(stats.plannedTotal)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Ward filter dropdown */}
          <select
            aria-label="Filter ward"
            className="h-8 rounded-md border bg-card px-2.5 text-xs font-bold text-foreground"
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
          >
            <option value="all">सबै वडा (All Wards)</option>
            {Array.from({ length: 16 }, (_, i) => String(i + 1)).map((w) => (
              <option key={w} value={w}>
                वडा नं. {w}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => query.refetch()}
            className="h-8 px-2.5 text-xs font-bold gap-1 text-primary hover:bg-primary/10"
            title="ग्राहक तथा ट्रिप विवरण ताजा गर्नुहोस् (Refresh)"
          >
            <RotateCw className="size-3.5" /> ताजा
          </Button>

          <Button
            type="button"
            size="sm"
            variant={trackingLocation ? "default" : "outline"}
            onClick={toggleLocationTracking}
            className={`gap-1.5 text-xs font-bold ${
              trackingLocation
                ? "bg-violet-600 hover:bg-violet-700 text-white shadow-[0_0_12px_rgba(124,58,237,0.4)]"
                : "border-violet-500/40 text-violet-700 hover:bg-violet-50 dark:text-violet-300"
            }`}
          >
            <LocateFixed className={`size-3.5 ${trackingLocation ? "animate-spin" : ""}`} />
            {trackingLocation ? "लोकेसन सक्रिय छ (GPS ON)" : "प्रमुख चालक GPS सुरु गर्नुहोस्"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant={settingDriverMode ? "secondary" : "outline"}
            onClick={() => {
              setSettingDriverMode(!settingDriverMode);
              if (!settingDriverMode) {
                setLocationError("");
                setLocatingStatus("👉 नक्सामा प्रमुख चालक / गाडी भएको ठाउँमा क्लिक गर्नुहोस्...");
              } else {
                setLocatingStatus("");
              }
            }}
            className={`h-8 text-xs gap-1 ${settingDriverMode ? "border-amber-500 bg-amber-50 text-amber-900 font-bold dark:bg-amber-950/50 dark:text-amber-200" : ""}`}
          >
            <MousePointer className="size-3.5" />
            {settingDriverMode ? "नक्सामा थिच्नुहोस्..." : "📍 नक्सामा प्रमुख राख्नुहोस्"}
          </Button>

          {driverLocation && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={centerOnDriver}
              className="h-8 text-xs gap-1 text-violet-600 border-violet-400/50 hover:bg-violet-50"
            >
              <Truck className="size-3.5" /> म भएको ठाउँ
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant={sidebarOpen ? "secondary" : "outline"}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 text-xs gap-1"
          >
            <Search className="size-3" /> ग्राहक सूची ({filteredCustomers.length})
          </Button>
        </div>
      </div>

      {/* Trip session panel: start GPS-tracked trip (collection / dumping) → end trip */}
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border-2 border-violet-500/30 bg-violet-500/5 p-2">
        <span className="text-xs font-extrabold text-violet-800 dark:text-violet-200">
          🛻 ट्रिप:
        </span>

        {!activeTrip ? (
          <>
            <div className="flex overflow-hidden rounded-md border border-violet-400/50 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTripType("collection")}
                className={`px-3 py-1.5 ${tripType === "collection" ? "bg-blue-600 text-white" : "bg-card text-blue-700 hover:bg-blue-50 dark:text-blue-300"}`}
              >
                🚚 संकलन (Collection)
              </button>
              <button
                type="button"
                onClick={() => setTripType("dumping")}
                className={`px-3 py-1.5 ${tripType === "dumping" ? "bg-amber-600 text-white" : "bg-card text-amber-700 hover:bg-amber-50 dark:text-amber-300"}`}
              >
                🗑️ मल फाल्ने (Dumping)
              </button>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={tripSessionBusy}
              onClick={handleStartTrip}
              className="h-8 px-4 text-xs font-extrabold bg-green-600 hover:bg-green-700 text-white"
            >
              {tripSessionBusy ? "सुरु हुँदैछ..." : "▶ ट्रिप सुरु गर्नुहोस् (Start Trip)"}
            </Button>
            <span className="text-[11px] text-muted-foreground">
              ट्रिप सुरु गर्दा GPS लोकेसन लाइभ प्रशासक (Admin) नक्सामा देखिन्छ र प्रत्येक बिन्दु
              सुरक्षित हुन्छ।
            </span>
          </>
        ) : (
          <>
            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-extrabold text-white">
              {activeTrip.trip_type === "dumping"
                ? "🗑️ मल फाल्ने (Dumping)"
                : "🚚 संकलन (Collection)"}
            </span>
            <span
              className="flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-extrabold text-white"
              title="लाइभ ट्रिप — स्थान प्रशासकलाई पठाइँदैछ"
            >
              <span className="inline-block size-2 animate-pulse rounded-full bg-white" />
              लाइभ ट्रिप चलिरहेको छ
            </span>
            <span
              className="text-[11px] font-bold text-violet-800 dark:text-violet-200"
              suppressHydrationWarning
            >
              ⏱️ {Math.floor(durationSeconds / 3600)}:
              {String(Math.floor((durationSeconds % 3600) / 60)).padStart(2, "0")}:
              {String(durationSeconds % 60).padStart(2, "0")} · बिन्दु: {tripSavedPoints} सुरक्षित
              {tripPendingPoints > 0 ? ` + ${tripPendingPoints}` : ""}
            </span>
            <Button
              type="button"
              size="sm"
              disabled={tripSessionBusy}
              onClick={handleEndTrip}
              className="h-8 px-4 text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {tripSessionBusy ? "बन्द हुँदैछ..." : "■ ट्रिप समाप्त गर्नुहोस् (End Trip)"}
            </Button>
          </>
        )}

        {tripSessionErr && (
          <span className="text-[11px] font-bold text-rose-600">{tripSessionErr}</span>
        )}
      </div>

      {locatingStatus && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-violet-500/10 border border-violet-500/20 p-2 text-xs text-violet-700 dark:text-violet-300 font-medium">
          <LocateFixed className="size-3.5 shrink-0 animate-spin text-violet-600" />
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
              setLocatingStatus("👉 नक्सामा प्रमुख चालक भएको ठाउँमा क्लिक गर्नुहोस्...");
            }}
          >
            नक्सामा थिच्नुहोस्
          </Button>
        </div>
      )}

      {/* Map area */}
      {/* leaflet-map-wrapper creates an isolated stacking context so Leaflet's
          internal z-indexes don't bleed above the sticky app navbar on mobile. */}
      <div
        ref={mapWrapperRef}
        className={`leaflet-map-wrapper relative w-full overflow-hidden rounded-xl border-2 border-border shadow-lg ${
          mapFull ? "map-fullscreen" : ""
        }`}
      >
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
            title={
              hideBoxes
                ? "बक्सहरू देखाउनुहोस् (Show info boxes)"
                : "नक्सामा बक्सहरू लुकाउनुहोस् (Hide boxes)"
            }
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

        {/* Trip legend */}
        {!hideBoxes && (
          <div className="absolute top-3 left-3 z-[1000] rounded-lg bg-card/95 backdrop-blur-md p-2.5 shadow-lg border border-border/80 text-[11px] max-w-[220px]">
            <div className="font-bold text-foreground mb-1.5 flex items-center gap-1">
              <Truck className="size-3.5 text-violet-600" />
              <span>मासिक ट्रिप अवस्था ({MONTHS[month]})</span>
            </div>
            <div className="space-y-1 text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-red-600 animate-pulse shrink-0" />
                <span>रातो: ट्रिप सुरु हुन बाँकी (0 सम्म)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-amber-500 shrink-0" />
                <span>
                  सुन्तला: ट्रिप जारी (जस्तै 1/3, ..., {stats.plannedTotal > 3 ? "7/8" : "2/3"})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-emerald-500 shrink-0" />
                <span>
                  हरियो: तोकिएका सबै पूरा (जस्तै {stats.plannedTotal > 3 ? `8/8, 12/12` : "3/3"}),
                  अतिरिक्त ट्रिप छ भने <b>✓ अतिरिक्त</b> देखाउँछ
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="size-5 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center shrink-0"
                  style={{ fontSize: "8px" }}
                >
                  🛻
                </span>
                <span>प्रमुख चालकको GPS ट्रयाक</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full border border-amber-500 bg-amber-100" />
                <span>पहेँलो किनारा: वडा क्षेत्र अनुमान</span>
              </div>
            </div>
          </div>
        )}

        {settingDriverMode && (
          <div className="absolute top-3 right-14 z-[1000] rounded-lg bg-amber-500 text-amber-950 font-bold text-xs px-3 py-1.5 shadow-xl animate-bounce flex items-center gap-1.5">
            <MousePointer className="size-4" />
            <span>नक्सामा जहाँ प्रमुख चालक छ, त्यहाँ क्लिक गर्नुहोस्</span>
          </div>
        )}

        {/* Selected customer panel */}
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
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ backgroundColor: selectedCustomer.color }}
                  >
                    {selectedCustomer.statusLabel} {selectedCustomer.done}/
                    {selectedCustomer.planned}
                    {selectedCustomer.extra > 0 ? ` (अतिरिक्त ${np(selectedCustomer.extra)})` : ""}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  वडा {selectedCustomer.ward}, टोल: {selectedCustomer.tole} • {MONTHS[month]}{" "}
                  {np(year)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Trip progress */}
            <div className="mb-3 rounded-lg bg-muted/60 p-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">मासिक ट्रिप प्रगति</span>
                <span className="font-mono" style={{ color: selectedCustomer.color }}>
                  {selectedCustomer.done} / {selectedCustomer.planned} ट्रिप
                </span>
              </div>
              <div className="mt-1.5 flex gap-1">
                {Array.from(
                  { length: Math.max(selectedCustomer.planned, selectedCustomer.done) },
                  (_, i) => {
                    const isExtra = i >= selectedCustomer.planned;
                    return (
                      <span
                        key={i}
                        className={`h-2.5 flex-1 rounded-full ${
                          i < selectedCustomer.done
                            ? isExtra
                              ? "bg-emerald-800"
                              : ""
                            : "bg-muted-foreground/20"
                        }`}
                        style={
                          i < selectedCustomer.done
                            ? { backgroundColor: isExtra ? undefined : selectedCustomer.color }
                            : undefined
                        }
                      />
                    );
                  },
                )}
              </div>
              {selectedCustomer.complete && (
                <p className="mt-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  ✓ तोकिएका सबै {np(selectedCustomer.planned)} ट्रिप पूरा भयो
                  {selectedCustomer.extra > 0
                    ? ` — अतिरिक्त ${np(selectedCustomer.extra)} ट्रिप गरिएको छ।`
                    : "।"}
                </p>
              )}
            </div>

            {tripErr && (
              <div className="mb-2 rounded-lg bg-destructive/10 border border-destructive/30 p-2 text-xs text-destructive font-medium">
                {tripErr}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
              {selectedCustomer.phone && (
                <a
                  href={`tel:${selectedCustomer.phone}`}
                  className="inline-flex h-9 items-center gap-1 rounded-md border bg-background px-3 text-xs font-semibold hover:bg-accent"
                  title="Phone customer"
                >
                  📞 फोन
                </a>
              )}

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

              <Button
                type="button"
                size="sm"
                onClick={() => void handleMarkTrip(selectedCustomer)}
                disabled={busyTrip || selectedCustomer.complete}
                className="h-9 gap-1.5 bg-emerald-600 font-extrabold text-white hover:bg-emerald-700 shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-emerald-600"
                title={
                  selectedCustomer.complete
                    ? "तोकिएका सबै ट्रिप पूरा भए — नयाँ ट्रिप दर्ता गर्न पछाडि योजना सच्याउनुहोस्"
                    : "यो घरको संकलन ट्रिप भएको दर्ता गर्नुहोस्"
                }
              >
                <Plus className="size-4" />
                {selectedCustomer.complete ? "सबै ट्रिप पूरा भयो (✓)" : "ट्रिप भयो (Mark trip)"}
              </Button>

              {selectedCustomer.lastTrip && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleUndoTrip(selectedCustomer)}
                  disabled={busyTrip}
                  className="h-9 gap-1 text-xs text-muted-foreground"
                  title={selectedCustomer.lastTrip.logged_at}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Customer list drawer */}
        {sidebarOpen && (
          <div className="absolute top-0 right-0 bottom-0 z-[1000] w-full sm:w-80 bg-card/95 backdrop-blur-md shadow-2xl border-l border-border flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-3 border-b flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">ग्राहक ट्रिप सूची</h4>
                <p className="text-[11px] text-muted-foreground">
                  {filteredCustomers.length} — {MONTHS[month]} {np(year)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>

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
              <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground">
                <input
                  type="checkbox"
                  checked={filterComplete}
                  onChange={(e) => setFilterComplete(e.target.checked)}
                  className="rounded border"
                />
                <span>बाँकी ट्रिप भएका मात्र</span>
              </label>
            </div>

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
                      className={`p-3 text-xs cursor-pointer transition-colors hover:bg-accent/60 ${isSelected ? "bg-primary/10 border-l-4 border-primary" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            <span>{c.name}</span>
                            <span title="निश्चित GPS पिन">
                              <MapPin className="size-3 text-emerald-600" />
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            कार्ड: <b>{c.card}</b> • वडा {c.ward}, {c.tole}
                          </div>
                        </div>
                        <span
                          className="rounded px-1.5 text-[10px] font-mono font-bold text-white py-0.5"
                          style={{ backgroundColor: c.color }}
                        >
                          {np(c.done)}/{np(c.planned)}
                        </span>
                      </div>
                      {c.distanceFromDriver !== undefined && (
                        <div className="mt-0.5 text-[10px] font-semibold text-violet-600">
                          {formatDistance(c.distanceFromDriver)} टाढा
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </WorkspacePage>
  );
}

/** BS month shown with its calendar year (fiscal Shrawan starts year, Baisakh is year+1). */
function monthYearLabel(fy: number, month: number): number {
  return month >= 3 ? fy : fy + 1;
}
