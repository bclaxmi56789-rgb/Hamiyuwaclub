-- Migration 0015: Expenses, Fixed Assets, Items/Inventory, Item Master

CREATE TABLE IF NOT EXISTS public.item_master (
  id text PRIMARY KEY DEFAULT ('itm-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  item_code text NOT NULL,
  name text NOT NULL,
  uom text DEFAULT 'nos',
  category text DEFAULT 'item',
  last_rate numeric(12,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.item_master ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'item_master' AND policyname = 'item_master_select_authenticated') THEN
    CREATE POLICY item_master_select_authenticated ON public.item_master FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'item_master' AND policyname = 'item_master_all_owner') THEN
    CREATE POLICY item_master_all_owner ON public.item_master FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.expense_records (
  id text PRIMARY KEY DEFAULT ('exp-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  expense_type text NOT NULL DEFAULT 'expense',
  date_bs text NOT NULL,
  bill_number text DEFAULT '',
  vendor_id text DEFAULT '',
  vendor_name text DEFAULT '',
  linked_member_id text DEFAULT '',
  linked_employee_id text DEFAULT '',
  linked_event_id text DEFAULT '',
  line_items jsonb DEFAULT '[]',
  other_charges numeric(12,2) DEFAULT 0,
  other_charges_desc text DEFAULT '',
  subtotal numeric(12,2) DEFAULT 0,
  final_amount numeric(12,2) DEFAULT 0,
  bill_scanned_amount numeric(12,2) DEFAULT 0,
  bill_match_status text DEFAULT 'pending',
  remarks text DEFAULT '',
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.expense_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expense_records' AND policyname = 'expense_records_select_authenticated') THEN
    CREATE POLICY expense_records_select_authenticated ON public.expense_records FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expense_records' AND policyname = 'expense_records_all_owner') THEN
    CREATE POLICY expense_records_all_owner ON public.expense_records FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
