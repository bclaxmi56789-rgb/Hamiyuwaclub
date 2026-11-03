-- Apply Employee Credentials Vault & Admin PIN
CREATE TABLE IF NOT EXISTS public.employee_credentials (
  employee_id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_name text NOT NULL DEFAULT '',
  login_id text NOT NULL DEFAULT '',
  login_password text NOT NULL DEFAULT '',
  login_pin text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.employee_credentials ADD COLUMN IF NOT EXISTS login_pin text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_employee_credentials_owner ON public.employee_credentials(owner_id);

ALTER TABLE public.employee_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_employee_credentials" ON public.employee_credentials;
CREATE POLICY "owner_employee_credentials" ON public.employee_credentials
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

REVOKE ALL ON public.employee_credentials FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_credentials TO authenticated;

-- Admin PIN column in app_configuration
ALTER TABLE public.app_configuration ADD COLUMN IF NOT EXISTS admin_pin text DEFAULT '';

NOTIFY pgrst, 'reload schema';
