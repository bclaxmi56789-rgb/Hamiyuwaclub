-- Migration 0032: Truncate / Clear Theli Stock and Ledger Data
-- Clears public.theli_stock_items, public.theli_stock_batches, and public.theli_logs
-- so fresh theli ranges and ledger data can be populated.

TRUNCATE TABLE public.theli_stock_items CASCADE;
TRUNCATE TABLE public.theli_stock_batches CASCADE;
TRUNCATE TABLE public.theli_logs CASCADE;

NOTIFY pgrst, 'reload schema';
