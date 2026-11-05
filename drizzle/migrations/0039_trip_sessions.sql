-- Migration 0039: Driver Trip Sessions with GPS points (collection / dumping)
CREATE TABLE IF NOT EXISTS public.trip_sessions (
  id text PRIMARY KEY DEFAULT 'trip-' || md5(random()::text || clock_timestamp()::text),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id text DEFAULT '',
  employee_name text DEFAULT '',
  ward text DEFAULT '',
  fiscal_year integer,
  trip_type text NOT NULL DEFAULT 'collection' CHECK (trip_type IN ('collection', 'dumping')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  end_note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_sessions_owner
  ON public.trip_sessions(owner_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS public.trip_points (
  seq bigserial PRIMARY KEY,
  session_id text NOT NULL REFERENCES public.trip_sessions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_points_session
  ON public.trip_points(session_id, seq);

ALTER TABLE public.trip_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_trip_sessions" ON public.trip_sessions;
CREATE POLICY "owner_trip_sessions" ON public.trip_sessions
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "owner_trip_points" ON public.trip_points;
CREATE POLICY "owner_trip_points" ON public.trip_points
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

REVOKE ALL ON public.trip_sessions FROM PUBLIC, anon;
REVOKE ALL ON public.trip_points FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_sessions TO authenticated;
GRANT SELECT, INSERT ON public.trip_points TO authenticated;
