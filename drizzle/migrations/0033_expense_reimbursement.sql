-- Migration 0033: employee reimbursement + theli receipt conversion
-- 1) Expense bills can be flagged as employee reimbursement; the bill payable
--    then sits on the linked employee's ledger, not the vendor's.
-- 2) Theli stock items remember when their booked amount was converted into a
--    receipt (रूपान्तरित), preventing double conversion.
ALTER TABLE public.expense_records ADD COLUMN IF NOT EXISTS employee_reimbursed boolean DEFAULT false;

ALTER TABLE public.theli_stock_items ADD COLUMN IF NOT EXISTS converted_to_receipt boolean DEFAULT false;
