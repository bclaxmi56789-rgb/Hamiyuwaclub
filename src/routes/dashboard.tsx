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
} from "@/lib/receipt-rules";
import { BSDatePicker } from "@/components/bs-date-picker";
import { useState } from "react";
import { Plus, Users, ReceiptText, Wallet } from "lucide-react";
import { DashboardAIChatbot } from "@/components/dashboard-ai-chatbot";
import { SummaryTable } from "@/components/summary-table";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Hami Yuwa Club" },
      {
        name: "description",
        content: "Ward and fiscal-year collection totals for Hami Yuwa Club.",
      },
      { property: "og:title", content: "Hami Yuwa Club dashboard" },
      { property: "og:description", content: "Collections, customers and payment totals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { query, ward, year } = useWorkspace();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tole, setTole] = useState("");

  const yearReceipts =
    query.data?.receipts.filter((r) => (!ward || r.ward === ward) && Number(r.year) === year) ?? [];
  const toles = [...new Set(yearReceipts.map((r) => r.tole))].sort();
  const receipts = yearReceipts.filter(
    (r) => inBSRange(r.date, from, to) && (!tole || r.tole === tole),
  );
  const byWard = collectionBy(receipts, (r) => r.ward).sort(
    (a, b) => Number(a.key) - Number(b.key),
  );
  const byTole = collectionBy(receipts, (r) => r.tole);
  const byMonth = collectionByMonth(receipts);
  const people = query.data?.people.filter((p) => !ward || p.ward === ward) ?? [];
  const total = receipts.reduce((a, r) => a + r.total, 0);

  return (
    <WorkspacePage title="Dashboard">
      <div className="mb-7 flex justify-end">
        <Button asChild>
          <Link to="/">
            <Plus /> New receipt
          </Link>
        </Button>
      </div>

      {/* Primary KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total collection", value: money(total), icon: Wallet },
          { label: "Receipts", value: receipts.length, icon: ReceiptText },
          { label: "Registered customers", value: people.length, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border bg-card p-5">
            <Icon className="mb-4 size-5 text-ink" />
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 break-words text-2xl font-extrabold text-ink">{value}</p>
          </div>
        ))}
      </div>

      {/* ─── INSTITUTIONAL AI CHATBOT (DASHBOARD COPILOT) ─── */}
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
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <div className="text-sm">
          <span className="text-muted-foreground">From (मिति वि.सं.)</span>
          <BSDatePicker value={from} onChange={setFrom} />
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">To (मिति वि.सं.)</span>
          <BSDatePicker value={to} onChange={setTo} />
        </div>
        <label className="text-sm text-muted-foreground">
          Tole
          <select
            aria-label="Filter tole"
            className="mt-1 block rounded-md border bg-background px-3 py-2 text-foreground"
            value={tole}
            onChange={(e) => setTole(e.target.value)}
          >
            <option value="">All toles</option>
            {toles.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {(from || to || tole) && (
          <Button
            variant="ghost"
            onClick={() => {
              setFrom("");
              setTo("");
              setTole("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Ward & Tole Summaries */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SummaryTable
          title="Ward-wise collection"
          rows={byWard.map((r) => ({
            label: `Ward ${np(r.key)}`,
            count: r.count,
            amount: r.amount,
          }))}
        />
        <SummaryTable
          title="Tole-wise collection"
          rows={byTole.map((r) => ({
            label: r.key,
            count: r.count,
            amount: r.amount,
          }))}
        />
      </div>

      {/* Month-wise collection */}
      <h2 className="mt-8 mb-3 text-lg font-bold">Month-wise collection</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {byMonth.map((x) => (
          <div key={x.m} className="rounded border bg-card px-3 py-2">
            <p className="text-sm text-muted-foreground">
              {MONTHS[x.m]} {np(monthYear(year, x.m))}
            </p>
            <p className="font-bold">{money(x.amount)}</p>
          </div>
        ))}
      </div>

      {/* Payment mode collection */}
      <h2 className="mt-8 mb-3 text-lg font-bold">Collection by payment mode</h2>
      <div className="grid gap-2 sm:grid-cols-5">
        {MODES.map((mode) => (
          <div key={mode} className="border-l-2 border-ink px-3 py-2">
            <p className="text-sm text-muted-foreground">{mode}</p>
            <p className="font-bold">
              {money(receipts.filter((r) => r.mode === mode).reduce((a, r) => a + r.total, 0))}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Receipts Table */}
      <h2 className="mt-8 mb-3 text-lg font-bold">Recent receipts</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-accent">
            <tr>
              {["Receipt", "Ward", "Date", "Customer", "Amount"].map((t) => (
                <th key={t} className="px-3 py-3">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {receipts.slice(0, 8).map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-3">{r.no}</td>
                <td className="p-3">{r.ward}</td>
                <td className="p-3 whitespace-nowrap">{np(r.date)}</td>
                <td className="p-3">{r.name}</td>
                <td className="p-3 whitespace-nowrap">{money(r.total)}</td>
              </tr>
            ))}
            {!receipts.length && (
              <EmptyRows columns={5} text="No receipts for this ward and fiscal year." />
            )}
          </tbody>
        </table>
      </div>
    </WorkspacePage>
  );
}
