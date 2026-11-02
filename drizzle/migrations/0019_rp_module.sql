-- Migration 0019: Receipts and Payments (cash and bank book)
-- Tables: rp_accounts (petty cash + bank master), rp_transactions (receipt, payment, transfer), rp_counters.
-- Run after 0017+; safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS public.rp_accounts (
  id text PRIMARY KEY DEFAULT ('rpa-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  account_type text NOT NULL DEFAULT 'cash',
  name text NOT NULL,
  account_number text DEFAULT '',
  opening_balance numeric(12,2) DEFAULT 0,
  address text DEFAULT '',
  remarks text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.rp_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rp_accounts' AND policyname = 'rp_accounts_select_authenticated') THEN
    CREATE POLICY rp_accounts_select_authenticated ON public.rp_accounts FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rp_accounts' AND policyname = 'rp_accounts_all_owner') THEN
    CREATE POLICY rp_accounts_all_owner ON public.rp_accounts FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.rp_transactions (
  id text PRIMARY KEY DEFAULT ('rpt-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  txn_type text NOT NULL,
  ref_no text NOT NULL,
  fiscal_year integer NOT NULL,
  txn_date text NOT NULL,
  account_id text NOT NULL,
  to_account_id text DEFAULT '',
  party_type text DEFAULT '',
  party_id text DEFAULT '',
  party_name text NOT NULL,
  amount numeric(12,2) NOT NULL,
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (owner_id, txn_type, fiscal_year, ref_no)
);

ALTER TABLE public.rp_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rp_transactions' AND policyname = 'rp_transactions_select_authenticated') THEN
    CREATE POLICY rp_transactions_select_authenticated ON public.rp_transactions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rp_transactions' AND policyname = 'rp_transactions_all_owner') THEN
    CREATE POLICY rp_transactions_all_owner ON public.rp_transactions FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.rp_counters (
  id text PRIMARY KEY DEFAULT ('rpc-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  txn_type text NOT NULL,
  fiscal_year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (owner_id, txn_type, fiscal_year)
);

ALTER TABLE public.rp_counters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rp_counters' AND policyname = 'rp_counters_select_authenticated') THEN
    CREATE POLICY rp_counters_select_authenticated ON public.rp_counters FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rp_counters' AND policyname = 'rp_counters_all_owner') THEN
    CREATE POLICY rp_counters_all_owner ON public.rp_counters FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

-- One atomic save: validates, allocates the next ref number for its type and fiscal year,
-- and inserts the transaction in a single database transaction.
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
