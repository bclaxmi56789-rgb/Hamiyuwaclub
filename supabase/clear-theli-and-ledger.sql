-- Complete safe script to reset or setup theli stock & ledger tables cleanly.
-- It creates the tables if they don't exist yet, or clears (truncates) them if they do exist.

-- 1. theli_stock_batches
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

-- 2. theli_stock_items
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
  status text NOT NULL DEFAULT 'available',
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

-- 3. theli_logs (daily theli register / ledger)
CREATE TABLE IF NOT EXISTS public.theli_logs (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fiscal_year text NOT NULL DEFAULT '',
  ward text NOT NULL DEFAULT '',
  log_date text NOT NULL,
  employee_id text NOT NULL,
  employee_name text NOT NULL DEFAULT '',
  theli_number text NOT NULL DEFAULT '',
  last_remaining_from text DEFAULT '',
  last_remaining_to text DEFAULT '',
  issued_from text DEFAULT '',
  issued_to text DEFAULT '',
  total_theli_in_hand integer DEFAULT 0,
  total_vouchers_in_hand integer DEFAULT 0,
  booked_vouchers_count integer DEFAULT 0,
  rate_per_voucher numeric(10,2) DEFAULT 0,
  total_amount_booked numeric(12,2) DEFAULT 0,
  total_amount_obtained numeric(12,2) DEFAULT 0,
  carried_balance numeric(12,2) DEFAULT 0,
  new_balance numeric(12,2) DEFAULT 0,
  supervisor_name text DEFAULT '',
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
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

-- 4. Clean out all existing rows safely
TRUNCATE TABLE public.theli_stock_items CASCADE;
TRUNCATE TABLE public.theli_stock_batches CASCADE;
TRUNCATE TABLE public.theli_logs CASCADE;

NOTIFY pgrst, 'reload schema';
