import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  HandCoins,
  Layers,
  Package,
  PenLine,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BSDatePicker } from "@/components/bs-date-picker";
import { WorkspacePage, money, useWorkspace } from "@/components/workspace";
import {
  theliRasidsOut,
  theliRangeCount,
  theliRemainingRange,
  theliSerialNumber,
  theliSerialWithFormat,
  theliTotals,
  calculateTheliStockCounts,
  generateTheliRanges,
  sortTheliAvailableRanges,
  calculateTheliBooking,
  validateDateInFiscalYear,
  type Employee,
  type Member,
  type TheliLog,
  type TheliRangeEntry,
  type TheliStockBatch,
  type TheliStockItem,
} from "@/lib/receipt-rules";
import {
  getTheliData,
  saveTheliLog,
  deleteTheliLog,
  getTheliStockData,
  saveTheliStockBatch,
  issueMultipleTheliStockItems,
  reportTheliStockClosing,
  deleteTheliStockBatch,
  clearAllTheliData,
} from "@/lib/workspace.functions";

export const Route = createFileRoute("/assets")({
  head: () => ({
    meta: [
      { title: "थेली स्टक तथा कर्मचारी लेजर | Hami Yuwa Club" },
      {
        name: "description",
        content:
          "थेली स्टक दर्ता (पालिका, वडा, आ.व.), कर्मचारी निष्कासन, चालु बाँकी थेली पहिलो प्राथमिकता, अन्तिम काटिएको रसिद रिपोर्टिङ तथा बक्यौता हिसाब।",
      },
    ],
  }),
  component: AssetsPage,
});

const inputCls =
  "w-full rounded-md border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary shadow-2xs";

/* ── Seed sample stock if brand new ──────────────────────────── */
const SEED_BATCHES: TheliStockBatch[] = [];

const SEED_ITEMS: TheliStockItem[] = [];

