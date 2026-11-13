-- Migration 0043: Fix theli_logs schema — add all columns the code needs.
-- The 0032 migration recreated theli_logs with a different schema (old flat model),
-- dropping the JSONB out_entries/in_entries columns the new model requires.
-- This migration adds all missing columns safely with IF NOT EXISTS.

-- Core columns from 0022 that may have been lost in 0032's recreate:
ALTER TABLE public.theli_logs
  ADD COLUMN IF NOT EXISTS supervisor_type text DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS supervisor_id   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS opening_balance numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS out_entries     jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS in_entries      jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS amount          numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cleared_amount  numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settled         boolean DEFAULT false;

-- New columns the code also saves (not in any prior migration):
ALTER TABLE public.theli_logs
  ADD COLUMN IF NOT EXISTS closing_serial  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancelled_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_valid_count integer DEFAULT 0;

-- Ensure fiscal_year is present (exists in 0032 schema; harmless if already there):
ALTER TABLE public.theli_logs
  ADD COLUMN IF NOT EXISTS fiscal_year text DEFAULT '';

-- Ensure RLS policy is correct and consistent with 0022:
ALTER TABLE public.theli_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_theli_logs" ON public.theli_logs;
CREATE POLICY "owner_theli_logs" ON public.theli_logs
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

REVOKE ALL ON public.theli_logs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.theli_logs TO authenticated;

-- Also ensure theli_stock_items has converted_to_receipt (added in 0033 but may be missing):
ALTER TABLE public.theli_stock_items
  ADD COLUMN IF NOT EXISTS converted_to_receipt boolean DEFAULT false;

-- Ensure theli_stock_batches and theli_stock_items have proper RLS:
ALTER TABLE public.theli_stock_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_theli_stock_batches" ON public.theli_stock_batches;
CREATE POLICY "owner_theli_stock_batches" ON public.theli_stock_batches
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.theli_stock_batches TO authenticated;

ALTER TABLE public.theli_stock_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_theli_stock_items" ON public.theli_stock_items;
CREATE POLICY "owner_theli_stock_items" ON public.theli_stock_items
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.theli_stock_items TO authenticated;

-- Reload PostgREST schema cache:
NOTIFY pgrst, 'reload schema';

