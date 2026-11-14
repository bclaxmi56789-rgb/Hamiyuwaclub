-- Migration 0045: High-Performance Composite Indexes for Sub-Second Responses
-- Creates composite B-Tree indexes on the most frequently queried tables,
-- converting full-table sequential scans into instant index scans.

-- 1. ward_receipts: Speeds up workspace, receipts list, and ledger queries
CREATE INDEX IF NOT EXISTS idx_ward_receipts_owner_created 
  ON public.ward_receipts(owner_id, created_at DESC, id);

CREATE INDEX IF NOT EXISTS idx_ward_receipts_owner_ward_fy 
  ON public.ward_receipts(owner_id, ward, fiscal_year);

-- 2. customer_master: Speeds up workspace loading, masters page, and dues calculations
CREATE INDEX IF NOT EXISTS idx_customer_master_owner_id 
  ON public.customer_master(owner_id, id);

CREATE INDEX IF NOT EXISTS idx_customer_master_owner_ward 
  ON public.customer_master(owner_id, ward);

-- 3. rp_transactions: Speeds up Receipts & Payments book and dashboard cash ledger
CREATE INDEX IF NOT EXISTS idx_rp_transactions_owner_created 
  ON public.rp_transactions(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rp_transactions_owner_account 
  ON public.rp_transactions(owner_id, account_id, txn_date);

-- 4. expense_records: Speeds up expenses tab, reports, and net surplus computation
CREATE INDEX IF NOT EXISTS idx_expense_records_owner_created 
  ON public.expense_records(owner_id, created_at DESC);

-- 5. trip_log: Speeds up garbage collection trip logging
CREATE INDEX IF NOT EXISTS idx_trip_log_owner_logged 
  ON public.trip_log(owner_id, logged_at DESC);

-- 6. plan_master: Speeds up fee structure lookup
CREATE INDEX IF NOT EXISTS idx_plan_master_owner_created 
  ON public.plan_master(owner_id, created_at ASC);

