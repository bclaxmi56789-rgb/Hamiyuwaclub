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

/** Convert a theli's full booked amount (काटिएको रकम) into a real ward receipt. */
export const convertTheliBalanceToReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      item_id: z.string().trim().min(1),
      ward: z.string().regex(/^[1-9]\d?$/),
      fiscal_year: z.string().trim().min(1),
      theli_no: z.number().int().optional().default(0),
      range_from: z.string().trim().default(""),
      range_to: z.string().trim().default(""),
      last_voucher_booked: z.string().trim().default(""),
      issued_to_name: z.string().trim().default(""),
      municipality: z.string().trim().default(""),
      amount: z.number().positive("रकम शून्य वा कम हुन सक्दैन"),
      date: z.string().trim().min(1, "मिति आवश्यक छ"),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const fy = Number(data.fiscal_year.split("/")[0]);
    if (!fy) throw new Error("आर्थिक वर्ष पढ्न सकिएन।");

    // The full booked amount (काटिएको रकम) becomes the receipt
    let balance = Math.round(data.amount * 100) / 100;
    try {
      const res = await supabase
        .from("theli_stock_items")
        .select("amount_booked,amount_obtained,issued_to_name,last_voucher_booked")
        .eq("id", data.item_id)
        .eq("owner_id", context.userId)
        .maybeSingle();
      if (!res.error && res.data) {
        balance = Math.round(Number(res.data.amount_booked) * 100) / 100;
        if (balance <= 0) throw new Error("यो थेलीमा काटिएको रकम छैन। केही गर्नु पर्दैन।");
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("काटिएको रकम")) throw e;
    }

    // Allocate the next receipt number under an owner-scoped lock-free upsert
    const counter = await supabase
      .from("receipt_counters")
      .upsert(
        { owner_id: context.userId, ward: data.ward, fiscal_year: fy, last_number: 0 },
        { onConflict: "owner_id,ward,fiscal_year", ignoreDuplicates: true },
      )
      .select("last_number")
      .single();
    if (counter.error) throw new Error(counter.error.message);
    const prev = Number(counter.data?.last_number) || 0;
    const no = prev + 1;

    const ref = `${data.last_voucher_booked || data.range_to || data.range_from}-आ${
      data.ward
    }-${data.fiscal_year}`;
    const card = `TH${String(data.theli_no || 0).padStart(4, "0")}`;
    const payerName = data.issued_to_name || "थेली संकलन (लेजर रूपान्तरण)";
    const payload = {
      card,
      name: payerName,
      ward: data.ward,
      tole: data.municipality,
      phone: "",
      date: data.date,
      year: String(fy),
      mode: "नगद (Cash)",
      months: [{ m: 0, amt: balance }],
      no,
      ref,
      total: balance,
    } satisfies Receipt;

    // Theli conversion cards are not People-Master customers, so bypass the
    // customer-card RPC and insert the owner-scoped ward receipt directly.
    // Nothing is written to receipt_month_payments — no member month is marked paid.
    const inserted = await supabase.from("ward_receipts").insert({
      owner_id: context.userId,
      ward: data.ward,
      fiscal_year: fy,
      no,
      card,
      receipt_date: data.date,
      ref,
      payload,
    });
    if (inserted.error) {
      if (inserted.error.code === "23505" && inserted.error.message.includes("ref"))
        throw new Error("यो सिरियल पहिले नै रसिदमा प्रयोग भइसकेको छ।");
      throw new Error(inserted.error.message || "रसिद सुरक्षित भएन।");
    }
    // Confirm final counter state
    await supabase
      .from("receipt_counters")
      .update({ last_number: no })
      .eq("owner_id", context.userId)
      .eq("ward", data.ward)
      .eq("fiscal_year", fy)
      .eq("last_number", prev);
    const receipt = { ...payload, id: inserted.data?.[0]?.id } as unknown as Receipt;

    // Mark the full booked amount as converted: बुझाएको = काटिएको, बाँकी अन्तर = 0
    try {
      const current = await supabase
        .from("theli_stock_items")
        .select("amount_booked,amount_obtained")
        .eq("id", data.item_id)
        .eq("owner_id", context.userId)
        .maybeSingle();
      if (!current.error && current.data) {
        const booked = Math.round(Number(current.data.amount_booked) * 100) / 100;
        await supabase
          .from("theli_stock_items")
          .update({
            amount_obtained: booked,
            balance: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.item_id)
          .eq("owner_id", context.userId);
      }
    } catch {}

    return { success: true, receipt, amount: balance };
  });
