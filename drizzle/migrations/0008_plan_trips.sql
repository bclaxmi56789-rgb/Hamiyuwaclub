-- Migration 0008: Add trips and no_of_trips to plan_master
ALTER TABLE public.plan_master
  ADD COLUMN IF NOT EXISTS trips integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS no_of_trips integer DEFAULT 1;

NOTIFY pgrst, 'reload schema';

