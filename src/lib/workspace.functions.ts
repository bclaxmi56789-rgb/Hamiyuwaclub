import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_PLANS,
  fiscalYear,
  FISCAL_YEARS,
  RP_REF_PREFIX,
  rpReference,
  type Person,
  type Receipt,
  type PlanItem,
  type TripLogEntry,
  type Member,
  type BODMember,
  type Employee,
  type PayrollRecord,
  type ClubEvent,
  type EventMinutes,
  type Vendor,
  type VendorLedgerEntry,
  type ExpenseRecord,
  type ItemMaster,
  type FixedAssetMaster,
  type RPTxnType,
  type TheliLog,
  type TheliRangeEntry,
  type TheliStockBatch,
  type TheliStockItem,
  calculateTheliStockCounts,
  generateTheliRanges,
  calculateTheliBooking,
} from "./receipt-rules";

import { z } from "zod";
export const getWorkspaceData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const people: Person[] = [];
    const receipts: Receipt[] = [];
    const plans: PlanItem[] = [];
    const trips: TripLogEntry[] = [];

    for (let offset = 0; ; offset += 1000) {
      const result = await context.supabase
        .from("customer_master")
        .select("*")
        .eq("owner_id", context.userId)
        .order("id")
        .range(offset, offset + 999);
      if (result.error) throw new Error("Customer records could not be loaded.");
      people.push(...result.data);
      if (result.data.length < 1000) break;
    }

    for (let offset = 0; ; offset += 1000) {
      const result = await context.supabase
        .from("ward_receipts")
        .select("id,payload")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 999);
      if (result.error) throw new Error("Receipt records could not be loaded.");
      receipts.push(
        ...result.data.map((r) => ({ ...(r.payload as unknown as Receipt), id: r.id })),
      );
      if (result.data.length < 1000) break;
    }

    // Load plans from plan_master for this tenant
    try {
      const planRes = await context.supabase
        .from("plan_master")
        .select("*")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: true });
      if (!planRes.error && planRes.data && planRes.data.length > 0) {
        plans.push(
          ...planRes.data.map((p) => ({
            id: p.id,
            name: p.name,
            uom: p.uom || "महिना (Month)",
            rate: Number(p.rate) || Number(p.amount) || 0,
            trips: Number(p.trips ?? p.no_of_trips ?? 1) || 1,
            no_of_trips: Number(p.no_of_trips ?? p.trips ?? 1) || 1,
            amount: Number(p.amount) || 0,
            incentive: Number(p.incentive) || 0,
            chargeable_amount: Number(p.chargeable_amount) || 0,
            description: p.description ?? "",
            is_active: p.is_active ?? true,
          })),
        );
      }
    } catch {
      // New club starts with blank plans until added in Plan Master
    }

    // Load trip log scoped to this tenant
    try {
      for (let offset = 0; ; offset += 1000) {
        const tripRes = await context.supabase
          .from("trip_log")
          .select("*")
          .eq("owner_id", context.userId)
          .order("logged_at", { ascending: false })
          .range(offset, offset + 999);
        if (tripRes.error) throw new Error(tripRes.error.message);
        trips.push(...(tripRes.data as unknown as TripLogEntry[]));
        if (tripRes.data.length < 1000) break;
      }
    } catch {
      // trip_log migration not applied or tenant has no trips yet
    }

    return { people, receipts, plans, trips, checkedAt: new Date().toISOString() };
  });

export const saveCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      district: z.string().trim().max(80).optional().default(""),
      municipality: z.string().trim().max(80).optional().default(""),
      ward: z.string().regex(/^[1-9]\d?$/),
      card: z.string().trim().max(20).optional().default(""),
      name: z.string().trim().min(1).max(100),
      tole: z.string().trim().min(1).max(80),
      phone: z.string().trim().optional().default(""),
      email: z.string().trim().max(100).optional().default(""),
      pan: z.string().trim().max(20).optional().default(""),
      full_address: z.string().trim().max(250).optional().default(""),
      plan: z.string().trim().max(250).optional().default(""),
      plan_id: z.string().trim().max(250).optional().default(""),
      plans: z
        .array(
          z.object({
            plan_id: z.string(),
            name: z.string(),
            amount: z.number().optional(),
            incentive: z.number().optional(),
            chargeable_amount: z.number(),
            uom: z.string().optional(),
            quantity: z.number().optional().default(1),
            trips: z.number().optional().default(1),
            no_of_trips: z.number().optional().default(1),
          }),
        )
        .optional(),
      joining_date: z.string().trim().max(20).optional().default(""),
      latitude: z.number().nullable().optional(),
      longitude: z.number().nullable().optional(),
      gps_accuracy: z.number().nullable().optional(),
      locality_photo: z.string().trim().max(600).optional().default(""),
      nature: z.string().trim().max(80).optional().default(""),
      place_detail: z.string().trim().max(200).optional().default(""),
      opening_dues: z
        .array(
          z.object({
            fy: z.number(),
            month: z.number().min(0).max(11),
            amount: z.number().min(0),
          }),
        )
        .optional()
        .default([]),
    }),
  )
  .handler(async ({ data, context }) => {
    if (data.phone && !/^9\d{9}$/.test(data.phone)) {
      throw new Error("Contact number must be 10 digits starting with 9.");
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new Error("इमेल ढाँचा मिलेन (Invalid email format).");
    }
    const rpcRes = await context.supabase.rpc("save_customer_master", { p: data });
    if (!rpcRes.error) {
      return rpcRes.data as unknown as Person;
    }
    let card = data.card.trim();
    if (!card) {
      const counter = await context.supabase
        .from("member_counters")
        .select("last_number")
        .maybeSingle();
      const cardsRes = await context.supabase
        .from("customer_master")
        .select("card")
        .eq("owner_id", context.userId);
      const existingCards = (cardsRes.error ? [] : (cardsRes.data ?? [])) as { card: string }[];
      // Seed from the max already-used numeric card so manually entered card
      // numbers can never collide with auto-generated ones.
      const maxUsed = existingCards.reduce((m, row) => {
        const n = /^0*[1-9]\d*$/.test(row.card) ? parseInt(row.card, 10) : 0;
        return Math.max(m, n);
      }, 0);
      const nextNum = Math.max((counter.data?.last_number ?? 0) + 1, maxUsed + 1);
      await context.supabase
        .from("member_counters")
        .upsert({ owner_id: context.userId, last_number: nextNum });
      card = String(nextNum).padStart(4, "0");
    }
    const upsertPayload: Record<string, unknown> = {
      owner_id: context.userId,
      ward: data.ward,
      card,
      name: data.name,
      tole: data.tole,
      phone: data.phone,
    };
    // Include new fields only when provided (safe if migration 0004/0005/0006 applied)
    if (data.district) upsertPayload.district = data.district;
    if (data.municipality) upsertPayload.municipality = data.municipality;
    if (data.email) upsertPayload.email = data.email;
    if (data.pan) upsertPayload.pan = data.pan;
    if (data.full_address) upsertPayload.full_address = data.full_address;
    if (data.plan) upsertPayload.plan = data.plan;
    if (data.plan_id) upsertPayload.plan_id = data.plan_id;
    if (data.plans) upsertPayload.plans = data.plans;
    if (data.joining_date) upsertPayload.joining_date = data.joining_date;
    if (data.latitude != null) upsertPayload.latitude = data.latitude;
    if (data.longitude != null) upsertPayload.longitude = data.longitude;
    if (data.gps_accuracy != null) upsertPayload.gps_accuracy = data.gps_accuracy;
    if (data.locality_photo) upsertPayload.locality_photo = data.locality_photo;
    if (data.nature) upsertPayload.nature = data.nature;
    if (data.place_detail) upsertPayload.place_detail = data.place_detail;
    if (data.opening_dues !== undefined) upsertPayload.opening_dues = data.opening_dues;

    let insertRes = await context.supabase
      .from("customer_master")
      .upsert(upsertPayload, { onConflict: "owner_id,ward,card" })
      .select("*")
      .single();

    // If new columns are missing in Supabase schema cache, gracefully fall back to base columns
    if (
      insertRes.error &&
      (insertRes.error.message?.includes("schema cache") ||
        insertRes.error.message?.includes("column"))
    ) {
      insertRes = await context.supabase
        .from("customer_master")
        .upsert(
          {
            owner_id: context.userId,
            ward: data.ward,
            card,
            name: data.name,
            tole: data.tole,
            phone: data.phone,
          },
          { onConflict: "owner_id,ward,card" },
        )
        .select("*")
        .single();

      if (!insertRes.error && insertRes.data) {
        return {
          ...insertRes.data,
          ...data,
          card,
        } as Person;
      }
    }

    if (insertRes.error) {
      throw new Error(insertRes.error.message || "Could not save customer.");
    }
    return insertRes.data as Person;
  });

export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(1, "Plan name is required").max(100),
      uom: z.string().trim().max(50).optional().default("महिना (Month)"),
      rate: z.number().min(0).optional(),
      trips: z.number().min(1).optional().default(1),
      no_of_trips: z.number().min(1).optional().default(1),
      amount: z.number().min(0),
      incentive: z.number().min(0).default(0),
      chargeable_amount: z.number().min(0),
      description: z.string().trim().max(250).optional().default(""),
      is_active: z.boolean().optional().default(true),
    }),
  )
  .handler(async ({ data, context }) => {
    const id = data.id || `plan-${Date.now().toString(36)}`;
    const tripsVal = Number(data.trips ?? data.no_of_trips ?? 1) || 1;
    const payload: Record<string, unknown> = {
      id,
      owner_id: context.userId,
      name: data.name,
      uom: data.uom || "महिना (Month)",
      rate: data.rate != null ? data.rate : data.amount,
      trips: tripsVal,
      no_of_trips: tripsVal,
      amount: data.amount,
      incentive: data.incentive,
      chargeable_amount: data.chargeable_amount,
      description: data.description,
      is_active: data.is_active,
      updated_at: new Date().toISOString(),
    };
    let res = await context.supabase
      .from("plan_master")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();
    if (
      res.error &&
      (res.error.message?.includes("uom") ||
        res.error.message?.includes("rate") ||
        res.error.message?.includes("trips") ||
        res.error.message?.includes("schema cache"))
    ) {
      delete payload.uom;
      delete payload.rate;
      delete payload.trips;
      delete payload.no_of_trips;
      res = await context.supabase
        .from("plan_master")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();
    }
    if (res.error) {
      throw new Error(
        res.error.message ||
          "Could not save plan. Please ensure migration 0005/0006/0008 has been executed in Supabase.",
      );
    }
    return {
      id: res.data.id,
      name: res.data.name,
      uom: res.data.uom || data.uom || "महिना (Month)",
      rate: Number(res.data.rate ?? data.rate ?? res.data.amount) || 0,
      trips: Number(res.data.trips ?? res.data.no_of_trips ?? tripsVal) || 1,
      no_of_trips: Number(res.data.no_of_trips ?? res.data.trips ?? tripsVal) || 1,
      amount: Number(res.data.amount) || 0,
      incentive: Number(res.data.incentive) || 0,
      chargeable_amount: Number(res.data.chargeable_amount) || 0,
      description: res.data.description ?? "",
      is_active: res.data.is_active ?? true,
    } as PlanItem;
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const res = await context.supabase.from("plan_master").delete().eq("id", data.id);
    if (res.error) {
      throw new Error(res.error.message || "Could not delete plan.");
    }
    return true;
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      ward: z.string(),
      card: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    const rpcRes = await context.supabase.rpc("delete_customer_master", { p: data });
    if (!rpcRes.error) {
      return true;
    }
    const check = await context.supabase
      .from("receipt_month_payments")
      .select("card")
      .eq("ward", data.ward)
      .eq("card", data.card)
      .limit(1);
    if (check.data && check.data.length > 0) {
      throw new Error("Cannot delete customer who already has receipt records.");
    }
    const delRes = await context.supabase
      .from("customer_master")
      .delete()
      .eq("ward", data.ward)
      .eq("card", data.card);
    if (delRes.error) {
      throw new Error(delRes.error.message || "Could not delete customer.");
    }
    return true;
  });

