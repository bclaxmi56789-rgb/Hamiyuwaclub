-- Run this in Supabase SQL Editor to apply migration 0027
-- Migration 0027: Payroll booking/locking workflow

ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS is_booked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS booked_at timestamptz;

-- Backfill: mark all existing paid records as booked too
UPDATE public.payroll_records SET is_booked = true WHERE payment_status = 'paid';

NOTIFY pgrst, 'reload schema';

