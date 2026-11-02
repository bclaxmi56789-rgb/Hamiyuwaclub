-- Migration 0006: Add UOM and rate to plan_master and multiple plans support to customer_master
ALTER TABLE public.plan_master
  ADD COLUMN IF NOT EXISTS uom text DEFAULT 'महिना (Month)',
  ADD COLUMN IF NOT EXISTS rate numeric(10,2) DEFAULT 0;

ALTER TABLE public.customer_master
  ADD COLUMN IF NOT EXISTS plans jsonb DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
