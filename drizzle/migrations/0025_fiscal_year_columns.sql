-- Migration 0025: Fiscal-year (BS Shrawan 1 → Asar end) settings on app configuration.
ALTER TABLE public.app_configuration
  ADD COLUMN IF NOT EXISTS fiscal_year_start text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fiscal_year_end text DEFAULT '';

NOTIFY pgrst, 'reload schema';
