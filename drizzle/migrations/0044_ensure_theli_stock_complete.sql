-- Migration 0044: Complete Theli Stock, Issuance, and Logs Schema
-- Ensures all 3 tables exist with all required columns, default values, and RLS policies.
-- Safe and idempotent: uses CREATE TABLE IF NOT EXISTS and ALTER TABLE ... ADD COLUMN IF NOT EXISTS.

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

ALTER TABLE public.theli_stock_batches
  ADD COLUMN IF NOT EXISTS municipality text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ward text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fiscal_year text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS start_from text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS end_to text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vouchers_per_theli integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS total_vouchers integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_theli integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remarks text DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_theli_stock_batches_owner ON public.theli_stock_batches(owner_id);
CREATE INDEX IF NOT EXISTS idx_theli_stock_batches_ward ON public.theli_stock_batches(ward, fiscal_year);

ALTER TABLE public.theli_stock_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_theli_stock_batches" ON public.theli_stock_batches;
CREATE POLICY "owner_theli_stock_batches" ON public.theli_stock_batches
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.theli_stock_batches TO authenticated;


-- 2. theli_stock_items
CREATE TABLE IF NOT EXISTS public.theli_stock_items (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id text,
  municipality text NOT NULL DEFAULT '',
  ward text NOT NULL DEFAULT '',
  fiscal_year text NOT NULL DEFAULT '',
  theli_no integer DEFAULT 1,
  range_from text NOT NULL DEFAULT '',
  range_to text NOT NULL DEFAULT '',
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
  converted_to_receipt boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.theli_stock_items
  ADD COLUMN IF NOT EXISTS batch_id text,
  ADD COLUMN IF NOT EXISTS municipality text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ward text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fiscal_year text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS theli_no integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS range_from text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS range_to text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS total_vouchers integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS is_remaining_open boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS issued_to_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS issued_to_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS supervisor_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS issued_date text DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_voucher_booked text DEFAULT '',
  ADD COLUMN IF NOT EXISTS booked_vouchers_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_vouchers_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_range_from text DEFAULT '',
  ADD COLUMN IF NOT EXISTS remaining_range_to text DEFAULT '',
  ADD COLUMN IF NOT EXISTS amount_booked numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_obtained numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS converted_to_receipt boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_theli_stock_items_owner ON public.theli_stock_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_theli_stock_items_status ON public.theli_stock_items(ward, status);
CREATE INDEX IF NOT EXISTS idx_theli_stock_items_emp ON public.theli_stock_items(issued_to_id);

ALTER TABLE public.theli_stock_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_theli_stock_items" ON public.theli_stock_items;
CREATE POLICY "owner_theli_stock_items" ON public.theli_stock_items
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.theli_stock_items TO authenticated;


-- 3. theli_logs
CREATE TABLE IF NOT EXISTS public.theli_logs (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fiscal_year text NOT NULL DEFAULT '',
  ward text NOT NULL DEFAULT '',
  log_date text NOT NULL DEFAULT '',
  employee_id text NOT NULL DEFAULT '',
  employee_name text NOT NULL DEFAULT '',
  supervisor_type text DEFAULT 'member',
  supervisor_id text DEFAULT '',
  supervisor_name text DEFAULT '',
  opening_balance numeric(12,2) DEFAULT 0,
  out_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  in_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount numeric(12,2) DEFAULT 0,
  cleared_amount numeric(12,2) DEFAULT 0,
  settled boolean DEFAULT false,
  closing_serial text DEFAULT '',
  cancelled_count integer DEFAULT 0,
  net_valid_count integer DEFAULT 0,
  theli_number text DEFAULT '',
  last_remaining_from text DEFAULT '',
  last_remaining_to text DEFAULT '',
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.theli_logs
  ADD COLUMN IF NOT EXISTS fiscal_year text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ward text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS log_date text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS employee_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS employee_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS supervisor_type text DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS supervisor_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS supervisor_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS opening_balance numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS out_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS in_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cleared_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS closing_serial text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancelled_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_valid_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS theli_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_remaining_from text DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_remaining_to text DEFAULT '',
  ADD COLUMN IF NOT EXISTS remarks text DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_theli_logs_owner ON public.theli_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_theli_logs_date ON public.theli_logs(log_date, employee_id);

ALTER TABLE public.theli_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_theli_logs" ON public.theli_logs;
CREATE POLICY "owner_theli_logs" ON public.theli_logs
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.theli_logs TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