// ─── Driver trip sessions (start / share GPS / end; type: collection | dumping) ──

export interface TripSession {
  id: string;
  employee_id: string;
  employee_name: string;
  ward: string;
  fiscal_year: number | null;
  trip_type: "collection" | "dumping";
  status: "active" | "ended";
  started_at: string;
  ended_at: string | null;
  end_note: string;
}

export interface TripPoint {
  lat: number;
  lng: number;
  accuracy: number | null;
  recorded_at: string;
}

export const startTripSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      trip_type: z.enum(["collection", "dumping"]),
      ward: z.string().default(""),
      fiscal_year: z.number().min(2079).max(2099).nullable().optional(),
      employee_id: z.string().default(""),
      employee_name: z.string().default(""),
    }),
  )
  .handler(async ({ data, context }) => {
    // Close any careless leftovers, then open the new session atomically.
    await context.supabase
      .from("trip_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString(), end_note: "auto-closed" })
      .eq("owner_id", context.userId)
      .eq("status", "active");

    const res = await context.supabase
      .from("trip_sessions")
      .insert({
        owner_id: context.userId,
        employee_id: data.employee_id,
        employee_name: data.employee_name,
        ward: data.ward,
        fiscal_year: data.fiscal_year ?? null,
        trip_type: data.trip_type,
        status: "active",
      })
      .select("*")
      .single();
    if (res.error) {
      throw new Error(
        res.error.message ||
          "Could not start trip. Please ensure migration 0039_trip_sessions.sql has been executed in Supabase.",
      );
    }
    return res.data as TripSession;
  });

export const endTripSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      session_id: z.string(),
      end_note: z.string().trim().max(300).default(""),
    }),
  )
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("trip_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString(), end_note: data.end_note })
      .eq("id", data.session_id)
      .eq("owner_id", context.userId)
      .eq("status", "active")
      .select("*")
      .single();
    if (res.error) throw new Error(res.error.message || "Could not end trip session.");
    return res.data as TripSession;
  });

export const addTripPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      session_id: z.string(),
      points: z
        .array(
          z.object({
            lat: z.number().min(-90).max(90),
            lng: z.number().min(-180).max(180),
            accuracy: z.number().min(0).max(100000).nullable().optional(),
            recorded_at: z.string().default(""),
          }),
        )
        .min(1)
        .max(200),
    }),
  )
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("trip_points")
      .insert(
        data.points.map((p) => ({
          session_id: data.session_id,
          owner_id: context.userId,
          lat: p.lat,
          lng: p.lng,
          accuracy: p.accuracy ?? null,
          recorded_at: p.recorded_at ? p.recorded_at : new Date().toISOString(),
        })),
      )
      .select("seq");
    if (res.error) throw new Error(res.error.message || "Could not save trip location points.");
    return { saved: res.data.length };
  });

export const getActiveTripSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const res = await context.supabase
      .from("trip_sessions")
      .select("*")
      .eq("owner_id", context.userId)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1);
    if (res.error) return null;
    return (res.data?.[0] as TripSession | undefined) ?? null;
  });

export const getTripSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().optional() }))
  .handler(async ({ data, context }) => {
    if (data.session_id) {
      const res = await context.supabase
        .from("trip_sessions")
        .select("*")
        .eq("owner_id", context.userId)
        .eq("id", data.session_id)
        .maybeSingle();
      return { session: (res.data as TripSession | null) ?? null, sessions: [] };
    }
    const res = await context.supabase
      .from("trip_sessions")
      .select("*")
      .eq("owner_id", context.userId)
      .order("started_at", { ascending: false })
      .limit(100);
    if (res.error) return { session: null, sessions: [] };
    return { session: null, sessions: res.data as TripSession[] };
  });

export const getTripSessionPoints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string() }))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("trip_points")
      .select("lat,lng,accuracy,recorded_at")
      .eq("owner_id", context.userId)
      .eq("session_id", data.session_id)
      .order("seq", { ascending: true })
      .limit(3000);
    if (res.error) throw new Error(res.error.message || "Could not load trip points.");
    return res.data as unknown as TripPoint[];
  });

export const logTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      ward: z.string(),
      card: z.string(),
      fiscal_year: z.number().min(2079).max(2099),
      month: z.number().min(0).max(11),
      note: z.string().trim().max(200).optional().default(""),
    }),
  )
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("trip_log")
      .insert({
        owner_id: context.userId,
        ward: data.ward,
        card: data.card,
        fiscal_year: data.fiscal_year,
        month: data.month,
        note: data.note,
      })
      .select("*")
      .single();
    if (res.error) {
      throw new Error(
        res.error.message ||
          "Could not log trip. Please ensure migration 0009_trip_log.sql has been executed in Supabase.",
      );
    }
    return res.data as TripLogEntry;
  });

export const deleteTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("trip_log")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (res.error) {
      throw new Error(res.error.message || "Could not undo trip.");
    }
    return true;
  });

export const getMembersData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const members: Member[] = [];
    const employees: Employee[] = [];
    const payrollRecords: PayrollRecord[] = [];
    let accounts: Array<{ id: string; name: string; account_type: "cash" | "bank" }> = [];

    try {
      // Check 'members' or 'club_members' or 'bod_members' scoped to this tenant
      let memRes = await context.supabase
        .from("members")
        .select("*")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: true });
      if (memRes.error || !memRes.data || memRes.data.length === 0) {
        memRes = await context.supabase
          .from("club_members")
          .select("*")
          .eq("owner_id", context.userId)
          .order("created_at", { ascending: true });
      }
      if (memRes.error || !memRes.data || memRes.data.length === 0) {
        memRes = await context.supabase
          .from("bod_members")
          .select("*")
          .eq("owner_id", context.userId)
          .order("created_at", { ascending: true });
      }
      if (!memRes.error && memRes.data) {
        members.push(...(memRes.data as unknown as Member[]));
      }
    } catch {
      // Table may not be migrated yet
    }

    try {
      const empRes = await context.supabase
        .from("employee_master")
        .select("*")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: true });
      if (!empRes.error && empRes.data) {
        employees.push(...(empRes.data as unknown as Employee[]));
      }
    } catch {
      // Table may not be migrated yet
    }

    try {
      const payRes = await context.supabase
        .from("payroll_records")
        .select("*")
        .eq("owner_id", context.userId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (!payRes.error && payRes.data) {
        payrollRecords.push(...(payRes.data as unknown as PayrollRecord[]));
      }
    } catch {
      // Table may not be migrated yet
    }

    try {
      const accRes = await context.supabase
        .from("rp_accounts")
        .select("id, name, account_type")
        .eq("owner_id", context.userId)
        .order("name", { ascending: true });
      if (!accRes.error && accRes.data) {
        accounts = accRes.data as Array<{
          id: string;
          name: string;
          account_type: "cash" | "bank";
        }>;
      }
    } catch {
      // Table may not be migrated yet
    }

    let employeeTransactions: Array<{
      id: string;
      ref_no: string;
      txn_date: string;
      txn_type: string;
      account_id: string;
      party_id: string;
      party_name: string;
      amount: number;
      remarks: string;
    }> = [];
    try {
      const txRes = await context.supabase
        .from("rp_transactions")
        .select("id, ref_no, txn_date, txn_type, account_id, party_id, party_name, amount, remarks")
        .eq("owner_id", context.userId)
        .eq("party_type", "employee")
        .order("created_at", { ascending: false });
      if (!txRes.error && txRes.data) {
        employeeTransactions = txRes.data.map((t) => ({
          ...t,
          amount: Number(t.amount) || 0,
        }));
      }
    } catch {
      // Table may not be migrated yet
    }

    // Employee-reimbursement bills: payable on the employee's ledger
    let employeeReimbursements: ExpenseRecord[] = [];
    try {
      const reimbRes = await context.supabase
        .from("expense_records")
        .select(
          "id,expense_type,date_bs,bill_number,vendor_id,vendor_name,linked_employee_id,line_items,final_amount,employee_reimbursed,remarks,status",
        )
        .eq("owner_id", context.userId)
        .neq("linked_employee_id", "")
        .eq("employee_reimbursed", true);
      if (!reimbRes.error && reimbRes.data) {
        employeeReimbursements = reimbRes.data as unknown as ExpenseRecord[];
      }
    } catch {
      // Column may not be migrated yet
    }

    return {
      members,
      bodMembers: members,
      employees,
      payrollRecords,
      accounts,
      employeeTransactions,
      employeeReimbursements,
    };
  });

export const saveMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(1, "Name is required"),
      designation: z.string().trim().min(1, "Designation is required"),
      occupation: z.string().trim().optional().default(""),
      dob: z.string().trim().optional().default(""),
      membership_fee: z.number().optional().default(0),
      phone: z.string().trim().optional().default(""),
      address: z.string().trim().optional().default(""),
      status: z.enum(["active", "inactive"]).optional().default("active"),
    }),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      name: data.name,
      designation: data.designation,
      occupation: data.occupation,
      dob: data.dob,
      membership_fee: data.membership_fee,
      phone: data.phone,
      address: data.address,
      status: data.status,
      updated_at: new Date().toISOString(),
    };

    if (data.id && !data.id.startsWith("local-")) {
      let res = await context.supabase
        .from("members")
        .update(payload)
        .eq("id", data.id)
        .eq("owner_id", context.userId)
        .select("*")
        .single();
      if (res.error) {
        res = await context.supabase
          .from("club_members")
          .update(payload)
          .eq("id", data.id)
          .eq("owner_id", context.userId)
          .select("*")
          .single();
      }
      if (res.error) {
        res = await context.supabase
          .from("bod_members")
          .update(payload)
          .eq("id", data.id)
          .eq("owner_id", context.userId)
          .select("*")
          .single();
      }
      if (res.error) throw new Error(res.error.message);
      return res.data as Member;
    } else {
      const newId = `mem-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      let res = await context.supabase
        .from("members")
        .insert({
          id: newId,
          owner_id: context.userId,
          ...payload,
        })
        .select("*")
        .single();
      if (res.error) {
        res = await context.supabase
          .from("club_members")
          .insert({
            id: newId,
            owner_id: context.userId,
            ...payload,
          })
          .select("*")
          .single();
      }
      if (res.error) {
        res = await context.supabase
          .from("bod_members")
          .insert({
            id: newId,
            owner_id: context.userId,
            ...payload,
          })
          .select("*")
          .single();
      }
      if (res.error) throw new Error(res.error.message);
      return res.data as Member;
    }
  });

export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    let res = await context.supabase
      .from("members")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (res.error) {
      res = await context.supabase
        .from("club_members")
        .delete()
        .eq("id", data.id)
        .eq("owner_id", context.userId);
    }
    if (res.error) {
      res = await context.supabase
        .from("bod_members")
        .delete()
        .eq("id", data.id)
        .eq("owner_id", context.userId);
    }
    if (res.error) throw new Error(res.error.message);
    return true;
  });

export const saveBODMember = saveMember;
export const deleteBODMember = deleteMember;

export const saveEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(1, "Name is required"),
      age: z.number().optional().default(0),
      dob: z.string().trim().optional().default(""),
      designation: z.string().trim().min(1, "Designation is required"),
      qualification: z.string().trim().optional().default(""),
      basic_salary: z.number().min(0, "Basic salary must be positive"),
      allowance_type: z.enum(["day", "trip", "fixed", "none"]).optional().default("day"),
      allowance_rate: z.number().optional().default(0),
      other_allowance: z.number().optional().default(0),
      phone: z.string().trim().optional().default(""),
      pan: z.string().trim().optional().default(""),
      status: z.enum(["active", "inactive", "on_leave"]).optional().default("active"),
      joining_date: z.string().trim().optional().default(""),
      opening_balance: z.number().optional().default(0),
      balance_type: z.enum(["dr", "cr"]).optional().default("cr"),
    }),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      name: data.name,
      age: data.age,
      dob: data.dob,
      designation: data.designation,
      qualification: data.qualification,
      basic_salary: data.basic_salary,
      allowance_type: data.allowance_type,
      allowance_rate: data.allowance_rate,
      other_allowance: data.other_allowance ?? 0,
      phone: data.phone,
      pan: data.pan,
      status: data.status,
      joining_date: data.joining_date,
      opening_balance: data.opening_balance ?? 0,
      balance_type: data.balance_type ?? "cr",
      updated_at: new Date().toISOString(),
    };

    if (data.id && !data.id.startsWith("local-")) {
      let res = await context.supabase
        .from("employee_master")
        .update(payload)
        .eq("id", data.id)
        .eq("owner_id", context.userId)
        .select("*")
        .single();
      if (res.error && res.error.message.includes("other_allowance")) {
        const { other_allowance, ...fallback } = payload;
        res = await context.supabase
          .from("employee_master")
          .update(fallback)
          .eq("id", data.id)
          .eq("owner_id", context.userId)
          .select("*")
          .single();
      }
      if (res.error) throw new Error(res.error.message);
      return res.data as Employee;
    } else {
      const newId = `emp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      let res = await context.supabase
        .from("employee_master")
        .insert({
          id: newId,
          owner_id: context.userId,
          ...payload,
        })
        .select("*")
        .single();
      if (res.error && res.error.message.includes("other_allowance")) {
        const { other_allowance, ...fallback } = payload;
        res = await context.supabase
          .from("employee_master")
          .insert({
            id: newId,
            owner_id: context.userId,
            ...fallback,
          })
          .select("*")
          .single();
      }
      if (res.error) throw new Error(res.error.message);
      return res.data as Employee;
    }
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("employee_master")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return true;
  });

