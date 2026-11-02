import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, HandCoins, PenLine, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BSDatePicker } from "@/components/bs-date-picker";
import { WorkspacePage, money, useWorkspace } from "@/components/workspace";
import {
  theliRasidsOut,
  theliRangeCount,
  theliRemainingRange,
  theliSerialNumber,
  theliTotals,
  validateDateInFiscalYear,
  type Employee,
  type Member,
  type TheliLog,
  type TheliRangeEntry,
} from "@/lib/receipt-rules";
import { getTheliData, saveTheliLog, deleteTheliLog } from "@/lib/workspace.functions";

export const Route = createFileRoute("/assets")({
  head: () => ({
    meta: [
      { title: "Assets — Theli Ledger | Hami Yuwa Club" },
      {
        name: "description",
        content:
          "Employee-wise theli ledger: morning out ranges, evening closing serial, cancelled rasids and carried difference until settled.",
      },
    ],
  }),
  component: AssetsPage,
});

const inputCls =
  "w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary";

/* ── थेली बाहिर दायरा rows (S.No + देखि–सम्म, रसिद स्वतः) ─────── */
function TheliRangeRows({
  title,
  hint,
  rows,
  setRows,
}: {
  title: string;
  hint: string;
  rows: TheliRangeEntry[];
  setRows: (rows: TheliRangeEntry[]) => void;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold text-foreground">{title}</span>
        <button
          type="button"
          onClick={() => setRows([...rows, { from: "", to: "", count: 0 }])}
          className="inline-flex items-center gap-0.5 rounded bg-primary/10 border border-primary/30 px-1.5 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20"
        >
          <Plus className="size-3" /> दायरा थप
        </button>
      </div>
      <p className="mb-1.5 text-[10px] text-muted-foreground">{hint}</p>
      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const f = theliSerialNumber(r.from);
          const t = theliSerialNumber(r.to);
          const autoCount = !isNaN(f) && !isNaN(t) && t >= f;
          return (
            <div key={i} className="flex items-center gap-1">
              <span
                aria-label={`S.No ${i + 1}`}
                className="w-5 shrink-0 text-center font-mono text-[10px] font-bold text-muted-foreground"
              >
                {i + 1}
              </span>
              <input
                aria-label={`देखि ${i + 1}`}
                className={inputCls}
                placeholder="देखि GT-001"
                value={r.from}
                onChange={(e) =>
                  setRows(rows.map((old, j) => (j === i ? { ...old, from: e.target.value } : old)))
                }
              />
              <span className="text-muted-foreground">–</span>
              <input
                aria-label={`सम्म ${i + 1}`}
                className={inputCls}
                placeholder="सम्म GT-050"
                value={r.to}
                onChange={(e) =>
                  setRows(rows.map((old, j) => (j === i ? { ...old, to: e.target.value } : old)))
                }
              />
              {autoCount ? (
                <span
                  aria-label={`रसिद संख्या ${i + 1}`}
                  title="देखि–सम्म फरकबाट स्वतः गणना"
                  className="w-14 shrink-0 rounded-md border border-primary/20 bg-primary/10 px-1 py-1.5 text-center font-mono text-xs font-bold text-primary"
                >
                  {theliRangeCount(r)}
                </span>
              ) : (
                <input
                  aria-label={`रसिद संख्या ${i + 1}`}
                  type="number"
                  min={0}
                  className={`${inputCls} w-14`}
                  placeholder="संख्या"
                  value={r.count || ""}
                  onChange={(e) =>
                    setRows(
                      rows.map((old, j) =>
                        j === i ? { ...old, count: Number(e.target.value) || 0 } : old,
                      ),
                    )
                  }
                />
              )}
              <button
                type="button"
                aria-label="हटाउनुहोस्"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="rounded p-1 text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-[10px] text-muted-foreground">कुनै दायरा छैन।</p>}
      </div>
      <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
        जम्मा रसिद: {rows.reduce((s, r) => s + theliRangeCount(r), 0)}
      </span>
    </div>
  );
}

