/**
 * Account-scoped localStorage cache keys.
 * All private caches (`hami_*`) are namespaced by the signed-in account id so
 * switching or creating a new account always starts with a blank cache.
 */
let cacheScope = "anon";

export function setCacheScope(scope: string | null | undefined) {
  cacheScope = scope ? scope : "anon";
}

export function hamiCacheKey(base: string): string {
  return `${base}:${cacheScope}`;
}

/** Legacy shared keys (no scope) that older builds wrote — used for migration cleanup. */
export const LEGACY_SHARED_KEYS = [
  "hami_members_cache",
  "hami_emp_cache",
  "hami_payroll_cache",
  "hami_emp_reimbursement_cache",
  "hami_events_cache",
  "hami_minutes_cache",
  "hami_expenses_cache",
  "hami_items_master_cache",
  "hami_fixed_asset_master_cache",
  "hami_theli_stock_items",
  "hami_theli_stock_batches",
  "hami_theli_daily_logs",
  "hami_vendors_cache",
];

export function clearLegacySharedCaches() {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_SHARED_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
}
