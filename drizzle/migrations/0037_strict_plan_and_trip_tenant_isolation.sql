-- Migration 0037: Strict tenant isolation for plan_master and trip_log
-- Ensure plan_master and trip_log have proper owner_id and RLS strictly scoped to auth.uid()

DO $$ BEGIN
  -- 1. Ensure plan_master has owner_id and drops global select policy
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plan_master') THEN
    ALTER TABLE public.plan_master ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid();
    
    -- Drop leaky global read policy if exists
    DROP POLICY IF EXISTS plan_master_select_authenticated ON public.plan_master;
    DROP POLICY IF EXISTS plan_master_authenticated_read ON public.plan_master;
    DROP POLICY IF EXISTS plan_master_all_owner ON public.plan_master;
    DROP POLICY IF EXISTS plan_master_owner_all ON public.plan_master;
    
    -- Create strict owner-scoped RLS policies
    CREATE POLICY plan_master_owner_select ON public.plan_master
      FOR SELECT TO authenticated
      USING (owner_id = auth.uid());
      
    CREATE POLICY plan_master_owner_mod ON public.plan_master
      FOR ALL TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;

  -- 2. Ensure trip_log has owner_id and strict owner-scoped RLS policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trip_log') THEN
    ALTER TABLE public.trip_log ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid();
    
    DROP POLICY IF EXISTS trip_log_authenticated_select ON public.trip_log;
    DROP POLICY IF EXISTS trip_log_owner_all ON public.trip_log;
    
    CREATE POLICY trip_log_owner_select ON public.trip_log
      FOR SELECT TO authenticated
      USING (owner_id = auth.uid());
      
    CREATE POLICY trip_log_owner_mod ON public.trip_log
      FOR ALL TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;