export const savePayrollRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      year: z.number(),
      month: z.number(),
      records: z.array(
        z.object({
          id: z.string().optional(),
          employee_id: z.string(),
          employee_name: z.string(),
          designation: z.string(),
          basic_salary: z.number(),
          days_worked: z.number(),
          total_days: z.number(),
          trips: z.number(),
          allowance: z.number(),
          other_allowance: z.number().optional().default(0),
          gross_salary: z.number(),
          tax: z.number(),
          advance_adjusted: z.number(),
          other_deductions: z.number(),
          net_salary: z.number(),
          payment_status: z.enum(["paid", "pending", "booked"]),
          payment_date: z.string().optional().default(""),
          payment_mode: z.enum(["cash", "bank", "esewa", "cheque"]).optional().default("cash"),
          voucher_ref: z.string().optional().default(""),
          remarks: z.string().optional().default(""),
        }),
      ),
    }),
  )
  .handler(async ({ data, context }) => {
    const saved: PayrollRecord[] = [];
    for (const item of data.records) {
      // Check if already exists for this year, month, employee
      const existing = await context.supabase
        .from("payroll_records")
        .select("id, payment_status")
        .eq("owner_id", context.userId)
        .eq("year", data.year)
        .eq("month", data.month)
        .eq("employee_id", item.employee_id)
        .maybeSingle();

      // LOCK: If already paid OR booked, do NOT allow draft overwrite
      if (existing.data?.payment_status === "paid" || existing.data?.payment_status === "booked") {
        if (existing.data) saved.push(existing.data as unknown as PayrollRecord);
        continue;
      }

      const recordPayload = {
        owner_id: context.userId,
        year: data.year,
        month: data.month,
        employee_id: item.employee_id,
        employee_name: item.employee_name,
        designation: item.designation,
        basic_salary: item.basic_salary,
        days_worked: item.days_worked,
        total_days: item.total_days,
        trips: item.trips,
        allowance: item.allowance,
        other_allowance: item.other_allowance ?? 0,
        gross_salary: item.gross_salary,
        tax: item.tax,
        advance_adjusted: item.advance_adjusted,
        other_deductions: item.other_deductions,
        net_salary: item.net_salary,
        payment_status: item.payment_status,
        payment_date: item.payment_date,
        payment_mode: item.payment_mode,
        voucher_ref: item.voucher_ref ?? "",
        remarks: item.remarks,
        updated_at: new Date().toISOString(),
      };

      if (existing.data?.id) {
        let updateRes = await context.supabase
          .from("payroll_records")
          .update(recordPayload)
          .eq("id", existing.data.id)
          .select("*")
          .maybeSingle();
        if (
          updateRes.error &&
          (updateRes.error.message.includes("other_allowance") ||
            updateRes.error.message.includes("voucher_ref"))
        ) {
          const { other_allowance, voucher_ref, ...fallback } = recordPayload;
          updateRes = await context.supabase
            .from("payroll_records")
            .update(fallback)
            .eq("id", existing.data.id)
            .select("*")
            .maybeSingle();
        }
        if (updateRes.data) {
          saved.push(updateRes.data as PayrollRecord);
        } else {
          saved.push({ id: existing.data.id, ...recordPayload } as PayrollRecord);
        }
      } else {
        const newId = `pr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        let insertRes = await context.supabase
          .from("payroll_records")
          .insert({
            id: newId,
            ...recordPayload,
          })
          .select("*")
          .maybeSingle();
        if (
          insertRes.error &&
          (insertRes.error.message.includes("other_allowance") ||
            insertRes.error.message.includes("voucher_ref"))
        ) {
          const { other_allowance, voucher_ref, ...fallback } = recordPayload;
          insertRes = await context.supabase
            .from("payroll_records")
            .insert({
              id: newId,
              ...fallback,
            })
            .select("*")
            .maybeSingle();
        }
        if (insertRes.data) {
          saved.push(insertRes.data as PayrollRecord);
        } else {
          saved.push({ id: newId, ...recordPayload } as PayrollRecord);
        }
      }
    }
    return saved;
  });

export const payPayrollRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      account_id: z.string().min(1, "भुक्तानी खाता छान्नुहोस्"),
      payment_date: z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/, "अमान्य मिति ढाँचा (YYYY/MM/DD)"),
      payment_mode: z.enum(["cash", "bank", "esewa", "cheque"]).optional().default("cash"),
      records: z.array(
        z.object({
          id: z.string().optional(),
          year: z.number(),
          month: z.number(),
          employee_id: z.string(),
          employee_name: z.string(),
          designation: z.string(),
          basic_salary: z.number(),
          days_worked: z.number(),
          total_days: z.number(),
          trips: z.number(),
          allowance: z.number(),
          other_allowance: z.number().optional().default(0),
          gross_salary: z.number(),
          tax: z.number(),
          advance_adjusted: z.number(),
          other_deductions: z.number(),
          net_salary: z.number(),
          remarks: z.string().optional().default(""),
        }),
      ),
    }),
  )
  .handler(async ({ data, context }) => {
    const results: PayrollRecord[] = [];
    const MONTH_NAMES = [
      "बैशाख",
      "जेठ",
      "असार",
      "श्रावण",
      "भदौ",
      "असोज",
      "कार्तिक",
      "मंसिर",
      "पौष",
      "माघ",
      "फाल्गुन",
      "चैत्र",
    ];

    for (const item of data.records) {
      if (item.net_salary <= 0) continue;

      // Check existing record
      const existing = await context.supabase
        .from("payroll_records")
        .select("id, payment_status, voucher_ref")
        .eq("owner_id", context.userId)
        .eq("year", item.year)
        .eq("month", item.month)
        .eq("employee_id", item.employee_id)
        .maybeSingle();

      // LOCK: Already paid = no duplicate payment ever
      if (existing.data?.payment_status === "paid") {
        continue;
      }

      // REQUIRE BOOKING: Must be booked before paying
      if (
        existing.data &&
        existing.data.payment_status !== "booked" &&
        !(existing.data as any).is_booked
      ) {
        throw new Error(
          `पेरोल पहिले बुक गर्नुहोस् (${item.employee_name}) — बुकिङ नगरी भुक्तानी हुँदैन।`,
        );
      }

      const monthName = MONTH_NAMES[item.month] ?? `महिना ${item.month + 1}`;
      const remarks = item.remarks?.trim()
        ? item.remarks.trim()
        : `मासिक तलब भुक्तानी - ${monthName} ${item.year} (${item.employee_name})`;

      // 1. Create Payment Voucher in rp_transactions
      let voucherRef = "";
      try {
        const rpRes = await context.supabase.rpc("save_rp_transaction", {
          p: {
            txn_type: "payment",
            txn_date: data.payment_date,
            account_id: data.account_id,
            to_account_id: "",
            party_type: "employee",
            party_id: item.employee_id,
            party_name: item.employee_name,
            amount: item.net_salary,
            remarks: remarks,
            manual_ref: "",
          },
        });
        if (!rpRes.error && rpRes.data) {
          const rpData = rpRes.data as Record<string, unknown>;
          voucherRef = String(rpData["ref_no"] ?? "");
        }
      } catch (err) {
        console.warn("Failed to auto-create rp voucher for payroll:", err);
      }

      // 2. Update payroll_records with payment_status = 'paid' and lock
      const recordPayload = {
        owner_id: context.userId,
        year: item.year,
        month: item.month,
        employee_id: item.employee_id,
        employee_name: item.employee_name,
        designation: item.designation,
        basic_salary: item.basic_salary,
        days_worked: item.days_worked,
        total_days: item.total_days,
        trips: item.trips,
        allowance: item.allowance,
        other_allowance: item.other_allowance ?? 0,
        gross_salary: item.gross_salary,
        tax: item.tax,
        advance_adjusted: item.advance_adjusted,
        other_deductions: item.other_deductions,
        net_salary: item.net_salary,
        payment_status: "paid" as const,
        payment_date: data.payment_date,
        payment_mode: data.payment_mode,
        voucher_ref: voucherRef,
        remarks: remarks,
        updated_at: new Date().toISOString(),
      };

      if (existing.data?.id) {
        let updateRes = await context.supabase
          .from("payroll_records")
          .update(recordPayload)
          .eq("id", existing.data.id)
          .select("*")
          .maybeSingle();

        if (
          updateRes.error &&
          (updateRes.error.message.includes("other_allowance") ||
            updateRes.error.message.includes("voucher_ref"))
        ) {
          const { other_allowance, voucher_ref, ...fallback } = recordPayload;
          updateRes = await context.supabase
            .from("payroll_records")
            .update(fallback)
            .eq("id", existing.data.id)
            .select("*")
            .maybeSingle();
        }

        if (updateRes.data) {
          results.push(updateRes.data as PayrollRecord);
        } else {
          results.push({
            id: existing.data.id,
            ...recordPayload,
            is_booked: true,
          } as PayrollRecord);
        }
      } else {
        const newId = `pr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        let insertRes = await context.supabase
          .from("payroll_records")
          .insert({
            id: newId,
            ...recordPayload,
          })
          .select("*")
          .maybeSingle();

        if (
          insertRes.error &&
          (insertRes.error.message.includes("other_allowance") ||
            insertRes.error.message.includes("voucher_ref"))
        ) {
          const { other_allowance, voucher_ref, ...fallback } = recordPayload;
          insertRes = await context.supabase
            .from("payroll_records")
            .insert({
              id: newId,
              ...fallback,
            })
            .select("*")
            .maybeSingle();
        }

        if (insertRes.data) {
          results.push(insertRes.data as PayrollRecord);
        } else {
          results.push({ id: newId, ...recordPayload, is_booked: true } as PayrollRecord);
        }
      }
    }

    return results;
  });

