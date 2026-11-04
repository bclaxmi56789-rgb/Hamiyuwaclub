-- Apply RP Donation Support: Add company name and linked programme columns to rp_transactions
ALTER TABLE public.rp_transactions
  ADD COLUMN IF NOT EXISTS company_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS linked_event_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS linked_event_title text DEFAULT '';

NOTIFY pgrst, 'reload schema';
