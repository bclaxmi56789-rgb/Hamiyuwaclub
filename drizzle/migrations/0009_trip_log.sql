-- Migration 0009: Trip log table
CREATE TABLE IF NOT EXISTS public.trip_log (
  id text PRIMARY KEY DEFAULT ('trip-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  ward text NOT NULL,
  card text NOT NULL,
  fiscal_year integer NOT NULL,
  month integer NOT NULL,
  logged_at timestamptz DEFAULT now()
);

ALTER TABLE public.trip_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_log' AND policyname = 'trip_log_select_authenticated') THEN
    CREATE POLICY trip_log_select_authenticated ON public.trip_log FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_log' AND policyname = 'trip_log_all_owner') THEN
    CREATE POLICY trip_log_all_owner ON public.trip_log FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

