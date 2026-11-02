-- FIX: Re-apply the current save_rp_transaction.
-- 1) Fiscal-year check accepts every supported BS fiscal year (2079/80 .. 2100/101):
--    the previously deployed copy had a narrower range, so BS 2083+ dates failed
--    with "Fiscal year out of range".
-- 2) Non-transfer rows write NULL to to_account_id instead of '' so the deployed
--    rp_transactions_to_account_fk foreign key is satisfied.
-- 3) Payments may carry a manual reference (eSewa/Khalti/bank ref or slip number);
--    duplicates rejected, auto counter untouched so previews stay in sync.
-- Run once in the Lovable Cloud SQL editor. Safe to re-run (CREATE OR REPLACE).


CREATE OR REPLACE FUNCTION public.save_rp_transaction(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  fy integer;
  seq integer;
  ref_no text;
  manual_ref text;
  acc_from public.rp_accounts;
  acc_to public.rp_accounts;
  result jsonb;
  rid text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF coalesce(p->>'txn_type','') NOT IN ('receipt','payment','transfer') THEN
    RAISE EXCEPTION 'Invalid transaction type';
  END IF;
  IF coalesce(p->>'txn_date','') !~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}$' THEN
    RAISE EXCEPTION 'Invalid date';
  END IF;
  fy := regexp_replace(p->>'txn_date','^([0-9]{4}).*','\1')::integer
    + (CASE WHEN split_part(p->>'txn_date','/',2)::integer >= 4 THEN 0 ELSE -1 END);
  IF fy NOT BETWEEN 2079 AND 2100 THEN RAISE EXCEPTION 'Fiscal year out of range'; END IF;
  IF coalesce((p->>'amount')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO acc_from FROM public.rp_accounts WHERE id = coalesce(p->>'account_id','') AND owner_id = uid;
  IF acc_from.id IS NULL THEN RAISE EXCEPTION 'Choose the cash or bank account'; END IF;

  IF p->>'txn_type' = 'transfer' THEN
    SELECT * INTO acc_to FROM public.rp_accounts WHERE id = coalesce(p->>'to_account_id','') AND owner_id = uid;
    IF acc_to.id IS NULL THEN RAISE EXCEPTION 'Choose the destination account'; END IF;
    IF acc_to.id = acc_from.id THEN RAISE EXCEPTION 'Source and destination accounts must be different';
    END IF;
  ELSE
    IF coalesce(trim(p->>'party_name'),'') = '' THEN
      RAISE EXCEPTION 'Select the customer, vendor or employee';
    END IF;
  END IF;

  -- Manual reference (typed exactly as staff prefer, e.g. eSewa/Khalti/bank ref or
  -- receipt slip number) wins over the auto number; the auto counter is untouched
  -- so the next automatic reference keeps the preview and save in sync.
  manual_ref := trim(coalesce(p->>'manual_ref',''));
  IF char_length(manual_ref) > 40 THEN RAISE EXCEPTION 'Reference number too long'; END IF;
  IF manual_ref <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.rp_transactions t
      WHERE t.owner_id = uid AND t.ref_no = manual_ref
    ) THEN
      RAISE EXCEPTION 'Reference number already used';
    END IF;
    ref_no := manual_ref;
  ELSE
    INSERT INTO public.rp_counters(owner_id,txn_type,fiscal_year,last_number)
    VALUES(uid, p->>'txn_type', fy, 1)
    ON CONFLICT(owner_id,txn_type,fiscal_year)
    DO UPDATE SET last_number = public.rp_counters.last_number + 1
    RETURNING last_number INTO seq;

    ref_no := (CASE p->>'txn_type' WHEN 'receipt' THEN 'R' WHEN 'payment' THEN 'P' ELSE 'T' END)
      || '-' || lpad(seq::text, 4, '0');
  END IF;

  result := p || jsonb_build_object(
    'ref_no', ref_no,
    'fiscal_year', fy,
    'account_name', acc_from.name,
    'account_type', acc_from.account_type
  );
  IF p->>'txn_type' = 'transfer' THEN
    result := result || jsonb_build_object('to_account_name', acc_to.name);
  END IF;

  INSERT INTO public.rp_transactions(
    owner_id, txn_type, ref_no, fiscal_year, txn_date, account_id, to_account_id,
    party_type, party_id, party_name, amount, remarks
  ) VALUES (
    uid, p->>'txn_type', ref_no, fy, p->>'txn_date', acc_from.id,
    -- Non-transfer rows carry no destination account: write NULL, never the empty
    -- string, so the deployed to_account_id foreign key is satisfied.
    NULLIF(coalesce(p->>'to_account_id',''), ''),
    coalesce(p->>'party_type',''), coalesce(p->>'party_id',''),
    coalesce(trim(p->>'party_name'),''), (p->>'amount')::numeric,
    coalesce(trim(p->>'remarks'),'')
  ) RETURNING id INTO rid;

  RETURN result || jsonb_build_object('id', rid);
END $$;

REVOKE ALL ON FUNCTION public.save_rp_transaction(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_rp_transaction(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- 4) One bill per vendor: reject a second expense with the same vendor + bill number
--    (vendor matched by id or typed name; bill number case/whitespace tolerant;
--    empty bill numbers are always allowed).
--    Existing duplicate rows are NOT deleted — the oldest copy keeps the plain bill
--    number, later copies get " / दोहोरो-<order> (<id>)" appended so history is kept.
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

-- 5) Theli daily log: collector cart out/in ranges with carried-forward cash balance
CREATE TABLE IF NOT EXISTS public.theli_logs (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date text NOT NULL,
  ward text DEFAULT '',
  employee_id text DEFAULT '',
  employee_name text DEFAULT '',
  supervisor_type text DEFAULT 'member',
  supervisor_id text DEFAULT '',
  supervisor_name text DEFAULT '',
  opening_balance numeric(12,2) DEFAULT 0,
  out_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  in_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount numeric(12,2) DEFAULT 0,
  cleared_amount numeric(12,2) DEFAULT 0,
  remarks text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_theli_logs_owner ON public.theli_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_theli_logs_date ON public.theli_logs(log_date);

ALTER TABLE public.theli_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_theli_logs" ON public.theli_logs;
CREATE POLICY "owner_theli_logs" ON public.theli_logs
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

REVOKE ALL ON public.theli_logs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.theli_logs TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';
