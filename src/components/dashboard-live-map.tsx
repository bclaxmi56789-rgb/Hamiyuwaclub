/**
 * DashboardLiveMap — real-time team location map for the dashboard.
 *
 * Uses Supabase Realtime Presence so each team member (collector / driver)
 * who clicks "Share My Location" appears as a live marker on every watcher's
 * map. No extra database table needed; positions are ephemeral and disappear
 * the moment the user closes the page.
 *
 * Architecture:
 *   - Each device joins the shared Realtime presence channel "team-location-<accountId>".
 *   - When sharing is ON it calls presenceChannel.track({ lat, lng, name, role, … }).
 *   - Supabase broadcasts the full presence state to all subscribers within ~100 ms.
 *   - The map re-draws markers whenever the presence state changes.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LocateFixed,
  Radio,
  Users,
  MapPin,
  Navigation,
  AlertTriangle,
} from "lucide-react";
import { BIRENDRANAGAR_CENTER, NEPAL_CENTER } from "@/lib/geo";

/** One team member's presence payload */
interface MemberPresence {
  userId: string;
  name: string;
  role: "collector" | "driver" | "admin" | "other";
  lat: number;
  lng: number;
  updatedAt: number; // epoch ms
}

/** Role → emoji + color */
const ROLE_META: Record<
  MemberPresence["role"],
  { emoji: string; color: string; label: string }
> = {
  collector: { emoji: "🚚", color: "#2563eb", label: "संकलक" },
  driver:    { emoji: "🛻", color: "#7c3aed", label: "चालक" },
  admin:     { emoji: "🏢", color: "#059669", label: "प्रशासक" },
  other:     { emoji: "👤", color: "#64748b", label: "अन्य" },
};

interface Props {
  userId: string | null;
  userName: string;
  accountId: string; // scopes the channel per organisation
}

