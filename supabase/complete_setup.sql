-- Hami Yuwa Club (SKT) - Complete Supabase Database Setup
-- Project: tjawgszwbozvxqugdnva

-- 1. Customer Master (People Master)
CREATE TABLE IF NOT EXISTS public.customer_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  district text DEFAULT 'सुर्खेत',
  municipality text DEFAULT 'वीरेन्द्रनगर',
  ward text NOT NULL,
  card text NOT NULL,
  name text NOT NULL,
  tole text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text DEFAULT '',
  pan text DEFAULT '',
  full_address text DEFAULT '',
  plan text DEFAULT 'घरायसी (Household)',
  plan_id text DEFAULT '',
  plans jsonb DEFAULT '[]'::jsonb,
  joining_date text DEFAULT '',
  latitude double precision,
  longitude double precision,
  gps_accuracy double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_master_owner_card_key UNIQUE (owner_id, card)
);

ALTER TABLE public.customer_master ADD COLUMN IF NOT EXISTS plans jsonb DEFAULT '[]'::jsonb;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_master TO authenticated;
GRANT ALL ON public.customer_master TO service_role;
ALTER TABLE public.customer_master ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_master' AND policyname = 'owner_access_customer_master') THEN
    CREATE POLICY owner_access_customer_master ON public.customer_master FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

-- 2. Member Counters (Auto Card Numbering 0001, 0002...)
CREATE TABLE IF NOT EXISTS public.member_counters (
  owner_id uuid PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE ON public.member_counters TO authenticated;
GRANT ALL ON public.member_counters TO service_role;
ALTER TABLE public.member_counters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'member_counters' AND policyname = 'owner_access_member_counters') THEN
    CREATE POLICY owner_access_member_counters ON public.member_counters FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

-- 3. Receipt Counters (Sequential Receipt Numbers per Ward and FY)
CREATE TABLE IF NOT EXISTS public.receipt_counters (
  owner_id uuid NOT NULL,
  ward text NOT NULL,
  fiscal_year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id, ward, fiscal_year)
);

GRANT SELECT, INSERT, UPDATE ON public.receipt_counters TO authenticated;
GRANT ALL ON public.receipt_counters TO service_role;
ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'receipt_counters' AND policyname = 'owner_access_receipt_counters') THEN
    CREATE POLICY owner_access_receipt_counters ON public.receipt_counters FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

-- 4. Ward Receipts
CREATE TABLE IF NOT EXISTS public.ward_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  ward text NOT NULL,
  fiscal_year integer NOT NULL,
  no integer NOT NULL,
  card text NOT NULL,
  receipt_date text NOT NULL,
  ref text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, ward, fiscal_year, no),
  CONSTRAINT ward_receipts_ref_key UNIQUE(owner_id, ref)
);

GRANT SELECT, INSERT, UPDATE ON public.ward_receipts TO authenticated;
GRANT ALL ON public.ward_receipts TO service_role;
ALTER TABLE public.ward_receipts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ward_receipts' AND policyname = 'owner_access_ward_receipts') THEN
    CREATE POLICY owner_access_ward_receipts ON public.ward_receipts FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

