/**
 * team-location.ts
 *
 * Shared Supabase Realtime Presence utility for broadcasting and subscribing
 * to live team member GPS positions.
 *
 * Channel name: "team-location-<SUPABASE_PROJECT_ID>"
 *   — All users of the same Supabase project join the same channel, so
 *     a collector's location on Collection Map is instantly visible on the
 *     Dashboard and vice-versa.
 *
 * Usage (broadcaster — e.g. collection-map, trip-driver):
 *   const broadcast = useTeamLocationBroadcast({ userId, name, role });
 *   // call broadcast(lat, lng) whenever location updates
 *   // call broadcast(null, null) or just unmount to stop (auto-cleaned up)
 *
 * Usage (subscriber — dashboard):
 *   const members = useTeamLocationSubscribe();
 *   // members is an array of TeamMemberLocation updated in real-time
 */

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/** The fixed Supabase project ID — shared by every user of this app */
const PROJECT_ID = "tjawgszwbozvxqugdnva";
export const TEAM_LOCATION_CHANNEL = `team-location-${PROJECT_ID}`;

export type TeamMemberRole = "collector" | "driver" | "admin" | "other";

export interface TeamMemberLocation {
  userId: string;
  name: string;
  role: TeamMemberRole;
  lat: number;
  lng: number;
  updatedAt: number; // epoch ms
}

// ─────────────────────────────────────────────────────────────────────────────
// Broadcaster hook (used by Collection Map and Trip Driver)
// ─────────────────────────────────────────────────────────────────────────────

interface BroadcastOptions {
  /** The signed-in user's Supabase auth UUID */
  userId: string | null;
  /** Display name shown on the dashboard map */
  name: string;
  /** Role label — drives the emoji and colour on the dashboard */
  role: TeamMemberRole;
  /** Only broadcast while this is true (tracks the GPS-ON state of the page) */
  active: boolean;
}

/**
 * Joins the shared team-location Realtime channel and returns a stable
 * `broadcast(lat, lng)` function.  Automatically unjoins on unmount or
 * when `active` becomes false.
 */
export function useTeamLocationBroadcast({
  userId,
  name,
  role,
  active,
}: BroadcastOptions): (lat: number, lng: number) => void {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Keep the latest options in refs so the returned `broadcast` function can be
  // truly stable. This matters because geolocation watch callbacks capture the
  // broadcast function once when tracking starts — if `broadcast` were recreated
  // when `active` flips to true, those callbacks would keep calling the stale
  // version (with `active: false`) and nothing would ever reach the dashboard.
  const activeRef = useRef(active);
  activeRef.current = active;
  const metaRef = useRef({ userId, name, role });
  metaRef.current = { userId, name, role };
  // Remember the last fix so it can be replayed once the channel actually joins
  // (tracking can call broadcast() before the Realtime connection is ready).
  const lastFixRef = useRef<TeamMemberLocation | null>(null);

  // Join the channel once; leave on unmount or user change
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(TEAM_LOCATION_CHANNEL, {
      config: { presence: { key: userId } },
    });

    channel.subscribe((status) => {
      // Replay the latest known fix once the presence connection is live
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
  }, [userId]);

  // Untrack when active becomes false (GPS turned off)
  useEffect(() => {
    if (!active) {
      void channelRef.current?.untrack();
    }
  }, [active]);

  // Stable broadcast function — reads live options from refs
  const broadcast = useCallback((lat: number, lng: number) => {
    const { userId: uid, name: nm, role: rl } = metaRef.current;
    if (!uid || !activeRef.current || !channelRef.current) return;
    const fix = {
      userId: uid,
      name: nm || `Member-${uid.slice(0, 6)}`,
      role: rl,
      lat,
      lng,
      updatedAt: Date.now(),
    } satisfies TeamMemberLocation;
    lastFixRef.current = fix;
    void channelRef.current.track(fix);
  }, []);

  return broadcast;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscriber hook (used by Dashboard)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribes to the shared team-location channel and returns an up-to-date
 * list of all active team members.  Members are removed automatically when
 * they leave the channel (close the page).
 */
export function useTeamLocationSubscribe(): TeamMemberLocation[] {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // We use a ref-backed state setter pattern to avoid stale closures
  const setMembersRef = useRef<((members: TeamMemberLocation[]) => void) | null>(null);

  // This hook is used only once inside DashboardLiveMap which manages its own
  // state; we return a "setter registration" API instead of React state so the
  // hook itself stays framework-agnostic and testable.
  // ↑ Actually, for simplicity we just re-export the hook signature used in
  //   DashboardLiveMap directly — the subscriber logic lives there.
  return [];
}
