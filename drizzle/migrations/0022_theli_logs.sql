-- Migration 0022: Theli daily log (थेली दैनिक) — collector cart out/in ranges and cash balance
CREATE TABLE IF NOT EXISTS public.theli_logs (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date text NOT NULL,
  ward text DEFAULT '',
  employee_id text DEFAULT '',
  employee_name text DEFAULT '',
  supervisor_type text DEFAULT 'member',
  supervisor_id text DEFAULT '',
  supervisor_name text DEFAULT '',
  opening_balance numeric(12,2) DEFAULT 0,
  out_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  in_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount numeric(12,2) DEFAULT 0,
  cleared_amount numeric(12,2) DEFAULT 0,
  remarks text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_theli_logs_owner ON public.theli_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_theli_logs_date ON public.theli_logs(log_date);

ALTER TABLE public.theli_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_theli_logs" ON public.theli_logs;
CREATE POLICY "owner_theli_logs" ON public.theli_logs
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

REVOKE ALL ON public.theli_logs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.theli_logs TO authenticated;

NOTIFY pgrst, 'reload schema';