-- 5. Receipt Month Payments (Multi-Year Payment tracking per month)
CREATE TABLE IF NOT EXISTS public.receipt_month_payments (
  owner_id uuid NOT NULL,
  ward text NOT NULL,
  fiscal_year integer NOT NULL,
  card text NOT NULL,
  month integer NOT NULL,
  receipt_id uuid NOT NULL REFERENCES public.ward_receipts(id) ON DELETE CASCADE,
  PRIMARY KEY (owner_id, ward, fiscal_year, card, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_month_payments TO authenticated;
GRANT ALL ON public.receipt_month_payments TO service_role;
ALTER TABLE public.receipt_month_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'receipt_month_payments' AND policyname = 'owner_access_receipt_month_payments') THEN
    CREATE POLICY owner_access_receipt_month_payments ON public.receipt_month_payments FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

-- 6. Plan Master
CREATE TABLE IF NOT EXISTS public.plan_master (
  id text PRIMARY KEY DEFAULT ('plan-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  uom text DEFAULT 'महिना (Month)',
  rate numeric(10,2) DEFAULT 0,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  incentive numeric(10,2) NOT NULL DEFAULT 0,
  chargeable_amount numeric(10,2) NOT NULL DEFAULT 0,
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.plan_master ADD COLUMN IF NOT EXISTS uom text DEFAULT 'महिना (Month)';
ALTER TABLE public.plan_master ADD COLUMN IF NOT EXISTS rate numeric(10,2) DEFAULT 0;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_master TO authenticated;
GRANT ALL ON public.plan_master TO service_role;
ALTER TABLE public.plan_master ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plan_master' AND policyname = 'plan_master_authenticated_read') THEN
    CREATE POLICY plan_master_authenticated_read ON public.plan_master FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plan_master' AND policyname = 'plan_master_owner_all') THEN
    CREATE POLICY plan_master_owner_all ON public.plan_master FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

-- 7. RPC: save_ward_receipt
CREATE OR REPLACE FUNCTION public.save_ward_receipt(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); fy integer; mo integer; seq integer; rid uuid; result jsonb; item jsonb; card_no text; phone text; item_fy integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF coalesce(p->>'ward','') !~ '^([1-9]|[1-9][0-9])$' OR coalesce(trim(p->>'name'),'') = '' OR coalesce(trim(p->>'tole'),'') = '' THEN RAISE EXCEPTION 'Ward, name and tole required'; END IF;
  card_no := coalesce(trim(p->>'card'),'');
  IF card_no = '' THEN RAISE EXCEPTION 'Customer card number is required. Please register the customer in People Master first.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customer_master WHERE owner_id = uid AND card = card_no AND ward = p->>'ward') THEN
    RAISE EXCEPTION 'Customer with card "%" is not registered in People Master for Ward %. Please create the customer in People Master first.', card_no, p->>'ward';
  END IF;
  IF coalesce(trim(p->>'ref'),'') = '' OR length(trim(p->>'ref')) > 40 THEN RAISE EXCEPTION 'Reference number required'; END IF;
  phone := coalesce(trim(p->>'phone'),'');
  IF phone <> '' AND phone !~ '^9[0-9]{9}$' THEN RAISE EXCEPTION 'Invalid contact number'; END IF;
  IF coalesce(p->>'mode','') NOT IN ('नगद (Cash)','eSewa','Khalti','बैंक (Bank)','चेक (Cheque)') THEN RAISE EXCEPTION 'Payment mode required'; END IF;
  IF coalesce(p->>'date','') !~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}$' THEN RAISE EXCEPTION 'Invalid date'; END IF;
  mo := split_part(p->>'date','/',2)::integer;
  IF mo NOT BETWEEN 1 AND 12 OR split_part(p->>'date','/',3)::integer NOT BETWEEN 1 AND 32 THEN RAISE EXCEPTION 'Invalid date'; END IF;
  IF coalesce(p->>'year','') !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'Fiscal year required'; END IF;
  fy := (p->>'year')::integer;
  IF fy NOT BETWEEN 2079 AND 2099 THEN RAISE EXCEPTION 'Fiscal year out of range'; END IF;
  IF jsonb_typeof(p->'months') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'months') = 0 THEN RAISE EXCEPTION 'Choose a month'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'months') LOOP
    item_fy := coalesce((item->>'year')::integer, fy);
    IF (item->>'m')::integer NOT BETWEEN 0 AND 11 OR (item->>'amt')::numeric <= 0 OR item_fy NOT BETWEEN 2079 AND 2099 THEN
      RAISE EXCEPTION 'Invalid month or amount';
    END IF;
  END LOOP;
  INSERT INTO public.receipt_counters(owner_id,ward,fiscal_year,last_number) VALUES(uid,p->>'ward',fy,1) ON CONFLICT(owner_id,ward,fiscal_year) DO UPDATE SET last_number = receipt_counters.last_number + 1 RETURNING last_number INTO seq;
  result := p || jsonb_build_object('card',card_no,'phone',phone,'ref',trim(p->>'ref'),'no',seq,'year',fy::text,'total',(SELECT sum((value->>'amt')::numeric) FROM jsonb_array_elements(p->'months')));
  INSERT INTO public.ward_receipts(owner_id,ward,fiscal_year,no,card,receipt_date,ref,payload) VALUES(uid,p->>'ward',fy,seq,card_no,p->>'date',trim(p->>'ref'),result) RETURNING id INTO rid;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'months') LOOP
    item_fy := coalesce((item->>'year')::integer, fy);
    INSERT INTO public.receipt_month_payments VALUES(uid,p->>'ward',item_fy,card_no,(item->>'m')::integer,rid);
  END LOOP;
  RETURN result || jsonb_build_object('id',rid);
END $$;