/* ── Legacy row helper ───────────────────────────────────────── */
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
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold text-foreground">{title}</span>
        <button
          type="button"
          onClick={() => setRows([...rows, { from: "", to: "", count: 0 }])}
          className="inline-flex items-center gap-0.5 rounded bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20"
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
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-5 shrink-0 text-center font-mono text-[10px] font-bold text-muted-foreground">
                {i + 1}
              </span>
              <input
                className={inputCls}
                placeholder="देखि GT-001"
                value={r.from}
                onChange={(e) =>
                  setRows(rows.map((old, j) => (j === i ? { ...old, from: e.target.value } : old)))
                }
              />
              <span className="text-muted-foreground">–</span>
              <input
                className={inputCls}
                placeholder="सम्म GT-050"
                value={r.to}
                onChange={(e) =>
                  setRows(rows.map((old, j) => (j === i ? { ...old, to: e.target.value } : old)))
                }
              />
              {autoCount ? (
                <span
                  title="देखि–सम्म फरकबाट स्वतः गणना"
                  className="w-16 shrink-0 rounded-md border border-primary/20 bg-primary/10 px-1 py-1.5 text-center font-mono text-xs font-bold text-primary"
                >
                  {theliRangeCount(r)} रसिद
                </span>
              ) : (
                <input
                  type="number"
                  min={0}
                  className={`${inputCls} w-16`}
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
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="rounded p-1 text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN ASSETS / THELI PAGE
   ══════════════════════════════════════════════════════════════════ */
function AssetsPage() {
  const { ward, setWard, signedIn, userId, year } = useWorkspace();
  const queryClient = useQueryClient();

  // Active view sub-tab
  const [subTab, setSubTab] = useState<
    "stock" | "add_stock" | "issue" | "boxes" | "daily_log"
  >("stock");

  // Server functions
  const fetchStockFn = useServerFn(getTheliStockData);
  const saveStockBatchFn = useServerFn(saveTheliStockBatch);
  const issueMultipleFn = useServerFn(issueMultipleTheliStockItems);
  const reportStockClosingFn = useServerFn(reportTheliStockClosing);
  const deleteStockBatchFn = useServerFn(deleteTheliStockBatch);

  const fetchLegacyTheliFn = useServerFn(getTheliData);
  const saveLegacyTheliFn = useServerFn(saveTheliLog);
  const deleteLegacyTheliFn = useServerFn(deleteTheliLog);
  const clearAllTheliFn = useServerFn(clearAllTheliData);
  const [clearingData, setClearingData] = useState(false);

  // Queries
  const theliStockQuery = useQuery({
    queryKey: ["theli_stock", userId],
    queryFn: () => fetchStockFn(),
    enabled: signedIn,
  });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["theli_stock"] });
    void queryClient.invalidateQueries({ queryKey: ["theli"] });
  };

  // State with LocalStorage fallback
  const [stockBatches, setStockBatches] = useState<TheliStockBatch[]>(() => {
    try {
      const s = localStorage.getItem("hami_theli_stock_batches");
      if (s) return JSON.parse(s);
    } catch {}
    return SEED_BATCHES;
  });

  const [stockItems, setStockItems] = useState<TheliStockItem[]>(() => {
    try {
      const s = localStorage.getItem("hami_theli_stock_items");
      if (s) return JSON.parse(s);
    } catch {}
    return SEED_ITEMS;
  });

  const [dailyLogs, setDailyLogs] = useState<TheliLog[]>(() => {
    try {
      const s = localStorage.getItem("hami_theli_daily_logs");
      if (s) return JSON.parse(s);
    } catch {}
    return [];
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  // Sync server data
  useEffect(() => {
    if (theliStockQuery.data) {
      const bList = theliStockQuery.data.batches || [];
      const iList = theliStockQuery.data.items || [];
      const lList = theliStockQuery.data.logs || [];
      setStockBatches(bList);
      setStockItems(iList);
      setDailyLogs(lList);
      try {
        localStorage.setItem("hami_theli_stock_batches", JSON.stringify(bList));
        localStorage.setItem("hami_theli_stock_items", JSON.stringify(iList));
        localStorage.setItem("hami_theli_daily_logs", JSON.stringify(lList));
      } catch {}
      if (theliStockQuery.data.employees) {
        setEmployees(theliStockQuery.data.employees);
      }
      if (theliStockQuery.data.members) {
        setMembers(theliStockQuery.data.members);
      }
    }
  }, [theliStockQuery.data]);

  // Notifications
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleClearAllTheliAndLedger = async () => {
    if (
      !window.confirm(
        "चेतावनी: के तपाईं थेली स्टक र लेजरका सबै पुरानो डाटा मेटाउन चाहनुहुन्छ? यसपछि नयाँ थेली स्टक दर्ता गर्न सकिनेछ।",
      )
    ) {
      return;
    }
    setClearingData(true);
    setNotice(null);
    try {
      await clearAllTheliFn();
      setStockBatches([]);
      setStockItems([]);
      setDailyLogs([]);
      try {
        localStorage.removeItem("hami_theli_stock_batches");
        localStorage.removeItem("hami_theli_stock_items");
        localStorage.removeItem("hami_theli_daily_logs");
      } catch {}
      refreshAll();
      setNotice({
        type: "success",
        text: "थेली स्टक र लेजरको सम्पूर्ण पुरानो डाटा सफलतापूर्वक मेटाइयो। अब नयाँ डाटा भर्न सक्नुहुन्छ।",
      });
    } catch (e: any) {
      // Local fallback reset
      setStockBatches([]);
      setStockItems([]);
      setDailyLogs([]);
      try {
        localStorage.removeItem("hami_theli_stock_batches");
        localStorage.removeItem("hami_theli_stock_items");
        localStorage.removeItem("hami_theli_daily_logs");
      } catch {}
      refreshAll();
      setNotice({
        type: "success",
        text: "स्थानीय थेली र लेजर डाटा खाली गरियो।",
      });
    } finally {
      setClearingData(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     TAB 1: STOCK MASTER FORM STATE
     ───────────────────────────────────────────────────────────── */
  const [newBatchMunicipality, setNewBatchMunicipality] = useState("वीरेन्द्रनगर नगरपालिका");
  const [newBatchWard, setNewBatchWard] = useState(ward || "4");
  const [newBatchFY, setNewBatchFY] = useState(year || "2081/82");
  const [newBatchStart, setNewBatchStart] = useState("GT-0001");
  const [newBatchEnd, setNewBatchEnd] = useState("GT-1000");
  const [newBatchPerTheli, setNewBatchPerTheli] = useState<number>(50);
  const [newBatchRemarks, setNewBatchRemarks] = useState("");
  const [savingBatch, setSavingBatch] = useState(false);

  // Auto-calculated batch counts
  const batchCounts = useMemo(() => {
    return calculateTheliStockCounts(newBatchStart, newBatchEnd, newBatchPerTheli);
  }, [newBatchStart, newBatchEnd, newBatchPerTheli]);

  const handleCreateStockBatch = async () => {
    setNotice(null);
    if (!newBatchStart || !newBatchEnd) {
      setNotice({ type: "error", text: "सुरु र अन्तिम रसिद सिरियल भर्नुहोस्।" });
      return;
    }
    if (batchCounts.totalVouchers <= 0) {
      setNotice({ type: "error", text: "अमान्य सिरियल दायरा। अन्तिम नम्बर ठूलो हुनुपर्छ।" });
      return;
    }

    setSavingBatch(true);
    try {
      const res = await saveStockBatchFn({
        data: {
          municipality: newBatchMunicipality,
          ward: newBatchWard,
          fiscal_year: newBatchFY,
          start_from: newBatchStart,
          end_to: newBatchEnd,
          vouchers_per_theli: newBatchPerTheli,
          remarks: newBatchRemarks,
        },
      });

      const updatedBatches = [res.batch, ...stockBatches.filter((b) => b.id !== res.batch.id)];
      const updatedItems = [...res.items, ...stockItems];

      setStockBatches(updatedBatches);
      setStockItems(updatedItems);
      try {
        localStorage.setItem("hami_theli_stock_batches", JSON.stringify(updatedBatches));
        localStorage.setItem("hami_theli_stock_items", JSON.stringify(updatedItems));
      } catch {}

      setNotice({
        type: "success",
        text: `थेली स्टक दर्ता भयो! जम्मा ${batchCounts.total_vouchers ?? batchCounts.totalVouchers} रसिद (${batchCounts.total_theli ?? batchCounts.totalTheli} थेली) स्टकमा थपियो।`,
      });

      refreshAll();
      setSubTab("stock");
    } catch (e: any) {
      // Local fallback
      const batchId = `tsb-${Date.now()}`;
      const newBatch: TheliStockBatch = {
        id: batchId,
        municipality: newBatchMunicipality,
        ward: newBatchWard,
        fiscal_year: newBatchFY,
        start_from: newBatchStart,
        end_to: newBatchEnd,
        vouchers_per_theli: newBatchPerTheli,
        total_vouchers: batchCounts.totalVouchers,
        total_theli: batchCounts.totalTheli,
        remarks: newBatchRemarks,
        created_at: new Date().toISOString(),
      };
      const genItems = generateTheliRanges({
        id: batchId,
        municipality: newBatchMunicipality,
        ward: newBatchWard,
        fiscal_year: newBatchFY,
        start_from: newBatchStart,
        end_to: newBatchEnd,
        vouchers_per_theli: newBatchPerTheli,
      });

      const updatedBatches = [newBatch, ...stockBatches];
      const updatedItems = [...genItems, ...stockItems];

      setStockBatches(updatedBatches);
      setStockItems(updatedItems);
      try {
        localStorage.setItem("hami_theli_stock_batches", JSON.stringify(updatedBatches));
        localStorage.setItem("hami_theli_stock_items", JSON.stringify(updatedItems));
      } catch {}

      setNotice({
        type: "success",
        text: `थेली स्टक स्थानीय रूपमा सुरक्षित भयो! जम्मा ${batchCounts.totalVouchers} रसिद (${batchCounts.totalTheli} थेली)।`,
      });
      setSubTab("stock");
    } finally {
      setSavingBatch(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     TAB 2: ISSUE THELI STATE
     ───────────────────────────────────────────────────────────── */
  const [issueEmployeeId, setIssueEmployeeId] = useState("");
  const [issueSupervisorName, setIssueSupervisorName] = useState("");
  const [issueWard, setIssueWard] = useState(ward || "4");
  const [issueMunicipality, setIssueMunicipality] = useState("वीरेन्द्रनगर नगरपालिका");
  const [issueDate, setIssueDate] = useState("2083/07/15");
  const [selectedStockItemIds, setSelectedStockItemIds] = useState<string[]>([]);
  const [issuing, setIssuing] = useState(false);

  // Available ranges for issuing (filtered and SORTED so remaining open theli is FIRST!)
  const availableRanges = useMemo(() => {
    const unissued = stockItems.filter(
      (it) =>
        (it.status === "available" || it.status === "returned_remaining") &&
        (!issueWard || it.ward === issueWard),
    );
    return sortTheliAvailableRanges(unissued);
  }, [stockItems, issueWard]);

  // Pre-select first range (which is guaranteed to be the remaining one if available!)
  useEffect(() => {
    if (availableRanges.length > 0 && selectedStockItemIds.length === 0) {
      setSelectedStockItemIds([availableRanges[0].id]);
    }
  }, [availableRanges, selectedStockItemIds]);

  const toggleStockItemSelection = (id: string) => {
    setSelectedStockItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const totalSelectedVouchers = useMemo(
    () =>
      availableRanges
        .filter((it) => selectedStockItemIds.includes(it.id))
        .reduce((sum, it) => sum + (it.total_vouchers || 0), 0),
    [availableRanges, selectedStockItemIds],
  );

  const handleIssueTheli = async () => {
    setNotice(null);
    const emp = employees.find((e) => e.id === issueEmployeeId);
    if (!emp) {
      setNotice({ type: "error", text: "थेली पाउने कर्मचारी छान्नुहोस्।" });
      return;
    }
    if (selectedStockItemIds.length === 0) {
      setNotice({ type: "error", text: "स्टकबाट कम्तिमा एक उपलब्ध थेली दायरा छान्नुहोस्।" });
      return;
    }

    setIssuing(true);
    try {
      await issueMultipleFn({
        data: {
          item_ids: selectedStockItemIds,
          employee_id: emp.id,
          employee_name: emp.name,
          supervisor_name: issueSupervisorName,
          issued_date: issueDate,
        },
      });

      const updated = stockItems.map((it) =>
        selectedStockItemIds.includes(it.id)
          ? {
              ...it,
              status: "issued" as const,
              is_remaining_open: false,
              issued_to_id: emp.id,
              issued_to_name: emp.name,
              supervisor_name: issueSupervisorName,
              issued_date: issueDate,
            }
          : it,
      );
      setStockItems(updated);
      try {
        localStorage.setItem("hami_theli_stock_items", JSON.stringify(updated));
      } catch {}

      const selectedItems = availableRanges.filter((it) => selectedStockItemIds.includes(it.id));
      const rangesText = selectedItems.map((it) => `${it.range_from}–${it.range_to}`).join(", ");
      setNotice({
        type: "success",
        text: `${emp.name} लाई ${selectedStockItemIds.length} वटा थेली दायरा (${rangesText}) सफलतापूर्वक जारी गरियो!`,
      });
      setSelectedStockItemIds([]);
      refreshAll();
      setSubTab("boxes");
    } catch {
      // Local fallback: update items without server
      const updated = stockItems.map((it) =>
        selectedStockItemIds.includes(it.id)
          ? {
              ...it,
              status: "issued" as const,
              is_remaining_open: false,
              issued_to_id: emp.id,
              issued_to_name: emp.name,
              supervisor_name: issueSupervisorName,
              issued_date: issueDate,
            }
          : it,
      );
      setStockItems(updated);
      try {
        localStorage.setItem("hami_theli_stock_items", JSON.stringify(updated));
      } catch {}
      setNotice({
        type: "success",
        text: `${emp.name} लाई ${selectedStockItemIds.length} वटा थेली जारी गरियो!`,
      });
      setSubTab("boxes");
    } finally {
      setIssuing(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     TAB 3: EMPLOYEE REPORTING MODAL STATE
     ───────────────────────────────────────────────────────────── */
  const [reportingItem, setReportingItem] = useState<TheliStockItem | null>(null);
  const [reportLastVoucher, setReportLastVoucher] = useState("");
  const [reportAmountBooked, setReportAmountBooked] = useState("");
  const [reportAmountObtained, setReportAmountObtained] = useState("");
  const [reportCancelledCount, setReportCancelledCount] = useState(0);
  const [reportActionRemaining, setReportActionRemaining] = useState<"return" | "keep_issued">(
    "return",
  );
  const [reportDate, setReportDate] = useState("2083/07/15");
  const [reportRemarks, setReportRemarks] = useState("");
  const [savingReport, setSavingReport] = useState(false);

  // Employee's previous running balance from dailyLogs
  const employeeCarriedBalance = useMemo(() => {
    if (!reportingItem?.issued_to_id) return 0;
    const empLogs = dailyLogs
      .filter((l) => l.employee_id === reportingItem.issued_to_id)
      .sort((a, b) => b.log_date.localeCompare(a.log_date));
    return empLogs[0] ? theliTotals(empLogs[0]).balance : 0;
  }, [reportingItem, dailyLogs]);

  // Live reporting calculations
  const liveReportCalc = useMemo(() => {
    if (!reportingItem) return null;
    return calculateTheliBooking(
      reportingItem,
      reportLastVoucher,
      Number(reportAmountBooked) || 0,
      Number(reportAmountObtained) || 0,
      employeeCarriedBalance,
      reportCancelledCount,
    );
  }, [
    reportingItem,
    reportLastVoucher,
    reportAmountBooked,
    reportAmountObtained,
    employeeCarriedBalance,
    reportCancelledCount,
  ]);

  const handleOpenReportModal = (item: TheliStockItem) => {
    setReportingItem(item);
    // For partially booked theli, start clean or keep blank so user enters today's new last voucher
    setReportLastVoucher("");
    setReportAmountBooked("");
    setReportAmountObtained("");
    setReportCancelledCount(0);
    setReportActionRemaining("return");
    setReportDate(item.issued_date || "2083/07/15");
    setReportRemarks("");
  };

  const handleSaveReport = async () => {
    if (!reportingItem || !liveReportCalc) return;
    if (!reportLastVoucher.trim()) {
      alert("अन्तिम काटिएको रसिद नम्बर भर्नुहोस्।");
      return;
    }

    setSavingReport(true);
    try {
      await reportStockClosingFn({
        data: {
          item_id: reportingItem.id,
          last_voucher_booked: reportLastVoucher.trim(),
          amount_booked: liveReportCalc.amountBooked,
          amount_obtained: liveReportCalc.amountObtained,
          carried_balance: employeeCarriedBalance,
          cancelled_count: reportCancelledCount,
          action_on_remaining: reportActionRemaining,
          log_date: reportDate,
          remarks: reportRemarks,
        },
      });

      // Update local stockItems state
      let updatedItems = [...stockItems];
      if (liveReportCalc.isFullyExhausted || !liveReportCalc.remainingRange) {
        updatedItems = updatedItems.map((it) =>
          it.id === reportingItem.id
            ? {
                ...it,
                status: "completed" as const,
                last_voucher_booked: reportLastVoucher,
                booked_vouchers_count: liveReportCalc.bookedCount,
                cancelled_count: liveReportCalc.cancelledCount,
                remaining_vouchers_count: 0,
                amount_booked: liveReportCalc.amountBooked,
                amount_obtained: liveReportCalc.amountObtained,
                balance: liveReportCalc.newBalance,
              }
            : it,
        );
      } else {
        if (reportActionRemaining === "return") {
          // Completed for booked part
          updatedItems = updatedItems.map((it) =>
            it.id === reportingItem.id
              ? {
                  ...it,
                  status: "completed" as const,
                  last_voucher_booked: reportLastVoucher,
                  booked_vouchers_count: liveReportCalc.bookedCount,
                  cancelled_count: liveReportCalc.cancelledCount,
                  remaining_vouchers_count: 0,
                  amount_booked: liveReportCalc.amountBooked,
                  amount_obtained: liveReportCalc.amountObtained,
                  balance: liveReportCalc.newBalance,
                }
              : it,
          );

          // Add child item as returned open theli (at top of stack!)
          const childRemaining: TheliStockItem = {
            id: `th-rem-${Date.now()}`,
            batch_id: reportingItem.batch_id,
            municipality: reportingItem.municipality,
            ward: reportingItem.ward,
            fiscal_year: reportingItem.fiscal_year,
            theli_no: reportingItem.theli_no,
            range_from: liveReportCalc.remainingRange.from,
            range_to: liveReportCalc.remainingRange.to,
            total_vouchers: liveReportCalc.remainingRange.count,
            status: "returned_remaining",
            is_remaining_open: true, // Will rank at the very top!
            booked_vouchers_count: 0,
            remaining_vouchers_count: liveReportCalc.remainingRange.count,
            amount_booked: 0,
            amount_obtained: 0,
            balance: 0,
          };
          updatedItems = [childRemaining, ...updatedItems];
        } else {
          // Keep issued to employee
          updatedItems = updatedItems.map((it) =>
            it.id === reportingItem.id
              ? {
                  ...it,
                  status: "partially_booked" as const,
                  last_voucher_booked: reportLastVoucher,
                  booked_vouchers_count: liveReportCalc.bookedCount,
                  remaining_vouchers_count: liveReportCalc.remainingCount,
                  remaining_range_from: liveReportCalc.remainingRange?.from,
                  remaining_range_to: liveReportCalc.remainingRange?.to,
                  amount_booked: liveReportCalc.amountBooked,
                  amount_obtained: liveReportCalc.amountObtained,
                  balance: liveReportCalc.newBalance,
                }
              : it,
          );
        }
      }

      setStockItems(updatedItems);
      try {
        localStorage.setItem("hami_theli_stock_items", JSON.stringify(updatedItems));
      } catch {}

      setNotice({
        type: "success",
        text: `थेली रिपोर्टिङ सुरक्षित भयो! काटिएको: ${liveReportCalc.bookedCount}${liveReportCalc.cancelledCount ? `, रद्द: ${liveReportCalc.cancelledCount}, खुद: ${liveReportCalc.netValidCount}` : ""}, बक्यौता: रु. ${liveReportCalc.newBalance}।`,
      });
      setReportingItem(null);
      setReportCancelledCount(0);
      refreshAll();
    } catch (e: any) {
      alert("त्रुटि भयो: " + (e?.message || "रिपोर्ट सेभ भएन"));
    } finally {
      setSavingReport(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     EMPLOYEES GROUPED BOXES
     ───────────────────────────────────────────────────────────── */
  const employeeTheliCards = useMemo(() => {
    return employees.map((emp) => {
      const issued = stockItems.filter(
        (it) => it.issued_to_id === emp.id && (it.status === "issued" || it.status === "partially_booked"),
      );
      const allEmpItems = stockItems.filter((it) => it.issued_to_id === emp.id);

      // Latest carried balance
      const empLogs = dailyLogs
        .filter((l) => l.employee_id === emp.id)
        .sort((a, b) => b.log_date.localeCompare(a.log_date));
      const carryBalance = empLogs[0] ? theliTotals(empLogs[0]).balance : 0;

      const totalBooked = allEmpItems.reduce((s, it) => s + (Number(it.amount_booked) || 0), 0);
      const totalObtained = allEmpItems.reduce(
        (s, it) => s + (Number(it.amount_obtained) || 0),
        0,
      );

      return {
        emp,
        issued,
        allEmpItems,
        carryBalance,
        totalBooked,
        totalObtained,
      };
    });
  }, [employees, stockItems, dailyLogs]);

  /* ─────────────────────────────────────────────────────────────
     TAB 4: STOCK FILTER & SEARCH
     ───────────────────────────────────────────────────────────── */
  const [stockSearch, setStockSearch] = useState("");
  const [stockFilterWard, setStockFilterWard] = useState<string>("all");
  const [stockFilterStatus, setStockFilterStatus] = useState<string>("all");

  const filteredStockItems = useMemo(() => {
    return stockItems.filter((it) => {
      if (stockFilterWard !== "all" && it.ward !== stockFilterWard) return false;
      if (stockFilterStatus !== "all" && it.status !== stockFilterStatus) return false;
      if (stockSearch.trim()) {
        const q = stockSearch.toLowerCase();
        const matchesRange =
          it.range_from.toLowerCase().includes(q) || it.range_to.toLowerCase().includes(q);
        const matchesEmp = it.issued_to_name?.toLowerCase().includes(q);
        const matchesWard = it.ward.includes(q);
        if (!matchesRange && !matchesEmp && !matchesWard) return false;
      }
      return true;
    });
  }, [stockItems, stockFilterWard, stockFilterStatus, stockSearch]);

  // Overall Stock KPI totals
  const stockSummary = useMemo(() => {
    const total = stockItems.length;
    const totalVouchers = stockItems.reduce((s, it) => s + it.total_vouchers, 0);
    const available = stockItems.filter(
      (it) => it.status === "available" || it.status === "returned_remaining",
    ).length;
    const issued = stockItems.filter(
      (it) => it.status === "issued" || it.status === "partially_booked",
    ).length;
    const completed = stockItems.filter((it) => it.status === "completed").length;
    const totalAmountBooked = stockItems.reduce(
      (s, it) => s + (Number(it.amount_booked) || 0),
      0,
    );
    const totalAmountObtained = stockItems.reduce(
      (s, it) => s + (Number(it.amount_obtained) || 0),
      0,
    );
    const totalBalance = stockItems.reduce((s, it) => s + (Number(it.balance) || 0), 0);

    return {
      total,
      totalVouchers,
      available,
      issued,
      completed,
      totalAmountBooked,
      totalAmountObtained,
      totalBalance,
    };
  }, [stockItems]);

  return (
    <WorkspacePage title="Assets">
      <div className="space-y-4">
        {/* Header Strip */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs">
          <div>
            <h1 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Package className="size-5 text-primary" />
              <span>थेली स्टक, निष्कासन तथा कर्मचारी लेजर प्रणाली</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              पालिका, वडा, आ.व. अनुसार थेली स्टक व्यवस्थापन, कर्मचारीलाई निष्कासन, चालु बाँकी थेली पहिलो प्राथमिकता तथा दैनिक रसिद हिसाब।
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="text-xs font-semibold"
            >
              <Printer className="mr-1.5 size-3.5" />
              <span>प्रिन्ट गर्नुहोस्</span>
            </Button>
          </div>
        </div>

        {/* Global Alert Notification */}
        {notice && (
          <div
            role="alert"
            className={`flex items-center justify-between rounded-xl p-3 text-xs font-semibold shadow-xs transition-all ${
              notice.type === "success"
                ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/30"
                : "bg-destructive/10 text-destructive border border-destructive/30"
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="size-4 shrink-0 text-destructive" />
              )}
              <span>{notice.text}</span>
            </div>
            <button
              onClick={() => setNotice(null)}
              className="rounded p-1 opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Sub-Navigation Tabs */}
        <div className="no-print flex items-center justify-between border-b gap-2 overflow-x-auto">
          <div className="flex gap-2 sm:gap-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSubTab("stock")}
              className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                subTab === "stock"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Package className="size-3.5" />
              <span>थेली स्टक स्थिति (Stock Status)</span>
              <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-mono text-primary font-bold">
                {stockItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab("add_stock")}
              className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                subTab === "add_stock"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Plus className="size-3.5" />
              <span>नयाँ थेली स्टक दर्ता (Add Stock)</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab("issue")}
              className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                subTab === "issue"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCheck className="size-3.5" />
              <span>कर्मचारीलाई थेली जारी (Issue Theli)</span>
              {availableRanges.some((r) => r.is_remaining_open) && (
                <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] text-amber-700 font-bold">
                  बाँकी थेली छ!
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSubTab("boxes")}
              className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                subTab === "boxes"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <HandCoins className="size-3.5" />
              <span>कर्मचारी अनुसार थेली बक्स (Employee Boxes)</span>
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono font-bold">
                {employees.length}
              </span>
            </button>
          </div>

          {(stockItems.length > 0 || dailyLogs.length > 0) && (
            <button
              type="button"
              disabled={clearingData}
              onClick={handleClearAllTheliAndLedger}
              className="mb-2 shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-destructive hover:bg-destructive/10 border border-destructive/30 rounded-lg px-2.5 py-1 transition-all"
              title="सबै पुरानो थेली र लेजर डाटा मेटाउनुहोस्"
            >
              <Trash2 className="size-3" />
              <span>{clearingData ? "मेटिँदैछ…" : "पुरानो थेली/लेजर मेटाउनुहोस्"}</span>
            </button>
          )}
        </div>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* SUB-TAB 1: THELI STOCK STATUS & LIVE TABLE                    */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {subTab === "stock" && (
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              <div className="rounded-xl border bg-card p-3 shadow-2xs">
                <span className="text-[11px] text-muted-foreground font-semibold">कुल थेली संख्या</span>
                <div className="text-xl font-extrabold text-foreground mt-0.5">{stockSummary.total} थेली</div>
                <div className="text-[10px] text-muted-foreground font-mono">{stockSummary.totalVouchers} रसिद</div>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 shadow-2xs">
                <span className="text-[11px] text-emerald-700 font-semibold">उपलब्ध मौज्दात</span>
                <div className="text-xl font-extrabold text-emerald-700 mt-0.5">{stockSummary.available} थेली</div>
                <div className="text-[10px] text-emerald-600 font-semibold">निष्कासनका लागि तयार</div>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 shadow-2xs">
                <span className="text-[11px] text-blue-700 font-semibold">कर्मचारीसँग जारी</span>
                <div className="text-xl font-extrabold text-blue-700 mt-0.5">{stockSummary.issued} थेली</div>
                <div className="text-[10px] text-blue-600 font-semibold">फिल्डमा संकलन भइरहेको</div>
              </div>

              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 shadow-2xs">
                <span className="text-[11px] text-purple-700 font-semibold">संकलित काटिएको रकम</span>
                <div className="text-xl font-extrabold text-purple-700 mt-0.5">{money(stockSummary.totalAmountBooked)}</div>
                <div className="text-[10px] text-purple-600 font-semibold">बुझाएको: {money(stockSummary.totalAmountObtained)}</div>
              </div>

              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 shadow-2xs col-span-2 sm:col-span-1">
                <span className="text-[11px] text-rose-700 font-semibold">बाँकी क्यारी अन्तर</span>
                <div className="text-xl font-extrabold text-rose-700 mt-0.5">{money(stockSummary.totalBalance)}</div>
                <div className="text-[10px] text-rose-600 font-semibold">कर्मचारीको खातामा बोकिएको</div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="सिरियल, कर्मचारी वा वडा खोज्नुहोस्…"
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className={`${inputCls} pl-8`}
                  />
                </div>

                <select
                  value={stockFilterWard}
                  onChange={(e) => setStockFilterWard(e.target.value)}
                  className={`${inputCls} w-auto`}
                >
                  <option value="all">सबै वडा</option>
                  {Array.from({ length: 16 }, (_, i) => String(i + 1)).map((w) => (
                    <option key={w} value={w}>
                      वडा {w}
                    </option>
                  ))}
                </select>

                <select
                  value={stockFilterStatus}
                  onChange={(e) => setStockFilterStatus(e.target.value)}
                  className={`${inputCls} w-auto`}
                >
                  <option value="all">सबै अवस्था (All Status)</option>
                  <option value="available">उपलब्ध (Available)</option>
                  <option value="returned_remaining">बाँकी फिर्ता (Remaining Open)</option>
                  <option value="issued">जारी गरिएको (Issued)</option>
                  <option value="partially_booked">प्रयोगमा (Partially Booked)</option>
                  <option value="completed">सम्पन्न (Completed)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setSubTab("issue")}
                  className="text-xs font-bold bg-primary text-primary-foreground shadow-2xs flex items-center gap-1.5"
                >
                  <UserCheck className="size-3.5" />
                  <span>थेली जारी गर्नुहोस्</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSubTab("add_stock")}
                  className="text-xs font-bold"
                >
                  <Plus className="size-3.5" />
                  <span>स्टक थप्नुहोस्</span>
                </Button>
              </div>
            </div>

            {/* Live Stock Items Table */}
            <div className="overflow-x-auto rounded-xl border bg-card shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-3.5 py-3">सि.नं.</th>
                    <th className="px-3.5 py-3">थेली / सिरियल दायरा</th>
                    <th className="px-3.5 py-3">वडा र पालिका</th>
                    <th className="px-3.5 py-3">रसिद</th>
                    <th className="px-3.5 py-3">अवस्था (Status)</th>
                    <th className="px-3.5 py-3">जिम्मेवार कर्मचारी</th>
                    <th className="px-3.5 py-3">अन्तिम काटिएको</th>
                    <th className="px-3.5 py-3 text-right">काटिएको रकम</th>
                    <th className="px-3.5 py-3 text-right">बुझाएको</th>
                    <th className="px-3.5 py-3 text-right">बाँकी अन्तर</th>
                    <th className="no-print px-3.5 py-3 text-right">कार्य</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-muted-foreground">
                        कुनै थेली फेला परेन। माथिको 'नयाँ थेली स्टक दर्ता' बाट स्टक थप्नुहोस्।
                      </td>
                    </tr>
                  ) : (
                    filteredStockItems.map((item, idx) => {
                      const isRemaining =
                        item.is_remaining_open || item.status === "returned_remaining";
                      return (
                        <tr
                          key={item.id || idx}
                          className={`hover:bg-muted/30 transition-colors ${
                            isRemaining ? "bg-amber-500/5 font-medium" : ""
                          }`}
                        >
                          <td className="px-3.5 py-3 font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="px-3.5 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-foreground text-sm">
                                {item.range_from} – {item.range_to}
                              </span>
                              {isRemaining && (
                                <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[9px] font-bold text-amber-800">
                                  ★ बाँकी चालु थेली
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              थेली नं: {item.theli_no || idx + 1} | आ.व. {item.fiscal_year}
                            </div>
                          </td>
                          <td className="px-3.5 py-3">
                            <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary text-[11px]">
                              वडा {item.ward}
                            </span>
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]">
                              {item.municipality}
                            </div>
                          </td>
                          <td className="px-3.5 py-3 font-mono">
                            <div className="font-bold">{item.total_vouchers}</div>
                            {item.remaining_vouchers_count !== undefined &&
                              item.remaining_vouchers_count !== item.total_vouchers && (
                                <div className="text-[10px] text-muted-foreground">
                                  बाँकी: {item.remaining_vouchers_count}
                                </div>
                              )}
                          </td>
                          <td className="px-3.5 py-3">
                            {item.status === "available" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                ● उपलब्ध (Stock)
                              </span>
                            )}
                            {item.status === "returned_remaining" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                ↺ फिर्ता बाँकी (Ready)
                              </span>
                            )}
                            {item.status === "issued" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                ➔ कर्मचारीसँग जारी
                              </span>
                            )}
                            {item.status === "partially_booked" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                                ◐ प्रयोग भइरहेको
                              </span>
                            )}
                            {item.status === "completed" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted border px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                ✓ सम्पन्न (Finished)
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-3">
                            {item.issued_to_name ? (
                              <div>
                                <span className="font-bold text-foreground">{item.issued_to_name}</span>
                                <div className="text-[10px] text-muted-foreground">
                                  मिति: {item.issued_date || "—"}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 font-mono">
                            {item.last_voucher_booked ? (
                              <div>
                                <span className="font-bold text-blue-700">{item.last_voucher_booked}</span>
                                <div className="text-[10px] text-muted-foreground">
                                  काटियो: {item.booked_vouchers_count || 0}
                                  {(item.cancelled_count || 0) > 0 && (
                                    <span className="ml-1 text-rose-600">
                                      | रद्द: {item.cancelled_count}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-semibold">
                            {money(item.amount_booked || 0)}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono text-emerald-700 font-semibold">
                            {money(item.amount_obtained || 0)}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono">
                            <span
                              className={`rounded px-1.5 py-0.5 font-bold ${
                                (item.balance || 0) > 0
                                  ? "bg-rose-500/10 text-rose-700 border border-rose-500/20"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {money(item.balance || 0)}
                            </span>
                          </td>
                          <td className="no-print px-3.5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {(item.status === "available" || item.status === "returned_remaining") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px] font-bold text-primary border-primary/30"
                                  onClick={() => {
                                    setSelectedStockItemIds([item.id]);
                                    setIssueWard(item.ward);
                                    setSubTab("issue");
                                  }}
                                >
                                  जारी
                                </Button>
                              )}
                              {(item.status === "issued" || item.status === "partially_booked") && (
                                <Button
                                  size="sm"
                                  className="h-7 px-2 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handleOpenReportModal(item)}
                                >
                                  रिपोर्टिङ
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* SUB-TAB 2: ADD THELI STOCK BATCH (स्टक दर्ता फारम)           */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {subTab === "add_stock" && (
          <div className="max-w-2xl mx-auto rounded-xl border bg-card p-5 shadow-xs space-y-4">
            <div className="border-b pb-3">
              <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <Plus className="size-4 text-primary" />
                <span>नयाँ थेली स्टक दर्ता (Theli Stock Registration)</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                पालिका, वडा, आ.व. छान्नुहोस् र सुरु देखि अन्तिम सिरियल दायरा भर्नुहोस्। रसिद र थेली संख्या स्वतः गणना हुन्छ।
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    नगरपालिका / पालिका (Municipality) *
                  </label>
                  <input
                    type="text"
                    value={newBatchMunicipality}
                    onChange={(e) => setNewBatchMunicipality(e.target.value)}
                    className={inputCls}
                    placeholder="उदा: वीरेन्द्रनगर नगरपालिका"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    वडा नं. (Ward) *
                  </label>
                  <select
                    value={newBatchWard}
                    onChange={(e) => setNewBatchWard(e.target.value)}
                    className={inputCls}
                  >
                    {Array.from({ length: 16 }, (_, i) => String(i + 1)).map((w) => (
                      <option key={w} value={w}>
                        वडा नं. {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    आर्थिक वर्ष (Fiscal Year) *
                  </label>
                  <select
                    value={newBatchFY}
                    onChange={(e) => setNewBatchFY(e.target.value)}
                    className={inputCls}
                  >
                    {["2080/81", "2081/82", "2082/83", "2083/84", "2084/85"].map((y) => (
                      <option key={y} value={y}>
                        आ.व. {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    देखि सिरियल (Starts From) *
                  </label>
                  <input
                    type="text"
                    value={newBatchStart}
                    onChange={(e) => setNewBatchStart(e.target.value)}
                    className={`${inputCls} font-mono font-bold`}
                    placeholder="उदा: GT-0001"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    सम्म सिरियल (End To) *
                  </label>
                  <input
                    type="text"
                    value={newBatchEnd}
                    onChange={(e) => setNewBatchEnd(e.target.value)}
                    className={`${inputCls} font-mono font-bold`}
                    placeholder="उदा: GT-1000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                  रसिद प्रति थेली (Vouchers per Theli Book)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={newBatchPerTheli}
                    onChange={(e) => setNewBatchPerTheli(Number(e.target.value) || 50)}
                    className={`${inputCls} w-28 font-mono`}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    (सामान्यतया १ थेलीमा ५० वा १०० वटा रसिद हुन्छ)
                  </span>
                </div>
              </div>

              {/* Automatic Calculation Preview Banner */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="text-[11px] font-bold text-primary mb-2 flex items-center gap-1.5">
                  <Sparkles className="size-4" />
                  <span>स्वतः गणना विवरण (Live Automatic Calculation):</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">जम्मा रसिद संख्या (Vouchers)</span>
                    <span className="text-lg font-extrabold font-mono text-foreground">
                      {batchCounts.totalVouchers} वटा
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">जम्मा थेली संख्या (Theli Books)</span>
                    <span className="text-lg font-extrabold font-mono text-emerald-700">
                      {batchCounts.totalTheli} थेली
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">प्रति थेली रसिद</span>
                    <span className="text-lg font-extrabold font-mono text-foreground">
                      {newBatchPerTheli} वटा
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                  कैफियत (Remarks / Note)
                </label>
                <input
                  type="text"
                  value={newBatchRemarks}
                  onChange={(e) => setNewBatchRemarks(e.target.value)}
                  className={inputCls}
                  placeholder="उदा: नयाँ छापिएर आएको थेली लट"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSubTab("stock")}
                >
                  रद्द गर्नुहोस्
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={savingBatch || batchCounts.totalVouchers <= 0}
                  onClick={handleCreateStockBatch}
                  className="font-bold bg-primary text-primary-foreground"
                >
                  {savingBatch ? "सुरक्षित हुँदै…" : "थेली स्टक सुरक्षित गर्नुहोस्"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* SUB-TAB 3: ISSUE THELI TO EMPLOYEE (कर्मचारीलाई थेली जारी)      */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {subTab === "issue" && (
          <div className="max-w-3xl mx-auto rounded-xl border bg-card p-5 shadow-xs space-y-4">
            <div className="border-b pb-3">
              <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <UserCheck className="size-4 text-primary" />
                <span>कर्मचारीलाई थेली निष्कासन / जारी (Issue Theli to Employee)</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                कर्मचारी छान्नुहोस् र उपलब्ध थेली दायरा छान्नुहोस्। <strong>बाँकी रहेको चालु थेली स्वतः पहिलो स्थानमा देखिन्छ।</strong>
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    थेली बुझ्ने कर्मचारी (Employee Name) *
                  </label>
                  <select
                    value={issueEmployeeId}
                    onChange={(e) => setIssueEmployeeId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— कर्मचारी छान्नुहोस् —</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.designation})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    जिम्मेवार सुपरभाइजर (Supervisor)
                  </label>
                  <select
                    value={issueSupervisorName}
                    onChange={(e) => setIssueSupervisorName(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— सुपरभाइजर छान्नुहोस् —</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.designation})
                      </option>
                    ))}
                    {employees.map((e) => (
                      <option key={e.id} value={e.name}>
                        {e.name} ({e.designation})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    नगरपालिका (Municipality)
                  </label>
                  <input
                    type="text"
                    value={issueMunicipality}
                    onChange={(e) => setIssueMunicipality(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    वडा नं. (Ward)
                  </label>
                  <select
                    value={issueWard}
                    onChange={(e) => setIssueWard(e.target.value)}
                    className={inputCls}
                  >
                    {Array.from({ length: 16 }, (_, i) => String(i + 1)).map((w) => (
                      <option key={w} value={w}>
                        वडा नं. {w}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    जारी मिति (Issue Date BS)
                  </label>
                  <BSDatePicker value={issueDate} onChange={setIssueDate} />
                </div>
              </div>

              {/* Range Selection Box — With Remaining One Prominently at Top */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-foreground">
                    उपलब्ध थेली दायरा छान्नुहोस् (Available Theli Range) *
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    (पहिलो दायरा बाँकी चालु थेली हो)
                  </span>
                </div>

                {availableRanges.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground bg-muted/20">
                    यस वडामा कुनै थेली उपलब्ध छैन। पहिले 'नयाँ थेली स्टक दर्ता' बाट स्टक थप्नुहोस्।
                  </div>
                ) : (
                  <>
                    {/* "Select All" shortcut */}
                    <div className="flex items-center justify-between text-xs mb-1 px-1">
                      <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-muted-foreground">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-primary"
                          checked={selectedStockItemIds.length === availableRanges.length && availableRanges.length > 0}
                          onChange={(e) =>
                            setSelectedStockItemIds(e.target.checked ? availableRanges.map((r) => r.id) : [])
                          }
                        />
                        सबै छान्नुहोस्
                      </label>
                      {selectedStockItemIds.length > 0 && (
                        <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {selectedStockItemIds.length} थेली छानियो — {totalSelectedVouchers} रसिद
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {availableRanges.map((item, idx) => {
                        const isRemaining =
                          item.is_remaining_open || item.status === "returned_remaining";
                        const isSelected = selectedStockItemIds.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleStockItemSelection(item.id)}
                            className={`cursor-pointer rounded-xl border p-3 transition-all flex items-center justify-between ${
                              isSelected
                                ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                                : isRemaining
                                  ? "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
                                  : "border-border bg-card hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleStockItemSelection(item.id)}
                                className="size-4 accent-primary"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-extrabold text-sm text-foreground">
                                    {item.range_from} – {item.range_to}
                                  </span>
                                  {isRemaining && (
                                    <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[9px] font-extrabold text-amber-800 animate-pulse">
                                      ★ बाँकी रहेको चालु थेली (पहिले जारी गर्नुहोस्)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  वडा नं. {item.ward} | रसिद संख्या: {item.total_vouchers} वटा | आ.व. {item.fiscal_year}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="font-bold text-xs text-foreground font-mono">
                                {item.total_vouchers} रसिद
                              </span>
                              <div className="text-[10px] text-emerald-600 font-semibold">उपलब्ध</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSubTab("stock")}
                >
                  रद्द
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={issuing || selectedStockItemIds.length === 0 || !issueEmployeeId}
                  onClick={handleIssueTheli}
                  className="font-bold bg-primary text-primary-foreground flex items-center gap-1.5"
                >
                  <UserCheck className="size-3.5" />
                  <span>
                    {issuing
                      ? "जारी हुँदै…"
                      : selectedStockItemIds.length > 1
                        ? `${selectedStockItemIds.length} वटा थेली जारी गर्नुहोस्`
                        : "थेली कर्मचारीलाई जारी गर्नुहोस्"}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* SUB-TAB 4: EMPLOYEE THELI BOXES (कर्मचारी अनुसार थेली बक्स)     */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {subTab === "boxes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h2 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
                  <HandCoins className="size-4 text-primary" />
                  <span>कर्मचारी अनुसार थेली बक्स तथा दैनिक रिपोर्टिङ</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  प्रत्येक कर्मचारीको बक्समा जारी थेली, अन्तिम काटिएको रसिद रिपोर्टिङ तथा बक्यौता हिसाब हेर्न सकिन्छ।
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employeeTheliCards.map(({ emp, issued, carryBalance, totalBooked, totalObtained }) => (
                <div
                  key={emp.id}
                  className="rounded-xl border bg-card p-4 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 border-b pb-2 mb-3">
                      <div>
                        <div className="font-bold text-sm text-foreground">{emp.name}</div>
                        <div className="text-[10px] text-muted-foreground">{emp.designation}</div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          carryBalance > 0
                            ? "bg-rose-500/10 text-rose-700 border border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                        }`}
                      >
                        अन्तर: {money(carryBalance)}
                      </span>
                    </div>

                    {/* Summary row */}
                    <div className="grid grid-cols-2 gap-2 text-center text-xs bg-muted/20 rounded-lg p-2 mb-3">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">काटिएको रकम</span>
                        <span className="font-bold font-mono text-foreground">{money(totalBooked)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">बुझाएको रकम</span>
                        <span className="font-bold font-mono text-emerald-700">{money(totalObtained)}</span>
                      </div>
                    </div>

                    {/* Currently Issued Theli in Hands */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-muted-foreground block">
                        हाल हातमा रहेको थेली ({issued.length}):
                      </span>

                      {issued.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">
                          हाल कुनै थेली जारी भएको छैन।
                        </div>
                      ) : (
                        issued.map((it) => (
                          <div
                            key={it.id}
                            className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-extrabold text-blue-900">
                                {it.status === "partially_booked" && it.remaining_range_from
                                  ? `${it.remaining_range_from} – ${it.range_to}`
                                  : `${it.range_from} – ${it.range_to}`}
                              </span>
                              <span className="rounded bg-blue-500/20 px-1.5 py-0.2 text-[9px] font-bold text-blue-800">
                                {it.status === "partially_booked" && it.remaining_vouchers_count !== undefined
                                  ? `${it.remaining_vouchers_count} बाँकी`
                                  : `${it.total_vouchers} रसिद`}
                              </span>
                            </div>

                            <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                              <span>वडा {it.ward} ({it.fiscal_year})</span>
                              {it.last_voucher_booked && (
                                <span className="font-bold text-purple-700">
                                  अन्तिम काटियो: {it.last_voucher_booked}
                                </span>
                              )}
                            </div>

                            {it.status === "partially_booked" && it.remaining_range_from && (
                              <div className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-[10px] font-semibold text-amber-800">
                                ◐ आंशिक — बाँकी दायरा: {it.remaining_range_from} देखि {it.range_to}
                              </div>
                            )}

                            <Button
                              size="sm"
                              className="w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white mt-1 h-7 flex items-center justify-center gap-1"
                              onClick={() => handleOpenReportModal(it)}
                            >
                              <PenLine className="size-3" />
                              <span>दैनिक थेली रिपोर्टिङ भर्नुहोस्</span>
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs font-semibold w-full"
                      onClick={() => {
                        setIssueEmployeeId(emp.id);
                        setSubTab("issue");
                      }}
                    >
                      <Plus className="size-3 mr-1" />
                      <span>नयाँ थेली थप जारी गर्नुहोस्</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* REPORTING MODAL DIALOG (अन्तिम काटिएको रसिद रिपोर्टिङ)         */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {reportingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="relative w-full max-w-lg rounded-2xl border bg-card p-5 shadow-2xl space-y-4">
              <div className="border-b pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                    <PenLine className="size-4 text-emerald-600" />
                    <span>दैनिक थेली रिपोर्टिङ — {reportingItem.issued_to_name}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {reportingItem.status === "partially_booked" && reportingItem.remaining_range_from
                      ? <>बाँकी दायरा: <strong className="font-mono">{reportingItem.remaining_range_from} देखि {reportingItem.range_to}</strong> (वडा {reportingItem.ward})</>
                      : <>जारी दायरा: <strong className="font-mono">{reportingItem.range_from} देखि {reportingItem.range_to}</strong> (वडा {reportingItem.ward})</>
                    }
                  </p>
                </div>
                <button
                  onClick={() => setReportingItem(null)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* Carried Balance Banner */}
                <div className="rounded-xl border bg-muted/30 p-2.5 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-semibold">
                    पहिलेको बाँकी अन्तर (Carried Balance)
                  </span>
                  <span
                    className={`font-mono font-bold text-xs ${
                      employeeCarriedBalance > 0 ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {money(employeeCarriedBalance)}
                  </span>
                </div>

                {/* Main Input: Last Voucher Booked */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2">
                  <label className="block text-xs font-extrabold text-primary">
                    १. अन्तिम काटिएको रसिद नम्बर (Last Voucher Booked No.) *
                  </label>
                  <input
                    type="text"
                    value={reportLastVoucher}
                    onChange={(e) => setReportLastVoucher(e.target.value)}
                    className={`${inputCls} font-mono font-extrabold text-sm border-primary/40`}
                    placeholder={
                      reportingItem.status === "partially_booked" && reportingItem.remaining_range_from
                        ? `उदा: ${reportingItem.remaining_range_from} देखि ${reportingItem.range_to}`
                        : `उदा: ${reportingItem.range_to}`
                    }
                  />
                  {reportingItem.status === "partially_booked" && reportingItem.remaining_range_from && (
                    <div className="text-[11px] text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                      यसअघि अन्तिम काटिएको रसिद: <strong>{reportingItem.last_voucher_booked}</strong> | अब गणना सुरु हुने रसिद: <strong className="font-mono">{reportingItem.remaining_range_from}</strong>
                    </div>
                  )}
                  {liveReportCalc && (
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold pt-1">
                      <div className="text-emerald-700">
                        काटिएको रसिद: <strong>{liveReportCalc.bookedCount} वटा</strong>
                      </div>
                      <div className="text-purple-700">
                        बाँकी रसिद: <strong>{liveReportCalc.remainingCount} वटा</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cancelled Rasids input */}
                <div className="rounded-xl border border-rose-400/30 bg-rose-500/5 p-3 space-y-2">
                  <label className="block text-[11px] font-bold text-rose-700">
                    २. रद्द रसिद संख्या (Cancelled Vouchers Count)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={liveReportCalc?.bookedCount ?? 9999}
                    value={reportCancelledCount}
                    onChange={(e) => setReportCancelledCount(Math.max(0, Number(e.target.value) || 0))}
                    className={`${inputCls} font-mono font-bold text-rose-700`}
                    placeholder="0"
                  />
                  {liveReportCalc && reportCancelledCount > 0 && (
                    <div className="text-[11px] font-semibold text-rose-800 bg-rose-100/60 rounded px-2 py-1">
                      काटिएको {liveReportCalc.bookedCount} − रद्द {liveReportCalc.cancelledCount} ={" "}
                      <strong>खुद वैध रसिद: {liveReportCalc.netValidCount} वटा</strong>
                    </div>
                  )}
                </div>

                {/* Amount inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                      ३. काटिएको रकम (Booked Amount - रु.) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={reportAmountBooked}
                      onChange={(e) => setReportAmountBooked(e.target.value)}
                      className={`${inputCls} font-mono font-bold`}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                      ४. बुझाएको रकम (Obtained Cash - रु.) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={reportAmountObtained}
                      onChange={(e) => setReportAmountObtained(e.target.value)}
                      className={`${inputCls} font-mono font-bold text-emerald-700`}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Live Balance / Credit Calculation */}
                {liveReportCalc && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        नयाँ बक्यौता अन्तर (Running Balance on Credit)
                      </span>
                      <span className="font-extrabold text-sm font-mono text-amber-900">
                        {money(liveReportCalc.newBalance)}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground text-right max-w-[200px]">
                      (थालनी रु. {employeeCarriedBalance} + काटिएको रु. {liveReportCalc.amountBooked} − बुझाइएको रु. {liveReportCalc.amountObtained})
                    </div>
                  </div>
                )}

                {/* Remaining Range: Returned or Kept Issued? */}
                {liveReportCalc && liveReportCalc.remainingRange && (
                  <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 space-y-2">
                    <div className="font-bold text-purple-900 text-xs">
                      बाँकी रसिद दायरा ({liveReportCalc.remainingRange.from} देखि {liveReportCalc.remainingRange.to}) — के गर्ने?
                    </div>

                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="remaining_action"
                          value="return"
                          checked={reportActionRemaining === "return"}
                          onChange={() => setReportActionRemaining("return")}
                          className="accent-primary"
                        />
                        <span className="font-semibold text-foreground text-[11px]">
                          🟢 <strong>स्टकमा फिर्ता बुझाउने (Returned to Stock)</strong> — बाँकी दायरा स्टकमा आउनेछ र अर्को पटक निष्कासन गर्दा सबैभन्दा पहिलो स्थानमा देखिनेछ।
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="remaining_action"
                          value="keep_issued"
                          checked={reportActionRemaining === "keep_issued"}
                          onChange={() => setReportActionRemaining("keep_issued")}
                          className="accent-primary"
                        />
                        <span className="font-semibold text-foreground text-[11px]">
                          🟡 <strong>कर्मचारीसँगै जारी रहने (Kept Issued)</strong> — यो बाँकी दायरा भोलि संकलनका लागि यसै कर्मचारीको हातमा रहनेछ।
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                      रिपोर्ट मिति (BS Date)
                    </label>
                    <BSDatePicker value={reportDate} onChange={setReportDate} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                      कैफियत (Remarks)
                    </label>
                    <input
                      type="text"
                      value={reportRemarks}
                      onChange={(e) => setReportRemarks(e.target.value)}
                      className={inputCls}
                      placeholder="वैकल्पिक टिप्पणी"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setReportingItem(null)}
                  >
                    रद्द
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingReport || !reportLastVoucher}
                    onClick={handleSaveReport}
                    className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {savingReport ? "सुरक्षित हुँदै…" : "दैनिक रिपोर्ट सुरक्षित गर्नुहोस्"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </WorkspacePage>
  );
}