CREATE TABLE public.customer_master (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL DEFAULT auth.uid(), ward text NOT NULL, card text NOT NULL, name text NOT NULL, tole text NOT NULL, phone text NOT NULL, UNIQUE(owner_id, ward, card));
GRANT SELECT ON public.customer_master TO authenticated; GRANT ALL ON public.customer_master TO service_role;
ALTER TABLE public.customer_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON public.customer_master FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE TABLE public.receipt_counters (owner_id uuid NOT NULL, ward text NOT NULL, fiscal_year integer NOT NULL, last_number integer NOT NULL DEFAULT 0, PRIMARY KEY(owner_id,ward,fiscal_year));
GRANT SELECT ON public.receipt_counters TO authenticated; GRANT ALL ON public.receipt_counters TO service_role;
ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON public.receipt_counters FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE TABLE public.ward_receipts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL DEFAULT auth.uid(), ward text NOT NULL, fiscal_year integer NOT NULL, no integer NOT NULL, card text NOT NULL, receipt_date text NOT NULL, ref text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,ward,fiscal_year,no), CONSTRAINT ward_receipts_ref_key UNIQUE(owner_id,ref));
GRANT SELECT ON public.ward_receipts TO authenticated; GRANT ALL ON public.ward_receipts TO service_role;
ALTER TABLE public.ward_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON public.ward_receipts FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE TABLE public.receipt_month_payments (owner_id uuid NOT NULL, ward text NOT NULL, fiscal_year integer NOT NULL, card text NOT NULL, month integer NOT NULL, receipt_id uuid NOT NULL REFERENCES public.ward_receipts(id), PRIMARY KEY(owner_id,ward,fiscal_year,card,month));
GRANT SELECT ON public.receipt_month_payments TO authenticated; GRANT ALL ON public.receipt_month_payments TO service_role;
ALTER TABLE public.receipt_month_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON public.receipt_month_payments FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE FUNCTION public.save_ward_receipt(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); fy integer; yr integer; mo integer; seq integer; rid uuid; result jsonb; item jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF coalesce(p->>'ward','') !~ '^([1-9]|[1-9][0-9])$' OR coalesce(trim(p->>'card'),'') = '' OR coalesce(trim(p->>'name'),'') = '' OR coalesce(trim(p->>'tole'),'') = '' THEN RAISE EXCEPTION 'Ward, card, name and tole required'; END IF;
 IF coalesce(trim(p->>'ref'),'') = '' OR length(trim(p->>'ref')) > 40 THEN RAISE EXCEPTION 'Reference number required'; END IF;
 IF coalesce(p->>'phone','') !~ '^9[0-9]{9}$' THEN RAISE EXCEPTION 'Valid contact number required'; END IF;
 IF coalesce(p->>'mode','') NOT IN ('नगद (Cash)','eSewa','Khalti','बैंक (Bank)','चेक (Cheque)') THEN RAISE EXCEPTION 'Payment mode required'; END IF;
 IF coalesce(p->>'date','') !~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}$' THEN RAISE EXCEPTION 'Invalid date'; END IF;
 yr := split_part(p->>'date','/',1)::integer; mo := split_part(p->>'date','/',2)::integer;
 IF mo NOT BETWEEN 1 AND 12 OR split_part(p->>'date','/',3)::integer NOT BETWEEN 1 AND 32 THEN RAISE EXCEPTION 'Invalid date'; END IF;
 fy := CASE WHEN mo >= 4 THEN yr ELSE yr - 1 END;
 IF jsonb_typeof(p->'months') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'months') = 0 THEN RAISE EXCEPTION 'Choose a month'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p->'months') LOOP
 IF (item->>'m')::integer NOT BETWEEN 0 AND 11 OR (item->>'amt')::numeric <= 0 THEN RAISE EXCEPTION 'Invalid month or amount'; END IF;
 END LOOP;
 INSERT INTO public.receipt_counters(owner_id,ward,fiscal_year,last_number) VALUES(uid,p->>'ward',fy,1) ON CONFLICT(owner_id,ward,fiscal_year) DO UPDATE SET last_number = receipt_counters.last_number + 1 RETURNING last_number INTO seq;
 result := p || jsonb_build_object('ref',trim(p->>'ref'),'no',seq,'year',fy::text,'total',(SELECT sum((value->>'amt')::numeric) FROM jsonb_array_elements(p->'months')));
 INSERT INTO public.ward_receipts(owner_id,ward,fiscal_year,no,card,receipt_date,ref,payload) VALUES(uid,p->>'ward',fy,seq,p->>'card',p->>'date',trim(p->>'ref'),result) RETURNING id INTO rid;
 FOR item IN SELECT value FROM jsonb_array_elements(p->'months') LOOP
 INSERT INTO public.receipt_month_payments VALUES(uid,p->>'ward',fy,p->>'card',(item->>'m')::integer,rid);
 END LOOP;
 INSERT INTO public.customer_master(owner_id,ward,card,name,tole,phone) VALUES(uid,p->>'ward',p->>'card',p->>'name',p->>'tole',p->>'phone') ON CONFLICT(owner_id,ward,card) DO UPDATE SET name=excluded.name,tole=excluded.tole,phone=excluded.phone;
 RETURN result || jsonb_build_object('id',rid);
END $$;
REVOKE ALL ON FUNCTION public.save_ward_receipt(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_ward_receipt(jsonb) TO authenticated;