REVOKE ALL ON FUNCTION public.save_ward_receipt(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_ward_receipt(jsonb) TO authenticated;

-- 8. RPC: save_customer_master
CREATE OR REPLACE FUNCTION public.save_customer_master(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  card_no text;
  mseq integer;
  phone_val text;
  email_val text;
  district_val text;
  municipality_val text;
  pan_val text;
  address_val text;
  plan_val text;
  plan_id_val text;
  joining_date_val text;
  lat_val double precision;
  lng_val double precision;
  acc_val double precision;
  res jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF coalesce(p->>'ward','') !~ '^([1-9]|[1-9][0-9])$' OR coalesce(trim(p->>'name'),'') = '' OR coalesce(trim(p->>'tole'),'') = '' THEN
    RAISE EXCEPTION 'Ward, name and tole are required';
  END IF;

  phone_val := coalesce(trim(p->>'phone'),'');
  IF phone_val <> '' AND phone_val !~ '^9[0-9]{9}$' THEN
    RAISE EXCEPTION 'Contact number must be 10 digits starting with 9';
  END IF;

  email_val := coalesce(trim(p->>'email'), '');
  district_val := coalesce(trim(p->>'district'), 'सुर्खेत');
  municipality_val := coalesce(trim(p->>'municipality'), 'वीरेन्द्रनगर');
  pan_val := coalesce(trim(p->>'pan'), '');
  address_val := coalesce(trim(p->>'full_address'), '');
  plan_val := coalesce(trim(p->>'plan'), 'घरायसी (Household)');
  plan_id_val := coalesce(trim(p->>'plan_id'), '');
  joining_date_val := coalesce(trim(p->>'joining_date'), '');

  IF (p->>'latitude') IS NOT NULL AND (p->>'latitude') <> '' THEN
    lat_val := (p->>'latitude')::double precision;
  ELSE
    lat_val := NULL;
  END IF;

  IF (p->>'longitude') IS NOT NULL AND (p->>'longitude') <> '' THEN
    lng_val := (p->>'longitude')::double precision;
  ELSE
    lng_val := NULL;
  END IF;

  IF (p->>'gps_accuracy') IS NOT NULL AND (p->>'gps_accuracy') <> '' THEN
    acc_val := (p->>'gps_accuracy')::double precision;
  ELSE
    acc_val := NULL;
  END IF;

  card_no := coalesce(trim(p->>'card'),'');
  IF card_no = '' THEN
    INSERT INTO public.member_counters(owner_id, last_number) VALUES(uid, 1)
    ON CONFLICT(owner_id) DO UPDATE SET last_number = member_counters.last_number + 1
    RETURNING last_number INTO mseq;
    card_no := lpad(mseq::text, 4, '0');
  END IF;

  INSERT INTO public.customer_master(
    owner_id, ward, card, name, tole, phone, email, district, municipality, pan, full_address, plan, plan_id, joining_date, latitude, longitude, gps_accuracy
  ) VALUES (
    uid, p->>'ward', card_no, trim(p->>'name'), trim(p->>'tole'), phone_val, email_val, district_val, municipality_val, pan_val, address_val, plan_val, plan_id_val, joining_date_val, lat_val, lng_val, acc_val
  )
  ON CONFLICT(owner_id, card) DO UPDATE
    SET ward = excluded.ward,
        name = excluded.name,
        tole = excluded.tole,
        phone = excluded.phone,
        email = excluded.email,
        district = excluded.district,
        municipality = excluded.municipality,
        pan = excluded.pan,
        full_address = excluded.full_address,
        plan = excluded.plan,
        plan_id = excluded.plan_id,
        joining_date = excluded.joining_date,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        gps_accuracy = excluded.gps_accuracy;

  res := jsonb_build_object(
    'card', card_no,
    'ward', p->>'ward',
    'name', trim(p->>'name'),
    'tole', trim(p->>'tole'),
    'phone', phone_val,
    'email', email_val,
    'district', district_val,
    'municipality', municipality_val,
    'pan', pan_val,
    'full_address', address_val,
    'plan', plan_val,
    'plan_id', plan_id_val,
    'joining_date', joining_date_val,
    'latitude', lat_val,
    'longitude', lng_val,
    'gps_accuracy', acc_val
  );
  RETURN res;
END $$;

REVOKE ALL ON FUNCTION public.save_customer_master(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_customer_master(jsonb) TO authenticated;

-- 9. RPC: delete_customer_master
CREATE OR REPLACE FUNCTION public.delete_customer_master(p jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF EXISTS (SELECT 1 FROM public.receipt_month_payments WHERE owner_id = uid AND card = trim(p->>'card') AND ward = p->>'ward') THEN
    RAISE EXCEPTION 'Cannot delete customer who already has payment receipts.';
  END IF;
  DELETE FROM public.customer_master WHERE owner_id = uid AND card = trim(p->>'card') AND ward = p->>'ward';
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.delete_customer_master(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_customer_master(jsonb) TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
