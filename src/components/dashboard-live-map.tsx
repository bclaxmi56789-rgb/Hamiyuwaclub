/**
 * DashboardLiveMap — real-time team location & customer tracking map for the dashboard.
 *
 * Shows:
 * 1. All registered customers/people pins on the map:
 *    - With their profession / business nature icon (emoji + badge)
 *    - Status color-coded:
 *      * Green: Driver completed planned trips OR Collector collected dues (dueAmount <= 0)
 *      * Orange/Yellow: Driver in-progress trip OR collector nearby / partial
 *      * Red: Incomplete / pending trip OR pending dues
 * 2. Active collectors (🚚) and drivers (🛻) broadcasting their real-time GPS locations
 *    from /collection-map and /trip-driver.
 * 3. Real-time proximity calculation:
 *    - When a driver or collector comes within reach (~50m) of a customer pin,
 *      or marks it completed, it dynamically updates / highlights green.
 * 4. Filters & Toggle options:
 *    - View by role (Driver view / Collector view / All)
 *    - Filter by Ward / Status (All / Pending Red / Completed Green)
 *    - Fullscreen & search
 */

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  TEAM_LOCATION_CHANNEL,
  useTeamLocationSubscribe,
  type TeamMemberLocation,
  type TeamMemberRole,
} from "@/lib/team-location";
import {
  getTripSessions,
  getTripSessionPoints,
  getLatestTravelledTripPoints,
  type TripSession,
  type TripPoint,
} from "@/lib/workspace.functions";
import { Button } from "@/components/ui/button";
import {
  LocateFixed,
  Radio,
  Users,
  MapPin,
  Navigation,
  AlertTriangle,
  Eye,
  CheckCircle2,
  Filter,
  Maximize2,
  Minimize2,
  Truck,
  Car,
  Search,
  Check,
  RotateCw,
} from "lucide-react";
import {
  BIRENDRANAGAR_CENTER,
  NEPAL_CENTER,
  getDistanceInMeters,
  formatDistance,
  resolveCustomerLocation,
} from "@/lib/geo";
import { natureEmoji, natureLabel } from "@/lib/nature";
import {
  np,
  tripStatus,
  plannedTripsForPerson,
  getDueMonths,
  mergeOpeningDues,
  getCustomerTotalRate,
  type Person,
  type PlanItem,
  type TripLogEntry,
  type Receipt,
} from "@/lib/receipt-rules";

/** Role → emoji + color */
const ROLE_META: Record<TeamMemberRole, { emoji: string; color: string; label: string }> = {
  collector: { emoji: "🚚", color: "#2563eb", label: "संकलक" },
  driver: { emoji: "🛻", color: "#7c3aed", label: "चालक" },
  admin: { emoji: "🏢", color: "#059669", label: "प्रशासक" },
  other: { emoji: "👤", color: "#64748b", label: "अन्य" },
};

const tripDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

const tripDurationText = (s: TripSession) => {
  const from = new Date(s.started_at).getTime();
  const to = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
  const mins = Math.max(0, Math.round((to - from) / 60000));
  return `${Math.floor(mins / 60)} घण्टा ${mins % 60} मिनेट`;
};

interface CustomerMapPin extends Person {
  displayLat: number;
  displayLng: number;
  isApproximateArea: boolean;
  plannedTrips: number;
  doneTrips: number;
  isTripComplete: boolean;
  dueAmount: number;
  isDuePaid: boolean;
  // Dynamic flags
  isNearCollector: boolean;
  isNearDriver: boolean;
  nearestWorkerDistance?: number;
}

interface Props {
  userId: string | null;
  userName: string;
  people: Person[];
  trips: TripLogEntry[];
  receipts: Receipt[];
  plans?: PlanItem[];
  selectedWard?: string;
  currentYear?: number;
  currentMonth?: number; // 0-indexed BS month
  onRefresh?: () => void;
}

