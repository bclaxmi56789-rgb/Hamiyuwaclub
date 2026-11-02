-- Migration 0027: Payroll booking/locking workflow
-- Adds is_booked flag to payroll_records so payroll must be "booked" before payment
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS is_booked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS booked_at timestamptz;

-- Also track txn_type on rp_transactions so we can distinguish salary pay vs advance
ALTER TABLE public.rp_transactions
  ADD COLUMN IF NOT EXISTS txn_sub_type text DEFAULT '';

NOTIFY pgrst, 'reload schema';

