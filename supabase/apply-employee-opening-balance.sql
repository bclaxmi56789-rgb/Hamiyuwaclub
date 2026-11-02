-- Run this in Supabase SQL Editor to apply migration 0028
-- Employee ledger opening balance (employee account defaults to credit/payable)

ALTER TABLE public.employee_master
  ADD COLUMN IF NOT EXISTS opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_type text NOT NULL DEFAULT 'cr'; -- 'dr' | 'cr'

NOTIFY pgrst, 'reload schema';
