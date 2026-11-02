-- Migration 0011: Events and Programmes
CREATE TABLE IF NOT EXISTS public.club_events (
  id text PRIMARY KEY DEFAULT ('evt-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  locality text NOT NULL,
  budget_required numeric(12,2) NOT NULL DEFAULT 0,
  budget_allocated numeric(12,2) DEFAULT 0,
  commencing_date text NOT NULL DEFAULT '',
  end_date text DEFAULT '',
  status text NOT NULL DEFAULT 'planned', -- 'planned' | 'ongoing' | 'completed' | 'postponed'
  authorized_persons jsonb DEFAULT '[]'::jsonb,
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.club_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'club_events' AND policyname = 'club_events_select_authenticated') THEN
    CREATE POLICY club_events_select_authenticated ON public.club_events FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'club_events' AND policyname = 'club_events_all_owner') THEN
    CREATE POLICY club_events_all_owner ON public.club_events FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