/* ── हरेक कर्मचारीको थेली बक्स (employee-wise) ────────────────── */
function TheliEmployeeBox({
  name,
  logs,
  busyId,
  onEdit,
  onToggleSettled,
  onDelete,
}: {
  name: string;
  logs: TheliLog[];
  busyId: string | null;
  onEdit: (l: TheliLog) => void;
  onToggleSettled: (l: TheliLog) => void;
  onDelete: (l: TheliLog) => void;
}) {
  const carry = logs[0] ? theliTotals(logs[0]).balance : 0;
  const sums = logs.reduce(
    (acc, l) => {
      const t = theliTotals(l);
      return {
        amount:
          acc.amount +
          t.balance +
          (Number(l.cleared_amount) || 0) -
          (Number(l.opening_balance) || 0),
        cleared: acc.cleared + (Number(l.cleared_amount) || 0),
        rasids: acc.rasids + t.rasidsOut,
        cancelled: acc.cancelled + t.cancelledCount,
        finalRasids: acc.finalRasids + t.finalRasids,
      };
    },
    { amount: 0, cleared: 0, rasids: 0, cancelled: 0, finalRasids: 0 },
  );
  return (
    <div className="rounded-xl border bg-card p-3 shadow-xs">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <HandCoins className="size-4 shrink-0 text-amber-600" />
          <span className="truncate text-xs font-extrabold text-foreground">{name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {carry !== 0 && (
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                carry > 0
                  ? "bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300"
                  : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              अन्तर {money(carry)}
            </span>
          )}
          <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {logs.length} दिन
          </span>
        </div>
      </div>
      <div className="mb-2 grid grid-cols-4 gap-1 rounded-lg bg-muted/40 p-1.5 text-center text-[10px]">
        <div>
          <span className="block text-muted-foreground">संकलन</span>
          <span className="font-mono font-bold text-foreground">{money(sums.amount)}</span>
        </div>
        <div>
          <span className="block text-muted-foreground">बुझाएको</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {money(sums.cleared)}
          </span>
        </div>
        <div>
          <span className="block text-muted-foreground">अन्तिम रसिद</span>
          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
            {sums.finalRasids}
          </span>
        </div>
        <div>
          <span className="block text-muted-foreground">रद्द</span>
          <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
            {sums.cancelled}
          </span>
        </div>
      </div>
      <div className="divide-y divide-border">
        {logs.map((l) => {
          const t = theliTotals(l);
          const hasClosing = !!(l.closing_serial && l.closing_serial.trim());
          return (
            <div key={l.id} className="flex items-start justify-between gap-2 py-2">
              <div className="min-w-0">
                <span className="font-mono text-xs font-bold text-foreground">{l.log_date}</span>
                <span className="ml-1 text-[10px] text-muted-foreground">{l.supervisor_name}</span>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                    थेली बाहिर {t.outCount}
                  </span>
                  {hasClosing ? (
                    <>
                      <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1 py-0.2 font-mono text-[9px] font-bold text-blue-700 dark:text-blue-300">
                        खारेज {l.closing_serial}
                      </span>
                      <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1 py-0.2 text-[9px] font-bold text-blue-700 dark:text-blue-300">
                        काटिएको {t.rasidsOut}
                      </span>
                      <span className="rounded bg-orange-500/10 border border-orange-500/20 px-1 py-0.2 text-[9px] font-bold text-orange-700 dark:text-orange-300">
                        रद्द {t.cancelledCount}
                      </span>
                      <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                        अन्तिम {t.finalRasids}
                      </span>
                    </>
                  ) : (
                    <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                      रकम{" "}
                      {money(
                        t.balance +
                          (Number(l.cleared_amount) || 0) -
                          (Number(l.opening_balance) || 0),
                      )}
                    </span>
                  )}
                  {l.settled && (
                    <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                      सेटल ✓
                    </span>
                  )}
                  <span
                    className={`rounded px-1 py-0.2 text-[9px] font-bold ${
                      t.balance > 0
                        ? "bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300"
                        : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    अन्तर {money(t.balance)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <button
                  type="button"
                  aria-label={l.settled ? "सेटल खारियो गर्नुहोस्" : "सेटल गर्नुहोस्"}
                  title={
                    l.settled
                      ? "सेटल खारियो गर्नुहोस् (अन्तर फेरि बोकिन्छ)"
                      : "सेटल गर्नुहोस् — यो दिनसम्मको अन्तर बुझाइयो"
                  }
                  disabled={busyId === l.id}
                  onClick={() => onToggleSettled(l)}
                  className={`rounded p-1 ${
                    l.settled
                      ? "text-emerald-600 hover:bg-emerald-500/10"
                      : "text-muted-foreground hover:bg-muted hover:text-emerald-600"
                  }`}
                >
                  <CheckCircle2 className={`size-3.5 ${busyId === l.id ? "animate-pulse" : ""}`} />
                </button>
                <button
                  type="button"
                  aria-label="सच्याउनुहोस्"
                  onClick={() => onEdit(l)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <PenLine className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="मेट्नुहोस्"
                  onClick={() => onDelete(l)}
                  className="rounded p-1 text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Assets page ──────────────────────────────────────────────── */
function AssetsPage() {
  const { ward, setWard, signedIn, userId, year } = useWorkspace();
  const queryClient = useQueryClient();
  const fetchTheliFn = useServerFn(getTheliData);
  const saveFn = useServerFn(saveTheliLog);
  const deleteFn = useServerFn(deleteTheliLog);
  const theliQuery = useQuery({
    queryKey: ["theli", userId],
    queryFn: () => fetchTheliFn(),
    enabled: signedIn,
  });
  const logs: TheliLog[] = useMemo(() => theliQuery.data?.logs ?? [], [theliQuery.data]);
  const employees: Employee[] = theliQuery.data?.employees ?? [];
  const members: Member[] = theliQuery.data?.members ?? [];
  const theliRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["theli"] });
  };

  const [logDate, setLogDate] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [supType, setSupType] = useState<"member" | "employee">("member");
  const [supId, setSupId] = useState("");
  const [outRows, setOutRows] = useState<TheliRangeEntry[]>([{ from: "", to: "", count: 0 }]);
  const [closing, setClosing] = useState("");
  const [cancelled, setCancelled] = useState("");
  const [opening, setOpening] = useState("");
  const [amount, setAmount] = useState("");
  const [cleared, setCleared] = useState("");
  const [settleTick, setSettleTick] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const logsRef = useRef(logs);
  logsRef.current = logs;

  useEffect(() => {
    if (signedIn && !logDate) setLogDate("");
  }, [signedIn, logDate]);

  /* बोकिएको अन्तर — कर्मचारी अनुसार स्वतः थालनीमा बसालिन्छ */
  useEffect(() => {
    if (editId) return;
    if (logDate === "") return;
    const carried = employeeId
      ? (function latestBalance() {
          const per = logsRef.current
            .filter((l) => l.employee_id === employeeId && l.log_date < logDate)
            .sort((a, b) => b.log_date.localeCompare(a.log_date));
          return per[0] ? theliTotals(per[0]).balance : 0;
        })()
      : 0;
    setOpening(String(carried || 0));
    setErr("");
    setOkMsg("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logDate, employeeId]);

  const preview = theliTotals({
    opening_balance: Number(opening) || 0,
    amount: Number(amount) || 0,
    cleared_amount: Number(cleared) || 0,
    out_entries: outRows,
    in_entries: [],
  });
  const liveRasidsOut = theliRasidsOut(outRows, closing);
  const liveCancelled = Math.max(0, Number(cancelled) || 0);
  const liveFinal = Math.max(0, liveRasidsOut - liveCancelled);
  const liveRemaining = theliRemainingRange(outRows, closing);
  const liveOutTotal = outRows.reduce((s, r) => s + theliRangeCount(r), 0);
  const fullSettle = Math.max(0, (Number(opening) || 0) + (Number(amount) || 0));

  /* employee-wise grouping — हरेक कर्मचारीको सबै थेली एक बक्समा */
  const employeeBoxes = useMemo(() => {
    const map = new Map<string, { key: string; name: string; logs: TheliLog[] }>();
    for (const l of logs) {
      const key = l.employee_id || l.employee_name || "—";
      if (!map.has(key)) map.set(key, { key, name: l.employee_name || "—", logs: [] });
      map.get(key)!.logs.push(l);
    }
    for (const g of map.values()) {
      g.logs.sort(
        (a, b) =>
          b.log_date.localeCompare(a.log_date) ||
          (b.created_at ?? "").localeCompare(a.created_at ?? ""),
      );
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [logs]);

  const loadLog = (l: TheliLog) => {
    setEditId(l.id ?? null);
    setLogDate(l.log_date);
    setEmployeeId(l.employee_id);
    setSupType(l.supervisor_type === "employee" ? "employee" : "member");
    setSupId(l.supervisor_id);
    setOpening(String(l.opening_balance ?? 0));
    setOutRows(l.out_entries?.length ? l.out_entries : [{ from: "", to: "", count: 0 }]);
    setClosing(l.closing_serial ?? "");
    setCancelled(l.cancelled_count ? String(l.cancelled_count) : "");
    setAmount(String(l.amount ?? 0));
    setCleared(String(l.cleared_amount ?? 0));
    setSettleTick(l.settled === true);
    setRemarks(l.remarks ?? "");
    setErr("");
    setOkMsg("");
  };

  const blankForm = () => {
    setEditId(null);
    setEmployeeId("");
    setSupType("member");
    setSupId("");
    setOutRows([{ from: "", to: "", count: 0 }]);
    setClosing("");
    setCancelled("");
    setAmount("");
    setCleared("");
    setSettleTick(false);
    setRemarks("");
    setErr("");
    setOkMsg("");
  };

  const handleSettleTick = (checked: boolean) => {
    setSettleTick(checked);
    setCleared(checked ? String(fullSettle) : "");
  };

  const handleSave = async () => {
    setErr("");
    setOkMsg("");
    const fyDateErr = validateDateInFiscalYear(logDate, year, "थेली मिति");
    if (fyDateErr) {
      setErr(fyDateErr);
      return;
    }
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) {
      setErr("कर्मचारी छान्नुहोस् (कर्मचारी मास्टरबाट छानिन्छ)।");
      return;
    }
    const supList = supType === "employee" ? employees : members;
    const sup = supList.find((x) => x.id === supId);
    const cleanRows = (rows: TheliRangeEntry[]) =>
      rows
        .filter((r) => (r.from.trim() || r.to.trim()) && theliRangeCount(r) > 0)
        .map((r) => ({ from: r.from.trim(), to: r.to.trim(), count: theliRangeCount(r) }));
    const cleanOut = cleanRows(outRows);
    if (cleanOut.length === 0) {
      setErr(
        "बिहान थेली बाहिरको दायरा (देखि–सम्म सिरियल) भर्नुहोस् — मात्र यही अनिवार्य छ, यसका साथै सेभ हुन्छ।",
      );
      return;
    }
    setSaving(true);
    try {
      await saveFn({
        data: {
          id: editId ?? undefined,
          log_date: logDate,
          ward,
          employee_id: employeeId,
          employee_name: emp.name,
          supervisor_type: supType,
          supervisor_id: sup?.id ?? "",
          supervisor_name: sup?.name ?? "",
          opening_balance: Number(opening) || 0,
          out_entries: cleanOut,
          in_entries: [],
          closing_serial: closing.trim(),
          cancelled_count: liveCancelled,
          amount: Number(amount) || 0,
          cleared_amount: settleTick ? fullSettle : Number(cleared) || 0,
          settled: settleTick,
          remarks: remarks.trim(),
        },
      });
      setOkMsg("थेली विवरण सुरक्षित भयो।");
      blankForm();
      theliRefresh();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "सुरक्षित गर्न सकिएन।");
    } finally {
      setSaving(false);
    }
  };

  const toggleSettled = async (l: TheliLog) => {
    const id = l.id;
    if (!id || busyId === id) return;
    const next = !(l.settled === true);
    setBusyId(id);
    setErr("");
    try {
      await saveFn({
        data: {
          id,
          log_date: l.log_date,
          ward: l.ward ?? "",
          employee_id: l.employee_id,
          employee_name: l.employee_name,
          supervisor_type: l.supervisor_type,
          supervisor_id: l.supervisor_id,
          supervisor_name: l.supervisor_name,
          opening_balance: Number(l.opening_balance) || 0,
          out_entries: l.out_entries ?? [],
          in_entries: l.in_entries ?? [],
          closing_serial: l.closing_serial ?? "",
          cancelled_count: Math.max(0, Number(l.cancelled_count) || 0),
          amount: Number(l.amount) || 0,
          cleared_amount: next
            ? Math.max(0, (Number(l.opening_balance) || 0) + (Number(l.amount) || 0))
            : Number(l.cleared_amount) || 0,
          settled: next,
          remarks: l.remarks ?? "",
        },
      });
      setOkMsg(next ? "सेटल गरियो — क्यारी अन्तर सफा भयो।" : "सेटल खारियो।");
      theliRefresh();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "सेटल गर्न सकिएन।");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (l: TheliLog) => {
    setErr("");
    if (!window.confirm(`${l.log_date} ${l.employee_name} को थेली विवरण मेट्ने हो?`)) return;
    try {
      await deleteFn({ data: { id: l.id ?? "" } });
      setOkMsg("मेटियो।");
      theliRefresh();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "मेट्न सकिएन।");
    }
  };

  return (
    <WorkspacePage title="Assets">
      <p className="mb-4 text-xs text-muted-foreground">
        कर्मचारी अनुसार थेली लेजर — बिहान थेली बाहिर (अनिवार्य), बेलुका खारेज सिरियल र रद्द रसिद।
        प्रत्येक कर्मचारीको अन्तर बोकिन्छ, ✓ सेटल थिचेसम्म।
      </p>

      {theliQuery.isPending ? (
        <p role="status">थेली लोड हुँदै…</p>
      ) : theliQuery.isError ? (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
            थेली लोड गर्न सकिएन।
          </p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => theliQuery.refetch()}>
            फेरि प्रयास
          </Button>
        </div>
      ) : (
        <>
          {/*_entry form */}
          <div className="mb-5 rounded-xl border bg-card p-4 shadow-xs">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-foreground">
                {editId ? "थेली विवरण सच्याउने" : "थेली विवरण (बिहान मात्र भरे पनि सेभ हुन्छ)"}
              </span>
              {editId && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={blankForm}>
                  नयाँ फारम
                </Button>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">
                    मिति (BS Date)
                  </label>
                  <BSDatePicker
                    value={logDate}
                    onChange={(d) => {
                      setLogDate(d);
                    }}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">
                    वडा (Ward)
                  </label>
                  <select
                    aria-label="वडा छान्नुहोस्"
                    className={inputCls}
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                  >
                    <option value="">वडा छान्नुहोस्</option>
                    {Array.from({ length: 16 }, (_, i) => String(i + 1)).map((w) => (
                      <option key={w} value={w}>
                        वडा {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">
                    कर्मचारी (Employee)
                  </label>
                  <select
                    aria-label="कर्मचारी छान्नुहोस्"
                    className={inputCls}
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                  >
                    <option value="">— छान्नुहोस् —</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id ?? ""}>
                        {e.name}
                        {e.designation ? ` (${e.designation})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">
                    सुपरभाइजर (इच्छा भए छान्नुहोस्)
                  </label>
                  <div className="flex gap-1">
                    <select
                      aria-label="सुपरभाइजर प्रकार"
                      className={inputCls}
                      value={supType}
                      onChange={(e) => {
                        setSupType(e.target.value === "employee" ? "employee" : "member");
                        setSupId("");
                      }}
                    >
                      <option value="member">सदस्य</option>
                      <option value="employee">कर्मचारी</option>
                    </select>
                    <select
                      aria-label="सुपरभाइजर छान्नुहोस्"
                      className={inputCls}
                      value={supId}
                      onChange={(e) => setSupId(e.target.value)}
                    >
                      <option value="">— खाली —</option>
                      {(supType === "employee" ? employees : members).map((x) => (
                        <option key={x.id} value={x.id ?? ""}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <TheliRangeRows
                title="थेली बाहिर (बिहान)"
                hint="S.No अनुसार देखि–सम्म सिरियल भर्नुहोस् — रसिद संख्या फरकबाट स्वतः गणना हुन्छ।"
                rows={outRows}
                setRows={setOutRows}
              />

              {/* थेली भित्र (बेलुका) */}
              <div className="rounded-lg border bg-muted/30 p-2">
                <div className="mb-1 text-[11px] font-bold text-foreground">
                  थेली भित्र (बेलुका) — इच्छा (सेभ हुन अनिवार्य छैन)
                </div>
                <p className="mb-1.5 text-[10px] text-muted-foreground">
                  आज काटिएको अन्तिम रसिदको खारेज सिरियल र रद्द रसिद भर्नुहोस् — संख्या र फर्किएको
                  दायरा स्वतः गणना हुन्छ।
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="mb-0.5 block text-[9px] font-semibold text-muted-foreground">
                      खारेज सिरियल (आजको अन्तिम रसिद)
                    </label>
                    <input
                      aria-label="खारेज सिरियल"
                      className={inputCls}
                      placeholder="खारेज GT-030"
                      value={closing}
                      onChange={(e) => setClosing(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[9px] font-semibold text-muted-foreground">
                      रद्द रसिद
                    </label>
                    <input
                      aria-label="रद्द रसिद"
                      type="number"
                      min={0}
                      className={inputCls}
                      placeholder="रद्द 0"
                      title="आज रद्द भएका रसिद संख्या"
                      value={cancelled || ""}
                      onChange={(e) => setCancelled(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                    काटिएको: {liveRasidsOut}
                  </span>
                  <span className="text-[11px] font-bold text-muted-foreground">−</span>
                  <span className="rounded bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-300">
                    रद्द: {liveCancelled}
                  </span>
                  <span className="text-[11px] font-bold text-muted-foreground">=</span>
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    अन्तिम रसिद: {liveFinal}
                  </span>
                </div>
                {liveRemaining && (
                  <div className="mt-1">
                    <span
                      title="खारेज सिरियल पछि थेली सँगसँगै फर्किने बाँकी रसिद"
                      className="inline-block rounded bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-violet-700 dark:text-violet-300"
                    >
                      फर्किएको दायरा: {liveRemaining.from}–{liveRemaining.to} ({liveRemaining.count}
                      )
                    </span>
                  </div>
                )}
                {liveOutTotal > 0 && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    थेली बाहिर दिइएका रसिद: {liveOutTotal} — फर्किएको संख्या सिरियल मिल्नुपर्छ।
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">
                    थालनी ब्यालेन्स (क्यारी)
                  </label>
                  <input
                    aria-label="थालनी ब्यालेन्स"
                    type="number"
                    className={inputCls}
                    placeholder="0"
                    value={opening}
                    onChange={(e) => setOpening(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">
                    रकम (संकलन)
                  </label>
                  <input
                    aria-label="संकलित रकम"
                    type="number"
                    className={inputCls}
                    placeholder="0"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      if (settleTick) setSettleTick(false);
                    }}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">
                    सफा रकम (जम्मा)
                  </label>
                  <input
                    aria-label="सफा रकम"
                    type="number"
                    className={inputCls}
                    placeholder="0"
                    value={cleared}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCleared(v);
                      setSettleTick(fullSettle > 0 && Math.max(0, Number(v) || 0) >= fullSettle);
                    }}
                  />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                <input
                  type="checkbox"
                  aria-label="सेटल गरियो"
                  className="size-3 accent-emerald-600"
                  checked={settleTick}
                  onChange={(e) => handleSettleTick(e.target.checked)}
                />
                ✓ सेटल गरियो — थालनी + रकम सबै बुझाइयो (अन्तर रु.{" "}
                {fullSettle.toLocaleString("en-IN")})
              </label>
              <p className="text-[10px] text-muted-foreground">
                थालनी + रकम − सफा रकम = अन्तर रु. {(preview.balance || 0).toLocaleString("en-IN")} —
                उक्त कर्मचारीको ब्यालेन्समा अर्को दिन स्वतः बोकिन्छ; ✓ सेटल थिचेसम्म।
              </p>

              <div>
                <label className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">
                  कैफियत
                </label>
                <input
                  aria-label="कैफियत"
                  className={inputCls}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder=""
                />
              </div>

              {err && (
                <div
                  role="alert"
                  className="rounded-md bg-red-500/10 border border-red-500/30 p-2 text-[11px] font-semibold text-red-700 dark:text-red-300"
                >
                  {err}
                </div>
              )}
              {okMsg && (
                <div
                  role="status"
                  className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
                >
                  {okMsg}
                </div>
              )}

              <Button size="sm" className="w-full" disabled={saving} onClick={handleSave}>
                {saving ? "सुरक्षित हुँदै…" : "सुरक्षित गर्नुहोस्"}
              </Button>

              {(employees.length === 0 || members.length === 0) && (
                <p className="text-[10px] text-muted-foreground">
                  कर्मचारी/सदस्य सूची खाली छ? Members &amp; Staff पानामा मास्टर भर्नुहोस्।
                </p>
              )}
            </div>
          </div>

          {/* कर्मचारी अनुसार थेली बक्स */}
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-foreground">
              कर्मचारी अनुसार थेली ({employeeBoxes.length})
            </h2>
          </div>
          {employeeBoxes.length === 0 ? (
            <p className="mb-4 rounded-xl border border-dashed bg-muted/20 p-6 text-center text-xs text-muted-foreground">
              माथिको फारमबाट बिहानको थेली विवरण सेभ गर्नुहोस् — हरेक कर्मचारीको थेली तल एक-एक बक्समा
              देखिन्छ।
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {employeeBoxes.map((g) => (
                <TheliEmployeeBox
                  key={g.key}
                  name={g.name}
                  logs={g.logs}
                  busyId={busyId}
                  onEdit={loadLog}
                  onToggleSettled={toggleSettled}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}
    </WorkspacePage>
  );
}