/** Book (lock) payroll records for a month — must happen before payment */
export const bookPayrollRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      year: z.number(),
      month: z.number(),
      records: z.array(
        z.object({
          id: z.string().optional(),
          employee_id: z.string(),
          employee_name: z.string(),
          designation: z.string(),
          basic_salary: z.number(),
          days_worked: z.number(),
          total_days: z.number(),
          trips: z.number(),
          allowance: z.number(),
          other_allowance: z.number().optional().default(0),
          gross_salary: z.number(),
          tax: z.number(),
          advance_adjusted: z.number(),
          other_deductions: z.number(),
          net_salary: z.number(),
          remarks: z.string().optional().default(""),
        }),
      ),
    }),
  )
  .handler(async ({ data, context }) => {
    const saved: PayrollRecord[] = [];
    const now = new Date().toISOString();

    for (const item of data.records) {
      // Check existing record
      const existing = await context.supabase
        .from("payroll_records")
        .select("id, payment_status")
        .eq("owner_id", context.userId)
        .eq("year", data.year)
        .eq("month", data.month)
        .eq("employee_id", item.employee_id)
        .maybeSingle();

      // If already paid, skip silently
      if (existing.data?.payment_status === "paid") {
        if (existing.data) saved.push(existing.data as unknown as PayrollRecord);
        continue;
      }

      const basePayload = {
        owner_id: context.userId,
        year: data.year,
        month: data.month,
        employee_id: item.employee_id,
        employee_name: item.employee_name,
        designation: item.designation,
        basic_salary: item.basic_salary,
        days_worked: item.days_worked,
        total_days: item.total_days,
        trips: item.trips,
        allowance: item.allowance,
        other_allowance: item.other_allowance ?? 0,
        gross_salary: item.gross_salary,
        tax: item.tax,
        advance_adjusted: item.advance_adjusted,
        other_deductions: item.other_deductions,
        net_salary: item.net_salary,
        payment_status: "booked" as const,
        remarks: item.remarks ?? "",
        updated_at: now,
      };

      if (existing.data?.id) {
        // Try update
        let res = await context.supabase
          .from("payroll_records")
          .update(basePayload)
          .eq("id", existing.data.id)
          .select("*")
          .maybeSingle();

        if (res.error && res.error.message.includes("other_allowance")) {
          const { other_allowance, ...fallback } = basePayload;
          res = await context.supabase
            .from("payroll_records")
            .update(fallback)
            .eq("id", existing.data.id)
            .select("*")
            .maybeSingle();
        }

        if (res.data) {
          saved.push({ ...(res.data as PayrollRecord), payment_status: "booked", is_booked: true });
        } else {
          saved.push({
            id: existing.data.id,
            ...basePayload,
            payment_status: "booked",
            is_booked: true,
          } as PayrollRecord);
        }
      } else {
        const newId = `pr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        let res = await context.supabase
          .from("payroll_records")
          .insert({
            id: newId,
            ...basePayload,
          })
          .select("*")
          .maybeSingle();

        if (res.error && res.error.message.includes("other_allowance")) {
          const { other_allowance, ...fallback } = basePayload;
          res = await context.supabase
            .from("payroll_records")
            .insert({
              id: newId,
              ...fallback,
            })
            .select("*")
            .maybeSingle();
        }

        if (res.data) {
          saved.push({ ...(res.data as PayrollRecord), payment_status: "booked", is_booked: true });
        } else {
          saved.push({
            id: newId,
            ...basePayload,
            payment_status: "booked",
            is_booked: true,
          } as PayrollRecord);
        }
      }
    }

    return saved;
  });

/** Unbook (unlock) payroll records for a month back to draft (only if not paid) */
export const unbookPayrollRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      year: z.number(),
      month: z.number(),
    }),
  )
  .handler(async ({ data, context }) => {
    // Only unbook records that are NOT paid
    const res = await context.supabase
      .from("payroll_records")
      .update({ payment_status: "pending", updated_at: new Date().toISOString() })
      .eq("owner_id", context.userId)
      .eq("year", data.year)
      .eq("month", data.month)
      .neq("payment_status", "paid")
      .select("*");

    return res.data ?? [];
  });

export const deletePayrollRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("payroll_records")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return true;
  });

export const getEventsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const events: ClubEvent[] = [];

    try {
      const res = await context.supabase
        .from("club_events")
        .select("*")
        .eq("owner_id", context.userId)
        .order("commencing_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (!res.error && res.data) {
        events.push(...(res.data as unknown as ClubEvent[]));
      }
    } catch {
      // Table may not be migrated yet
    }

    return { events };
  });

export const saveEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().optional(),
      title: z.string().trim().min(1, "Programme name is required"),
      locality: z.string().trim().min(1, "Locality is required"),
      budget_required: z.number().min(0, "Budget must be positive"),
      budget_allocated: z.number().optional().default(0),
      commencing_date: z.string().trim().min(1, "Commencing date is required"),
      end_date: z.string().trim().optional().default(""),
      status: z.enum(["planned", "ongoing", "completed", "postponed"]).default("planned"),
      authorized_persons: z
        .array(
          z.object({
            id: z.string().optional(),
            name: z.string(),
            designation: z.string().optional(),
            role: z.string().optional(),
            phone: z.string().optional(),
            type: z.enum(["employee", "member", "other"]).default("employee"),
          }),
        )
        .default([]),
      remarks: z.string().optional().default(""),
    }),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      title: data.title,
      locality: data.locality,
      budget_required: data.budget_required,
      budget_allocated: data.budget_allocated,
      commencing_date: data.commencing_date,
      end_date: data.end_date,
      status: data.status,
      authorized_persons: data.authorized_persons,
      remarks: data.remarks,
      updated_at: new Date().toISOString(),
    };

    if (data.id && !data.id.startsWith("local-")) {
      const res = await context.supabase
        .from("club_events")
        .update(payload)
        .eq("id", data.id)
        .eq("owner_id", context.userId)
        .select("*")
        .single();
      if (res.error) throw new Error(res.error.message);
      return res.data as ClubEvent;
    } else {
      const newId = `evt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const res = await context.supabase
        .from("club_events")
        .insert({
          id: newId,
          owner_id: context.userId,
          ...payload,
        })
        .select("*")
        .single();
      if (res.error) throw new Error(res.error.message);
      return res.data as ClubEvent;
    }
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("club_events")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return true;
  });

// ────────────────────────────────────────────────────────────
// EVENT MEETING MINUTES (कार्यविवरण / मिनेट)
// ────────────────────────────────────────────────────────────

export const getMinutesData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const minutes: EventMinutes[] = [];
    try {
      const res = await context.supabase
        .from("event_minutes")
        .select("*")
        .eq("owner_id", context.userId)
        .order("meeting_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (!res.error && res.data) {
        minutes.push(...(res.data as unknown as EventMinutes[]));
      }
    } catch {
      // event_minutes migration 0017 not applied yet — treated as empty
    }
    return { minutes };
  });

export const saveMinutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().optional(),
      event_id: z.string().trim().optional().default(""),
      meeting_date: z.string().trim().min(1),
      attendees: z
        .array(
          z.object({
            name: z.string().trim().min(1),
            designation: z.string().trim().optional(),
            category: z.enum(["member", "advisor", "representative"]),
          }),
        )
        .default([]),
      agenda: z
        .array(
          z.object({
            id: z.string().trim().min(1),
            text: z.string().trim().min(1),
            decision: z.string().trim().optional(),
            done: z.boolean().default(false),
          }),
        )
        .default([]),
      draft: z.string().max(20000).optional().default(""),
    }),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      event_id: data.event_id,
      meeting_date: data.meeting_date,
      attendees: data.attendees,
      agenda: data.agenda,
      draft: data.draft,
      updated_at: new Date().toISOString(),
    };
    if (data.id && !data.id.startsWith("local-min-")) {
      const res = await context.supabase
        .from("event_minutes")
        .update(payload)
        .eq("id", data.id)
        .eq("owner_id", context.userId)
        .select("*")
        .single();
      if (res.error)
        throw new Error(
          "Could not save minutes. Please apply migration 0017_event_minutes.sql in Supabase.",
        );
      return res.data as unknown as EventMinutes;
    } else {
      const newId = `min-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const res = await context.supabase
        .from("event_minutes")
        .insert({ id: newId, owner_id: context.userId, ...payload })
        .select("*")
        .single();
      if (res.error)
        throw new Error(
          "Could not save minutes. Please apply migration 0017_event_minutes.sql in Supabase.",
        );
      return res.data as unknown as EventMinutes;
    }
  });

export const deleteMinutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("event_minutes")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return true;
  });

export const uploadLocalityPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      ward: z.string().regex(/^[1-9]\d?$/),
      card: z.string().trim().max(20),
      dataUrl: z
        .string()
        .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
        .max(4_500_000),
    }),
  )
  .handler(async ({ data, context }) => {
    const mime = data.dataUrl.slice(5, data.dataUrl.indexOf(";"));
    const base64 = data.dataUrl.slice(data.dataUrl.indexOf(",") + 1);
    const name = data.card ? data.card : `new-${Date.now().toString(36)}`;
    // Upsert into the owner-scoped locality_photos table (Storage-free)
    const up = await context.supabase
      .from("locality_photos")
      .upsert(
        { ward: data.ward, card: name, mime, data: base64 },
        { onConflict: "owner_id,ward,card" },
      )
      .select("ward,card")
      .single();
    if (up.error) throw new Error(up.error.message);
    return { ref: `locality:${data.ward}:${name}`, updated: true };
  });

export const getLocalityPhoto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ ward: z.string().regex(/^[1-9]\d?$/), card: z.string().trim().max(20) }),
  )
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("locality_photos")
      .select("mime,data")
      .eq("owner_id", context.userId)
      .eq("ward", data.ward)
      .eq("card", data.card)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) return "";
    return `data:${res.data.mime || "image/jpeg"};base64,${res.data.data}`;
  });

export const deleteLocalityPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      ref: z.string().trim(),
      ward: z.string().optional(),
      card: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    // New style ref: locality:{ward}:{card} — delete the DB row
    if (data.ref.startsWith("locality:")) {
      const [, ward, card] = data.ref.split(":");
      if (!ward || !card) return false;
      const res = await context.supabase
        .from("locality_photos")
        .delete()
        .eq("owner_id", context.userId)
        .eq("ward", ward)
        .eq("card", card);
      if (res.error && res.error.code !== "PGRST116") throw new Error(res.error.message);
      return true;
    }
    // Legacy Storage URL cleanup
    const marker = "/object/public/locality-photos/";
    const idx = data.ref.indexOf(marker);
    if (idx === -1) return false;
    const path = decodeURIComponent(data.ref.slice(idx + marker.length).split("?")[0] || "");
    const top = path.split("/")[0];
    if (top !== context.userId) return false;
    const res = await context.supabase.storage.from("locality-photos").remove([path]);
    if (res.error) throw new Error(res.error.message);
    return true;
  });

// ═══════════════════════════════════════════════════════════
// VENDOR MASTER
// ═══════════════════════════════════════════════════════════

export const getVendorsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const res = await context.supabase
        .from("vendor_master")
        .select("*")
        .eq("owner_id", context.userId)
        .order("name");
      if (res.error) throw new Error(res.error.message);
      return res.data as Vendor[];
    } catch {
      return [] as Vendor[];
    }
  });

export const saveVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().optional(),
      name: z.string(),
      address: z.string().optional(),
      pan_vat: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      due_days: z.number().optional(),
      opening_balance: z.number().optional(),
      balance_type: z.enum(["dr", "cr"]).optional(),
      is_active: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      name: data.name,
      address: data.address ?? "",
      pan_vat: data.pan_vat ?? "",
      phone: data.phone ?? "",
      email: data.email ?? "",
      due_days: data.due_days ?? 30,
      opening_balance: data.opening_balance ?? 0,
      balance_type: data.balance_type ?? "cr",
      is_active: data.is_active !== false,
      updated_at: new Date().toISOString(),
    };
    if (data.id && !data.id.startsWith("local-")) {
      const res = await context.supabase
        .from("vendor_master")
        .update(payload)
        .eq("id", data.id)
        .eq("owner_id", context.userId)
        .select("*")
        .single();
      if (res.error) throw new Error(res.error.message);
      return res.data as Vendor;
    } else {
      const newId = `ven-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const res = await context.supabase
        .from("vendor_master")
        .insert({ id: newId, owner_id: context.userId, ...payload })
        .select("*")
        .single();
      if (res.error) throw new Error(res.error.message);
      return res.data as Vendor;
    }
  });

export const deleteVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("vendor_master")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return true;
  });

export const getVendorLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ vendor_id: z.string() }))
  .handler(async ({ data, context }) => {
    try {
      const res = await context.supabase
        .from("vendor_ledger")
        .select("*")
        .eq("vendor_id", data.vendor_id)
        .eq("owner_id", context.userId)
        .order("created_at");
      if (res.error) throw new Error(res.error.message);
      return res.data as VendorLedgerEntry[];
    } catch {
      return [] as VendorLedgerEntry[];
    }
  });

// ═══════════════════════════════════════════════════════════
// ITEM MASTER & FIXED ASSET MASTER
// ═══════════════════════════════════════════════════════════

