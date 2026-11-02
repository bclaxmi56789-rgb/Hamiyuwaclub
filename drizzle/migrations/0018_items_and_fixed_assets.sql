-- Migration 0018: Item Master and Fixed Asset Master with parent, sub_parent, UOM, units, and amount

-- 1. Item Master table
CREATE TABLE IF NOT EXISTS public.item_master (
  id text PRIMARY KEY DEFAULT ('itm-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  item_code text NOT NULL,
  name text NOT NULL,
  parent text DEFAULT '',
  sub_parent text DEFAULT '',
  uom text DEFAULT 'nos',
  units numeric(12,2) DEFAULT 1,
  amount numeric(12,2) DEFAULT 0,
  category text DEFAULT 'item',
  last_rate numeric(12,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure all columns exist if table was previously created
ALTER TABLE public.item_master ADD COLUMN IF NOT EXISTS parent text DEFAULT '';
ALTER TABLE public.item_master ADD COLUMN IF NOT EXISTS sub_parent text DEFAULT '';
ALTER TABLE public.item_master ADD COLUMN IF NOT EXISTS units numeric(12,2) DEFAULT 1;
ALTER TABLE public.item_master ADD COLUMN IF NOT EXISTS amount numeric(12,2) DEFAULT 0;

ALTER TABLE public.item_master ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'item_master' AND policyname = 'item_master_select_authenticated') THEN
    CREATE POLICY item_master_select_authenticated ON public.item_master FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'item_master' AND policyname = 'item_master_all_owner') THEN
    CREATE POLICY item_master_all_owner ON public.item_master FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

-- 2. Fixed Asset Master table
CREATE TABLE IF NOT EXISTS public.fixed_asset_master (
  id text PRIMARY KEY DEFAULT ('ast-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  parent text DEFAULT '',
  sub_parent text DEFAULT '',
  uom text DEFAULT 'nos',
  units numeric(12,2) DEFAULT 1,
  amount numeric(12,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.fixed_asset_master ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fixed_asset_master' AND policyname = 'fixed_asset_master_select_authenticated') THEN
    CREATE POLICY fixed_asset_master_select_authenticated ON public.fixed_asset_master FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fixed_asset_master' AND policyname = 'fixed_asset_master_all_owner') THEN
    CREATE POLICY fixed_asset_master_all_owner ON public.fixed_asset_master FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

