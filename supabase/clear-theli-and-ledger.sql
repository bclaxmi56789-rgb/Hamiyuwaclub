-- Apply script to clear existing theli stock items, stock batches, and theli ledger logs
TRUNCATE TABLE public.theli_stock_items CASCADE;
TRUNCATE TABLE public.theli_stock_batches CASCADE;
TRUNCATE TABLE public.theli_logs CASCADE;

NOTIFY pgrst, 'reload schema';
