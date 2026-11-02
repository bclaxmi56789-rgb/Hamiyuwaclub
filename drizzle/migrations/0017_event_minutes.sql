-- Migration 0017: Meeting minutes (कार्यविवरण/मिनेट) for events & programmes
CREATE TABLE IF NOT EXISTS public.event_minutes (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  meeting_date text NOT NULL,
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  agenda jsonb NOT NULL DEFAULT '[]'::jsonb,
  draft text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_event_minutes_owner ON public.event_minutes(owner_id);
CREATE INDEX IF NOT EXISTS idx_event_minutes_event ON public.event_minutes(event_id);

ALTER TABLE public.event_minutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_event_minutes" ON public.event_minutes;
CREATE POLICY "owner_event_minutes" ON public.event_minutes
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

REVOKE ALL ON public.event_minutes FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_minutes TO authenticated;

NOTIFY pgrst, 'reload schema';
