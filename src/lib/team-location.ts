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
  /** Only broadcast while this is true (tracks the GPS-ON state of the page) */
  active: boolean;
}

/**
 * Joins the shared team-location Realtime channel and returns a stable
 * `broadcast(lat, lng)` function. Automatically unjoins on unmount or
 * when `active` becomes false.
 */
export function useTeamLocationBroadcast({
  userId,
  userEmail,
  employeeId,
  name,
  designation,
  role,
  active,
}: BroadcastOptions): (lat: number, lng: number) => void {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const activeRef = useRef(active);
  activeRef.current = active;
  const metaRef = useRef({ userId, userEmail, employeeId, name, designation, role });
  metaRef.current = { userId, userEmail, employeeId, name, designation, role };
  const lastFixRef = useRef<TeamMemberLocation | null>(null);

  const memberKey = `${userId || userEmail || "worker"}:${employeeId || role}`;

  useEffect(() => {
    const channel = supabase.channel(TEAM_LOCATION_CHANNEL, {
      config: { presence: { key: memberKey } },
    });

    channel.subscribe((status) => {
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

  useEffect(() => {
    if (!active) {
      void channelRef.current?.untrack();
    }
  }, [active]);

  const broadcast = useCallback((lat: number, lng: number) => {
    const { userId: uid, userEmail: uemail, employeeId: empId, name: nm, designation: desig, role: rl } = metaRef.current;
    if (!activeRef.current || !channelRef.current) return;
    const key = `${uid || uemail || "worker"}:${empId || rl}`;
    const fix: TeamMemberLocation = {
      id: key,
      userId: uid || "",
      email: uemail || undefined,
      employeeId: empId || null,
      name: nm || (rl === "driver" ? "चालक" : "संकलक"),
      designation: desig || undefined,
      role: rl,
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
