import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useWorkspace, WorkspacePage, money, EmptyRows } from "@/components/workspace";
import { SummaryTable } from "@/components/summary-table";
import { BSDatePicker } from "@/components/bs-date-picker";
import {
  np,
  MODES,
  MONTHS,
  monthYear,
  collectionBy,
  collectionByMonth,
  inBSRange,
} from "@/lib/receipt-rules";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getExpensesData } from "@/lib/workspace.functions";
import type { ExpenseRecord } from "@/lib/receipt-rules";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — Hami Yuwa Club" },
      {
        name: "description",
        content: "Ward, tole, month and payment-mode collection reports with expense totals.",
      },
      { property: "og:title", content: "Reports & Analytics" },
    ],
  }),
  component: Reports,
});

function Reports() {
  const { query, ward, year, userId, signedIn } = useWorkspace();
  const fetchExpensesFn = useServerFn(getExpensesData);
  const expensesQuery = useQuery({
    queryKey: ["expenses", userId],
    queryFn: () => fetchExpensesFn({ data: {} }),
    enabled: Boolean(signedIn && userId),
  });

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
  const total = receipts.reduce((a, r) => a + r.total, 0);

  const allExpenses: ExpenseRecord[] = expensesQuery.data ?? [];
  const filteredExpenses = allExpenses.filter((e) => inBSRange(e.date_bs, from, to));
  const expenseTotal = filteredExpenses.reduce((a, e) => a + (Number(e.final_amount) || 0), 0);
  const expensesByMonth = new Map<number, number>();
  filteredExpenses.forEach((e) => {
    const m = Number(e.date_bs.split("/")[1] ?? 0) - 1;
    if (m >= 0)
      expensesByMonth.set(m, (expensesByMonth.get(m) ?? 0) + (Number(e.final_amount) || 0));
  });

  return (
    <WorkspacePage title="Reports & Analytics">
      {/* Summary strip */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-5">
          <TrendingUp className="mb-4 size-5 text-emerald-600" />
          <p className="text-sm text-muted-foreground">कुल संकलन (Total collection)</p>
          <p className="mt-1 break-words text-2xl font-extrabold text-ink">{money(total)}</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <TrendingDown className="mb-4 size-5 text-red-600" />
          <p className="text-sm text-muted-foreground">कुल खर्च (Total expenses)</p>
          <p className="mt-1 break-words text-2xl font-extrabold text-ink">{money(expenseTotal)}</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <BarChart3 className="mb-4 size-5 text-ink" />
          <p className="text-sm text-muted-foreground">बचत / परिचालित (Net)</p>
          <p className="mt-1 break-words text-2xl font-extrabold text-ink">
            {money(total - expenseTotal)}
          </p>
        </div>
      </div>

      {/* Filters */}
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
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
              setTole("");
            }}
            className="text-sm text-primary underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Collection summaries */}
      <div className="grid gap-6 lg:grid-cols-2">
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

      {/* Month-wise side by side */}
      <h2 className="mt-8 mb-3 text-lg font-bold">Month-wise collection vs expenses</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-accent">
            <tr>
              <th className="px-3 py-3">Month</th>
              <th className="px-3 py-3 text-right">Collection</th>
              <th className="px-3 py-3 text-right">Expenses</th>
              <th className="px-3 py-3 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {[...new Set([...byMonth.map((x) => x.m), ...Array.from(expensesByMonth.keys())])]
              .sort((a, b) => a - b)
              .map((m) => {
                const col = byMonth.find((x) => x.m === m)?.amount ?? 0;
                const exp = expensesByMonth.get(m) ?? 0;
                return (
                  <tr key={m} className="border-b">
                    <td className="p-3">
                      {MONTHS[m]} {np(monthYear(year, m))}
                    </td>
                    <td className="p-3 text-right">{money(col)}</td>
                    <td className="p-3 text-right">{money(exp)}</td>
                    <td
                      className={`p-3 text-right font-bold ${
                        col - exp >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {money(col - exp)}
                    </td>
                  </tr>
                );
              })}
            {!byMonth.length && !expensesByMonth.size && (
              <EmptyRows columns={4} text="No data for these filters." />
            )}
          </tbody>
        </table>
      </div>

      {/* Payment mode */}
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

      {/* Recent expenses */}
      <h2 className="mt-8 mb-3 text-lg font-bold">Recent expenses</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-accent">
            <tr>
              {["Date", "Type", "Vendor", "Bill no.", "Amount"].map((t) => (
                <th key={t} className="px-3 py-3">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.slice(0, 8).map((e) => (
              <tr key={e.id} className="border-b">
                <td className="p-3 whitespace-nowrap">{np(e.date_bs)}</td>
                <td className="p-3">{e.expense_type}</td>
                <td className="p-3">{e.vendor_name || "—"}</td>
                <td className="p-3">{e.bill_number || "—"}</td>
                <td className="p-3 whitespace-nowrap">{money(Number(e.final_amount) || 0)}</td>
              </tr>
            ))}
            {!filteredExpenses.length && (
              <EmptyRows columns={5} text="No expenses for these filters." />
            )}
          </tbody>
        </table>
      </div>
    </WorkspacePage>
  );
}
