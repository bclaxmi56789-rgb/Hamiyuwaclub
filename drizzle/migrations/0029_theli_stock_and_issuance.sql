-- Migration 0029: Theli Stock Master, Issuance, and Status Tracking
CREATE TABLE IF NOT EXISTS public.theli_stock_batches (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  municipality text NOT NULL DEFAULT '',
  ward text NOT NULL DEFAULT '',
  fiscal_year text NOT NULL DEFAULT '',
  start_from text NOT NULL DEFAULT '',
  end_to text NOT NULL DEFAULT '',
  vouchers_per_theli integer NOT NULL DEFAULT 50,
  total_vouchers integer NOT NULL DEFAULT 0,
  total_theli integer NOT NULL DEFAULT 0,
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_theli_stock_batches_owner ON public.theli_stock_batches(owner_id);
CREATE INDEX IF NOT EXISTS idx_theli_stock_batches_ward ON public.theli_stock_batches(ward, fiscal_year);

ALTER TABLE public.theli_stock_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_theli_stock_batches" ON public.theli_stock_batches;
CREATE POLICY "owner_theli_stock_batches" ON public.theli_stock_batches
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

REVOKE ALL ON public.theli_stock_batches FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.theli_stock_batches TO authenticated;


CREATE TABLE IF NOT EXISTS public.theli_stock_items (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id text REFERENCES public.theli_stock_batches(id) ON DELETE CASCADE,
  municipality text NOT NULL DEFAULT '',
  ward text NOT NULL DEFAULT '',
  fiscal_year text NOT NULL DEFAULT '',
  theli_no integer DEFAULT 1,
  range_from text NOT NULL,
  range_to text NOT NULL,
  total_vouchers integer NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'available', -- 'available' | 'returned_remaining' | 'issued' | 'partially_booked' | 'completed'
  is_remaining_open boolean DEFAULT false,
  issued_to_id text DEFAULT '',
  issued_to_name text DEFAULT '',
  supervisor_name text DEFAULT '',
  issued_date text DEFAULT '',
  last_voucher_booked text DEFAULT '',
  booked_vouchers_count integer DEFAULT 0,
  cancelled_count integer DEFAULT 0,
  remaining_vouchers_count integer DEFAULT 0,
  remaining_range_from text DEFAULT '',
  remaining_range_to text DEFAULT '',
  amount_booked numeric(12,2) DEFAULT 0,
  amount_obtained numeric(12,2) DEFAULT 0,
  balance numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_theli_stock_items_owner ON public.theli_stock_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_theli_stock_items_status ON public.theli_stock_items(ward, status);
CREATE INDEX IF NOT EXISTS idx_theli_stock_items_emp ON public.theli_stock_items(issued_to_id);

ALTER TABLE public.theli_stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_theli_stock_items" ON public.theli_stock_items;
CREATE POLICY "owner_theli_stock_items" ON public.theli_stock_items
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

REVOKE ALL ON public.theli_stock_items FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.theli_stock_items TO authenticated;

NOTIFY pgrst, 'reload schema';

