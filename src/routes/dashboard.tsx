import { createFileRoute, Link } from "@tanstack/react-router";
import { useWorkspace, WorkspacePage, money, EmptyRows } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import {
  np,
  MODES,
  MONTHS,
  monthYear,
  collectionBy,
  collectionByMonth,
  inBSRange,
  todayBS,
  remainingDuesForPerson,
  indexPaidReceiptsByCustomer,
  getCustomerTotalRate,
  type ExpenseRecord,
  type RPTransaction,
  type RPAccount,
} from "@/lib/receipt-rules";
import { BSDatePicker } from "@/components/bs-date-picker";
import { SearchSelect } from "@/components/search-select";
import { useState, useMemo } from "react";
import {
  Plus,
  Users,
  ReceiptText,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  PieChart as PieChartIcon,
  BarChart3,
  ArrowUpRight,
  Sparkles,
  Banknote,
  Building2,
  Calendar,
  Landmark,
} from "lucide-react";
import { DashboardAIChatbot } from "@/components/dashboard-ai-chatbot";
import { DashboardLiveMap } from "@/components/dashboard-live-map";
import { SummaryTable } from "@/components/summary-table";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getExpensesData, getRpData } from "@/lib/workspace.functions";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — Sangstha" },
      {
        name: "description",
        content: "Interactive executive dashboard, analytics, and infographics for Sangstha.",
      },
      { property: "og:title", content: "Sangstha Executive Dashboard" },
      {
        property: "og:description",
        content: "Financial KPIs, collection trends, and dues monitoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

// Color palettes for rich infographics
const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

function Dashboard() {
  const { query, ward, year, userId, signedIn } = useWorkspace();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tole, setTole] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [myName, setMyName] = useState("");

  // Fetch expenses to calculate net surplus/deficit
  const fetchExpensesFn = useServerFn(getExpensesData);
  const expensesQuery = useQuery({
    queryKey: ["expenses", userId],
    queryFn: () => fetchExpensesFn({ data: {} }),
    enabled: Boolean(signedIn && userId),
    staleTime: 60_000,
    refetchOnMount: false,
  });

  // Receipts & Payments (cash/bank book) summary data
  const fetchRpDataFn = useServerFn(getRpData);
  const rpQuery = useQuery({
    queryKey: ["rp_data", userId],
    queryFn: () => fetchRpDataFn(),
    enabled: Boolean(signedIn && userId),
    staleTime: 60_000,
    refetchOnMount: false,
  });
  const rpTransactions: RPTransaction[] = useMemo(
    () => (rpQuery.data as { transactions?: RPTransaction[] } | undefined)?.transactions ?? [],
    [rpQuery.data],
  );
  const rpAccounts: RPAccount[] = useMemo(
    () => (rpQuery.data as { accounts?: RPAccount[] } | undefined)?.accounts ?? [],
    [rpQuery.data],
  );

  const yearReceipts = useMemo(
    () =>
      query.data?.receipts.filter((r) => (!ward || r.ward === ward) && Number(r.year) === year) ??
      [],
    [query.data?.receipts, ward, year],
  );

  const toles = useMemo(
    () => [...new Set(yearReceipts.map((r) => r.tole).filter(Boolean))].sort(),
    [yearReceipts],
  );

  const receipts = useMemo(
    () =>
      yearReceipts.filter(
        (r) =>
          inBSRange(r.date, from, to) &&
          (!tole || r.tole === tole) &&
          (!modeFilter || r.mode === modeFilter),
      ),
    [yearReceipts, from, to, tole, modeFilter],
  );

  const byWard = useMemo(
    () => collectionBy(receipts, (r) => r.ward).sort((a, b) => Number(a.key) - Number(b.key)),
    [receipts],
  );

  const byTole = useMemo(() => collectionBy(receipts, (r) => r.tole), [receipts]);
  const byMonth = useMemo(() => collectionByMonth(receipts), [receipts]);
  const people = useMemo(
    () => query.data?.people.filter((p) => !ward || p.ward === ward) ?? [],
    [query.data?.people, ward],
  );
  const plans = query.data?.plans ?? [];

  // Total collected revenue
  const total = receipts.reduce((a, r) => a + r.total, 0);

  // Expenses filtered by date range
  const allExpenses: ExpenseRecord[] = expensesQuery.data ?? [];
  const filteredExpenses = useMemo(
    () => allExpenses.filter((e) => inBSRange(e.date_bs, from, to)),
    [allExpenses, from, to],
  );
  const totalExpense = filteredExpenses.reduce((a, e) => a + (Number(e.final_amount) || 0), 0);
  const netSurplus = total - totalExpense;

  // Receipts & Payments (cash/bank book) summary — respects the BS date filters
  const rpSummary = useMemo(() => {
    const opening = rpAccounts.reduce((a, acc) => a + (Number(acc.opening_balance) || 0), 0);
    const txns = rpTransactions.filter((t) => inBSRange(t.txn_date, from, to));
    const rpReceipts = txns.filter((t) => t.txn_type === "receipt");
    const rpPayments = txns.filter((t) => t.txn_type === "payment");
    const rpTransfers = txns.filter((t) => t.txn_type === "transfer");
    const receiptsAmt = rpReceipts.reduce((a, t) => a + (Number(t.amount) || 0), 0);
    const paymentsAmt = rpPayments.reduce((a, t) => a + (Number(t.amount) || 0), 0);
    return {
      opening,
      receiptsAmt,
      paymentsAmt,
      closing: opening + receiptsAmt - paymentsAmt,
      transfers: rpTransfers.length,
      latest: [...txns]
        .sort((a, b) => String(b.txn_date ?? "").localeCompare(String(a.txn_date ?? "")))
        .slice(0, 5),
      cash: rpAccounts.filter((a) => a.account_type === "cash").length,
      bank: rpAccounts.filter((a) => a.account_type === "bank").length,
    };
  }, [rpAccounts, rpTransactions, from, to]);

  // Dues & Aging computation across all customers (O(N) with pre-indexed receipts)
  const { totalOutstandingDues, overdueCustomerCount, totalExpectedMonthly } = useMemo(() => {
    const today = todayBS();
    const allR = query.data?.receipts ?? [];
    const paidIndex = indexPaidReceiptsByCustomer(allR);
    let duesSum = 0;
    let overdueCount = 0;
    let monthlyExpected = 0;

    people.forEach((p) => {
      const rate = getCustomerTotalRate(p, plans);
      monthlyExpected += rate;
      const res = remainingDuesForPerson(
        p.joining_date,
        p.opening_dues,
        allR,
        p.ward,
        p.card,
        rate,
        today,
        paidIndex,
      );
      if (res.total > 0) {
        duesSum += res.total;
        overdueCount++;
      }
    });

    return {
      totalOutstandingDues: duesSum,
      overdueCustomerCount: overdueCount,
      totalExpectedMonthly: monthlyExpected,
    };
  }, [people, query.data?.receipts, plans]);

  // Collection recovery efficiency rate
  const collectionEfficiency =
    totalExpectedMonthly > 0
      ? Math.min(100, Math.round((total / (totalExpectedMonthly * 12)) * 100))
      : 0;

  // 12-Month Financial Trajectory (Income vs Expense)
  const monthlyFinancialTrend = useMemo(() => {
    const expMap = new Map<number, number>();
    filteredExpenses.forEach((e) => {
      const parts = e.date_bs.split("/");
      const m = Number(parts[1] ?? 0) - 1;
      if (m >= 0 && m < 12) {
        expMap.set(m, (expMap.get(m) || 0) + (Number(e.final_amount) || 0));
      }
    });

    return byMonth.map((x) => ({
      monthName: MONTHS[x.m] || `महिना ${x.m + 1}`,
      income: x.amount,
      expense: expMap.get(x.m) || 0,
      net: x.amount - (expMap.get(x.m) || 0),
    }));
  }, [byMonth, filteredExpenses]);

  // Payment Mode Distribution for Donut Chart
  const paymentModeData = useMemo(() => {
    return MODES.map((mode) => {
      const amt = receipts.filter((r) => r.mode === mode).reduce((a, r) => a + r.total, 0);
      return { name: mode, value: amt };
    }).filter((item) => item.value > 0);
  }, [receipts]);

  // Top 5 Highest Performing Toles
  const topToles = useMemo(() => {
    return [...byTole].sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [byTole]);

  // Customer Plan Breakdown
  const customerPlanBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    people.forEach((p) => {
      const planName = p.plan || p.plans?.[0]?.name || "अन्य / अनिर्धारित";
      map.set(planName, (map.get(planName) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [people]);

  return (
    <WorkspacePage title="Dashboard">
      {/* Top Banner & Quick Action */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <Sparkles className="size-4" />
            </span>
            <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
              संस्था समग्र वित्तीय तथा कार्यसम्पादन ड्यासबोर्ड
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            आर्थिक वर्ष २०८१/८२ · वडा {ward ? np(ward) : "सबै"} · संकलन, खर्च, बाँकी बक्यौता तथा
            इन्फोग्राफिक्स
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            className="bg-emerald-600 font-bold hover:bg-emerald-700 text-white shadow-xs"
          >
            <Link to="/">
              <Plus className="size-4" /> नयाँ रसिद काट्नुहोस्
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="font-semibold">
            <Link to="/reports">
              <BarChart3 className="size-4 text-primary" /> विस्तृत प्रतिवेदन
            </Link>
          </Button>
        </div>
      </div>

      {/* ─── PRIMARY KPI INFOGRAPHIC CARDS ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Income */}
        <Link
          to="/reports"
          className="group relative block overflow-hidden rounded-xl border bg-card p-5 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">कुल संकलन आम्दानी</span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
              <Wallet className="size-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-foreground">{money(total)}</div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
            <ArrowUpRight className="size-3.5" />
            <span>कुल {receipts.length} वटा रसिद जारी · विवरण हेर्नुहोस्</span>
          </div>
          <div className="absolute -bottom-6 -right-6 size-24 rounded-full bg-emerald-500/5 pointer-events-none" />
        </Link>

        {/* Total Expenses */}
        <Link
          to="/expenses"
          className="group relative block overflow-hidden rounded-xl border bg-card p-5 shadow-xs transition-all hover:border-rose-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">कुल भुक्तानी खर्च</span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600">
              <TrendingDown className="size-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-foreground">{money(totalExpense)}</div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>सञ्चालन तथा प्रशासनिक खर्च · खर्च हेर्नुहोस्</span>
          </div>
          <div className="absolute -bottom-6 -right-6 size-24 rounded-full bg-rose-500/5 pointer-events-none" />
        </Link>

        {/* Net Surplus / Deficit */}
        <Link
          to="/reports"
          className="group relative block overflow-hidden rounded-xl border bg-card p-5 shadow-xs transition-all hover:border-teal-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">खुद बचत / घाटा (Net)</span>
            <div
              className={`flex size-9 items-center justify-center rounded-lg ${
                netSurplus >= 0 ? "bg-teal-500/15 text-teal-600" : "bg-amber-500/15 text-amber-600"
              }`}
            >
              <TrendingUp className="size-5" />
            </div>
          </div>
          <div
            className={`mt-2 text-2xl font-black ${
              netSurplus >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-amber-700 dark:text-amber-400"
            }`}
          >
            {money(netSurplus)}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            {netSurplus >= 0 ? "सकारात्मक कोष स्थिति (Surplus)" : "नकारात्मक अवस्था (Deficit)"}
          </div>
          <div className="absolute -bottom-6 -right-6 size-24 rounded-full bg-teal-500/5 pointer-events-none" />
        </Link>

        {/* Outstanding Dues */}
        <Link
          to="/members"
          className="group relative block overflow-hidden rounded-xl border bg-card p-5 shadow-xs transition-all hover:border-amber-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">ग्राहक बाँकी बक्यौता</span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
              <AlertTriangle className="size-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {money(totalOutstandingDues)}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
            <span>{overdueCustomerCount} जना ग्राहकको शुल्क बाँकी · ग्राहक हेर्नुहोस्</span>
          </div>
          <div className="absolute -bottom-6 -right-6 size-24 rounded-full bg-amber-500/5 pointer-events-none" />
        </Link>
      </div>

      {/* ─── SECONDARY METRIC STRIP ─── */}
      <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Link
          to="/members"
          className="rounded-lg border bg-card/60 p-3 flex items-center gap-3 transition-all hover:border-primary/40 hover:bg-card"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Users className="size-4" />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-semibold">दर्ता भएका ग्राहक</div>
            <div className="text-base font-extrabold text-foreground">{people.length} जना</div>
          </div>
        </Link>

        <Link
          to="/reports"
          className="rounded-lg border bg-card/60 p-3 flex items-center gap-3 transition-all hover:border-indigo-300 hover:bg-card"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600">
            <Building2 className="size-4" />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-semibold">
              सक्रिय टोल क्षेत्र
            </div>
            <div className="text-base font-extrabold text-foreground">{toles.length} वटा टोल</div>
          </div>
        </Link>

        <Link
          to="/reports"
          className="rounded-lg border bg-card/60 p-3 flex items-center gap-3 transition-all hover:border-emerald-300 hover:bg-card"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="size-4" />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-semibold">
              अपेक्षित मासिक शुल्क
            </div>
            <div className="text-base font-extrabold text-foreground">
              {money(totalExpectedMonthly)}
            </div>
          </div>
        </Link>

        <Link
          to="/reports"
          className="rounded-lg border bg-card/60 p-3 flex items-center gap-3 transition-all hover:border-cyan-300 hover:bg-card"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
            <Banknote className="size-4" />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-semibold">औसत रसिद रकम</div>
            <div className="text-base font-extrabold text-foreground">
              {receipts.length > 0 ? money(Math.round(total / receipts.length)) : "रु. ०"}
            </div>
          </div>
        </Link>
      </div>

      {/* ─── कुन संकलन? MODE-WISE BIFURCATION OF TOTAL COLLECTION ─── */}
      <div className="mt-6 rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
              <Wallet className="size-4 text-emerald-600" />
              कुन संकलन? — माध्यम अनुसार वर्गीकरण
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              कुल संकलन रु. {np(total.toLocaleString("en-IN"))} को भुक्तानी माध्यम अनुसार बिफर्केसन
            </p>
          </div>
          <label className="text-xs font-semibold text-muted-foreground">
            <span className="block mb-1">कुन संकलन छनोट</span>
            <select
              aria-label="Collection mode filter"
              className="h-9 block rounded-md border bg-background px-3 text-xs font-bold text-foreground min-w-[160px]"
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
            >
              <option value="">सबै संकलन (All)</option>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {MODES.map((m, idx) => {
            const amt = receipts.filter((r) => r.mode === m).reduce((a, r) => a + r.total, 0);
            const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
            const active = modeFilter === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setModeFilter(active ? "" : m)}
                className={`rounded-lg border px-3 py-2 text-left transition-all ${
                  active ? "border-emerald-400 bg-emerald-500/10" : "bg-card/60 hover:bg-card"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <span className="text-[10px] font-bold text-muted-foreground truncate">{m}</span>
                </div>
                <div className="text-sm font-black text-foreground mt-0.5">{money(amt)}</div>
                <div className="text-[10px] font-bold text-muted-foreground">{pct}% हिस्सा</div>
              </button>
            );
          })}
        </div>
        {modeFilter && (
          <p className="mt-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            फोकस: {modeFilter} — माथिका सबै तथ्याङ्क यही माध्यमको संकलनमा आधारित छन्
          </p>
        )}
      </div>

      {/* ─── RECEIPTS & PAYMENTS (CASH/BANK BOOK) SUMMARY ─── */}
      <div className="mt-6 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 mb-4">
          <div>
            <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
              <Landmark className="size-4 text-cyan-600" />
              रसिद तथा भुक्तानी सारांश (Receipts &amp; Payments — नगद/बैंक)
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              नगद तथा बैंक खाताका रसिद, भुक्तानी र त्यसैले बनेको तल्लो मौज्दात
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="font-semibold text-xs">
            <Link to="/receipts-payments">नगद/बैंक बही हेर्नुहोस् &rarr;</Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card/60 p-3">
            <div className="text-[11px] font-semibold text-muted-foreground">
              प्रारम्भिक मौज्दात (Opening)
            </div>
            <div className="text-lg font-black text-foreground">{money(rpSummary.opening)}</div>
          </div>
          <div className="rounded-lg border bg-emerald-500/5 p-3">
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              कुल रसिद प्राप्ति (Receipts)
            </div>
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">
              {money(rpSummary.receiptsAmt)}
            </div>
          </div>
          <div className="rounded-lg border bg-rose-500/5 p-3">
            <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-400">
              कुल भुक्तानी (Payments)
            </div>
            <div className="text-lg font-black text-rose-700 dark:text-rose-400">
              {money(rpSummary.paymentsAmt)}
            </div>
          </div>
          <div className="rounded-lg border bg-cyan-500/5 p-3">
            <div className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-400">
              अन्तिम मौज्दात (Closing)
            </div>
            <div className="text-lg font-black text-cyan-700 dark:text-cyan-400">
              {money(rpSummary.closing)}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/40 font-bold text-foreground">
              <tr>
                {["मिति (BS)", "खाता", "प्रकार", "पक्ष", "रकम (रु.)"].map((t) => (
                  <th key={t} className="px-3 py-2">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rpSummary.latest.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-accent/40">
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{np(t.txn_date)}</td>
                  <td className="px-3 py-2">{t.account_name || "-"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        t.txn_type === "receipt"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : t.txn_type === "payment"
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                            : "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400"
                      }`}
                    >
                      {t.txn_type === "receipt"
                        ? "रसिद"
                        : t.txn_type === "payment"
                          ? "भुक्तानी"
                          : "ट्रान्सफर"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{t.party_name || t.company_name || "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-black text-right">
                    {money(t.amount)}
                  </td>
                </tr>
              ))}
              {!rpSummary.latest.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                    यो मिति अवधिमा नगद/बैंक कारोबार भेटिएन।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── LIVE TEAM & CUSTOMER LOCATION MAP ─── */}
      {signedIn && userId && (
        <div className="mt-6">
          <DashboardLiveMap
            userId={userId}
            userName={myName || `व्यवस्थापक-${userId.slice(0, 6)}`}
            people={query.data?.people ?? []}
            trips={query.data?.trips ?? []}
            receipts={query.data?.receipts ?? []}
            plans={plans}
            selectedWard={ward || undefined}
            currentYear={year}
            currentMonth={Number(todayBS().split("/")[1] || 1) - 1}
            onRefresh={() => query.refetch()}
          />
        </div>
      )}

      {/* ─── INSTITUTIONAL AI CHATBOT COPILOT ─── */}
      <div className="my-6">
        <DashboardAIChatbot
          totalCollection={total}
          receiptCount={receipts.length}
          customerCount={people.length}
          ward={ward}
          year={year}
          byWard={byWard}
          byTole={byTole}
          recentReceipts={receipts.slice(0, 10)}
        />
      </div>

      {/* Date & Tole Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-2xs">
        <div className="text-xs font-semibold">
          <span className="text-muted-foreground block mb-1">मिति देखि (From BS)</span>
          <BSDatePicker value={from} onChange={setFrom} />
        </div>
        <div className="text-xs font-semibold">
          <span className="text-muted-foreground block mb-1">मिति सम्म (To BS)</span>
          <BSDatePicker value={to} onChange={setTo} />
        </div>
        <label className="text-xs font-semibold text-muted-foreground">
          <span className="block mb-1">टोल छनोट</span>
          <SearchSelect
            className="block min-w-[140px] text-xs font-bold text-foreground"
            value={tole}
            onChange={(v) => setTole(v)}
            placeholder="सबै टोलहरू"
            options={toles.map((t) => ({ value: t, label: t }))}
          />
        </label>
        {(from || to || tole) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setFrom("");
              setTo("");
              setTole("");
              setModeFilter("");
            }}
          >
            फिल्टर हटाउनुहोस् (Clear)
          </Button>
        )}
      </div>

      {/* ─── INFOGRAPHIC CHARTS SECTION ─── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Monthly Trend Area Chart (2 Cols) */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <BarChart3 className="size-4 text-emerald-600" />
                मासिक आम्दानी तथा खर्च विश्लेषण (Monthly Cashflow)
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                १२ महिनाको आम्दानी (रसिद संकलन) र खर्चको तुलनात्मक ग्राफ
              </p>
            </div>
            <span className="text-[10px] rounded-md bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
              वि.सं. {np(year)}
            </span>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthlyFinancialTrend}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="monthName" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) =>
                    `रु. ${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`
                  }
                />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `रु. ${Number(value || 0).toLocaleString("en-IN")}`,
                    name === "income" ? "आम्दानी" : "खर्च",
                  ]}
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    borderColor: "var(--border)",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: "bold",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#incomeGrad)"
                  name="income"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#expenseGrad)"
                  name="expense"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-center gap-6 text-xs font-bold text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <span>आम्दानी (Income)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-rose-500" />
              <span>खर्च (Expense)</span>
            </div>
          </div>
        </div>

        {/* Payment Mode Donut Chart (1 Col) */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <PieChartIcon className="size-4 text-primary" />
                भुक्तानी माध्यम हिस्सा
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">नगद, eSewa, खल्ती, बैंक</p>
            </div>
          </div>

          <div className="h-[210px] w-full">
            {paymentModeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentModeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentModeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [
                      `रु. ${Number(val || 0).toLocaleString("en-IN")}`,
                      "रकम",
                    ]}
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      borderColor: "var(--border)",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                कुनै डेटा उपलब्ध छैन
              </div>
            )}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {paymentModeData.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between border-b py-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <span className="text-[11px] text-muted-foreground truncate">{item.name}</span>
                </div>
                <span className="text-[11px] font-bold">{money(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── TOP TOLES & PLAN DISTRIBUTION INFOGRAPHICS ─── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Top Performing Toles Bar Chart */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <Building2 className="size-4 text-emerald-600" />
                शीर्ष संकलन हुने टोलहरू (Top 5 Toles)
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                धेरै संकलन भएका शीर्ष ५ टोलहरू
              </p>
            </div>
          </div>

          <div className="h-[210px] w-full">
            {topToles.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topToles}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => `रु. ${val >= 1000 ? `${val / 1000}k` : val}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="key"
                    tick={{ fontSize: 11, fontWeight: "bold" }}
                    width={80}
                  />
                  <Tooltip
                    formatter={(val: any) => [
                      `रु. ${Number(val || 0).toLocaleString("en-IN")}`,
                      "कुल संकलन",
                    ]}
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      borderColor: "var(--border)",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                  />
                  <Bar dataKey="amount" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                टोलको डेटा उपलब्ध छैन
              </div>
            )}
          </div>
        </div>

        {/* Customer Plan Distribution */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <Users className="size-4 text-primary" />
                ग्राहक सेवा योजना वर्गीकरण (Customer Plans)
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                घरायसी, व्यापारिक, होटल, संस्थागत
              </p>
            </div>
            <span className="text-xs font-bold text-muted-foreground">कुल: {people.length}</span>
          </div>

          <div className="space-y-3">
            {customerPlanBreakdown.map((item, idx) => {
              const pct = people.length > 0 ? Math.round((item.count / people.length) * 100) : 0;
              const color = PIE_COLORS[idx % PIE_COLORS.length];
              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{item.name}</span>
                    <span className="text-muted-foreground font-mono font-bold">
                      {item.count} जना ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ward & Tole Summaries Tables */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SummaryTable
          title="वडागत संकलन स्थिति (Ward-wise collection)"
          rows={byWard.map((r) => ({
            label: `वडा नं. ${np(r.key)}`,
            count: r.count,
            amount: r.amount,
          }))}
        />
        <SummaryTable
          title="टोलगत संकलन विवरण (Tole-wise collection)"
          rows={byTole.map((r) => ({
            label: r.key,
            count: r.count,
            amount: r.amount,
          }))}
        />
      </div>

      {/* Month-wise collection Pills */}
      <h2 className="mt-8 mb-3 text-sm font-extrabold text-foreground flex items-center gap-2">
        <Calendar className="size-4 text-emerald-600" />
        मासिक संकलन विवरण (Month-wise Breakdown)
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {byMonth.map((x) => (
          <div
            key={x.m}
            className="rounded-lg border bg-card/60 px-3 py-2.5 transition-all hover:bg-card"
          >
            <p className="text-[11px] font-semibold text-muted-foreground">
              {MONTHS[x.m]} {np(monthYear(year, x.m))}
            </p>
            <p className="text-sm font-black text-foreground mt-0.5">{money(x.amount)}</p>
          </div>
        ))}
      </div>

      {/* Recent Receipts Table */}
      <div className="mt-8 flex items-center justify-between mb-3">
        <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
          <ReceiptText className="size-4 text-emerald-600" />
          पछिल्लो रसिदहरू (Recent Receipts)
        </h2>
        <Button variant="link" size="sm" asChild className="text-xs font-bold text-primary">
          <Link to="/reports">सबै हेर्नुहोस् &rarr;</Link>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/40 font-bold text-foreground">
            <tr>
              {["रसिद नं.", "वडा", "मिति (BS)", "ग्राहकको नाम", "टोल", "माध्यम", "रकम (रु.)"].map(
                (t) => (
                  <th key={t} className="px-4 py-3">
                    {t}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {receipts.slice(0, 8).map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-accent/40">
                <td className="px-4 py-2.5 font-mono font-bold text-primary">{r.no}</td>
                <td className="px-4 py-2.5">{np(r.ward)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap font-mono">{np(r.date)}</td>
                <td className="px-4 py-2.5 font-bold text-foreground">{r.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.tole || "-"}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                    {r.mode}
                  </span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap font-black text-right text-emerald-600 dark:text-emerald-400">
                  {money(r.total)}
                </td>
              </tr>
            ))}
            {!receipts.length && (
              <EmptyRows columns={7} text="यो वडा र आर्थिक वर्षको लागि कुनै रसिद भेटिएन।" />
            )}
          </tbody>
        </table>
      </div>
    </WorkspacePage>
  );
}