export const getItemMaster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ category: z.string().optional() }).optional())
  .handler(async ({ data, context }) => {
    try {
      let query = context.supabase
        .from("item_master")
        .select("*")
        .eq("owner_id", context.userId)
        .order("item_code");
      if (data?.category) query = query.eq("category", data.category);
      const res = await query;
      if (res.error) throw new Error(res.error.message);
      return (res.data || []) as ItemMaster[];
    } catch {
      return [] as ItemMaster[];
    }
  });

export const saveItemMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().optional(),
      item_code: z.string(),
      name: z.string(),
      parent: z.string().optional(),
      sub_parent: z.string().optional(),
      uom: z.string().optional(),
      units: z.number().optional(),
      amount: z.number().optional(),
      category: z.enum(["asset", "item"]).optional(),
      last_rate: z.number().optional(),
      is_active: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      item_code: data.item_code,
      name: data.name,
      parent: data.parent ?? "",
      sub_parent: data.sub_parent ?? "",
      uom: data.uom ?? "nos",
      units: data.units ?? 1,
      amount: data.amount ?? 0,
      category: data.category ?? "item",
      last_rate: data.last_rate ?? data.amount ?? 0,
      is_active: data.is_active !== false,
      updated_at: new Date().toISOString(),
    };
    if (data.id && !data.id.startsWith("local-")) {
      const res = await context.supabase
        .from("item_master")
        .update(payload)
        .eq("id", data.id)
        .eq("owner_id", context.userId)
        .select("*")
        .single();
      if (res.error) throw new Error(res.error.message);
      return res.data as ItemMaster;
    } else {
      const newId = `itm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const res = await context.supabase
        .from("item_master")
        .insert({ id: newId, owner_id: context.userId, ...payload })
        .select("*")
        .single();
      if (res.error) throw new Error(res.error.message);
      return res.data as ItemMaster;
    }
  });

export const deleteItemMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("item_master")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return { success: true };
  });

export const getFixedAssetMaster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const res = await context.supabase
        .from("fixed_asset_master")
        .select("*")
        .eq("owner_id", context.userId)
        .order("code");
      if (res.error) throw new Error(res.error.message);
      return (res.data || []) as FixedAssetMaster[];
    } catch {
      return [] as FixedAssetMaster[];
    }
  });

export const saveFixedAssetMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().optional(),
      code: z.string(),
      name: z.string(),
      parent: z.string().optional(),
      sub_parent: z.string().optional(),
      uom: z.string().optional(),
      units: z.number().optional(),
      amount: z.number().optional(),
      is_active: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      code: data.code,
      name: data.name,
      parent: data.parent ?? "",
      sub_parent: data.sub_parent ?? "",
      uom: data.uom ?? "nos",
      units: data.units ?? 1,
      amount: data.amount ?? 0,
      is_active: data.is_active !== false,
      updated_at: new Date().toISOString(),
    };
    if (data.id && !data.id.startsWith("local-")) {
      const res = await context.supabase
        .from("fixed_asset_master")
        .update(payload)
        .eq("id", data.id)
        .eq("owner_id", context.userId)
        .select("*")
        .single();
      if (res.error) throw new Error(res.error.message);
      return res.data as FixedAssetMaster;
    } else {
      const newId = `ast-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const res = await context.supabase
        .from("fixed_asset_master")
        .insert({ id: newId, owner_id: context.userId, ...payload })
        .select("*")
        .single();
      if (res.error) throw new Error(res.error.message);
      return res.data as FixedAssetMaster;
    }
  });

export const deleteFixedAssetMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("fixed_asset_master")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return { success: true };
  });

// ═══════════════════════════════════════════════════════════
// EXPENSE RECORDS (Fixed Assets / Items / OpEx)
// ═══════════════════════════════════════════════════════════

export const getExpensesData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ expense_type: z.string().optional() }).optional())
  .handler(async ({ data, context }) => {
    try {
      let query = context.supabase
        .from("expense_records")
        .select("*")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: false });
      if (data?.expense_type) query = query.eq("expense_type", data.expense_type);
      const res = await query;
      if (res.error) throw new Error(res.error.message);
      return res.data as ExpenseRecord[];
    } catch {
      return [] as ExpenseRecord[];
    }
  });

export const saveExpenseRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().optional(),
      expense_type: z.enum(["fixed_asset", "item", "expense"]),
      date_bs: z.string(),
      bill_number: z.string().optional(),
      vendor_id: z.string().optional(),
      vendor_name: z.string().optional(),
      linked_member_id: z.string().optional(),
      linked_employee_id: z.string().optional(),
      employee_reimbursed: z.boolean().optional(),
      linked_event_id: z.string().optional(),
      line_items: z.array(z.any()),
      other_charges: z.number().optional(),
      other_charges_desc: z.string().optional(),
      discount: z.number().optional(),
      discount_desc: z.string().optional(),
      subtotal: z.number().optional(),
      final_amount: z.number(),
      bill_scanned_amount: z.number().optional(),
      bill_match_status: z.enum(["match", "mismatch", "pending"]).optional(),
      remarks: z.string().optional(),
      status: z.enum(["draft", "approved"]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const billNo = (data.bill_number ?? "").trim();
    const vendorId = data.vendor_id ?? "";
    const vendorName = (data.vendor_name ?? "").trim().toLowerCase();
    if (billNo && (vendorId || vendorName)) {
      // Same vendor (id or typed name) + same bill number must not be saved twice.
      let dup = context.supabase
        .from("expense_records")
        .select("id,vendor_name,bill_number")
        .eq("owner_id", context.userId)
        .eq("bill_number", billNo)
        .limit(1);
      if (vendorId) dup = dup.eq("vendor_id", vendorId);
      else dup = dup.ilike("vendor_name", vendorName);
      if (data.id && !data.id.startsWith("local-")) dup = dup.neq("id", data.id);
      const dupRes = await dup;
      if (!dupRes.error && (dupRes.data?.length ?? 0) > 0) {
        throw new Error(
          `${
            vendorName.charAt(0).toUpperCase() + vendorName.slice(1) || "यो"
          } जना/विक्रेताको बिल नं. ${billNo} पहिले नै दर्ता भइसकेको छ।`,
        );
      }
    }
    const payload = {
      expense_type: data.expense_type,
      date_bs: data.date_bs,
      bill_number: data.bill_number ?? "",
      vendor_id: data.vendor_id ?? "",
      vendor_name: data.vendor_name ?? "",
      linked_member_id: data.linked_member_id ?? "",
      linked_employee_id: data.linked_employee_id ?? "",
      employee_reimbursed: data.employee_reimbursed === true,
      linked_event_id: data.linked_event_id ?? "",
      line_items: data.line_items,
      other_charges: data.other_charges ?? 0,
      other_charges_desc: data.other_charges_desc ?? "",
      discount: data.discount ?? 0,
      discount_desc: data.discount_desc ?? "",
      subtotal: data.subtotal ?? 0,
      final_amount: data.final_amount,
      bill_scanned_amount: data.bill_scanned_amount ?? 0,
      bill_match_status: data.bill_match_status ?? "pending",
      remarks: data.remarks ?? "",
      status: data.status ?? "draft",
      updated_at: new Date().toISOString(),
    };
    if (data.id && !data.id.startsWith("local-")) {
      let res = await context.supabase
        .from("expense_records")
        .update(payload)
        .eq("id", data.id)
        .eq("owner_id", context.userId)
        .select("*")
        .single();
      // Older DBs may not have the employee_reimbursed column yet — retry without it
      if (res.error && `${res.error.message}`.includes("employee_reimbursed")) {
        const { employee_reimbursed: _skip, ...rest } = payload as Record<string, unknown>;
        res = await context.supabase
          .from("expense_records")
          .update(rest)
          .eq("id", data.id)
          .eq("owner_id", context.userId)
          .select("*")
          .single();
      }
      if (res.error) throw new Error(res.error.message);
      return res.data as ExpenseRecord;
    } else {
      const newId = `exp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      let res = await context.supabase
        .from("expense_records")
        .insert({ id: newId, owner_id: context.userId, ...payload })
        .select("*")
        .single();
      if (res.error && `${res.error.message}`.includes("employee_reimbursed")) {
        const { employee_reimbursed: _skip, ...rest } = payload as Record<string, unknown>;
        res = await context.supabase
          .from("expense_records")
          .insert({ id: newId, owner_id: context.userId, ...rest })
          .select("*")
          .single();
      }
      if (res.error) throw new Error(res.error.message);
      return res.data as ExpenseRecord;
    }
  });

export const deleteExpenseRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("expense_records")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return true;
  });

// Convenience: fetch only employees (subset of getMembersData)
export const getEmployeesData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const res = await context.supabase
        .from("employee_master")
        .select("*")
        .eq("owner_id", context.userId)
        .order("name");
      if (res.error) throw new Error(res.error.message);
      return res.data as Employee[];
    } catch {
      return [] as Employee[];
    }
  });

// ═══════════════════════════════════════════════════════════
// APP CONFIGURATION (Entity & AI)
// ═══════════════════════════════════════════════════════════

export const getAppConfiguration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const res = await context.supabase
        .from("app_configuration")
        .select("*")
        .eq("owner_id", context.userId)
        .maybeSingle();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    } catch {
      return null;
    }
  });

export const saveAppConfiguration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      entity_name: z.string().optional(),
      entity_sub_name: z.string().optional(),
      tagline: z.string().optional(),
      address: z.string().optional(),
      pan_vat: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      logo_url: z.string().optional(),
      fiscal_year_start: z.string().trim().max(10).optional().default(""),
      fiscal_year_end: z.string().trim().max(10).optional().default(""),
      ai_provider: z.enum(["gemini", "openrouter", "openai", "custom"]).optional(),
      gemini_api_key: z.string().optional(),
      gemini_model: z.string().optional(),
      openrouter_api_key: z.string().optional(),
      openrouter_model: z.string().optional(),
      openai_api_key: z.string().optional(),
      openai_model: z.string().optional(),
      custom_ai_endpoint: z.string().optional(),
      custom_ai_key: z.string().optional(),
      custom_ai_model: z.string().optional(),
      admin_pin: z.string().trim().max(10).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const KEY_COLS = ["gemini_api_key", "openrouter_api_key", "openai_api_key", "custom_ai_key"];
    // Some databases may still have the pre-key table shape — probe which key columns exist
    const probe = await context.supabase
      .from("app_configuration")
      .select(`id,${KEY_COLS.join(",")}`)
      .limit(1);
    const hasKeys = !probe.error;
    const missingCol = (msg: string) => /Could not find the '([^']+)' column/.exec(msg || "")?.[1];
    const payload: Record<string, unknown> = {
      ...data,
      owner_id: context.userId,
      updated_at: new Date().toISOString(),
    };
    if (!hasKeys) for (const k of KEY_COLS) delete payload[k];
    const send = (pl: Record<string, unknown>) =>
      context.supabase
        .from("app_configuration")
        .upsert(pl, { onConflict: "owner_id" })
        .select("*")
        .single();
    let res = await send(payload);
    for (let i = 0; res.error && i < 5; i++) {
      const col = missingCol(res.error.message);
      if (!col || !(col in payload)) break;
      delete payload[col];
      res = await send(payload);
    }
    if (!res.error) return res.data;
    // Fallback for databases where the owner-unique constraint is absent:
    // update the owner's row if present, otherwise insert a fresh one.
    let msg = res.error.message || "Configuration could not be saved.";
    const existing = await context.supabase
      .from("app_configuration")
      .select("id")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (existing.data?.id) {
      const upd = await context.supabase
        .from("app_configuration")
        .update(payload)
        .eq("id", existing.data.id as string)
        .select("*")
        .single();
      if (!upd.error) return upd.data;
      const col = missingCol(upd.error.message);
      if (col && col in payload) {
        delete payload[col];
        const retry = await context.supabase
          .from("app_configuration")
          .update(payload)
          .eq("id", existing.data.id as string)
          .select("*")
          .single();
        if (!retry.error) return retry.data;
        msg = retry.error.message || msg;
      } else {
        msg = upd.error.message || msg;
      }
    } else if (!existing.error) {
      const ins = await context.supabase
        .from("app_configuration")
        .insert(payload)
        .select("*")
        .single();
      if (!ins.error) return ins.data;
      const col = missingCol(ins.error.message);
      if (col && col in payload) {
        delete payload[col];
        const retry = await context.supabase
          .from("app_configuration")
          .insert(payload)
          .select("*")
          .single();
        if (!retry.error) return retry.data;
        msg = retry.error.message || msg;
      } else {
        msg = ins.error.message || msg;
      }
    } else {
      msg = existing.error.message || msg;
    }
    if (/Could not find the/.test(msg)) {
      msg =
        "app_configuration मा केही columns छैनन्। Supabase SQL Editor मा migration 0016_app_configuration.sql फेरि Run गर्नुहोस् (त्यसपछि API keys यी अधूरा columns मा सुरक्षित हुनेछन्)। " +
        msg;
    }
    throw new Error(msg);
  });

/* ── Receipts & Payments module ───────────────────────────────── */

/**
 * Next cash-book reference per transaction type for the fiscal year of txn_date.
 * Reads the same rp_counters row the atomic save allocates from, so the preview
 * matches the number that will actually be assigned.
 */
export const getRpRefPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ txn_date: z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/) }))
  .handler(async ({ data, context }) => {
    const fy = fiscalYear(data.txn_date);
    if (!fy || !FISCAL_YEARS.includes(fy)) return null;
    const res = await context.supabase
      .from("rp_counters")
      .select("txn_type,last_number")
      .eq("owner_id", context.userId)
      .eq("fiscal_year", fy);
    if (res.error) throw new Error(res.error.message);
    const last: Partial<Record<RPTxnType, number>> = {};
    for (const row of (res.data ?? []) as { txn_type: string; last_number: number }[]) {
      const t = row.txn_type as RPTxnType;
      if (t in RP_REF_PREFIX && typeof row.last_number === "number") {
        last[t] = Math.max(last[t] || 0, row.last_number);
      }
    }
    return {
      fiscal_year: fy,
      receipt: rpReference("receipt", (last.receipt || 0) + 1),
      payment: rpReference("payment", (last.payment || 0) + 1),
      transfer: rpReference("transfer", (last.transfer || 0) + 1),
    };
  });

export const getRpData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const [accRes, custRes, vendRes, empRes] = await Promise.all([
        context.supabase
          .from("rp_accounts")
          .select("*")
          .eq("owner_id", context.userId)
          .order("created_at"),
        context.supabase
          .from("customer_master")
          .select("id,name")
          .eq("owner_id", context.userId)
          .order("name"),
        context.supabase
          .from("vendor_master")
          .select("id,name")
          .eq("owner_id", context.userId)
          .order("name"),
        context.supabase
          .from("employee_master")
          .select("id,name")
          .eq("owner_id", context.userId)
          .order("name"),
      ]);
      // Fetch transactions directly and map account names from accounts map
      const txRes = await context.supabase
        .from("rp_transactions")
        .select("*")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: false });
      const errors = [accRes, custRes, vendRes, empRes, txRes].filter((r) => r.error);
      if (errors.length) throw new Error(errors[0].error?.message || "Load failed");
      const accounts = (accRes.data ?? []).map((a) => ({
        ...a,
        opening_balance: Number(a.opening_balance) || 0,
      }));
      const accountsById = new Map(accounts.map((a) => [a.id as string, a]));

      // Events / Programmes list for donation linking
      let events: Array<{ id: string; title: string; locality?: string; status?: string }> = [];
      try {
        const evtRes = await context.supabase
          .from("club_events")
          .select("id, title, locality, status")
          .eq("owner_id", context.userId)
          .order("created_at", { ascending: false });
        if (evtRes.data) events = evtRes.data;
      } catch {}
      const eventsById = new Map(events.map((e) => [e.id, e]));

      const transactions = (txRes.data ?? []).map((t: Record<string, unknown>) => {
        const pType = String(t.party_type || "");
        const rawRemarks = String(t.remarks || "");
        const progFromRemarks = rawRemarks.match(/\[कार्यक्रम:\s*([^\]]+)\]/)?.[1] || "";
        const evTitle =
          String(t.linked_event_title || "") ||
          (pType === "donation" && t.party_id && eventsById.get(String(t.party_id))?.title) ||
          progFromRemarks;
        return {
          ...t,
          account_name: (accountsById.get(String(t.account_id ?? ""))?.name ?? null) as
            string | null,
          linked_event_title: evTitle || undefined,
          company_name:
            String(t.company_name || "") ||
            (pType === "donation" ? String(t.party_name || "") : undefined),
        };
      });

      // TDS/SST accumulation from payroll records
      let tds_sst_accrued = 0;
      try {
        const prRes = await context.supabase
          .from("payroll_records")
          .select("tax, payment_status")
          .eq("owner_id", context.userId);
        if (prRes.data) {
          tds_sst_accrued = prRes.data.reduce(
            (sum, r: { tax?: number; payment_status?: string }) => sum + (Number(r.tax) || 0),
            0,
          );
        }
      } catch {}

      // TDS/SST payments made in rp_transactions
      const tds_sst_paid = (txRes.data ?? []).reduce((sum, t: Record<string, unknown>) => {
        if (t.txn_type === "payment") {
          const pType = String(t.party_type || "").toLowerCase();
          const pName = String(t.party_name || "").toUpperCase();
          const remarks = String(t.remarks || "").toUpperCase();
          if (
            pType === "tax" ||
            pName.includes("TDS") ||
            pName.includes("SST") ||
            remarks.includes("TDS") ||
            remarks.includes("SST")
          ) {
            return sum + (Number(t.amount) || 0);
          }
        }
        return sum;
      }, 0);

      const tds_sst = {
        accrued: tds_sst_accrued,
        paid: tds_sst_paid,
        balance: Math.max(0, tds_sst_accrued - tds_sst_paid),
      };

      return {
        accounts,
        transactions,
        customers: custRes.data ?? [],
        vendors: vendRes.data ?? [],
        employees: empRes.data ?? [],
        events,
        tds_sst,
      };
    } catch {
      return {
        accounts: [] as unknown[],
        transactions: [] as unknown[],
        customers: [] as unknown[],
        vendors: [] as unknown[],
        employees: [] as unknown[],
        events: [] as unknown[],
        tds_sst: { accrued: 0, paid: 0, balance: 0 },
      };
    }
  });

export const saveRpAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().optional(),
      account_type: z.enum(["cash", "bank"]),
      name: z.string().min(1),
      account_number: z.string().optional(),
      opening_balance: z.number().default(0),
      address: z.string().optional(),
      remarks: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      account_type: data.account_type,
      name: data.name,
      account_number: data.account_number ?? "",
      opening_balance: data.opening_balance ?? 0,
      address: data.address ?? "",
      remarks: data.remarks ?? "",
      owner_id: context.userId,
    };
    if (data.id && !data.id.startsWith("local-")) {
      const res = await context.supabase
        .from("rp_accounts")
        .update(payload)
        .eq("id", data.id)
        .eq("owner_id", context.userId)
        .select("*")
        .single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    }
    const newId = `rpa-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const res = await context.supabase
      .from("rp_accounts")
      .insert({ id: newId, ...payload })
      .select("*")
      .single();
    if (res.error) throw new Error(res.error.message);
    return res.data;
  });

