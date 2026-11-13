-- Migration 0038: People Master ghardhani (house owner) details
-- For company-type natures and rentals, the ghardhani name is picked from
-- People Master; ghardhani_ref stores the "ward:card" reference of that person.

ALTER TABLE public.customer_master
  ADD COLUMN IF NOT EXISTS ghardhani_name text,
  ADD COLUMN IF NOT EXISTS ghardhani_ref text;

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
  place_detail_val text;
  home_area_sqft_val double precision;
  no_of_floors_val integer;
  no_of_rooms_val integer;
  no_of_rental_rooms_val integer;
  ghardhani_name_val text;
  ghardhani_ref_val text;
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
  place_detail_val := coalesce(trim(p->>'place_detail'), '');
  ghardhani_name_val := coalesce(trim(p->>'ghardhani_name'), '');
  ghardhani_ref_val := coalesce(trim(p->>'ghardhani_ref'), '');

  IF ghardhani_ref_val <> '' AND ghardhani_ref_val !~ '^[1-9][0-9]*:[0-9]{1,20}$' THEN
    RAISE EXCEPTION 'Invalid ghardhani reference';
  END IF;

  IF (p->>'home_area_sqft') IS NOT NULL AND (p->>'home_area_sqft') <> '' THEN
    home_area_sqft_val := (p->>'home_area_sqft')::double precision;
  ELSE
    home_area_sqft_val := NULL;
  END IF;

  IF (p->>'no_of_floors') IS NOT NULL AND (p->>'no_of_floors') <> '' THEN
    no_of_floors_val := (p->>'no_of_floors')::integer;
  ELSE
    no_of_floors_val := NULL;
  END IF;

  IF (p->>'no_of_rooms') IS NOT NULL AND (p->>'no_of_rooms') <> '' THEN
    no_of_rooms_val := (p->>'no_of_rooms')::integer;
  ELSE
    no_of_rooms_val := NULL;
  END IF;

  IF (p->>'no_of_rental_rooms') IS NOT NULL AND (p->>'no_of_rental_rooms') <> '' THEN
    no_of_rental_rooms_val := (p->>'no_of_rental_rooms')::integer;
  ELSE
    no_of_rental_rooms_val := NULL;
  END IF;

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
    -- Seed from the max already-used numeric card so manually entered card
    -- numbers can never collide with auto-generated ones.
    SELECT coalesce(max(ltrim(c.card,'0')::int), 0) + 1 INTO mseq
    FROM public.customer_master c
    WHERE c.owner_id = uid AND c.card ~ '^[1-9][0-9]*$';

    INSERT INTO public.member_counters(owner_id, last_number) VALUES(uid, mseq)
    ON CONFLICT(owner_id) DO UPDATE
      SET last_number = GREATEST(member_counters.last_number + 1, mseq)
    RETURNING last_number INTO mseq;

    card_no := lpad(mseq::text, 4, '0');
  END IF;

  INSERT INTO public.customer_master(owner_id, ward, card, name, tole, phone, district, municipality, pan, full_address, plan, plan_id, plans, joining_date, latitude, longitude, gps_accuracy, opening_dues, locality_photo, nature, place_detail, home_area_sqft, no_of_floors, no_of_rooms, no_of_rental_rooms, ghardhani_name, ghardhani_ref)
  VALUES(uid, p->>'ward', card_no, trim(p->>'name'), trim(p->>'tole'), phone, district_val, municipality_val, pan_val, address_val, plan_val, plan_id_val, plans_val, joining_date_val, lat_val, lng_val, acc_val, opening_dues_val, locality_photo_val, nature_val, place_detail_val, home_area_sqft_val, no_of_floors_val, no_of_rooms_val, no_of_rental_rooms_val, ghardhani_name_val, ghardhani_ref_val)
  ON CONFLICT(owner_id, ward, card) DO UPDATE
    SET name = excluded.name,
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
        nature = excluded.nature,
        place_detail = excluded.place_detail,
        home_area_sqft = excluded.home_area_sqft,
        no_of_floors = excluded.no_of_floors,
        no_of_rooms = excluded.no_of_rooms,
        no_of_rental_rooms = excluded.no_of_rental_rooms,
        ghardhani_name = excluded.ghardhani_name,
        ghardhani_ref = excluded.ghardhani_ref;

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
    'nature', nature_val,
    'place_detail', place_detail_val,
    'home_area_sqft', home_area_sqft_val,
    'no_of_floors', no_of_floors_val,
    'no_of_rooms', no_of_rooms_val,
    'no_of_rental_rooms', no_of_rental_rooms_val,
    'ghardhani_name', ghardhani_name_val,
    'ghardhani_ref', ghardhani_ref_val
  );
  RETURN res;
END $$;

REVOKE ALL ON FUNCTION public.save_customer_master(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_customer_master(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
