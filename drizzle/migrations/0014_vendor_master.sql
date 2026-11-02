-- Migration 0014: Vendor Master and Vendor Ledger

CREATE TABLE IF NOT EXISTS public.vendor_master (
  id text PRIMARY KEY DEFAULT ('ven-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  address text DEFAULT '',
  pan_vat text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  due_days integer DEFAULT 30,
  opening_balance numeric(12,2) DEFAULT 0,
  balance_type text DEFAULT 'cr',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.vendor_master ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendor_master' AND policyname = 'vendor_master_select_authenticated') THEN
    CREATE POLICY vendor_master_select_authenticated ON public.vendor_master FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendor_master' AND policyname = 'vendor_master_all_owner') THEN
    CREATE POLICY vendor_master_all_owner ON public.vendor_master FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.vendor_ledger (
  id text PRIMARY KEY DEFAULT ('vl-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  vendor_id text NOT NULL,
  date_bs text NOT NULL,
  description text DEFAULT '',
  dr numeric(12,2) DEFAULT 0,
  cr numeric(12,2) DEFAULT 0,
  balance numeric(12,2) DEFAULT 0,
  ref_type text DEFAULT '',
  ref_id text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.vendor_ledger ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendor_ledger' AND policyname = 'vendor_ledger_select_authenticated') THEN
    CREATE POLICY vendor_ledger_select_authenticated ON public.vendor_ledger FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendor_ledger' AND policyname = 'vendor_ledger_all_owner') THEN
    CREATE POLICY vendor_ledger_all_owner ON public.vendor_ledger FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
