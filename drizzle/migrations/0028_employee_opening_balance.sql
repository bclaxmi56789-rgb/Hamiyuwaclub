-- Migration 0028: Employee ledger opening balance
-- Employee account is a credit (payable) ledger by default, same convention as vendor_master.
ALTER TABLE public.employee_master
  ADD COLUMN IF NOT EXISTS opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_type text NOT NULL DEFAULT 'cr'; -- 'dr' | 'cr'

NOTIFY pgrst, 'reload schema';
