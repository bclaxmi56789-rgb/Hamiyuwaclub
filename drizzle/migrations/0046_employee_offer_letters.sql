-- Migration 0046: Employee Offer Letters
-- Stores per-employee offer/appointment letters scoped strictly to the owner.

CREATE TABLE IF NOT EXISTS public.employee_offer_letters (
  id text PRIMARY KEY DEFAULT ('offer-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  employee_id text NOT NULL,
  offer_no text NOT NULL,
  letter_date text DEFAULT '',
  designation text DEFAULT '',
  offered_salary numeric(10,2) DEFAULT 0,
  joining_date text DEFAULT '',
  status text DEFAULT 'draft', -- 'draft' | 'issued'
  terms jsonb DEFAULT '[]'::jsonb,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT employee_offer_letters_owner_offer_unique UNIQUE (owner_id, offer_no)
);

CREATE INDEX IF NOT EXISTS idx_employee_offer_letters_owner_employee
  ON public.employee_offer_letters(owner_id, employee_id);

ALTER TABLE public.employee_offer_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_offer_letters_owner_select" ON public.employee_offer_letters;
DROP POLICY IF EXISTS "employee_offer_letters_owner_all" ON public.employee_offer_letters;

CREATE POLICY "employee_offer_letters_owner_select" ON public.employee_offer_letters
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "employee_offer_letters_owner_all" ON public.employee_offer_letters
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

NOTIFY pgrst, 'reload schema';
