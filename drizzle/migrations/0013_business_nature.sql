-- Migration 0013: Business nature (50 item master list) on customer_master
ALTER TABLE public.customer_master
  ADD COLUMN IF NOT EXISTS nature text DEFAULT '';

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
  plan_id_val text;
  plans_val jsonb;
  joining_date_val text;
  lat_val double precision;
  lng_val double precision;
  acc_val double precision;
  opening_dues_val jsonb;
  locality_photo_val text;
  nature_val text;
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
  plan_id_val := coalesce(trim(p->>'plan_id'), '');
  plans_val := coalesce(p->'plans', '[]'::jsonb);
  joining_date_val := coalesce(trim(p->>'joining_date'), '');
  opening_dues_val := coalesce(p->'opening_dues', '[]'::jsonb);
  locality_photo_val := coalesce(trim(p->>'locality_photo'), '');
  nature_val := coalesce(trim(p->>'nature'), '');

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

  INSERT INTO public.customer_master(owner_id, ward, card, name, tole, phone, district, municipality, pan, full_address, plan, plan_id, plans, joining_date, latitude, longitude, gps_accuracy, opening_dues, locality_photo, nature)
  VALUES(uid, p->>'ward', card_no, trim(p->>'name'), trim(p->>'tole'), phone, district_val, municipality_val, pan_val, address_val, plan_val, plan_id_val, plans_val, joining_date_val, lat_val, lng_val, acc_val, opening_dues_val, locality_photo_val, nature_val)
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
        plan_id = excluded.plan_id,
        plans = excluded.plans,
        joining_date = excluded.joining_date,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        gps_accuracy = excluded.gps_accuracy,
        opening_dues = excluded.opening_dues,
        locality_photo = excluded.locality_photo,
        nature = excluded.nature;

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
    'plan_id', plan_id_val,
    'plans', plans_val,
    'joining_date', joining_date_val,
    'latitude', lat_val,
    'longitude', lng_val,
    'gps_accuracy', acc_val,
    'opening_dues', opening_dues_val,
    'locality_photo', locality_photo_val,
    'nature', nature_val
  );
  RETURN res;
END $$;

REVOKE ALL ON FUNCTION public.save_customer_master(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_customer_master(jsonb) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_customer_master_nature ON public.customer_master(owner_id, nature);

NOTIFY pgrst, 'reload schema';