export const deleteRpAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("rp_accounts")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export const saveRpTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      txn_type: z.enum(["receipt", "payment", "transfer"]),
      txn_date: z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/),
      account_id: z.string(),
      to_account_id: z.string().optional(),
      party_type: z.string().optional(),
      party_id: z.string().optional(),
      party_name: z.string().optional(),
      amount: z.number().positive(),
      remarks: z.string().optional(),
      manual_ref: z.string().max(40).optional(),
      company_name: z.string().optional(),
      linked_event_id: z.string().optional(),
      linked_event_title: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const isDonation = data.party_type === "donation";
    const partyName =
      isDonation && data.company_name?.trim()
        ? data.company_name.trim()
        : (data.party_name ?? "").trim();

    // Include linked programme in remarks if not already present
    let finalRemarks = (data.remarks ?? "").trim();
    if (isDonation && data.linked_event_title?.trim()) {
      const progTag = `[कार्यक्रम: ${data.linked_event_title.trim()}]`;
      if (!finalRemarks.includes(progTag)) {
        finalRemarks = finalRemarks ? `${progTag} ${finalRemarks}` : progTag;
      }
    }

    const res = await context.supabase.rpc("save_rp_transaction", {
      p: {
        txn_type: data.txn_type,
        txn_date: data.txn_date,
        account_id: data.account_id,
        to_account_id: data.to_account_id ?? "",
        party_type: data.party_type ?? "",
        party_id: isDonation && data.linked_event_id ? data.linked_event_id : (data.party_id ?? ""),
        party_name: partyName,
        amount: data.amount,
        remarks: finalRemarks,
        manual_ref: data.manual_ref ?? "",
      },
    });
    if (res.error) throw new Error(res.error.message);
    const row = res.data as Record<string, unknown> | null;
    if (!row || typeof row["ref_no"] !== "string") {
      throw new Error("रसिद नम्बर तालयो गर्न सकिएन (RPC result खाली छ)।");
    }

    const rid = String(row["id"] || "");
    if (rid && (data.company_name || data.linked_event_id || data.linked_event_title)) {
      try {
        await context.supabase
          .from("rp_transactions")
          .update({
            company_name: data.company_name || "",
            linked_event_id: data.linked_event_id || "",
            linked_event_title: data.linked_event_title || "",
          })
          .eq("id", rid);
      } catch {
        // Optional columns
      }
    }

    return {
      ...(row as unknown as RPTransactionRow),
      company_name: data.company_name || undefined,
      linked_event_id: data.linked_event_id || undefined,
      linked_event_title: data.linked_event_title || undefined,
    };
  });

export const deleteRpTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("rp_transactions")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export interface RPTransactionRow {
  id: string;
  txn_type: "receipt" | "payment" | "transfer";
  ref_no: string;
  account_id: string;
  to_account_id?: string | null;
  party_name?: string | null;
  account_name?: string | null;
  amount: number;
  [k: string]: unknown;
}

export const getRpAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const res = await context.supabase
        .from("rp_accounts")
        .select("id,name,account_type,account_number,opening_balance")
        .eq("owner_id", context.userId)
        .order("account_type")
        .order("name");
      if (res.error) throw new Error(res.error.message);
      return (res.data || []) as unknown as Array<{
        id: string;
        name: string;
        account_type: "cash" | "bank";
        account_number: string | null;
        opening_balance: number;
      }>;
    } catch {
      return [];
    }
  });

/* ── Theli daily log ─────────────────────────────────────────── */

const theliEntrySchema = z
  .object({
    from: z.string().trim().optional().default(""),
    to: z.string().trim().optional().default(""),
    count: z.number().optional().default(0),
  })
  .transform((e) => ({ from: e.from, to: e.to, count: Math.max(0, Math.round(e.count)) }));

const cleanTheliEntries = (entries: { from: string; to: string; count: number }[]) =>
  entries.filter((e) => e.from || e.to || e.count > 0);

export const getTheliData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const logs: TheliLog[] = [];
    const employees: Employee[] = [];
    const members: Member[] = [];
    try {
      const res = await context.supabase
        .from("theli_logs")
        .select("*")
        .eq("owner_id", context.userId)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (!res.error && res.data) logs.push(...(res.data as unknown as TheliLog[]));
    } catch {
      // table may not be migrated yet
    }
    try {
      const empRes = await context.supabase
        .from("employee_master")
        .select("*")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: true });
      if (!empRes.error && empRes.data) employees.push(...(empRes.data as unknown as Employee[]));
    } catch {
      // table may not be migrated yet
    }
    try {
      let memRes = await context.supabase
        .from("members")
        .select("*")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: true });
      if (memRes.error || !memRes.data || memRes.data.length === 0) {
        memRes = await context.supabase
          .from("club_members")
          .select("*")
          .eq("owner_id", context.userId)
          .order("created_at", { ascending: true });
      }
      if (memRes.error || !memRes.data || memRes.data.length === 0) {
        memRes = await context.supabase
          .from("bod_members")
          .select("*")
          .eq("owner_id", context.userId)
          .order("created_at", { ascending: true });
      }
      if (!memRes.error && memRes.data) members.push(...(memRes.data as unknown as Member[]));
    } catch {
      // table may not be migrated yet
    }
    return { logs, employees, members };
  });

