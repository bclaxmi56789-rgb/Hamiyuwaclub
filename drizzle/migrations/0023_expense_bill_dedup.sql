-- Migration 0023: deduplicate existing vendor + bill number rows, then enforce uniqueness.
-- The oldest record keeps the plain bill number; later copies get " / दोहोरो-<order> (<id>)"
-- so no accounting amount is lost and history stays visible.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    WITH grp AS (
      SELECT owner_id,
             coalesce(vendor_id, '') AS vid,
             lower(coalesce(vendor_name, '')) AS vname,
             lower(btrim(bill_number)) AS bill
      FROM public.expense_records
      WHERE btrim(bill_number) <> ''
      GROUP BY 1, 2, 3, 4
      HAVING count(*) > 1
    )
    SELECT e.id,
           row_number() OVER (
             PARTITION BY e.owner_id, coalesce(e.vendor_id, ''),
             lower(coalesce(e.vendor_name, '')), lower(btrim(e.bill_number))
             ORDER BY e.created_at ASC, e.id ASC
           ) AS rn
    FROM public.expense_records e
    JOIN grp g ON g.owner_id = e.owner_id
      AND g.vid = coalesce(e.vendor_id, '')
      AND g.vname = lower(coalesce(e.vendor_name, ''))
      AND g.bill = lower(btrim(e.bill_number))
  LOOP
    IF r.rn > 1 THEN
      UPDATE public.expense_records
      SET bill_number = btrim(bill_number) || ' / दोहोरो-' || r.rn || ' (' || r.id || ')'
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_expense_vendor_bill
ON public.expense_records (owner_id, coalesce(vendor_id, ''), lower(coalesce(vendor_name, '')), lower(btrim(bill_number)))
WHERE btrim(bill_number) <> '';

NOTIFY pgrst, 'reload schema';
