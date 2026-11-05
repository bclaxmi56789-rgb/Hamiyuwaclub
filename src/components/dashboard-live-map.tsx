/**
 * DashboardLiveMap — real-time team location map for the dashboard.
 *
 * Subscribes to the shared Supabase Realtime Presence channel
 * "team-location-<projectId>" and shows every active collector/driver
 * who has enabled GPS on their Collection Map or Trip Driver page.
 *
 * Dashboard admins can ALSO optionally share their own location by
 * clicking the button — but the primary use-case is passive observation
 * of the collectors and drivers who are already broadcasting.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import {
  TEAM_LOCATION_CHANNEL,
  type TeamMemberLocation,
  type TeamMemberRole,
} from "@/lib/team-location";
import { Button } from "@/components/ui/button";
import { LocateFixed, Radio, Users, MapPin, Navigation, AlertTriangle, Eye } from "lucide-react";
import { BIRENDRANAGAR_CENTER, NEPAL_CENTER } from "@/lib/geo";

/** Role → emoji + color */
const ROLE_META: Record<TeamMemberRole, { emoji: string; color: string; label: string }> = {
  collector: { emoji: "🚚", color: "#2563eb", label: "संकलक" },
  driver: { emoji: "🛻", color: "#7c3aed", label: "चालक" },
  admin: { emoji: "🏢", color: "#059669", label: "प्रशासक" },
  other: { emoji: "👤", color: "#64748b", label: "अन्य" },
};

interface Props {
  userId: string | null;
  userName: string;
}

