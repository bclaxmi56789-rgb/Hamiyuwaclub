-- Migration 0026: Employee other allowance, payroll other allowance, and payment voucher reference
ALTER TABLE public.employee_master
  ADD COLUMN IF NOT EXISTS other_allowance numeric(10,2) DEFAULT 0;

ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS other_allowance numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voucher_ref text DEFAULT '';

NOTIFY pgrst, 'reload schema';

