-- Migration 0020: Add discount columns to expense_records

ALTER TABLE public.expense_records ADD COLUMN IF NOT EXISTS discount numeric(12,2) DEFAULT 0;
ALTER TABLE public.expense_records ADD COLUMN IF NOT EXISTS discount_desc text DEFAULT '';

NOTIFY pgrst, 'reload schema';