export function DashboardLiveMap({ userId, userName }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const [members, setMembers] = useState<TeamMemberLocation[]>([]);
  const [myRole, setMyRole] = useState<TeamMemberRole>("admin");
  const [sharing, setSharing] = useState(false);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [status, setStatus] = useState("");

  const watchIdRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── stable broadcast helper (tracks own position when sharing) ──────────
  const broadcastPos = useCallback(
    (lat: number, lng: number) => {
      if (!userId || !channelRef.current) return;
      void channelRef.current.track({
        userId,
        name: userName || `Member-${userId.slice(0, 6)}`,
        role: myRole,
        lat,
        lng,
        updatedAt: Date.now(),
      } satisfies TeamMemberLocation);
    },
    [userId, userName, myRole],
  );

  // ── Leaflet map initialisation ──────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: NEPAL_CENTER,
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    mapRef.current = map;

    setTimeout(() => {
      if (mapRef.current) mapRef.current.flyTo(BIRENDRANAGAR_CENTER, 13, { duration: 1.5 });
    }, 600);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // ── Redraw markers whenever member list changes ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove departed members
    const liveIds = new Set(members.map((m) => m.userId));
    for (const [id, marker] of markersRef.current) {
      if (!liveIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    // Add / move markers
    members.forEach((m) => {
      const meta = ROLE_META[m.role] ?? ROLE_META.other;
      const isMe = m.userId === userId;
      const stale = Date.now() - m.updatedAt > 90_000; // grey if >90 s old

      const icon = L.divIcon({
        className: "team-member-icon",
        html: `
          <div style="position:relative;width:42px;height:42px;">
            ${isMe || !stale ? `<div style="position:absolute;inset:-5px;border-radius:9999px;background:${meta.color};opacity:0.2;animation:ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ""}
            <div style="
              width:42px;height:42px;border-radius:9999px;
              background:${stale ? "#94a3b8" : meta.color};
              border:3px solid #fff;
              box-shadow:0 3px 12px rgba(0,0,0,0.35);
              display:flex;align-items:center;justify-content:center;
              font-size:19px;
            ">${meta.emoji}</div>
            <div style="
              position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);
              background:${stale ? "#64748b" : meta.color};color:#fff;
              font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;
              white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);max-width:100px;overflow:hidden;text-overflow:ellipsis;
            ">${isMe ? "म / You" : m.name}</div>
          </div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });

      const existing = markersRef.current.get(m.userId);
      if (existing) {
        existing.setLatLng([m.lat, m.lng]);
        existing.setIcon(icon);
        existing.setTooltipContent(
          `<b>${m.name}</b> (${meta.label})<br/>
           <span style="font-size:10px;color:${stale ? "#d97706" : "#059669"};">
             ${stale ? "⚠️ पुरानो स्थान (>१.५ मिनेट)" : "🟢 लाइभ"}</span>`,
        );
      } else {
        const marker = L.marker([m.lat, m.lng], { icon, zIndexOffset: isMe ? 2000 : 1000 })
          .addTo(map)
          .bindTooltip(
            `<b>${m.name}</b> (${meta.label})<br/>
             <span style="font-size:10px;color:${stale ? "#d97706" : "#059669"};">
               ${stale ? "⚠️ पुरानो स्थान" : "🟢 लाइभ"}</span>`,
            { direction: "top", offset: [0, -26] },
          );
        markersRef.current.set(m.userId, marker);
      }
    });

    // Auto-fit to show all active members
    if (members.length >= 2) {
      const lls = members.map((m) => [m.lat, m.lng] as [number, number]);
      try {
        map.fitBounds(lls, { padding: [60, 60], maxZoom: 16, animate: false });
      } catch {
        /* ignore */
      }
    } else if (members.length === 1) {
      map.setView([members[0].lat, members[0].lng], 15);
    }
  }, [members, userId]);

  // ── Subscribe to the shared team-location channel ───────────────────────
  useEffect(() => {
    const channel = supabase.channel(TEAM_LOCATION_CHANNEL, {
      config: { presence: { key: userId ?? "dashboard-guest" } },
    });

    const sync = () => {
      const state = channel.presenceState<TeamMemberLocation>();
      const list: TeamMemberLocation[] = [];
      for (const presences of Object.values(state)) {
        // Multiple tabs per key — take the freshest
        const latest = [...presences].sort(
          (a, b) => (b as TeamMemberLocation).updatedAt - (a as TeamMemberLocation).updatedAt,
        )[0] as TeamMemberLocation;
        if (latest?.lat && latest?.lng) list.push(latest);
      }
      // Sort: collectors first, then drivers, then others
      list.sort((a, b) => {
        const order: Record<TeamMemberRole, number> = {
          collector: 0,
          driver: 1,
          admin: 2,
          other: 3,
        };
        return (order[a.role] ?? 3) - (order[b.role] ?? 3);
      });
      setMembers(list);
    };

    channelRef.current = channel;

    // Presence callbacks must be registered before subscribe()
    channel.on("presence", { event: "sync" }, sync);
    channel.subscribe();

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId]);

  // ── Optional: dashboard admin shares their own location ─────────────────
  const toggleSharing = useCallback(() => {
    if (sharing) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setSharing(false);
      setMyLocation(null);
      setStatus("");
      void channelRef.current?.untrack();
      return;
    }

    if (!navigator.geolocation) {
      setLocationError("GPS उपलब्ध छैन।");
      return;
    }

    setLocationError("");
    setStatus("GPS खोज्दैछ...");
    setSharing(true);

    const handlePos = (pos: GeolocationPosition) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setMyLocation({ lat, lng });
      setStatus("✓ लोकेसन साझा भइरहेको छ");
      broadcastPos(lat, lng);
      if (mapRef.current && !myLocation) mapRef.current.flyTo([lat, lng], 15, { duration: 1 });
    };

    navigator.geolocation.getCurrentPosition(
      handlePos,
      () =>
        navigator.geolocation.getCurrentPosition(
          handlePos,
          () => {
            setSharing(false);
            setStatus("");
            setLocationError("GPS स्थान प्राप्त गर्न सकिएन।");
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
        ),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePos,
      (err) => console.warn("Dashboard GPS watch:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }, [sharing, broadcastPos, myLocation]);

  // Re-broadcast when role changes while sharing
  useEffect(() => {
    if (sharing && myLocation) broadcastPos(myLocation.lat, myLocation.lng);
  }, [myRole, sharing, myLocation, broadcastPos]);

  // Cleanup watch on unmount
  useEffect(
    () => () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    },
    [],
  );

  const activeCount = members.length;
  const collectorCount = members.filter((m) => m.role === "collector").length;
  const driverCount = members.filter((m) => m.role === "driver").length;

  return (
    <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-3">
        <div>
          <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
            <Radio className="size-4 text-blue-600 animate-pulse" />
            टोली लाइभ लोकेसन नक्सा (Live Team Map)
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            संकलन नक्सा र ट्रिप पृष्ठबाट GPS सुरु गरेका संकलक र चालकको स्थान यहाँ देखिन्छ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Active counters */}
          {collectorCount > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300">
              🚚 {collectorCount} संकलक
            </div>
          )}
          {driverCount > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 text-[11px] font-bold text-violet-700 dark:text-violet-300">
              🛻 {driverCount} चालक
            </div>
          )}

          {/* Optional: admin shares their own location */}
          <div className="flex items-center gap-1.5">
            <select
              aria-label="मेरो भूमिका"
              className="h-7 rounded-md border bg-background px-2 text-xs font-bold text-foreground"
              value={myRole}
              onChange={(e) => setMyRole(e.target.value as TeamMemberRole)}
            >
              <option value="admin">🏢 प्रशासक</option>
              <option value="collector">🚚 संकलक</option>
              <option value="driver">🛻 चालक</option>
              <option value="other">👤 अन्य</option>
            </select>
            <Button
              type="button"
              size="sm"
              variant={sharing ? "default" : "outline"}
              onClick={toggleSharing}
              className={`gap-1.5 text-xs font-bold ${
                sharing
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "border-blue-500/40 text-blue-700 hover:bg-blue-50 dark:text-blue-300"
              }`}
            >
              <LocateFixed className={`size-3.5 ${sharing ? "animate-spin" : ""}`} />
              {sharing ? "साझा भइरहेको" : "मेरो लोकेसन साझा"}
            </Button>
          </div>

          {/* Total active badge */}
          <div
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border ${
              activeCount > 0
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            <Users className="size-3" />
            {activeCount} सक्रिय
          </div>
        </div>
      </div>

      {/* Status / error banners */}
      {status && (
        <div className="flex items-center gap-2 border-b bg-blue-500/5 px-4 py-1.5 text-xs text-blue-700 dark:text-blue-300 font-medium">
          <LocateFixed className="size-3.5 shrink-0 animate-spin text-blue-600" />
          <span>{status}</span>
        </div>
      )}
      {locationError && (
        <div className="flex items-center gap-2 border-b bg-amber-500/5 px-4 py-1.5 text-xs text-amber-800 dark:text-amber-200 font-medium">
          <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
          <span>{locationError}</span>
        </div>
      )}

      {/* Map */}
      <div className="leaflet-map-wrapper relative w-full" style={{ height: 360 }}>
        <div ref={mapContainerRef} className="h-full w-full bg-muted" />

        {/* Legend overlay */}
        <div className="absolute top-3 left-3 z-[800] rounded-lg bg-card/95 backdrop-blur-md p-2.5 shadow-lg border border-border/80 text-[11px] max-w-[210px]">
          <div className="font-bold text-foreground mb-1.5 flex items-center gap-1.5">
            <Eye className="size-3.5 text-blue-600" />
            <span>सक्रिय टोली सदस्य</span>
          </div>
          {activeCount === 0 ? (
            <p className="text-muted-foreground text-[10px] leading-relaxed">
              अहिले कुनै संकलक वा चालकले GPS सुरु गरेका छैनन्।
              <br />
              <span className="font-semibold">संकलन नक्सा</span> वा{" "}
              <span className="font-semibold">ट्रिप पृष्ठ</span>मा GPS ON गर्नुहोस्।
            </p>
          ) : (
            <div className="space-y-1">
              {members.map((m) => {
                const meta = ROLE_META[m.role] ?? ROLE_META.other;
                const stale = Date.now() - m.updatedAt > 90_000;
                return (
                  <button
                    key={m.userId}
                    type="button"
                    className="flex w-full items-center gap-1.5 cursor-pointer hover:bg-muted/60 rounded px-1 py-0.5 text-left"
                    onClick={() => {
                      if (mapRef.current) mapRef.current.flyTo([m.lat, m.lng], 16, { duration: 1 });
                    }}
                  >
                    <span>{meta.emoji}</span>
                    <span className="truncate font-semibold text-foreground flex-1">
                      {m.userId === userId ? "म (You)" : m.name}
                    </span>
                    <span
                      className={`size-2 rounded-full shrink-0 ${
                        stale ? "bg-amber-400" : "bg-emerald-500 animate-pulse"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Empty state overlay */}
        {activeCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[800]">
            <div className="rounded-xl bg-card/90 backdrop-blur-sm border border-border/70 px-6 py-5 text-center shadow-xl max-w-xs">
              <Navigation className="size-9 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs font-bold text-muted-foreground">
                कुनै संकलक वा चालक अहिले लाइभ छैनन्
              </p>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                <b>संकलन नक्सा (GPS)</b> वा <b>ट्रिप तथा चालक</b> पृष्ठमा गएर
                <br />
                <b>GPS सुरु गर्नुहोस्</b> बटन थिच्नुहोस् — स्थान यहाँ आउँछ।
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-5 py-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Supabase Realtime Presence — स्वतः अपडेट (~१ सेकेन्डभित्र)
        </span>
        {myLocation && (
          <span className="font-mono font-bold text-foreground">
            📍 {myLocation.lat.toFixed(5)}, {myLocation.lng.toFixed(5)}
          </span>
        )}
      </div>
    </div>
  );
}
