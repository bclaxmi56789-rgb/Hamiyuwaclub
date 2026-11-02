-- Migration 0014: Locality photos stored as rows (bypasses Storage RLS quirks)
CREATE TABLE IF NOT EXISTS public.locality_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ward text NOT NULL,
  card text NOT NULL,
  mime text NOT NULL DEFAULT 'image/jpeg',
  data text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, ward, card)
);

CREATE INDEX IF NOT EXISTS idx_locality_photos_owner ON public.locality_photos(owner_id);

ALTER TABLE public.locality_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_locality_photos" ON public.locality_photos;
CREATE POLICY "owner_locality_photos" ON public.locality_photos
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

REVOKE ALL ON public.locality_photos FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locality_photos TO authenticated;

NOTIFY pgrst, 'reload schema';
