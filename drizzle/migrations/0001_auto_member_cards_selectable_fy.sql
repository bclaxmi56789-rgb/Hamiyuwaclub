CREATE TABLE public.member_counters (owner_id uuid PRIMARY KEY, last_number integer NOT NULL DEFAULT 0);
GRANT SELECT ON public.member_counters TO authenticated; GRANT ALL ON public.member_counters TO service_role;
ALTER TABLE public.member_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON public.member_counters FOR SELECT TO authenticated USING (owner_id = auth.uid());
ALTER TABLE public.customer_master ADD CONSTRAINT customer_master_owner_card_key UNIQUE (owner_id, card);
CREATE OR REPLACE FUNCTION public.save_ward_receipt(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); fy integer; mo integer; seq integer; rid uuid; result jsonb; item jsonb; card_no text; mseq integer; phone text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF coalesce(p->>'ward','') !~ '^([1-9]|[1-9][0-9])$' OR coalesce(trim(p->>'name'),'') = '' OR coalesce(trim(p->>'tole'),'') = '' THEN RAISE EXCEPTION 'Ward, name and tole required'; END IF;
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
 IF (item->>'m')::integer NOT BETWEEN 0 AND 11 OR (item->>'amt')::numeric <= 0 THEN RAISE EXCEPTION 'Invalid month or amount'; END IF;
 END LOOP;
 card_no := coalesce(trim(p->>'card'),'');
 IF card_no = '' THEN
  INSERT INTO public.member_counters(owner_id,last_number) VALUES(uid,1) ON CONFLICT(owner_id) DO UPDATE SET last_number = member_counters.last_number + 1 RETURNING last_number INTO mseq;
  card_no := lpad(mseq::text, 4, '0');
 ELSIF NOT EXISTS (SELECT 1 FROM public.customer_master WHERE owner_id = uid AND card = card_no) THEN
  RAISE EXCEPTION 'Card number not found';
 END IF;
 INSERT INTO public.receipt_counters(owner_id,ward,fiscal_year,last_number) VALUES(uid,p->>'ward',fy,1) ON CONFLICT(owner_id,ward,fiscal_year) DO UPDATE SET last_number = receipt_counters.last_number + 1 RETURNING last_number INTO seq;
 result := p || jsonb_build_object('card',card_no,'phone',phone,'ref',trim(p->>'ref'),'no',seq,'year',fy::text,'total',(SELECT sum((value->>'amt')::numeric) FROM jsonb_array_elements(p->'months')));
 INSERT INTO public.ward_receipts(owner_id,ward,fiscal_year,no,card,receipt_date,ref,payload) VALUES(uid,p->>'ward',fy,seq,card_no,p->>'date',trim(p->>'ref'),result) RETURNING id INTO rid;
 FOR item IN SELECT value FROM jsonb_array_elements(p->'months') LOOP
 INSERT INTO public.receipt_month_payments VALUES(uid,p->>'ward',fy,card_no,(item->>'m')::integer,rid);
 END LOOP;
 INSERT INTO public.customer_master(owner_id,ward,card,name,tole,phone) VALUES(uid,p->>'ward',card_no,p->>'name',p->>'tole',phone) ON CONFLICT(owner_id,card) DO UPDATE SET ward=excluded.ward,name=excluded.name,tole=excluded.tole,phone=excluded.phone;
 RETURN result || jsonb_build_object('id',rid);
END $$;
REVOKE ALL ON FUNCTION public.save_ward_receipt(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_ward_receipt(jsonb) TO authenticated;