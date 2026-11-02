-- Migration 0021: one bill per vendor — reject duplicate vendor + bill number rows.

CREATE UNIQUE INDEX IF NOT EXISTS ux_expense_vendor_bill
ON public.expense_records (owner_id, coalesce(vendor_id, ''), lower(coalesce(vendor_name, '')), lower(btrim(bill_number)))
WHERE btrim(bill_number) <> '';

NOTIFY pgrst, 'reload schema';
