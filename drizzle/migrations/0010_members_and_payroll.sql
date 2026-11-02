-- Migration 0010: Club Members, Employees, and Monthly Payroll

CREATE TABLE IF NOT EXISTS public.club_members (
  id text PRIMARY KEY DEFAULT ('mem-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  designation text NOT NULL,
  occupation text DEFAULT '',
  dob text DEFAULT '',
  membership_fee numeric(10,2) DEFAULT 0,
  phone text DEFAULT '',
  address text DEFAULT '',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'club_members' AND policyname = 'club_members_select_authenticated') THEN
    CREATE POLICY club_members_select_authenticated ON public.club_members FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'club_members' AND policyname = 'club_members_all_owner') THEN
    CREATE POLICY club_members_all_owner ON public.club_members FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.employee_master (
  id text PRIMARY KEY DEFAULT ('emp-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  age integer DEFAULT 0,
  dob text DEFAULT '',
  designation text NOT NULL,
  qualification text DEFAULT '',
  basic_salary numeric(10,2) NOT NULL DEFAULT 0,
  allowance_type text DEFAULT 'day', -- 'day' | 'trip' | 'fixed' | 'none'
  allowance_rate numeric(10,2) DEFAULT 0,
  phone text DEFAULT '',
  pan text DEFAULT '',
  status text DEFAULT 'active', -- 'active' | 'inactive' | 'on_leave'
  joining_date text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.employee_master ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_master' AND policyname = 'employee_master_select_authenticated') THEN
    CREATE POLICY employee_master_select_authenticated ON public.employee_master FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_master' AND policyname = 'employee_master_all_owner') THEN
    CREATE POLICY employee_master_all_owner ON public.employee_master FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payroll_records (
  id text PRIMARY KEY DEFAULT ('pr-' || substr(md5(random()::text), 1, 8)),
  owner_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  employee_id text NOT NULL,
  employee_name text NOT NULL,
  designation text NOT NULL,
  basic_salary numeric(10,2) NOT NULL DEFAULT 0,
  days_worked numeric(5,1) DEFAULT 26,
  total_days integer DEFAULT 26,
  trips integer DEFAULT 0,
  allowance numeric(10,2) DEFAULT 0,
  gross_salary numeric(10,2) NOT NULL DEFAULT 0,
  tax numeric(10,2) DEFAULT 0,
  advance_adjusted numeric(10,2) DEFAULT 0,
  other_deductions numeric(10,2) DEFAULT 0,
  net_salary numeric(10,2) NOT NULL DEFAULT 0,
  payment_status text DEFAULT 'pending', -- 'paid' | 'pending'
  payment_date text DEFAULT '',
  payment_mode text DEFAULT 'cash',
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT payroll_emp_month_unique UNIQUE (owner_id, year, month, employee_id)
);

ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payroll_records' AND policyname = 'payroll_records_select_authenticated') THEN
    CREATE POLICY payroll_records_select_authenticated ON public.payroll_records FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payroll_records' AND policyname = 'payroll_records_all_owner') THEN
    CREATE POLICY payroll_records_all_owner ON public.payroll_records FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