export function DashboardLiveMap({ userId, userName, accountId }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef         = useRef<L.Map | null>(null);
  const markersRef     = useRef<Map<string, L.Marker>>(new Map());
  const channelRef     = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const watchIdRef     = useRef<number | null>(null);

  const [sharing, setSharing]           = useState(false);
  const [myLocation, setMyLocation]     = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [members, setMembers]           = useState<MemberPresence[]>([]);
  const [myRole, setMyRole]             = useState<MemberPresence["role"]>("collector");
  const [status, setStatus]             = useState("");

  // ── Leaflet map initialisation ──────────────────────────────────────────
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

    mapRef.current = map;

    // Fly to Birendranagar after a short delay
    setTimeout(() => {
      if (mapRef.current)
        mapRef.current.flyTo(BIRENDRANAGAR_CENTER, 13, { duration: 1.5 });
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

    // Remove stale markers (members who left)
    const currentIds = new Set(members.map((m) => m.userId));
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    // Add / update markers
    members.forEach((m) => {
      const meta = ROLE_META[m.role] ?? ROLE_META.other;
      const isMe = m.userId === userId;
      const ageMs = Date.now() - m.updatedAt;
      const stale = ageMs > 60_000; // grey out if no update for 1 min

      const icon = L.divIcon({
        className: "team-member-icon",
        html: `
          <div style="position:relative; width:40px; height:40px;">
            ${isMe ? `<div style="position:absolute;inset:-4px;border-radius:9999px;background:${meta.color};opacity:0.25;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ""}
            <div style="
              width:40px;height:40px;border-radius:9999px;
              background:${stale ? "#94a3b8" : meta.color};
              border:3px solid #fff;
              box-shadow:0 3px 10px rgba(0,0,0,0.35);
              display:flex;align-items:center;justify-content:center;
              font-size:18px;
            ">${meta.emoji}</div>
            <div style="
              position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);
              background:${stale ? "#64748b" : meta.color};color:#fff;
              font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;
              white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);
            ">${isMe ? "म / You" : m.name}</div>
          </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const existing = markersRef.current.get(m.userId);
      if (existing) {
        existing.setLatLng([m.lat, m.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([m.lat, m.lng], { icon, zIndexOffset: isMe ? 2000 : 1000 })
          .addTo(map)
          .bindTooltip(
            `<b>${m.name}</b> (${meta.label})<br/>
             <span style="font-size:10px;color:#64748b;">${stale ? "⚠️ पुरानो स्थान (>1 मिनेट)" : "🟢 सक्रिय"}</span>`,
            { direction: "top", offset: [0, -24] },
          );
        markersRef.current.set(m.userId, marker);
      }
    });

    // Auto-fit bounds if 2+ members
    if (members.length >= 2) {
      const lls = members.map((m) => [m.lat, m.lng] as [number, number]);
      map.fitBounds(lls, { padding: [60, 60], maxZoom: 16, animate: false });
    } else if (members.length === 1) {
      map.setView([members[0].lat, members[0].lng], 15);
    }
  }, [members, userId]);

  // ── Supabase Realtime presence channel ─────────────────────────────────
  useEffect(() => {
    if (!accountId) return;

    const channelName = `team-location-${accountId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: userId ?? "anon" } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<MemberPresence>();
        const list: MemberPresence[] = [];
        for (const presences of Object.values(state)) {
          // Each key can have multiple presences (tabs) — take the latest
          const latest = [...presences].sort(
            (a, b) => (b as MemberPresence).updatedAt - (a as MemberPresence).updatedAt,
          )[0] as MemberPresence;
          if (latest?.lat && latest?.lng) list.push(latest);
        }
        setMembers(list);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [accountId, userId]);

  // ── Broadcast current location ──────────────────────────────────────────
  const broadcastLocation = useCallback(
    (lat: number, lng: number) => {
      const channel = channelRef.current;
      if (!channel || !userId) return;
      void channel.track({
        userId,
        name: userName || "Team Member",
        role: myRole,
        lat,
        lng,
        updatedAt: Date.now(),
      } satisfies MemberPresence);
    },
    [userId, userName, myRole],
  );

  // ── Toggle location sharing ─────────────────────────────────────────────
  const toggleSharing = () => {
    if (sharing) {
      // Stop
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      // Untrack from presence
      void channelRef.current?.untrack();
      setSharing(false);
      setMyLocation(null);
      setStatus("");
      return;
    }

    if (!navigator.geolocation) {
      setLocationError("तपाईंको ब्राउजरमा GPS उपलब्ध छैन।");
      return;
    }

    setLocationError("");
    setStatus("GPS खोज्दैछ...");
    setSharing(true);

    const handlePos = (pos: GeolocationPosition) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setMyLocation({ lat, lng });
      setStatus("✓ लाइभ लोकेसन साझा भइरहेको छ");
      broadcastLocation(lat, lng);

      // Fly to self on first fix
      if (mapRef.current && !myLocation) {
        mapRef.current.flyTo([lat, lng], 15, { duration: 1 });
      }
    };

    // Initial fix
    navigator.geolocation.getCurrentPosition(
      handlePos,
      () => {
        navigator.geolocation.getCurrentPosition(
          handlePos,
          () => {
            setSharing(false);
            setStatus("");
            setLocationError("GPS स्थान प्राप्त गर्न सकिएन। नक्साको अनुमति जाँच गर्नुहोस्।");
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );

    // Continuous watch
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePos,
      (err) => console.warn("Dashboard map watch error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  };

  // Re-broadcast when role changes while sharing
  useEffect(() => {
    if (sharing && myLocation) {
      broadcastLocation(myLocation.lat, myLocation.lng);
    }
  }, [myRole, sharing, myLocation, broadcastLocation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const activeCount = members.length;

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
            संकलक र चालकको वास्तविक-समयको स्थान — प्रत्येक उपकरणले आफ्नो लोकेसन साझा गर्छ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role selector */}
          <select
            aria-label="मेरो भूमिका"
            className="h-8 rounded-md border bg-background px-2 text-xs font-bold text-foreground"
            value={myRole}
            onChange={(e) => setMyRole(e.target.value as MemberPresence["role"])}
          >
            <option value="collector">🚚 संकलक</option>
            <option value="driver">🛻 चालक</option>
            <option value="admin">🏢 प्रशासक</option>
            <option value="other">👤 अन्य</option>
          </select>

          {/* Share button */}
          <Button
            type="button"
            size="sm"
            variant={sharing ? "default" : "outline"}
            onClick={toggleSharing}
            className={`gap-1.5 text-xs font-bold ${
              sharing
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                : "border-blue-500/40 text-blue-700 hover:bg-blue-50 dark:text-blue-300"
            }`}
          >
            <LocateFixed className={`size-3.5 ${sharing ? "animate-spin" : ""}`} />
            {sharing ? "लोकेसन साझा भइरहेको छ (ON)" : "मेरो लोकेसन साझा गर्नुहोस्"}
          </Button>

          {/* Active members badge */}
          <div
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              activeCount > 0
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            <Users className="size-3" />
            {activeCount} सक्रिय
          </div>
        </div>
      </div>

      {/* Status / error banners */}
      {status && (
        <div className="flex items-center gap-2 border-b bg-blue-500/5 px-4 py-2 text-xs text-blue-700 dark:text-blue-300 font-medium">
          <LocateFixed className="size-3.5 shrink-0 animate-spin text-blue-600" />
          <span>{status}</span>
        </div>
      )}
      {locationError && (
        <div className="flex items-center gap-2 border-b bg-amber-500/5 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 font-medium">
          <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
          <span>{locationError}</span>
        </div>
      )}

      {/* Map */}
      <div className="leaflet-map-wrapper relative w-full" style={{ height: 340 }}>
        <div ref={mapContainerRef} className="h-full w-full bg-muted" />

        {/* Legend overlay */}
        <div className="absolute top-3 left-3 z-[800] rounded-lg bg-card/95 backdrop-blur-md p-2.5 shadow-lg border border-border/80 text-[11px] max-w-[200px]">
          <div className="font-bold text-foreground mb-1.5 flex items-center gap-1">
            <MapPin className="size-3.5 text-blue-600" />
            <span>टोली सदस्यहरू</span>
          </div>
          {activeCount === 0 ? (
            <p className="text-muted-foreground text-[10px]">
              अहिले कोही सक्रिय छैनन्। <br />
              माथिको बटन थिचेर लोकेसन साझा गर्नुहोस्।
            </p>
          ) : (
            <div className="space-y-1">
              {members.map((m) => {
                const meta = ROLE_META[m.role] ?? ROLE_META.other;
                const stale = Date.now() - m.updatedAt > 60_000;
                return (
                  <div
                    key={m.userId}
                    className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/60 rounded px-1 py-0.5"
                    onClick={() => {
                      if (mapRef.current)
                        mapRef.current.flyTo([m.lat, m.lng], 16, { duration: 1 });
                    }}
                  >
                    <span>{meta.emoji}</span>
                    <span className="truncate font-semibold text-foreground">
                      {m.userId === userId ? "म (You)" : m.name}
                    </span>
                    <span
                      className={`ml-auto size-2 rounded-full shrink-0 ${
                        stale ? "bg-amber-400" : "bg-emerald-500 animate-pulse"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* "No one sharing" subtle overlay */}
        {activeCount === 0 && !sharing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[800]">
            <div className="rounded-xl bg-card/90 backdrop-blur-sm border border-border/70 px-6 py-4 text-center shadow-xl max-w-xs">
              <Navigation className="size-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs font-bold text-muted-foreground">
                कुनै टोली सदस्यले लोकेसन साझा गरेका छैनन्
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                माथिको <b>मेरो लोकेसन साझा गर्नुहोस्</b> बटन थिच्नुहोस्
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer info strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-5 py-2 text-[10px] text-muted-foreground">
        <span>🔴 Supabase Realtime Presence — स्वतः अपडेट (लगभग 1 सेकेन्डभित्र)</span>
        {myLocation && (
          <span className="font-mono font-bold text-foreground">
            📍 {myLocation.lat.toFixed(5)}, {myLocation.lng.toFixed(5)}
          </span>
        )}
      </div>
    </div>
  );
}

