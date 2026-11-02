-- Add district, municipality, PAN, full_address, plan, joining_date, latitude, longitude, and gps_accuracy to customer_master
ALTER TABLE public.customer_master
  ADD COLUMN IF NOT EXISTS district text DEFAULT '',
  ADD COLUMN IF NOT EXISTS municipality text DEFAULT '',
  ADD COLUMN IF NOT EXISTS pan text DEFAULT '',
  ADD COLUMN IF NOT EXISTS full_address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS plan text DEFAULT '',
  ADD COLUMN IF NOT EXISTS joining_date text DEFAULT '',
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS gps_accuracy double precision;

-- Update save_customer_master RPC to support district, municipality, PAN, full address, plan, joining_date and GPS coordinates
CREATE OR REPLACE FUNCTION public.save_customer_master(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  card_no text;
  mseq integer;
  phone text;
  district_val text;
  municipality_val text;
  pan_val text;
  address_val text;
  plan_val text;
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

  phone := coalesce(trim(p->>'phone'),'');
  IF phone <> '' AND phone !~ '^9[0-9]{9}$' THEN
    RAISE EXCEPTION 'Contact number must be 10 digits starting with 9';
  END IF;

  district_val := coalesce(trim(p->>'district'), '');
  municipality_val := coalesce(trim(p->>'municipality'), '');
  pan_val := coalesce(trim(p->>'pan'), '');
  address_val := coalesce(trim(p->>'full_address'), '');
  plan_val := coalesce(trim(p->>'plan'), '');
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

  INSERT INTO public.customer_master(owner_id, ward, card, name, tole, phone, district, municipality, pan, full_address, plan, joining_date, latitude, longitude, gps_accuracy)
  VALUES(uid, p->>'ward', card_no, trim(p->>'name'), trim(p->>'tole'), phone, district_val, municipality_val, pan_val, address_val, plan_val, joining_date_val, lat_val, lng_val, acc_val)
  ON CONFLICT(owner_id, card) DO UPDATE
    SET ward = excluded.ward,
        name = excluded.name,
        tole = excluded.tole,
        phone = excluded.phone,
        district = excluded.district,
        municipality = excluded.municipality,
        pan = excluded.pan,
        full_address = excluded.full_address,
        plan = excluded.plan,
        joining_date = excluded.joining_date,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        gps_accuracy = excluded.gps_accuracy;

  res := jsonb_build_object(
    'card', card_no,
    'ward', p->>'ward',
    'name', trim(p->>'name'),
    'tole', trim(p->>'tole'),
    'phone', phone,
    'district', district_val,
    'municipality', municipality_val,
    'pan', pan_val,
    'full_address', address_val,
    'plan', plan_val,
    'joining_date', joining_date_val,
    'latitude', lat_val,
    'longitude', lng_val,
    'gps_accuracy', acc_val
  );
  RETURN res;
END $$;

REVOKE ALL ON FUNCTION public.save_customer_master(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_customer_master(jsonb) TO authenticated;

-- Add plan_id to customer_master if not exists
ALTER TABLE public.customer_master
  ADD COLUMN IF NOT EXISTS plan_id text DEFAULT '';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