export function DashboardLiveMap({
  userId,
  userName,
  people = [],
  trips = [],
  receipts = [],
  plans = [],
  selectedWard,
  currentYear = 2081,
  currentMonth = 0,
  onRefresh,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapWrapperRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const teamMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const peopleMarkersLayerRef = useRef<L.LayerGroup | null>(null);

  const [members, setMembers] = useState<TeamMemberLocation[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "driver" | "collector">("all");

  // ── Trip history (saved trip sessions per employee) ────────────────────
  const getTripSessionsFn = useServerFn(getTripSessions);
  const getTripSessionPointsFn = useServerFn(getTripSessionPoints);
  const [tripSessions, setTripSessions] = useState<TripSession[]>([]);
  const [tripSessionsLoaded, setTripSessionsLoaded] = useState(false);
  const [tripHistoryOpen, setTripHistoryOpen] = useState(false);
  const [tripEmployeeFilter, setTripEmployeeFilter] = useState<string>("all");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [tripTrail, setTripTrail] = useState<TripPoint[]>([]);
  const [tripTrailLoading, setTripTrailLoading] = useState(false);
  const tripTrailLayerRef = useRef<L.LayerGroup | null>(null);
  const lastKnownLayerRef = useRef<L.LayerGroup | null>(null);

  // Poll saved trip sessions every 30s so the LIVE badge and list stay fresh,
  // and show a "last known position" pin for any unfinished trip whose driver
  // dropped off the live presence channel (phone locked / app switched).
  const getLatestTravelledTripPointsFn = useServerFn(getLatestTravelledTripPoints);
  const [lastKnownPoints, setLastKnownPoints] = useState<Record<string, TripPoint | null>>({});
  useEffect(() => {
    const poll = async () => {
      if (document.hidden) return;
      try {
        const data = await getTripSessionsFn({ data: {} });
        setTripSessions(data.sessions);
        setTripSessionsLoaded(true);
        const latest = await getLatestTravelledTripPointsFn();
        setLastKnownPoints(latest);
      } catch {
        // migration 0039 not applied yet — nothing to show
      }
    };
    void poll();
    const t = setInterval(poll, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Draw last-known-position pins for live trips not currently on presence
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (lastKnownLayerRef.current) {
      lastKnownLayerRef.current.clearLayers();
      lastKnownLayerRef.current = null;
    }

    const liveEmployeeIds = new Set(
      members.map((m) => m.employeeId).filter((v): v is string => Boolean(v)),
    );
    const layer = L.layerGroup().addTo(map);
    lastKnownLayerRef.current = layer;
    tripSessions
      .filter((s) => s.status === "active" && !liveEmployeeIds.has(s.employee_id || ""))
      .forEach((s) => {
        const p = lastKnownPoints[s.id];
        if (!p) return;
        L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="
              position:relative; width:40px; height:40px; border-radius:9999px;
              background:${s.trip_type === "dumping" ? "#d97706" : "#7c3aed"}; color:#fff;
              display:flex; align-items:center; justify-content:center; font-size:17px;
              border:3px solid #ffffff; box-shadow:0 3px 10px rgba(0,0,0,0.4);
            ">🛻
              <div style="
                position:absolute; top:-6px; right:-4px; width:14px; height:14px; border-radius:9999px;
                background:#d97706; border:2px solid #ffffff;"></div>
            </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          }),
          zIndexOffset: 2000,
        })
          .bindTooltip(
            `<b>${s.employee_name || "चालक"}${s.trip_type === "dumping" ? " — 🗑️ मल फाल्ने" : " — 🚚 संकलन"}</b><br/>
             <span style="font-size:10px; color:#d97706;">⚠️ अन्तिम थाहा (फोन अफ्लाइन) — ${p.recorded_at ? new Date(p.recorded_at).toLocaleTimeString("en-GB", { hour12: true }) : ""}</span><br/>
             <span style="font-size:9px; color:#64748b;">फोन अनलक हुनेबित्तिकै लाइभ स्थान आउँछ</span>`,
            { direction: "top", offset: [0, -24] },
          )
          .addTo(layer);
      });
    if (layer.getLayers().length === 0) {
      map.removeLayer(layer);
      lastKnownLayerRef.current = null;
    }
  }, [tripSessions, lastKnownPoints, members]);

  // Load saved trip sessions (per-employee trips) once
  useEffect(() => {
    if (!userId || tripSessionsLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getTripSessionsFn({ data: {} });
        if (!cancelled) {
          setTripSessions(data.sessions);
          setTripSessionsLoaded(true);
        }
      } catch {
        // migration 0039 not applied yet — nothing to show
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tripSessionsLoaded]);

  // Load the selected trip's GPS points and draw the green start marker +
  // red dotted travelled path on the map
  const showTripOnMap = async (session: TripSession) => {
    const map = mapRef.current;
    if (!map) return;
    if (selectedTripId === session.id) {
      // Toggle off
      tripTrailLayerRef.current?.clearLayers();
      tripTrailLayerRef.current = null;
      setSelectedTripId(null);
      setTripTrail([]);
      return;
    }
    setSelectedTripId(session.id);
    setTripTrailLoading(true);
    try {
      const points = await getTripSessionPointsFn({ data: { session_id: session.id } });
      setTripTrail(points);
      if (tripTrailLayerRef.current) {
        tripTrailLayerRef.current.clearLayers();
      }
      const layer = L.layerGroup().addTo(map);
      tripTrailLayerRef.current = layer;

      const start = points[0];
      if (points.length > 0 && start) {
        // Trip start point (green flag pin)
        L.marker([start.lat, start.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="
              display:flex; align-items:center; justify-content:center;
              width:30px; height:30px; border-radius:9999px;
              background:#059669; color:#fff; font-size:15px;
              border:3px solid #ffffff; box-shadow:0 3px 10px rgba(5,150,105,0.5);
            ">🚩</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
          zIndexOffset: 3000,
        })
          .bindTooltip(
            `<b>ट्रिप सुरु.${new Date(session.started_at).toLocaleString("en-GB", { hour12: true })}</b>`,
            { direction: "top", offset: [0, -20] },
          )
          .addTo(layer);

        // Travelled path: red dot-dot-dot dotted line + small red dots
        const line = L.polyline(
          points.map((p) => [p.lat, p.lng] as [number, number]),
          { color: "#dc2626", weight: 3, opacity: 0.95, dashArray: "1 8", lineCap: "round" },
        ).addTo(layer);
        for (let i = 1; i < points.length; i += 3) {
          const p = points[i];
          if (!p) continue;
          L.circleMarker([p.lat, p.lng], {
            radius: 3,
            color: "#dc2626",
            weight: 1,
            fillColor: "#dc2626",
            fillOpacity: 0.85,
          }).addTo(layer);
        }
        line.bindTooltip(
          `<b>${session.employee_name || "चालक"}</b> — ${session.trip_type === "dumping" ? "🗑️ मल फाल्ने" : "🚚 संकलन"} ट्रिप ट्रयाक (${points.length} बिन्दु)`,
          { direction: "center" },
        );
        map.fitBounds(line.getBounds(), { padding: [60, 60], maxZoom: 17 });
      }
    } catch {
      // points not available
    } finally {
      setTripTrailLoading(false);
    }
  };

  // Clear trail when leaving fullscreen/unmount
  useEffect(() => {
    return () => {
      tripTrailLayerRef.current?.clearLayers();
      tripTrailLayerRef.current = null;
    };
  }, []);

  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "done">("all");
  const [wardFilter, setWardFilter] = useState<string>(selectedWard || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<CustomerMapPin | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [legendOpenLeft, setLegendOpenLeft] = useState(false);

  // Proximity threshold to consider driver/collector "reaching that place" (meters)
  const REACHED_THRESHOLD_METERS = 75;

  // 1. Process customer map data with trips and dues
  const customersWithStatus: CustomerMapPin[] = useMemo(() => {
    // Trips keyed by ward:card for the active year and month
    const tripCounts = new Map<string, number>();
    for (const t of trips) {
      if (t.fiscal_year === currentYear && t.month === currentMonth) {
        const k = `${t.ward}:${t.card}`;
        tripCounts.set(k, (tripCounts.get(k) ?? 0) + 1);
      }
    }

    // Collector paid dues
    const activePlans = plans;

    return people
      .filter((p) => wardFilter === "all" || p.ward === wardFilter)
      .map((p) => {
        const loc = resolveCustomerLocation(p);
        const k = `${p.ward}:${p.card}`;
        const doneTrips = tripCounts.get(k) ?? 0;
        const plannedTrips = plannedTripsForPerson(p, activePlans);
        const isTripComplete = doneTrips >= plannedTrips;

        // Dues computation
        const customerPaidSet = new Set(
          receipts
            .filter((r) => r.ward === p.ward && r.card.toLowerCase() === p.card.toLowerCase())
            .flatMap((r) => r.months.map((m) => `${m.year ?? r.year}:${m.m}`)),
        );
        const autoDues = p.joining_date ? getDueMonths(p.joining_date, customerPaidSet) : [];
        const dueMonths = mergeOpeningDues(autoDues, p.opening_dues, customerPaidSet);
        const monthlyFee = getCustomerTotalRate(p, activePlans);
        const dueAmount = dueMonths.reduce((s, dm) => s + (dm.amount ?? monthlyFee), 0);
        const isDuePaid = dueAmount <= 0;

        // Proximity detection with live active members
        let isNearCollector = false;
        let isNearDriver = false;
        let minDistance: number | undefined = undefined;

        for (const m of members) {
          const dist = getDistanceInMeters(m.lat, m.lng, loc.lat, loc.lng);
          if (minDistance === undefined || dist < minDistance) {
            minDistance = dist;
          }
          if (dist <= REACHED_THRESHOLD_METERS) {
            if (m.role === "collector") isNearCollector = true;
            if (m.role === "driver") isNearDriver = true;
          }
        }

        return {
          ...p,
          displayLat: loc.lat,
          displayLng: loc.lng,
          isApproximateArea: loc.isApproximateArea,
          plannedTrips,
          doneTrips,
          isTripComplete,
          dueAmount,
          isDuePaid,
          isNearCollector,
          isNearDriver,
          nearestWorkerDistance: minDistance,
        };
      });
  }, [people, trips, receipts, plans, selectedWard, currentYear, currentMonth, members]);

  // Filtered customers for map display
  const filteredCustomers = useMemo(() => {
    return customersWithStatus.filter((c) => {
      // Role-based status evaluation:
      // In Driver view: check trip progress
      // In Collector view: check dues payment
      // In All view: green if either trip complete OR dues paid OR worker reached
      const isGreen =
        activeTab === "driver"
          ? c.isTripComplete || c.isNearDriver
          : activeTab === "collector"
            ? c.isDuePaid || c.isNearCollector
            : c.isTripComplete || c.isDuePaid || c.isNearDriver || c.isNearCollector;

      if (filterStatus === "done" && !isGreen) return false;
      if (filterStatus === "pending" && isGreen) return false;

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
  }, [customersWithStatus, activeTab, filterStatus, searchQuery]);

  // 2. Leaflet map initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: NEPAL_CENTER,
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    peopleMarkersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.flyTo(BIRENDRANAGAR_CENTER, 14, { duration: 1.5 });
      }
    }, 500);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 3. Render and update team members (Collectors & Drivers)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const liveIds = new Set(members.map((m) => m.id || `${m.userId}:${m.role}`));
    for (const [id, marker] of teamMarkersRef.current) {
      if (!liveIds.has(id)) {
        map.removeLayer(marker);
        teamMarkersRef.current.delete(id);
      }
    }

    members.forEach((m) => {
      const meta = ROLE_META[m.role] ?? ROLE_META.other;
      const markerId = m.id || `${m.userId}:${m.role}`;
      const stale = Date.now() - m.updatedAt > 90_000;
      const displayName = m.designation ? `${m.name} (${m.designation})` : m.name;

      const icon = L.divIcon({
        className: "team-member-icon",
        html: `
          <div style="position:relative; width:44px; height:44px; cursor:pointer;">
            ${
              !stale
                ? `<div style="position:absolute; inset:-6px; border-radius:9999px; background:${meta.color}; opacity:0.25; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>`
                : ""
            }
            <div style="
              width:44px; height:44px; border-radius:9999px;
              background:${stale ? "#94a3b8" : meta.color};
              border:3px solid #ffffff;
              box-shadow:0 4px 14px rgba(0,0,0,0.4);
              display:flex; align-items:center; justify-content:center;
              font-size:20px;
            ">${meta.emoji}</div>
            <div style="
              position:absolute; bottom:-22px; left:50%; transform:translateX(-50%);
              background:${stale ? "#64748b" : meta.color}; color:#ffffff;
              font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;
              white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.3); max-width:140px; overflow:hidden; text-overflow:ellipsis;
            ">${displayName}</div>
          </div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const tooltipContent = `<b>${m.name}</b>${m.designation ? ` (${m.designation})` : ` (${meta.label})`}<br/>
        ${
          m.tripType
            ? `<span style="font-size:10px;font-weight:800;color:#ffffff;background:${m.tripType === "dumping" ? "#d97706" : "#2563eb"};padding:1px 6px;border-radius:3px;">
                ${m.tripType === "dumping" ? "🗑️ मल फाल्ने ट्रिप (Dumping)" : "🚚 संकलन ट्रिप (Collection)"}
               </span><br/>`
            : ""
        }
        <span style="font-size:10px;color:${stale ? "#d97706" : "#059669"};">
          ${stale ? "⚠️ पुरानो स्थान" : "🟢 लाइभ GPS सक्रिय"}</span>`;

      const existing = teamMarkersRef.current.get(markerId);
      if (existing) {
        existing.setLatLng([m.lat, m.lng]);
        existing.setIcon(icon);
        existing.setTooltipContent(tooltipContent);
      } else {
        const marker = L.marker([m.lat, m.lng], { icon, zIndexOffset: 2500 })
          .addTo(map)
          .bindTooltip(tooltipContent, { direction: "top", offset: [0, -26] });
        teamMarkersRef.current.set(markerId, marker);
      }
    });
  }, [members, userId]);

  // 4. Render customer pins with profession, turning GREEN on task reach / completion
  useEffect(() => {
    const map = mapRef.current;
    const layer = peopleMarkersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    filteredCustomers.forEach((c) => {
      const emoji = natureEmoji(c.nature) || "👤";
      const isSelected = selectedPerson?.card === c.card && selectedPerson?.ward === c.ward;

      // Determine Green conversion:
      // - Driver perspective: Trip complete OR driver is physically at the location (<75m)
      // - Collector perspective: Dues paid OR collector is physically at the location (<75m)
      // - Combined view: either satisfied
      let isGreen = false;
      let statusText = "";

      if (activeTab === "driver") {
        isGreen = c.isTripComplete || c.isNearDriver;
        statusText = c.isNearDriver
          ? "चालक पुग्यो (Reached)"
          : c.isTripComplete
            ? "ट्रिप पूरा (Done)"
            : `ट्रिप बाँकी (${c.doneTrips}/${c.plannedTrips})`;
      } else if (activeTab === "collector") {
        isGreen = c.isDuePaid || c.isNearCollector;
        statusText = c.isNearCollector
          ? "संकलक पुग्यो (Reached)"
          : c.isDuePaid
            ? "चुक्ता (Paid)"
            : `बाँकी: रु. ${c.dueAmount.toLocaleString("en-IN")}`;
      } else {
        isGreen = c.isTripComplete || c.isDuePaid || c.isNearDriver || c.isNearCollector;
        if (c.isNearDriver || c.isNearCollector) {
          statusText = "टोली पुग्यो (Team Reached)";
        } else if (c.isTripComplete && c.isDuePaid) {
          statusText = "सबै पूरा (Completed)";
        } else if (c.isTripComplete) {
          statusText = "ट्रिप पूरा";
        } else if (c.isDuePaid) {
          statusText = "रकम चुक्ता";
        } else {
          statusText = "बाँकी (Pending)";
        }
      }

      const bgColor = isGreen ? "#10b981" : "#ef4444"; // Green or Red
      const size = isSelected ? 38 : isGreen ? 30 : 34;
      const zIndex = isSelected ? 2000 : isGreen ? 200 : 500;

      const pinIcon = L.divIcon({
        className: "customer-person-pin",
        html: `
          <div style="position: relative; width: ${size}px; height: ${size}px; cursor: pointer; z-index: ${zIndex};">
            ${
              !isGreen
                ? `<div style="position: absolute; inset: -4px; border-radius: 9999px; background-color: ${bgColor}; opacity: 0.3; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
                : ""
            }
            <div style="
              width: ${size}px; height: ${size}px; border-radius: 9999px;
              background-color: ${bgColor};
              border: ${isSelected ? "3px solid #1d4ed8" : c.isApproximateArea ? "2px dashed #fbbf24" : "2.5px solid #ffffff"};
              box-shadow: 0 4px 10px rgba(0,0,0,0.35);
              display: flex; align-items: center; justify-content: center;
              font-size: ${size >= 36 ? "18px" : "15px"};
              color: #ffffff;
            ">
              ${emoji}
            </div>
            ${
              isGreen
                ? `<span style="position: absolute; bottom: -3px; right: -3px; display: flex; align-items: center; justify-content: center; width: 15px; height: 15px; background: #047857; color: #ffffff; border: 1.5px solid #ffffff; border-radius: 9999px; font-size: 10px; font-weight: 900;">✓</span>`
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

      const marker = L.marker([c.displayLat, c.displayLng], { icon: pinIcon });
      marker.on("click", () => {
        setSelectedPerson(c);
        if (mapRef.current) {
          mapRef.current.flyTo([c.displayLat, c.displayLng], 16, { duration: 0.8 });
        }
      });

      marker.bindTooltip(
        `<b>${emoji} ${c.name}</b> (कार्ड: ${c.card})<br/>
         💼 पेसा/व्यवसाय: <b>${natureLabel(c.nature) || "घरायसी / अन्य"}</b><br/>
         वडा ${c.ward}, ${c.tole}${c.isApproximateArea ? ' <span style="color:#d97706;font-weight:bold;">(वडा क्षेत्र)</span>' : ""}<br/>
         <span style="color:${isGreen ? "#059669" : "#dc2626"}; font-weight:bold;">
           ${isGreen ? "🟢 " : "🔴 "}${statusText}
         </span>
         ${
           c.nearestWorkerDistance !== undefined
             ? `<br/><span style="color:#2563eb;font-size:10px;">📍 नजिकको सवारी: ${formatDistance(c.nearestWorkerDistance)}</span>`
             : ""
         }`,
        { direction: "top", offset: [0, -size / 2 - 4] },
      );

      layer.addLayer(marker);
    });
  }, [filteredCustomers, selectedPerson, activeTab]);

  // 5. Subscribe to Supabase Realtime channel for live team members
  useTeamLocationSubscribe(userId ?? null, setMembers);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    const el = mapWrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    } else if (el.requestFullscreen) {
      void el
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => setIsFullscreen(true));
    } else {
      setIsFullscreen(!isFullscreen);
    }
    if (mapRef.current) setTimeout(() => mapRef.current!.invalidateSize(), 300);
  };

  const totalPeopleCount = customersWithStatus.length;
  const greenCount = customersWithStatus.filter((c) =>
    activeTab === "driver"
      ? c.isTripComplete || c.isNearDriver
      : activeTab === "collector"
        ? c.isDuePaid || c.isNearCollector
        : c.isTripComplete || c.isDuePaid || c.isNearDriver || c.isNearCollector,
  ).length;
  const pendingCount = totalPeopleCount - greenCount;

  const collectorCount = members.filter((m) => m.role === "collector").length;
  const driverCount = members.filter((m) => m.role === "driver").length;

  return (
    <div
      ref={mapWrapperRef}
      className={`rounded-xl border bg-card shadow-xs overflow-hidden transition-all ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none border-none h-screen w-screen" : ""
      }`}
    >
      {/* ── Top Header & Tab Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-emerald-600 animate-pulse" />
          <div>
            <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
              नक्सा: ग्राहक पेसा/व्यवसाय तथा लाइभ चालक/संकलक
            </h3>
            <p className="text-[11px] text-muted-foreground">
              चालक वा संकलक पुग्दा वा कार्य सम्पन्न हुँदा पिन हरियो (🟢) मा परिवर्तन हुन्छ
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Broadcast Indicators */}
          {collectorCount > 0 && (
            <button
              type="button"
              onClick={() => {
                const c = members.find((m) => m.role === "collector");
                if (c && mapRef.current) mapRef.current.flyTo([c.lat, c.lng], 16, { duration: 1 });
              }}
              className="flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors cursor-pointer"
              title="संकलक भएको ठाउँमा नक्सा लैजानुहोस्"
            >
              🚚 {collectorCount} संकलक लाइभ
            </button>
          )}
          {driverCount > 0 && (
            <button
              type="button"
              onClick={() => {
                const d = members.find((m) => m.role === "driver");
                if (d && mapRef.current) mapRef.current.flyTo([d.lat, d.lng], 16, { duration: 1 });
              }}
              className="flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 transition-colors cursor-pointer animate-pulse"
              title="चालक भएको ठाउँमा नक्सा लैजानुहोस्"
            >
              🛻 {driverCount} चालक लाइभ
            </button>
          )}

          {/* Perspective Selector (Driver / Collector / All) */}
          <div className="flex rounded-lg border bg-muted p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                activeTab === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              सबै दृश्य
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("driver")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                activeTab === "driver"
                  ? "bg-background text-violet-700 dark:text-violet-300 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Truck className="size-3" /> चालक (Trips)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("collector")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                activeTab === "collector"
                  ? "bg-background text-blue-700 dark:text-blue-300 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Car className="size-3" /> संकलक (Dues)
            </button>
          </div>

          {/* Ward Filter */}
          <select
            aria-label="Filter ward"
            className="h-8 rounded-md border bg-background px-2 text-xs font-bold text-foreground"
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
          >
            <option value="all">सबै वडा (All Wards)</option>
            {Array.from({ length: 16 }, (_, i) => String(i + 1)).map((w) => (
              <option key={w} value={w}>
                वडा नं. {w}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            aria-label="Filter status"
            className="h-8 rounded-md border bg-background px-2 text-xs font-bold text-foreground"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">सबै अवस्था ({totalPeopleCount})</option>
            <option value="done">🟢 हरियो / पुगेको ({greenCount})</option>
            <option value="pending">🔴 रातो / बाँकी ({pendingCount})</option>
          </select>

          {/* Refresh Button */}
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="h-8 px-2.5 text-xs font-bold gap-1 text-primary hover:bg-primary/10"
              title="नक्सा तथा ग्राहक विवरण ताजा गर्नुहोस् (Refresh)"
            >
              <RotateCw className="size-3.5" /> ताजा
            </Button>
          )}

          {/* Fullscreen Toggle */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 px-2.5"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
        </div>
      </div>

      {/* ── Search & Metrics Strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="नाम, कार्ड, टोल, पेसा खोज्नुहोस्..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-full rounded-md border bg-background pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-bold">
          <div className="flex items-center gap-1.5 text-emerald-600">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>सम्पन्न/पुगेको: {greenCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-red-600">
            <span className="size-2 rounded-full bg-red-500 animate-pulse" />
            <span>बाँकी/नपुगेको: {pendingCount}</span>
          </div>
          <div className="text-muted-foreground">नक्सामा कुल: {filteredCustomers.length} जना</div>
        </div>
      </div>

      {/* ── Trip History Panel (saved per-employee trips) ── */}
      <div className="border-b bg-violet-500/5 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTripHistoryOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-card px-2.5 py-1 text-xs font-bold text-violet-700 dark:text-violet-300 hover:bg-violet-500/10"
          >
            🛻 ट्रिप इतिहास (Trip History) ({tripSessions.length})
            {tripTrailLoading && (
              <span className="ml-1 inline-block size-2 animate-spin rounded-full border border-violet-500 border-t-transparent" />
            )}
            <span className="text-[10px]">{tripHistoryOpen ? "▲" : "▼"}</span>
          </button>

          {(() => {
            const employees = Array.from(new Set(tripSessions.map((s) => s.employee_name || "—")));
            return (
              employees.length > 1 && (
                <select
                  aria-label="Filter trips by employee"
                  className="h-7 rounded-md border bg-background px-2 text-xs font-bold"
                  value={tripEmployeeFilter}
                  onChange={(e) => setTripEmployeeFilter(e.target.value)}
                >
                  <option value="all">सबै कर्मचारी (All Employees)</option>
                  {employees.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )
            );
          })()}

          <button
            type="button"
            onClick={() => {
              setTripSessionsLoaded(false);
              setTripSessions([]);
            }}
            className="rounded-md border bg-card px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
            title="ट्रिप इतिहास ताजा गर्नुहोस्"
          >
            <RotateCw className="inline size-3" /> ताजा
          </button>

          {selectedTripId && (
            <span className="text-[11px] font-bold text-red-600">
              🔴 नक्सामा ट्रिप ट्रयाक देखाइँदैछ (सुरु 🚩 + रातो डट मार्ग)
            </span>
          )}
        </div>

        {tripHistoryOpen && (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border bg-card">
            {(() => {
              const filtered =
                tripEmployeeFilter === "all"
                  ? tripSessions
                  : tripSessions.filter((s) => (s.employee_name || "—") === tripEmployeeFilter);
              if (filtered.length === 0) {
                return (
                  <div className="p-3 text-xs text-muted-foreground">
                    {tripSessions.length === 0
                      ? "अझै कुनै ट्रिप सुरक्षित छैन। चालकले 'ट्रिप सुरु' गरेपछि प्रत्येक ट्रिप यहाँ इतिहासमा बचत हुन्छ।"
                      : "यो कर्मचारीको कुनै ट्रिप छैन।"}
                  </div>
                );
              }
              return (
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-muted/80 text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2.5 py-1.5">चालक (कर्मचारी)</th>
                      <th className="px-2.5 py-1.5">प्रकार</th>
                      <th className="px-2.5 py-1.5">सुरु मिति र समय</th>
                      <th className="px-2.5 py-1.5">समाप्ति मिति र समय</th>
                      <th className="px-2.5 py-1.5">अवधि</th>
                      <th className="px-2.5 py-1.5">वडा</th>
                      <th className="px-2.5 py-1.5 text-right">नक्सा</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr
                        key={s.id}
                        className={`border-t ${selectedTripId === s.id ? "bg-violet-500/10" : "hover:bg-muted/40"}`}
                      >
                        <td className="px-2.5 py-1.5 font-bold">
                          {s.employee_name || "—"}{" "}
                          {s.employee_id && (
                            <span className="font-mono text-[9px] text-muted-foreground">
                              ({s.employee_id})
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5">
                          {s.trip_type === "dumping" ? (
                            <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              🗑️ मल फाल्ने
                            </span>
                          ) : (
                            <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              🚚 संकलन
                            </span>
                          )}
                          {s.status === "active" && (
                            <span className="ml-1 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white animate-pulse">
                              लाइभ
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap">
                          ▶ {tripDateTime(s.started_at)}
                        </td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap">
                          {s.status === "ended" ? (
                            <>
                              <CheckCircle2 className="mr-0.5 inline size-3 text-emerald-600" />
                              {tripDateTime(s.ended_at)}
                            </>
                          ) : (
                            <span className="font-bold text-rose-600">
                              ⏳ चलिरहेको (अझै समाप्त भएन)
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap">{tripDurationText(s)}</td>
                        <td className="px-2.5 py-1.5">{s.ward || "—"}</td>
                        <td className="px-2.5 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => void showTripOnMap(s)}
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              selectedTripId === s.id
                                ? "bg-red-600 text-white"
                                : "bg-violet-600 text-white hover:bg-violet-700"
                            }`}
                            title="सुरु बिन्दु (🚩) र रातो डट डट मार्ग नक्सामा देखाउनुहोस्"
                          >
                            {selectedTripId === s.id ? "✕ लुकाउनुहोस्" : "🗺️ नक्सामा देखाउनुहोस्"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Leaflet Map Area ── */}
      <div
        className="leaflet-map-wrapper relative w-full"
        style={{ height: isFullscreen ? "calc(100vh - 90px)" : 420 }}
      >
        <div ref={mapContainerRef} className="h-full w-full bg-muted" />

        {/* Legend Overlay — collapsed by default, click to open */}
        {!legendOpenLeft && (
          <button
            type="button"
            onClick={() => setLegendOpenLeft(true)}
            className="absolute top-3 left-3 z-[800] rounded-full bg-card/95 backdrop-blur-md p-2 shadow-lg border border-border/80 text-foreground hover:bg-accent"
            title="नक्सा संकेत (Legend) देखाउनुहोस्"
          >
            <MapPin className="size-4 text-emerald-600" />
          </button>
        )}
        {legendOpenLeft && (
          <div className="absolute top-3 left-3 z-[800] rounded-lg bg-card/95 backdrop-blur-md p-2.5 pl-6 shadow-lg border border-border/80 text-[11px] max-w-[220px]">
            <button
              type="button"
              onClick={() => setLegendOpenLeft(false)}
              className="absolute top-1.5 left-1.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
              title="लुकाउनुहोस्"
            >
              ✕
            </button>
            <div className="font-bold text-foreground mb-1 flex items-center gap-1">
              <MapPin className="size-3.5 text-emerald-600" />
              <span>नक्सा संकेत (Legend)</span>
            </div>
            <div className="space-y-1 text-muted-foreground text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[8px] font-bold">
                  ✓
                </span>
                <span>हरियो: काम सम्पन्न वा सवारी पुग्यो</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-red-500" />
                <span>रातो: बाँकी वा सवारी पुग्न बाँकी</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1 border-t">
                <span>👤 🏨 🛒 💊</span>
                <span>पिन भित्रको आइकन: ग्राहकको पेसा/व्यवसाय</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>🚚 🛻</span>
                <span>गाडी आइकन: प्रत्यक्ष GPS स्थान</span>
              </div>
            </div>
          </div>
        )}

        {/* Live worker quick-jump overlay (always visible) */}
        <div className="absolute top-3 right-3 z-[820] flex flex-col gap-1.5 items-end">
          {(() => {
            const fmt = (role: TeamMemberRole, emoji: string, count: number) => {
              const active = count > 0;
              const first = members.find((m) => m.role === role);
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (first && mapRef.current)
                      mapRef.current.flyTo([first.lat, first.lng], 16, { duration: 1 });
                  }}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-extrabold shadow-lg border-2 cursor-pointer transition-all hover:scale-105"
                  style={
                    first
                      ? {
                          background: ROLE_META[role].color,
                          color: "#ffffff",
                          borderColor: "#ffffff",
                        }
                      : {
                          background: "#f1f5f9",
                          color: "#94a3b8",
                          borderColor: "#e2e8f0",
                        }
                  }
                  title={
                    active
                      ? "लाइभ कर्मचारी भएको ठाउँमा नक्सा लैजानुहोस् (Fly to worker)"
                      : "अझै कसैको लाइभ GPS छैन"
                  }
                  disabled={!active}
                >
                  {emoji} {role === "driver" ? "चालक" : "संकलक"} लाइभ: {count}
                </button>
              );
            };
            return (
              <>
                {fmt("driver", "🛻", members.filter((m) => m.role === "driver").length)}
                {fmt("collector", "🚚", members.filter((m) => m.role === "collector").length)}
              </>
            );
          })()}
        </div>

        {/* Selected Customer Floating Card */}
        {selectedPerson && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm z-[800] rounded-xl bg-card/95 backdrop-blur-md p-3.5 shadow-xl border-2 border-primary/50 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start justify-between gap-2 border-b pb-2 mb-2">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-base">{natureEmoji(selectedPerson.nature) || "👤"}</span>
                  <h4 className="font-extrabold text-sm text-foreground">{selectedPerson.name}</h4>
                  <span className="rounded bg-primary/10 border border-primary/30 px-1 py-0.2 font-mono text-[10px] font-bold text-primary">
                    कार्ड: {selectedPerson.card}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  💼 पेसा: <b>{natureLabel(selectedPerson.nature) || "घरायसी / अन्य"}</b> • वडा{" "}
                  {selectedPerson.ward}, {selectedPerson.tole}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPerson(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted/60 p-2">
                <span className="block text-[10px] text-muted-foreground">मासिक ट्रिप स्थिति</span>
                <span
                  className={`font-bold ${selectedPerson.isTripComplete ? "text-emerald-600" : "text-amber-600"}`}
                >
                  {selectedPerson.isTripComplete
                    ? "✓ पूरा भयो"
                    : `${selectedPerson.doneTrips}/${selectedPerson.plannedTrips} ट्रिप`}
                </span>
              </div>
              <div className="rounded-lg bg-muted/60 p-2">
                <span className="block text-[10px] text-muted-foreground">बक्यौता रकम</span>
                <span
                  className={`font-bold ${selectedPerson.isDuePaid ? "text-emerald-600" : "text-red-600"}`}
                >
                  {selectedPerson.isDuePaid
                    ? "✓ चुक्ता"
                    : `रु. ${selectedPerson.dueAmount.toLocaleString("en-IN")}`}
                </span>
              </div>
            </div>

            {selectedPerson.nearestWorkerDistance !== undefined && (
              <div className="mt-2 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                📍 नजिकको संकलक/चालक दुरी: {formatDistance(selectedPerson.nearestWorkerDistance)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer Info Strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          GPS सक्रिय हुँदा स्वतः प्रत्यक्ष ट्र्याक भई नजिक पुग्दा वा कार्य सम्पन्न हुँदा हरियो (🟢)
          हुन्छ
        </span>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span>चालक ट्रिप + संकलक बक्यौता लाइभ सिंक</span>
        </div>
      </div>
    </div>
  );
}