export const saveTheliLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().optional(),
      log_date: z.string().trim().min(1, "Log date is required"),
      ward: z.string().trim().optional().default(""),
      employee_id: z.string().trim(),
      employee_name: z.string().trim(),
      supervisor_type: z.enum(["member", "employee"]).optional().default("member"),
      supervisor_id: z.string().trim().optional().default(""),
      supervisor_name: z.string().trim().optional().default(""),
      opening_balance: z.number().optional().default(0),
      out_entries: z.array(theliEntrySchema).optional().default([]),
      in_entries: z.array(theliEntrySchema).optional().default([]),
      closing_serial: z.string().trim().optional().default(""),
      cancelled_count: z.number().min(0).optional().default(0),
      settled: z.boolean().optional().default(false),
      amount: z.number().min(0).optional().default(0),
      cleared_amount: z.number().min(0).optional().default(0),
      remarks: z.string().trim().optional().default(""),
    }),
  )
  .handler(async ({ data, context }) => {
    const outEntries = cleanTheliEntries(data.out_entries);
    const inEntries = cleanTheliEntries(data.in_entries);
    if (!data.employee_name) throw new Error("कर्मचारी छान्नुहोस्।");
    if (outEntries.length === 0)
      throw new Error("बिहान निकालिएको थेलीको दायरा (देखि–सम्म सिरियल) भर्नुहोस्।");
    const payload = {
      log_date: data.log_date,
      ward: data.ward,
      employee_id: data.employee_id,
      employee_name: data.employee_name,
      supervisor_type: data.supervisor_type,
      supervisor_id: data.supervisor_id,
      supervisor_name: data.supervisor_name,
      opening_balance: data.opening_balance ?? 0,
      out_entries: outEntries,
      in_entries: inEntries,
      closing_serial: data.closing_serial ?? "",
      cancelled_count: data.cancelled_count ?? 0,
      settled: data.settled ?? false,
      amount: data.amount ?? 0,
      cleared_amount: data.cleared_amount ?? 0,
      remarks: data.remarks,
      updated_at: new Date().toISOString(),
    };
    if (data.id && !data.id.startsWith("local-")) {
      const res = await context.supabase
        .from("theli_logs")
        .update(payload)
        .eq("id", data.id)
        .eq("owner_id", context.userId)
        .select("*")
        .single();
      if (res.error) throw new Error(res.error.message);
      return res.data as TheliLog;
    }
    const newId = `th-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const res = await context.supabase
      .from("theli_logs")
      .insert({ id: newId, owner_id: context.userId, ...payload })
      .select("*")
      .single();
    if (res.error) throw new Error(res.error.message);
    return res.data as TheliLog;
  });

export const deleteTheliLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("theli_logs")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return true;
  });

/* ══════════════════════════════════════════════════════════════════
   THELI STOCK & ISSUANCE SERVER FUNCTIONS
   ══════════════════════════════════════════════════════════════════ */

export const getTheliStockData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const batches: TheliStockBatch[] = [];
    const items: TheliStockItem[] = [];
    const logs: TheliLog[] = [];
    const employees: Employee[] = [];
    const members: Member[] = [];

    try {
      const res = await context.supabase
        .from("theli_stock_batches")
        .select("*")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: false });
      if (!res.error && res.data) batches.push(...(res.data as unknown as TheliStockBatch[]));
    } catch {
      // Table may not be migrated yet
    }

    try {
      const res = await context.supabase
        .from("theli_stock_items")
        .select("*")
        .eq("owner_id", context.userId)
        .order("theli_no", { ascending: true });
      if (!res.error && res.data) items.push(...(res.data as unknown as TheliStockItem[]));
    } catch {
      // Table may not be migrated yet
    }

    try {
      const res = await context.supabase
        .from("theli_logs")
        .select("*")
        .eq("owner_id", context.userId)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (!res.error && res.data) logs.push(...(res.data as unknown as TheliLog[]));
    } catch {
      // Table may not be migrated yet
    }

    try {
      const empRes = await context.supabase
        .from("employee_master")
        .select("*")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: true });
      if (!empRes.error && empRes.data) employees.push(...(empRes.data as unknown as Employee[]));
    } catch {
      // Table may not be migrated yet
    }

    try {
      let memRes = await context.supabase
        .from("members")
        .select("*")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: true });
      if (memRes.error || !memRes.data || memRes.data.length === 0) {
        memRes = await context.supabase
          .from("club_members")
          .select("*")
          .eq("owner_id", context.userId)
          .order("created_at", { ascending: true });
      }
      if (!memRes.error && memRes.data) members.push(...(memRes.data as unknown as Member[]));
    } catch {
      // Table may not be migrated yet
    }

    return { batches, items, logs, employees, members };
  });

export const saveTheliStockBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().optional(),
      municipality: z.string().trim().min(1, "Municipality is required"),
      ward: z.string().trim().min(1, "Ward is required"),
      fiscal_year: z.string().trim().min(1, "Fiscal Year is required"),
      start_from: z.string().trim().min(1, "Start serial is required"),
      end_to: z.string().trim().min(1, "End serial is required"),
      vouchers_per_theli: z.number().min(1).optional().default(50),
      remarks: z.string().trim().optional().default(""),
    }),
  )
  .handler(async ({ data, context }) => {
    const counts = calculateTheliStockCounts(data.start_from, data.end_to, data.vouchers_per_theli);
    if (counts.totalVouchers <= 0) {
      throw new Error("अमान्य सिरियल दायरा — अन्तिम नम्बर सुरुको भन्दा ठूलो हुनुपर्छ।");
    }

    const batchId =
      data.id && !data.id.startsWith("local-")
        ? data.id
        : `tsb-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const batchPayload = {
      id: batchId,
      owner_id: context.userId,
      municipality: data.municipality,
      ward: data.ward,
      fiscal_year: data.fiscal_year,
      start_from: data.start_from,
      end_to: data.end_to,
      vouchers_per_theli: data.vouchers_per_theli,
      total_vouchers: counts.totalVouchers,
      total_theli: counts.totalTheli,
      remarks: data.remarks ?? "",
      updated_at: new Date().toISOString(),
    };

    let savedBatch: TheliStockBatch = {
      ...batchPayload,
      created_at: new Date().toISOString(),
    };

    try {
      const res = await context.supabase
        .from("theli_stock_batches")
        .upsert(batchPayload)
        .select("*")
        .single();
      if (!res.error && res.data) {
        savedBatch = res.data as TheliStockBatch;
      }
    } catch {
      // Table may not be migrated yet
    }

    // Generate individual theli items
    const generatedItems = generateTheliRanges({
      id: batchId,
      municipality: data.municipality,
      ward: data.ward,
      fiscal_year: data.fiscal_year,
      start_from: data.start_from,
      end_to: data.end_to,
      vouchers_per_theli: data.vouchers_per_theli,
    });

    const itemsToSave = generatedItems.map((item) => ({
      ...item,
      owner_id: context.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    try {
      await context.supabase.from("theli_stock_items").upsert(itemsToSave);
    } catch {
      // Table may not be migrated yet
    }

    return { batch: savedBatch, items: generatedItems };
  });

export const issueTheliStockItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      item_id: z.string().trim().min(1),
      employee_id: z.string().trim().min(1, "कर्मचारी छान्नुहोस्"),
      employee_name: z.string().trim().min(1),
      supervisor_name: z.string().trim().optional().default(""),
      issued_date: z.string().trim().min(1, "जारी मिति आवश्यक छ"),
    }),
  )
  .handler(async ({ data, context }) => {
    const updatePayload = {
      status: "issued" as const,
      is_remaining_open: false,
      issued_to_id: data.employee_id,
      issued_to_name: data.employee_name,
      supervisor_name: data.supervisor_name ?? "",
      issued_date: data.issued_date,
      updated_at: new Date().toISOString(),
    };

    try {
      await context.supabase
        .from("theli_stock_items")
        .update(updatePayload)
        .eq("id", data.item_id)
        .eq("owner_id", context.userId);
    } catch {
      // Table may not be migrated yet
    }

    return { success: true, item_id: data.item_id, ...updatePayload };
  });

// Issue MULTIPLE theli ranges to one employee in a single action
export const issueMultipleTheliStockItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      item_ids: z.array(z.string().trim().min(1)).min(1, "कम्तिमा एक थेली दायरा छान्नुहोस्"),
      employee_id: z.string().trim().min(1, "कर्मचारी छान्नुहोस्"),
      employee_name: z.string().trim().min(1),
      supervisor_name: z.string().trim().optional().default(""),
      issued_date: z.string().trim().min(1, "जारी मिति आवश्यक छ"),
    }),
  )
  .handler(async ({ data, context }) => {
    const updatePayload = {
      status: "issued" as const,
      is_remaining_open: false,
      issued_to_id: data.employee_id,
      issued_to_name: data.employee_name,
      supervisor_name: data.supervisor_name ?? "",
      issued_date: data.issued_date,
      updated_at: new Date().toISOString(),
    };

    try {
      await context.supabase
        .from("theli_stock_items")
        .update(updatePayload)
        .in("id", data.item_ids)
        .eq("owner_id", context.userId);
    } catch {
      // Table may not be migrated yet — each item falls back gracefully
    }

    return { success: true, item_ids: data.item_ids, ...updatePayload };
  });

