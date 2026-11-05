-- Migration 0038: Strict tenant isolation for club_members, employee_master, payroll_records, and club_events
-- Ensures RLS policy on SELECT is strictly scoped to owner_id = auth.uid() instead of allowing any authenticated user to view all clubs' data.

-- 1. club_members
ALTER TABLE IF EXISTS public.club_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "club_members_select_authenticated" ON public.club_members;
DROP POLICY IF EXISTS "club_members_all_owner" ON public.club_members;
DROP POLICY IF EXISTS "club_members_owner_select" ON public.club_members;
DROP POLICY IF EXISTS "club_members_owner_all" ON public.club_members;

CREATE POLICY "club_members_owner_select" ON public.club_members
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "club_members_owner_all" ON public.club_members
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 2. employee_master
ALTER TABLE IF EXISTS public.employee_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employee_master_select_authenticated" ON public.employee_master;
DROP POLICY IF EXISTS "employee_master_all_owner" ON public.employee_master;
DROP POLICY IF EXISTS "employee_master_owner_select" ON public.employee_master;
DROP POLICY IF EXISTS "employee_master_owner_all" ON public.employee_master;

CREATE POLICY "employee_master_owner_select" ON public.employee_master
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "employee_master_owner_all" ON public.employee_master
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 3. payroll_records
ALTER TABLE IF EXISTS public.payroll_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payroll_records_select_authenticated" ON public.payroll_records;
DROP POLICY IF EXISTS "payroll_records_all_owner" ON public.payroll_records;
DROP POLICY IF EXISTS "payroll_records_owner_select" ON public.payroll_records;
DROP POLICY IF EXISTS "payroll_records_owner_all" ON public.payroll_records;

CREATE POLICY "payroll_records_owner_select" ON public.payroll_records
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "payroll_records_owner_all" ON public.payroll_records
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 4. club_events
ALTER TABLE IF EXISTS public.club_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "club_events_select_authenticated" ON public.club_events;
DROP POLICY IF EXISTS "club_events_all_owner" ON public.club_events;
DROP POLICY IF EXISTS "club_events_owner_select" ON public.club_events;
DROP POLICY IF EXISTS "club_events_owner_all" ON public.club_events;

CREATE POLICY "club_events_owner_select" ON public.club_events
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "club_events_owner_all" ON public.club_events
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

NOTIFY pgrst, 'reload schema';
