-- Plan Master table creation and linking with customer_master
CREATE TABLE IF NOT EXISTS public.plan_master (
  id text PRIMARY KEY DEFAULT ('plan-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  incentive numeric(10,2) NOT NULL DEFAULT 0,
  chargeable_amount numeric(10,2) NOT NULL DEFAULT 0,
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plan_master ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plan_master' AND policyname = 'plan_master_select_authenticated') THEN
    CREATE POLICY plan_master_select_authenticated ON public.plan_master FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plan_master' AND policyname = 'plan_master_all_owner') THEN
    CREATE POLICY plan_master_all_owner ON public.plan_master FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

-- Add email and plan_id to customer_master if not exists
ALTER TABLE public.customer_master
  ADD COLUMN IF NOT EXISTS email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS plan_id text DEFAULT '';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
