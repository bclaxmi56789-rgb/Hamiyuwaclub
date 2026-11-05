/**
 * team-location.ts
 *
 * Shared Supabase Realtime Presence utility for broadcasting and subscribing
 * to live team member GPS positions.
 *
 * Uses the project's shared channel "team-location-tjawgszwbozvxqugdnva" so that:
 * - Drivers on their phones (e.g. logged in with freeflyplaying3214@gmail.com)
 * - Collectors in the field
 * - Admins and managers on the dashboard
 * all join the exact same Realtime presence channel and see each other's live
 * locations and actual names in real time without being blocked by differing user IDs.
 */

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/** The shared Supabase project ID — shared by all users of this project */
const PROJECT_ID = "tjawgszwbozvxqugdnva";
export const TEAM_LOCATION_CHANNEL = `team-location-${PROJECT_ID}`;

export type TeamMemberRole = "collector" | "driver" | "admin" | "other";

export interface TeamMemberLocation {
  id: string; // unique member key e.g. `${userId || email}:${employeeId || role}`
  userId: string;
  email?: string;
  employeeId?: string | null;
  name: string;
  designation?: string;
  role: TeamMemberRole;
  /** Active driver trip type — "collection" | "dumping" (only while a trip session is running) */
  tripType?: string;
  tripSessionId?: string;
  lat: number;
  lng: number;
  updatedAt: number; // epoch ms
}

/** Shared emoji/colour/label per role — used by dashboard and field pages alike */
export const TEAM_ROLE_STYLE: Record<
  TeamMemberRole,
  { emoji: string; color: string; label: string }
> = {
  collector: { emoji: "🚚", color: "#2563eb", label: "संकलक" },
  driver: { emoji: "🛻", color: "#7c3aed", label: "चालक" },
  admin: { emoji: "🏢", color: "#059669", label: "प्रशासक" },
  other: { emoji: "👤", color: "#64748b", label: "अन्य" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Broadcaster hook (used by Collection Map and Trip Driver)
// ─────────────────────────────────────────────────────────────────────────────

interface BroadcastOptions {
  /** The signed-in user's Supabase auth UUID */
  userId: string | null;
  /** Optional user email */
  userEmail?: string | null;
  /** Optional active employee ID */
  employeeId?: string | null;
  /** Display name shown on the dashboard map */
  name: string;
  /** Designation/post */
  designation?: string;
  /** Role label — drives the emoji and colour on the dashboard */
  role: TeamMemberRole;
  /** Active trip info — set while the driver has a trip session running */
  tripType?: string;
  tripSessionId?: string;
  /** Only broadcast while this is true (tracks the GPS-ON state of the page) */
  active: boolean;
}

/**
 * Joins the shared team-location Realtime channel and returns a stable
 * `broadcast(lat, lng)` function.
 *
 * The channel is ALWAYS joined (regardless of `active`) so that the first GPS
 * fix is immediately propagated. `active=false` just means we do NOT call
 * track() on subscribe — we still stay connected. The only time we untrack is
 * on unmount (cleanup) or when the user explicitly turns off GPS (`active`
 * transitions from true → false).
 */
export function useTeamLocationBroadcast({
  userId,
  userEmail,
  employeeId,
  name,
  designation,
  role,
  tripType,
  tripSessionId,
  active,
}: BroadcastOptions): (lat: number, lng: number) => void {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const activeRef = useRef(active);
  const prevActiveRef = useRef(active);
  activeRef.current = active;
  const metaRef = useRef({
    userId,
    userEmail,
    employeeId,
    name,
    designation,
    role,
    tripType,
    tripSessionId,
  });
  metaRef.current = {
    userId,
    userEmail,
    employeeId,
    name,
    designation,
    role,
    tripType,
    tripSessionId,
  };
  const lastFixRef = useRef<TeamMemberLocation | null>(null);

  const memberKey = `${userId || userEmail || "worker"}:${employeeId || role}`;

  // Always join the channel — never tear it down on active change
  useEffect(() => {
    const channel = supabase.channel(TEAM_LOCATION_CHANNEL, {
      config: { presence: { key: memberKey } },
    });

    channel.subscribe((status) => {
      // On reconnect, re-broadcast last known fix if still active
      if (status === "SUBSCRIBED" && lastFixRef.current && activeRef.current) {
        void channel.track(lastFixRef.current);
      }
    });
    channelRef.current = channel;

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [memberKey]);

  // Only untrack when active transitions true → false (GPS deliberately turned off)
  useEffect(() => {
    if (prevActiveRef.current && !active) {
      void channelRef.current?.untrack();
    }
    prevActiveRef.current = active;
  }, [active]);

  const broadcast = useCallback((lat: number, lng: number) => {
    const {
      userId: uid,
      userEmail: uemail,
      employeeId: empId,
      name: nm,
      designation: desig,
      role: rl,
      tripType: ttype,
      tripSessionId: tsession,
    } = metaRef.current;
    if (!channelRef.current) return; // removed activeRef guard — allow broadcast any time channel exists
    const key = `${uid || uemail || "worker"}:${empId || rl}`;
    const fix: TeamMemberLocation = {
      id: key,
      userId: uid || "",
      email: uemail || undefined,
      employeeId: empId || null,
      name: nm || (rl === "driver" ? "चालक" : "संकलक"),
      designation: desig || undefined,
      role: rl,
      tripType: ttype,
      tripSessionId: tsession,
      lat,
      lng,
      updatedAt: Date.now(),
    };
    lastFixRef.current = fix;
    void channelRef.current.track(fix);
  }, []);

  return broadcast;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscriber hook (used by Dashboard, Collection Map, Trip Driver)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribes to the shared team-location channel and pushes the up-to-date
 * list of active team members into `onMembers` whenever presence syncs.
 */
export function useTeamLocationSubscribe(
  userId: string | null,
  onMembers: (members: TeamMemberLocation[]) => void,
): void {
  const cbRef = useRef(onMembers);
  cbRef.current = onMembers;

  const viewerKey = useRef(`viewer-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    let cancelled = false;

    const channel = supabase.channel(TEAM_LOCATION_CHANNEL, {
      config: { presence: { key: viewerKey } },
    });

    const sync = () => {
      if (cancelled) return;
      const state = channel.presenceState<TeamMemberLocation>();
      const list: TeamMemberLocation[] = [];
      for (const [key, presences] of Object.entries(state)) {
        if (key.startsWith("viewer-")) continue;
        const latest = [...presences].sort(
          (a, b) => (b as TeamMemberLocation).updatedAt - (a as TeamMemberLocation).updatedAt,
        )[0] as TeamMemberLocation | undefined;
        if (latest?.lat && latest?.lng) {
          list.push({
            ...latest,
            id: latest.id || key,
          });
        }
      }
      cbRef.current(list);
    };

    channel.on("presence", { event: "sync" }, sync);
    channel.subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [viewerKey]);
}
