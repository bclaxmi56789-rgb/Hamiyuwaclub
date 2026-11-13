-- Migration 0042: Add budget_breakdown to club_events for itemized budget planning
ALTER TABLE IF EXISTS public.club_events 
ADD COLUMN IF NOT EXISTS budget_breakdown jsonb DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
