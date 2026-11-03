-- Apply Employee Page Permissions Table
CREATE TABLE IF NOT EXISTS public.employee_permissions (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  employee_name text NOT NULL DEFAULT '',
  page_path text NOT NULL,
  access_level text NOT NULL DEFAULT 'full_access', -- 'no_access' | 'read_only' | 'full_access'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT emp_page_perm_unique UNIQUE (owner_id, employee_id, page_path)
);

CREATE INDEX IF NOT EXISTS idx_employee_permissions_owner ON public.employee_permissions(owner_id);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_emp ON public.employee_permissions(employee_id);

ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_employee_permissions" ON public.employee_permissions;
CREATE POLICY "owner_employee_permissions" ON public.employee_permissions
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

REVOKE ALL ON public.employee_permissions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_permissions TO authenticated;

NOTIFY pgrst, 'reload schema';