export const reportTheliStockClosing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      item_id: z.string().trim().min(1),
      last_voucher_booked: z.string().trim().min(1, "अन्तिम काटिएको रसिद नं. भर्नुहोस्"),
      amount_booked: z.number().min(0).default(0),
      amount_obtained: z.number().min(0).default(0),
      carried_balance: z.number().default(0),
      cancelled_count: z.number().min(0).default(0),
      action_on_remaining: z.enum(["return", "keep_issued"]).default("return"),
      log_date: z.string().trim().min(1),
      remarks: z.string().trim().optional().default(""),
    }),
  )
  .handler(async ({ data, context }) => {
    // 1. Fetch current item
    let currentItem: TheliStockItem | null = null;
    try {
      const res = await context.supabase
        .from("theli_stock_items")
        .select("*")
        .eq("id", data.item_id)
        .eq("owner_id", context.userId)
        .maybeSingle();
      if (!res.error && res.data) currentItem = res.data as TheliStockItem;
    } catch {}

    if (!currentItem) {
      // Stub fallback
      currentItem = {
        id: data.item_id,
        municipality: "वीरेन्द्रनगर",
        ward: "4",
        fiscal_year: "2081/82",
        range_from: "GT-001",
        range_to: "GT-050",
        total_vouchers: 50,
        status: "issued",
      };
    }

    const calc = calculateTheliBooking(
      currentItem,
      data.last_voucher_booked,
      data.amount_booked,
      data.amount_obtained,
      data.carried_balance,
      data.cancelled_count,
    );

    const now = new Date().toISOString();

    if (calc.isFullyExhausted || !calc.remainingRange) {
      // All vouchers booked
      const updatePayload = {
        status: "completed" as const,
        is_remaining_open: false,
        last_voucher_booked: data.last_voucher_booked,
        booked_vouchers_count: calc.bookedCount,
        cancelled_count: calc.cancelledCount ?? 0,
        remaining_vouchers_count: 0,
        remaining_range_from: "",
        remaining_range_to: "",
        amount_booked: calc.amountBooked,
        amount_obtained: calc.amountObtained,
        balance: calc.newBalance,
        updated_at: now,
      };

      try {
        await context.supabase
          .from("theli_stock_items")
          .update(updatePayload)
          .eq("id", data.item_id)
          .eq("owner_id", context.userId);
      } catch {}
    } else {
      // Partial range remains
      if (data.action_on_remaining === "return") {
        // Return remaining part to stock:
        // Update current item to completed for the booked portion
        const completedUpdate = {
          status: "completed" as const,
          is_remaining_open: false,
          last_voucher_booked: data.last_voucher_booked,
          booked_vouchers_count: calc.bookedCount,
          cancelled_count: calc.cancelledCount ?? 0,
          remaining_vouchers_count: 0,
          amount_booked: calc.amountBooked,
          amount_obtained: calc.amountObtained,
          balance: calc.newBalance,
          updated_at: now,
        };

        try {
          await context.supabase
            .from("theli_stock_items")
            .update(completedUpdate)
            .eq("id", data.item_id)
            .eq("owner_id", context.userId);
        } catch {}

        // Create new remaining theli stock item ready to be issued FIRST
        const remainingId = `th-rem-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        const remainingItemPayload = {
          id: remainingId,
          owner_id: context.userId,
          batch_id: currentItem.batch_id,
          municipality: currentItem.municipality,
          ward: currentItem.ward,
          fiscal_year: currentItem.fiscal_year,
          theli_no: currentItem.theli_no,
          range_from: calc.remainingRange.from,
          range_to: calc.remainingRange.to,
          total_vouchers: calc.remainingRange.count,
          status: "returned_remaining" as const,
          is_remaining_open: true, // Will rank at the very top of available list!
          booked_vouchers_count: 0,
          remaining_vouchers_count: calc.remainingRange.count,
          amount_booked: 0,
          amount_obtained: 0,
          balance: 0,
          created_at: now,
          updated_at: now,
        };

        try {
          await context.supabase.from("theli_stock_items").insert(remainingItemPayload);
        } catch {}
      } else {
        // Keep issued to employee
        const keepUpdate = {
          status: "partially_booked" as const,
          is_remaining_open: false,
          last_voucher_booked: data.last_voucher_booked,
          booked_vouchers_count: calc.bookedCount,
          cancelled_count: calc.cancelledCount ?? 0,
          remaining_vouchers_count: calc.remainingCount,
          remaining_range_from: calc.remainingRange.from,
          remaining_range_to: calc.remainingRange.to,
          amount_booked: (Number(currentItem.amount_booked) || 0) + calc.amountBooked,
          amount_obtained: (Number(currentItem.amount_obtained) || 0) + calc.amountObtained,
          balance: calc.newBalance,
          updated_at: now,
        };

        try {
          await context.supabase
            .from("theli_stock_items")
            .update(keepUpdate)
            .eq("id", data.item_id)
            .eq("owner_id", context.userId);
        } catch {}
      }
    }

    // Also record in theli_logs for the daily collection record
    try {
      const logPayload = {
        id: `th-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        owner_id: context.userId,
        log_date: data.log_date,
        ward: currentItem.ward,
        employee_id: currentItem.issued_to_id || "",
        employee_name: currentItem.issued_to_name || "",
        supervisor_name: currentItem.supervisor_name || "",
        opening_balance: data.carried_balance,
        out_entries: [
          {
            from: currentItem.range_from,
            to: currentItem.range_to,
            count: currentItem.total_vouchers,
          },
        ],
        closing_serial: data.last_voucher_booked,
        amount: calc.amountBooked,
        cleared_amount: calc.amountObtained,
        remarks: data.remarks || `थेली रिपोर्ट: ${data.last_voucher_booked} सम्म काटियो`,
        cancelled_count: calc.cancelledCount ?? 0,
        net_valid_count: calc.netValidCount ?? calc.bookedCount,
        updated_at: now,
      };
      await context.supabase.from("theli_logs").insert(logPayload);
    } catch {}

    return {
      success: true,
      calc,
    };
  });

export const deleteTheliStockBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    try {
      await context.supabase
        .from("theli_stock_items")
        .delete()
        .eq("batch_id", data.id)
        .eq("owner_id", context.userId);

      await context.supabase
        .from("theli_stock_batches")
        .delete()
        .eq("id", data.id)
        .eq("owner_id", context.userId);
    } catch {}
    return true;
  });

// Clear all theli data (theli stock batches, stock items, and daily theli ledger logs)
export const clearAllTheliData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await context.supabase.from("theli_stock_items").delete().eq("owner_id", context.userId);

      await context.supabase.from("theli_stock_batches").delete().eq("owner_id", context.userId);

      await context.supabase.from("theli_logs").delete().eq("owner_id", context.userId);

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  });

// ═══════════════════════════════════════════════════════════
// EMPLOYEE PAGE PERMISSIONS (Access Control)
// ═══════════════════════════════════════════════════════════

export const getEmployeePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const res = await context.supabase
        .from("employee_permissions")
        .select("*")
        .eq("owner_id", context.userId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    } catch {
      return [];
    }
  });

export const saveEmployeePermissionBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      employee_id: z.string().trim().min(1, "कर्मचारी छान्नुहोस्"),
      employee_name: z.string().trim().optional().default(""),
      permissions: z.array(
        z.object({
          page_path: z.string().trim().min(1),
          access_level: z.enum(["no_access", "read_only", "full_access"]),
        }),
      ),
    }),
  )
  .handler(async ({ data, context }) => {
    const rows = data.permissions.map((p) => ({
      id: `perm-${data.employee_id}-${p.page_path.replace(/[^a-zA-Z0-9]/g, "_")}`,
      owner_id: context.userId,
      employee_id: data.employee_id,
      employee_name: data.employee_name || "",
      page_path: p.page_path,
      access_level: p.access_level,
      updated_at: new Date().toISOString(),
    }));

    try {
      const res = await context.supabase
        .from("employee_permissions")
        .upsert(rows, { onConflict: "owner_id,employee_id,page_path" })
        .select("*");
      if (res.error) {
        return { success: false, saved: rows, error: res.error.message };
      }
      return { success: true, saved: res.data };
    } catch (e: any) {
      return { success: false, saved: rows, error: e?.message };
    }
  });

// ═══════════════════════════════════════════════════════════
// EMPLOYEE CREDENTIALS VAULT (ID & Password Storage)
// ═══════════════════════════════════════════════════════════

export const getEmployeeCredentialsList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Errors propagate to the caller so the Settings UI can show exactly why
    // the vault is unavailable (e.g. table not migrated yet). Never silently
    // pretend an empty list means "no credentials saved".
    const res = await context.supabase
      .from("employee_credentials")
      .select("*")
      .eq("owner_id", context.userId);
    if (res.error) {
      throw new Error(
        `Credentials vault रिड्डमा छैन (table missing?) — SQL migration चलाउनुहोस्: ${res.error.message}`,
      );
    }
    return res.data ?? [];
  });

export const saveEmployeeCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      employee_id: z.string().trim().min(1, "कर्मचारी छान्नुहोस्"),
      employee_name: z.string().trim().optional().default(""),
      login_id: z.string().trim().min(1, "लगइन आईडी आवश्यक छ"),
      login_password: z.string().trim().min(1, "पासवर्ड आवश्यक छ"),
      login_pin: z
        .string()
        .trim()
        .regex(/^\d{4}$/, "PIN चार अंकको हुनुपर्छ (4 digits)"),
      is_active: z.boolean().optional().default(true),
      notes: z.string().optional().default(""),
    }),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      employee_id: data.employee_id,
      owner_id: context.userId,
      employee_name: data.employee_name || "",
      login_id: data.login_id,
      login_password: data.login_password,
      login_pin: data.login_pin,
      is_active: data.is_active,
      notes: data.notes || "",
      updated_at: new Date().toISOString(),
    };

    try {
      const res = await context.supabase
        .from("employee_credentials")
        .upsert(payload, { onConflict: "employee_id" })
        .select("*")
        .single();
      if (res.error) {
        return { success: false, credential: payload, error: res.error.message };
      }
      return { success: true, credential: res.data };
    } catch (e: any) {
      return { success: false, credential: payload, error: e?.message };
    }
  });

export const deleteEmployeeCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      employee_id: z.string().trim().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    try {
      const res = await context.supabase
        .from("employee_credentials")
        .delete()
        .eq("employee_id", data.employee_id)
        .eq("owner_id", context.userId);
      if (res.error) return { success: false, error: res.error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  });

// PIN unlock: verify an employee's login PIN server-side so the client never
// receives PINs to compare. Returns only identity info on success.
export const verifyEmployeePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      employee_id: z.string().trim().min(1, "कर्मचारी छान्नुहोस्"),
      pin: z.string().trim().regex(/^\d+$/, "PIN अंक मात्र हुनुपर्छ"),
    }),
  )
  .handler(async ({ data, context }) => {
    try {
      const res = await context.supabase
        .from("employee_credentials")
        .select("employee_id, employee_name, login_pin, is_active")
        .eq("owner_id", context.userId)
        .eq("employee_id", data.employee_id)
        .maybeSingle();
      if (res.error) throw new Error(res.error.message);
      const cred = res.data as {
        employee_id: string;
        employee_name: string;
        login_pin: string;
        is_active: boolean;
      } | null;
      if (!cred || !cred.is_active) {
        return { ok: false, code: "not_found" as const };
      }
      if (!/^\d{4}$/.test(cred.login_pin)) {
        return { ok: false, code: "pin_not_set" as const };
      }
      if (cred.login_pin !== data.pin) {
        return { ok: false, code: "wrong_pin" as const };
      }
      return {
        ok: true,
        code: "ok" as const,
        employee_id: cred.employee_id,
        employee_name: cred.employee_name,
      };
    } catch (e: any) {
      return { ok: false, code: "error" as const, error: e?.message };
    }
  });

// Admin PIN unlock: verify owner's Admin PIN server-side against app_configuration.
export const verifyAdminPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      pin: z
        .string()
        .trim()
        .regex(/^\d{4}$/, "Admin PIN चार अंकको हुनुपर्छ"),
    }),
  )
  .handler(async ({ data, context }) => {
    try {
      const res = await context.supabase
        .from("app_configuration")
        .select("admin_pin")
        .eq("owner_id", context.userId)
        .maybeSingle();
      if (res.error) throw new Error(res.error.message);
      const conf = res.data as { admin_pin?: string | null } | null;
      const configuredPin = (conf?.admin_pin || "").trim();

      if (!configuredPin) {
        // No admin PIN in DB yet: fall back to the PIN captured during signup
        // (stored in the user's auth metadata), and persist it on first match.
        const metaPin = String((context.claims as any)?.user_metadata?.admin_pin || "").trim();
        if (metaPin) {
          if (metaPin === data.pin) {
            await context.supabase.from("app_configuration").upsert(
              {
                owner_id: context.userId,
                admin_pin: data.pin,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "owner_id" },
            );
            return { ok: true, code: "ok" as const };
          }
          return { ok: false, code: "wrong_pin" as const };
        }
        return { ok: false, code: "pin_not_set" as const };
      }

      if (configuredPin !== data.pin) {
        return { ok: false, code: "wrong_pin" as const };
      }

      return { ok: true, code: "ok" as const };
    } catch (e: any) {
      return { ok: false, code: "error" as const, error: e?.message };
    }
  });

// Save Admin PIN upon initial signup or update from Settings
export const saveAdminPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      admin_pin: z
        .string()
        .trim()
        .regex(/^\d{4}$/, "Admin PIN चार अंकको हुनुपर्छ"),
    }),
  )
  .handler(async ({ data, context }) => {
    try {
      const payload = {
        owner_id: context.userId,
        admin_pin: data.admin_pin,
        updated_at: new Date().toISOString(),
      };
      // Upsert into app_configuration for this user
      const res = await context.supabase
        .from("app_configuration")
        .upsert(payload, { onConflict: "owner_id" })
        .select("admin_pin")
        .maybeSingle();
      if (res.error) {
        // Fallback: try update if upsert failed due to missing constraint
        const upd = await context.supabase
          .from("app_configuration")
          .update({ admin_pin: data.admin_pin, updated_at: new Date().toISOString() })
          .eq("owner_id", context.userId)
          .select("admin_pin");
        if (upd.error) {
          // Last resort: insert a fresh configuration row for this owner
          const ins = await context.supabase
            .from("app_configuration")
            .insert(payload)
            .select("admin_pin");
          if (ins.error) return { ok: false, error: ins.error.message };
          return { ok: true };
        }
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message };
    }
  });
