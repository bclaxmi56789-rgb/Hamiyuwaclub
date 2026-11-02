import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  validateReceipt,
  validateReference,
  validateDateInFiscalYear,
  type Person,
  type Receipt,
  type PlanItem,
  DEFAULT_PLANS,
  type ReceiptMonthItem,
} from "./receipt-rules";

export const getReceiptData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ward: z.string().regex(/^[1-9]\d?$/), year: z.number().int() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const people: Person[] = [];
    for (let start = 0; ; start += 1000) {
      const page = await supabase
        .from("customer_master")
        .select("*")
        .eq("ward", data.ward)
        .order("card")
        .range(start, start + 999);
      if (page.error) throw new Error("Could not load customer master.");
      people.push(...page.data);
      if (page.data.length < 1000) break;
    }
    const [receipts, counter, paid, plansRes] = await Promise.all([
      supabase
        .from("ward_receipts")
        .select("id,payload")
        .eq("ward", data.ward)
        .eq("fiscal_year", data.year)
        .order("no", { ascending: false })
        .limit(15),
      supabase
        .from("receipt_counters")
        .select("last_number")
        .eq("ward", data.ward)
        .eq("fiscal_year", data.year)
        .maybeSingle(),
      supabase
        .from("receipt_month_payments")
        .select("card,month,fiscal_year")
        .eq("ward", data.ward)
        .order("card")
        .order("month")
        .range(0, 999),
      supabase.from("plan_master").select("*").eq("is_active", true).order("chargeable_amount"),
    ]);
    if (receipts.error || counter.error || paid.error)
      throw new Error("Could not load receipt records.");
    const plans: PlanItem[] =
      plansRes.data && !plansRes.error && plansRes.data.length > 0
        ? (plansRes.data as PlanItem[])
        : DEFAULT_PLANS;
    // Paginate all paid months; the recent receipt list intentionally shows only 15.
    const payments = paid.data.map((p) => ({ card: p.card, month: p.month, year: p.fiscal_year }));
    if (paid.data.length === 1000) {
      for (let start = 1000; ; start += 1000) {
        const page = await supabase
          .from("receipt_month_payments")
          .select("card,month,fiscal_year")
          .eq("ward", data.ward)
          .order("card")
          .order("month")
          .range(start, start + 999);
        if (page.error) throw new Error("Could not load paid months.");
        payments.push(
          ...page.data.map((p) => ({ card: p.card, month: p.month, year: p.fiscal_year })),
        );
        if (page.data.length < 1000) break;
      }
    }
    return {
      people,
      receipts: receipts.data.map((r) => ({ ...(r.payload as unknown as Receipt), id: r.id })),
      nextNo: (counter.data?.last_number ?? 0) + 1,
      payments,
      plans,
    };
  });

export const saveReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      card: z.string().trim().max(20),
      year: z.string().regex(/^\d{4}$/),
      name: z.string().trim().min(1).max(100),
      ward: z.string().regex(/^[1-9]\d?$/),
      tole: z.string().trim().min(1).max(80),
      phone: z.string(),
      date: z.string(),
      mode: z.string(),
      months: z
        .array(
          z.object({
            m: z.number().int().min(0).max(11),
            amt: z.number().positive(),
            year: z.number().int().min(2079).max(2099).optional(),
          }),
        )
        .min(1),
      ref: z.string().trim().min(1).max(40),
      accountId: z.string().optional(),
      accountName: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const months = data.months as ReceiptMonthItem[];
    const error =
      validateReference(data.ref) ||
      validateDateInFiscalYear(data.date, Number(data.year), "रसिद मिति") ||
      validateReceipt(data, data.date, data.mode, months);
    if (error) throw new Error(error);
    // Payment must come from a cash/bank account registered in नगद तथा बैंक मास्टर
    if (data.accountId) {
      const ensureAccount = await context.supabase
        .from("rp_accounts")
        .select("id,name")
        .eq("id", data.accountId)
        .eq("owner_id", context.userId)
        .maybeSingle();
      if (ensureAccount.error) throw new Error(ensureAccount.error.message);
      if (!ensureAccount.data)
        throw new Error(
          "छानिएको खाता फेला परेन। नगद तथा बैंक मास्टर (Receipts & Payments) मा खाता थप्नुहोस्।",
        );
    } else if (data.accountName === undefined) {
      const exists = await context.supabase
        .from("rp_accounts")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", context.userId);
      if (!exists.error && (exists.count ?? 0) > 0) {
        throw new Error(
          "कुन नगद/बैंक खाताबाट भुक्तानी भयो छान्नुहोस्। (खाता: नगद तथा बैंक मास्टर)",
        );
      }
    }
    const result = await context.supabase.rpc("save_ward_receipt", { p: data });
    if (result.error) {
      if (result.error.message.includes("Card number not found"))
        throw new Error("Card number not found. Leave it blank to create a new member.");
      if (result.error.code === "23505")
        throw new Error(
          result.error.message.includes("ref")
            ? "This reference number is already used. Enter a different one."
            : "A selected month is already paid. Refresh the records and try again.",
        );
      throw new Error(result.error.message || "Receipt could not be saved. Please try again.");
    }
    return result.data as unknown as Receipt;
  });
