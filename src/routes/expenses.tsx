import { hamiCacheKey } from "@/lib/hami-cache";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAppState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BSDatePicker } from "@/components/bs-date-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Receipt,
  Package,
  Building,
  ScanLine,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Camera,
  Upload,
  Sparkles,
  AlertTriangle,
  UserCheck,
  Users,
  CalendarDays,
  Settings,
  RefreshCw,
} from "lucide-react";
import {
  np,
  todayBS,
  ITEM_PARENTS,
  FIXED_ASSET_PARENTS,
  validateDateInFiscalYear,
} from "@/lib/receipt-rules";
import { useAppConfig, scanBillWithAI, type AppConfig } from "@/lib/app-config";
import type {
  Vendor,
  AssetLineItem,
  ExpenseLineItem,
  ExpenseRecord,
  Member,
  Employee,
  ClubEvent,
  ItemMaster,
  FixedAssetMaster,
} from "@/lib/receipt-rules";
import {
  getVendorsData,
  getExpensesData,
  saveExpenseRecord,
  deleteExpenseRecord,
  getMembersData,
  getEmployeesData,
  getEventsData,
  saveVendor,
  saveItemMaster,
  saveFixedAssetMaster,
} from "@/lib/workspace.functions";

export const Route = createFileRoute("/expenses")({
  component: ExpensesPage,
});

const UOM_OPTIONS = ["nos", "kg", "ltr", "mtr", "ft", "pkt", "box", "set", "pair", "roll", "unit"];

function fmt(n: number | undefined | null) {
  return (Number(n) || 0).toLocaleString("ne-NP", { minimumFractionDigits: 2 });
}

function makeAssetRow(): AssetLineItem {
  return { item_code: "", name: "", lot: "", uom: "nos", qty: 1, rate: 0, amount: 0 };
}

function makeExpenseRow(): ExpenseLineItem {
  return {
    description: "",
    uom: "nos",
    qty: 1,
    rate: 0,
    amount: 0,
    tds_applicable: false,
    tds_rate: 0,
    tds_amount: 0,
    net_amount: 0,
  };
}

// Auto lot generator: FA-001, FA-002... or IT-001...
function generateLot(type: "fixed_asset" | "item", existingLots: string[]) {
  const prefix = type === "fixed_asset" ? "FA" : "IT";
  const nums = (existingLots || [])
    .filter((l) => typeof l === "string" && l.startsWith(prefix + "-"))
    .map((l) => parseInt(l.replace(prefix + "-", ""), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

// ─── Master auto-save helpers (खर्च सेभ गर्दा मास्टरमा स्वतः सुरक्षित) ──

const ITEM_CACHE_KEY = hamiCacheKey("hami_items_master_cache");
const ASSET_CACHE_KEY = hamiCacheKey("hami_fixed_asset_master_cache");

type MasterFillRow = {
  include: boolean;
  parent: string;
  sub_parent: string;
  uom: string;
  units: number;
  uomTouched: boolean;
  unitsTouched: boolean;
  amountOverride?: number;
};

function matchItemMaster(name: string, code: string, list: ItemMaster[]): ItemMaster | undefined {
  const nm = name.trim().toLowerCase();
  const cd = code.trim().toLowerCase();
  return list.find(
    (m) =>
      (cd && (m.item_code || "").toLowerCase() === cd) || (!!nm && m.name.toLowerCase() === nm),
  );
}

function matchAssetMaster(
  name: string,
  code: string,
  list: FixedAssetMaster[],
): FixedAssetMaster | undefined {
  const nm = name.trim().toLowerCase();
  const cd = code.trim().toLowerCase();
  return list.find(
    (m) => (cd && (m.code || "").toLowerCase() === cd) || (!!nm && m.name.toLowerCase() === nm),
  );
}

function buildMasterRow(
  row: AssetLineItem,
  matched?: { parent?: string; sub_parent?: string; uom?: string },
): MasterFillRow {
  return {
    include: true,
    parent: matched?.parent ?? "",
    sub_parent: matched?.sub_parent ?? "",
    uom: matched?.uom || row.uom || "nos",
    units: Number(row.qty) || 1,
    uomTouched: !!matched?.uom,
    unitsTouched: false,
  };
}

function nextMasterCode(list: { item_code?: string; code?: string }[], prefix: string) {
  const nums = list
    .map((m) => (m.item_code || m.code || "").replace(prefix, ""))
    .map((c) => parseInt(c, 10))
    .filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

function upsertById<T extends { id?: string }>(list: T[], rec: T): T[] {
  const id = rec.id || `local-${Date.now()}`;
  const withId = { ...rec, id };
  const found = list.some((x) => x.id === id);
  return found ? list.map((x) => (x.id === id ? withId : x)) : [withId, ...list];
}

// Pro-rata split of the bill's actual payable (अन्य शुल्क + छुट सहित) across line items.
function prorataShares(list: AssetLineItem[], finalAmount: number): number[] {
  const amounts = list.map((r) => Number(r.amount) || 0);
  const sum = amounts.reduce((s, a) => s + a, 0);
  if (finalAmount <= 0) return list.map(() => 0);
  const shares = amounts.map((a) => {
    const raw = sum > 0 ? (finalAmount * a) / sum : list.length ? finalAmount / list.length : 0;
    return Math.round(raw * 100) / 100;
  });
  const diff = Math.round((finalAmount - shares.reduce((s, v) => s + v, 0)) * 100) / 100;
  if (diff !== 0) {
    let maxIdx = 0;
    let maxVal = shares[0] ?? 0;
    shares.forEach((v, i) => {
      if (v > maxVal) {
        maxVal = v;
        maxIdx = i;
      }
    });
    shares[maxIdx] = Math.round((maxVal + diff) * 100) / 100;
  }
  return shares;
}

// Bill match badge
function BillMatchBadge({
  status,
  computed,
  scanned,
}: {
  status: string;
  computed: number;
  scanned: number;
}) {
  if (status === "match")
    return (
      <Badge className="bg-green-600 hover:bg-green-600 text-white gap-1 text-xs">
        <CheckCircle2 className="h-3 w-3" /> बिल मेल (Match)
      </Badge>
    );
  if (status === "mismatch")
    return (
      <Badge className="bg-red-600 hover:bg-red-600 text-white gap-1 text-xs">
        <XCircle className="h-3 w-3" /> मेल छैन | फरक: रु.{fmt(Math.abs(computed - scanned))}
      </Badge>
    );
  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      <Clock className="h-3 w-3" /> बिल रुजु बाँकी
    </Badge>
  );
}

// ─── ASSET / ITEM FORM ────────────────────────────────────────────
function AssetItemForm({
  type,
  vendors,
  members,
  employees,
  events,
  allExpenses,
  initial,
  onSave,
  onClose,
  saveRecordFn,
  saveVendorFn,
  saveItemMasterFn,
  saveAssetMasterFn,
  onVendorSaved,
  fiscalYearProp,
  config,
}: {
  type: "fixed_asset" | "item";
  vendors: Vendor[];
  members: Member[];
  employees: Employee[];
  events: ClubEvent[];
  allExpenses: ExpenseRecord[];
  initial?: ExpenseRecord | undefined;
  onSave: (r: ExpenseRecord) => void;
  onClose: () => void;
  saveRecordFn: (payload: any) => Promise<ExpenseRecord>;
  saveVendorFn: (payload: any) => Promise<any>;
  saveItemMasterFn: (payload: any) => Promise<ItemMaster>;
  saveAssetMasterFn: (payload: any) => Promise<FixedAssetMaster>;
  onVendorSaved?: () => void;
  fiscalYearProp: number;
  config: AppConfig;
}) {
  const today = todayBS ? todayBS() : "";
  const [dateBs, setDateBs] = useState(initial?.date_bs ?? today);
  const [billNumber, setBillNumber] = useState(initial?.bill_number ?? "");
  const [vendorId, setVendorId] = useState(initial?.vendor_id ?? "");
  const [vendorName, setVendorName] = useState(initial?.vendor_name ?? "");
  const [linkedMember, setLinkedMember] = useState(initial?.linked_member_id ?? "");
  const [linkedEmployee, setLinkedEmployee] = useState(initial?.linked_employee_id ?? "");
  const [linkedEvent, setLinkedEvent] = useState(initial?.linked_event_id ?? "");
  const initialRows: AssetLineItem[] = (initial?.line_items as AssetLineItem[]) ?? [makeAssetRow()];
  const [rows, setRows] = useState<AssetLineItem[]>(initialRows);
  const [masterRows, setMasterRows] = useState<MasterFillRow[]>(() =>
    initialRows.map((r) => buildMasterRow(r)),
  );
  const [otherCharges, setOtherCharges] = useState(initial?.other_charges ?? 0);
  const [otherChargesDesc, setOtherChargesDesc] = useState(initial?.other_charges_desc ?? "");
  const [discount, setDiscount] = useState(initial?.discount ?? 0);
  const [discountDesc, setDiscountDesc] = useState(initial?.discount_desc ?? "");
  const [billScanned, setBillScanned] = useState(initial?.bill_scanned_amount ?? 0);
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [savingVendor, setSavingVendor] = useState(false);
  const [vendorSaved, setVendorSaved] = useState(false);
  const [isReimbursement, setIsReimbursement] = useState<boolean>(
    initial?.employee_reimbursed ?? false,
  );

  const [masterItems, setMasterItems] = useState<ItemMaster[]>([]);
  const [masterAssets, setMasterAssets] = useState<FixedAssetMaster[]>([]);

  useEffect(() => {
    try {
      const itmStr = localStorage.getItem(hamiCacheKey("hami_items_master_cache"));
      if (itmStr) setMasterItems(JSON.parse(itmStr));
      const astStr = localStorage.getItem(hamiCacheKey("hami_fixed_asset_master_cache"));
      if (astStr) setMasterAssets(JSON.parse(astStr));
    } catch {}
  }, []);

  // Masters loaded → prefill master-fill rows from matching master entries (empty fields only).
  const masterItemsRef = useRef(masterItems);
  masterItemsRef.current = masterItems;
  const masterAssetsRef = useRef(masterAssets);
  masterAssetsRef.current = masterAssets;
  useEffect(() => {
    setMasterRows((prev) =>
      prev.map((mr, i) => {
        const row = rows[i];
        if (!row || mr.parent) return mr;
        const matched =
          type === "item"
            ? matchItemMaster(row.name, row.item_code, masterItems)
            : matchAssetMaster(row.name, row.item_code, masterAssets);
        if (!matched) return mr;
        return {
          ...mr,
          parent: matched.parent ?? "",
          sub_parent: matched.sub_parent ?? "",
          uom: matched.uom || mr.uom,
          uomTouched: mr.uomTouched || !!matched.uom,
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterItems, masterAssets]);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const billInputRef = useRef<HTMLInputElement>(null);

  const existingLots = (allExpenses || [])
    .filter((e) => e.expense_type === type)
    .flatMap((e) =>
      Array.isArray(e.line_items) ? (e.line_items as AssetLineItem[]).map((r) => r.lot) : [],
    );

  function addRow() {
    const lot = generateLot(type, [...existingLots, ...rows.map((r) => r.lot)]);
    const next = [...rows, { ...makeAssetRow(), lot }];
    setRows(next);
    syncMasterRows(next);
  }
  function removeRow(i: number) {
    const next = rows.filter((_, idx) => idx !== i);
    setRows(next);
    setMasterRows((prev) => prev.filter((_, idx) => idx !== i));
  }
  function syncMasterRows(nextRows: AssetLineItem[]) {
    setMasterRows((prev) => {
      const next = nextRows.map((r, i) => {
        const old = prev[i];
        const matched =
          type === "item"
            ? matchItemMaster(r.name, r.item_code, masterItems)
            : matchAssetMaster(r.name, r.item_code, masterAssets);
        if (!old) return buildMasterRow(r, matched);
        return {
          ...old,
          parent: old.parent || matched?.parent || "",
          sub_parent: old.sub_parent || matched?.sub_parent || "",
          uom: old.uomTouched ? old.uom : matched?.uom || r.uom || "nos",
          uomTouched: old.uomTouched || !!matched?.uom,
          units: old.unitsTouched ? old.units : Number(r.qty) || 1,
        };
      });
      const changed =
        next.length !== prev.length ||
        next.some(
          (n, i) =>
            !prev[i] ||
            n.include !== prev[i].include ||
            n.parent !== prev[i].parent ||
            n.sub_parent !== prev[i].sub_parent ||
            n.uom !== prev[i].uom ||
            n.units !== prev[i].units,
        );
      return changed ? next : prev;
    });
  }
  function updateRow(i: number, key: keyof AssetLineItem, val: string | number) {
    const next = rows.map((r, idx) => {
      if (idx !== i) return r;
      const updated = { ...r, [key]: val };
      if (key === "qty" || key === "rate") {
        updated.amount =
          Math.round((Number(updated.qty) || 0) * (Number(updated.rate) || 0) * 100) / 100;
      }
      return updated;
    });
    setRows(next);
    syncMasterRows(next);
  }
  function updateMasterRow(i: number, patch: Partial<MasterFillRow>) {
    setMasterRows((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function persistMaster(kind: "item" | "asset", rec: ItemMaster | FixedAssetMaster) {
    if (kind === "item") {
      const next = upsertById(masterItemsRef.current, rec as ItemMaster);
      masterItemsRef.current = next;
      try {
        localStorage.setItem(ITEM_CACHE_KEY, JSON.stringify(next));
      } catch {}
      setMasterItems(next);
    } else {
      const next = upsertById(masterAssetsRef.current, rec as FixedAssetMaster);
      masterAssetsRef.current = next;
      try {
        localStorage.setItem(ASSET_CACHE_KEY, JSON.stringify(next));
      } catch {}
      setMasterAssets(next);
    }
  }

  const subtotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const finalAmount = subtotal + (Number(otherCharges) || 0) - (Number(discount) || 0);
  // मास्टर रकम = कुल रकम (अन्य शुल्क तथा छुट सहित) को प्रोराटा हिस्सा
  const prorata = useMemo(() => prorataShares(rows, finalAmount), [rows, otherCharges, discount]);
  const billMatchStatus =
    billScanned <= 0 ? "pending" : Math.abs(finalAmount - billScanned) < 0.5 ? "match" : "mismatch";

  // Event budget verification
  const selectedEvent = (events || []).find((ev) => ev.id === linkedEvent);
  const eventSpent = (allExpenses || [])
    .filter((x) => x.linked_event_id === linkedEvent && x.id !== initial?.id)
    .reduce((s, x) => s + (Number(x.final_amount) || 0), 0);
  const eventBudget = selectedEvent
    ? Number(selectedEvent.budget_allocated) || Number(selectedEvent.budget_required) || 0
    : 0;
  const budgetExceeded = selectedEvent && eventBudget > 0 && eventSpent + finalAmount > eventBudget;

  function pickVendor(vid: string) {
    if (vid === "none") {
      setVendorId("");
      return;
    }
    setVendorId(vid);
    const v = (vendors || []).find((v) => v.id === vid);
    if (v) setVendorName(v.name);
    setVendorSaved(false);
  }

  async function handleSaveNewVendor() {
    if (!vendorName.trim()) return;
    setSavingVendor(true);
    try {
      const saved = await saveVendorFn({ data: { name: vendorName.trim() } });
      if (saved?.id) {
        setVendorId(saved.id);
        setVendorSaved(true);
        onVendorSaved?.();
      }
    } catch (e: any) {
      alert("Vendor सेभ गर्न सकिएन: " + e.message);
    } finally {
      setSavingVendor(false);
    }
  }

  // Handle AI Bill Scan (from Camera Photo or Document File)
  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanNotice(null);
    try {
      const data = await scanBillWithAI(file, config);
      if (data.vendor_name) {
        setVendorName(data.vendor_name);
        const match = (vendors || []).find(
          (v) =>
            (data.pan_vat && v.pan_vat && v.pan_vat === data.pan_vat) ||
            v.name.toLowerCase().includes(data.vendor_name!.toLowerCase()) ||
            data.vendor_name!.toLowerCase().includes(v.name.toLowerCase()),
        );
        if (match?.id) setVendorId(match.id);
      }
      if (data.bill_number) setBillNumber(data.bill_number);
      if (data.date_bs) setDateBs(data.date_bs);
      if (data.other_charges) setOtherCharges(data.other_charges);
      if (data.other_charges_desc) setOtherChargesDesc(data.other_charges_desc);
      if (data.discount) setDiscount(data.discount);
      if (data.discount_desc) setDiscountDesc(data.discount_desc);
      if (data.total_amount) setBillScanned(data.total_amount);

      if (data.line_items && data.line_items.length > 0) {
        const newRows: AssetLineItem[] = data.line_items.map((item, idx) => ({
          item_code: item.item_code || `ITM-${String(idx + 1).padStart(3, "0")}`,
          name: item.name || "Item",
          lot: generateLot(type, [...existingLots, ...rows.slice(0, idx).map((r) => r.lot)]),
          uom: item.uom || "nos",
          qty: Number(item.qty) || 1,
          rate: Number(item.rate) || 0,
          amount: Number(item.amount) || (Number(item.qty) || 1) * (Number(item.rate) || 0),
        }));
        setRows(newRows);
        syncMasterRows(newRows);
      }
      setScanNotice(
        `AI ले बिल सफलतापूर्वक स्क्यान गर्‍यो! जम्मा रकम: रु. ${fmt(data.total_amount || 0)}`,
      );
    } catch (err: any) {
      alert("बिल स्क्यान गर्न सकिएन: " + err.message);
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    if (!dateBs.trim()) {
      alert("कृपया मिति (BS) भर्नुहोस्।");
      return;
    }
    // सेटिङको आर्थिक वर्ष भित्रको मिति मात्र स्वीकार्य
    const fyDateErr = validateDateInFiscalYear(dateBs.trim(), fiscalYearProp, "खर्च मिति");
    if (fyDateErr) {
      alert(fyDateErr);
      return;
    }

    // Same vendor + same bill number must not be saved twice.
    const billNo = billNumber.trim();
    if (billNo) {
      const dup = (allExpenses || []).find(
        (e) =>
          e.id !== initial?.id &&
          (e.bill_number ?? "").trim().toLowerCase() === billNo.toLowerCase() &&
          ((vendorId && e.vendor_id === vendorId) ||
            (!vendorId &&
              !!vendorName.trim() &&
              (e.vendor_name ?? "").trim().toLowerCase() === vendorName.trim().toLowerCase())),
      );
      if (dup) {
        alert(
          `${dup.vendor_name || vendorName} जना/विक्रेताको बिल नं. ${billNo} पहिले नै दर्ता भइसकेको छ।`,
        );
        return;
      }
    }

    // Data validation against employees, members, events
    const cleanMember = linkedMember && linkedMember !== "none" ? linkedMember : "";
    const cleanEmployee = linkedEmployee && linkedEmployee !== "none" ? linkedEmployee : "";
    const cleanEvent = linkedEvent && linkedEvent !== "none" ? linkedEvent : "";

    if (cleanMember && !(members || []).some((m) => m.id === cleanMember)) {
      alert("छानिएको सदस्य प्रणालीमा फेला परेन। कृपया मान्य सदस्य छान्नुहोस्।");
      return;
    }
    if (cleanEmployee && !(employees || []).some((e) => e.id === cleanEmployee)) {
      alert("छानिएको कर्मचारी प्रणालीमा फेला परेन। कृपया मान्य कर्मचारी छान्नुहोस्।");
      return;
    }
    if (cleanEvent && !(events || []).some((ev) => ev.id === cleanEvent)) {
      alert("छानिएको कार्यक्रम/परियोजना प्रणालीमा फेला परेन।");
      return;
    }
    if (
      rows.length === 0 ||
      !rows.some((r) => (Number(r.amount) || 0) > 0 || r.name.trim() !== "")
    ) {
      alert("कृपया कम्तिमा एउटा सामानको विवरण, दर र रकम प्रविष्ट गर्नुहोस्।");
      return;
    }

    setSaving(true);
    try {
      const finalRows = rows.map((r, i) => ({
        ...r,
        lot: r.lot || generateLot(type, [...existingLots, ...rows.slice(0, i).map((x) => x.lot)]),
      }));
      const payload = {
        ...(initial?.id && !initial.id.startsWith("local-") ? { id: initial.id } : {}),
        expense_type: type,
        date_bs: dateBs.trim(),
        bill_number: billNumber.trim(),
        vendor_id: vendorId === "none" ? "" : vendorId,
        vendor_name: vendorName.trim(),
        linked_member_id: cleanMember,
        linked_employee_id: cleanEmployee,
        employee_reimbursed: cleanEmployee ? isReimbursement : false,
        linked_event_id: cleanEvent,
        line_items: finalRows,
        other_charges: Number(otherCharges) || 0,
        other_charges_desc: otherChargesDesc,
        discount: Number(discount) || 0,
        discount_desc: discountDesc,
        subtotal,
        final_amount: finalAmount,
        bill_scanned_amount: Number(billScanned) || 0,
        bill_match_status: billMatchStatus as "match" | "mismatch" | "pending",
        remarks,
        status: "draft" as const,
      };
      const saved = await saveRecordFn(payload);
      onSave(saved);

      // मास्टर सुनिश्चित: सम्मिलित हरेक सामान item/asset master मा प्रोराटा रकम सहित सेभ
      const failures: string[] = [];
      const masterItemsNow = masterItemsRef.current;
      const masterAssetsNow = masterAssetsRef.current;
      for (let i = 0; i < finalRows.length; i++) {
        const row = finalRows[i];
        const mr = masterRows[i];
        if (!row || !mr || !mr.include) continue;
        const name = row.name.trim();
        if (!name) {
          failures.push(`लाइन ${i + 1}: सामानको नाम खाली भएकाले मास्टरमा सेभ भएन।`);
          continue;
        }
        const masterAmount =
          mr.amountOverride !== undefined && mr.amountOverride !== null
            ? Number(mr.amountOverride) || 0
            : (prorata[i] ?? 0);
        try {
          if (type === "item") {
            const existing = matchItemMaster(name, row.item_code, masterItemsNow);
            const code = (
              row.item_code.trim() ||
              existing?.item_code ||
              nextMasterCode(masterItemsNow, "ITM-")
            ).toUpperCase();
            const res = await saveItemMasterFn({
              data: {
                id: existing?.id,
                item_code: code,
                name,
                parent: mr.parent.trim(),
                sub_parent: mr.sub_parent.trim(),
                uom: mr.uom || "nos",
                units: Number(mr.units) || 1,
                amount: masterAmount,
                category: "item",
                last_rate: Number(row.rate) || 0,
                is_active: true,
              },
            });
            if (res) persistMaster("item", res);
          } else {
            const existing = matchAssetMaster(name, row.item_code, masterAssetsNow);
            const code =
              row.item_code.trim() || existing?.code || nextMasterCode(masterAssetsNow, "FA-");
            const res = await saveAssetMasterFn({
              data: {
                id: existing?.id,
                code,
                name,
                parent: mr.parent.trim(),
                sub_parent: mr.sub_parent.trim(),
                uom: mr.uom || "nos",
                units: Number(mr.units) || 1,
                amount: masterAmount,
                is_active: true,
              },
            });
            if (res) persistMaster("asset", res);
          }
        } catch (me: any) {
          failures.push(`${name}: ${me?.message || "मास्टर सेभ गर्न सकिएन।"}`);
        }
      }
      if (failures.length > 0) {
        alert(
          "खर्च रेकर्ड सेभ भयो, तर केही मास्टर रेकर्ड सेभ गर्न सकिएन:\n" +
            failures.join("\n") +
            "\nकृपया Items & Assets पानाबाट सम्बन्धित सामान फेरि सेभ गर्नुहोस्।",
        );
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── AI SCANNER BAR (Camera & File upload) ────────────────────────── */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="space-y-0.5">
          <div className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>AI बिल स्क्यानर (Agentic OCR Scanner)</span>
            <Badge
              variant="outline"
              className="text-[10px] py-0 font-mono bg-background text-primary border-primary/30"
            >
              {config.openrouter_api_key?.trim()
                ? "OpenRouter Active"
                : config.gemini_api_key?.trim()
                  ? "Gemini Active"
                  : config.openai_api_key?.trim()
                    ? "OpenAI Active"
                    : "Any Saved API"}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            बिलको फोटो खिच्नुहोस् वा कागजात अपलोड गर्नुहोस्—AI ले भेन्डर, मिति, विवरण, दर र रकम
            स्वतः भर्छ।
          </div>
        </div>

        {/* Hidden inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleScanFile}
        />
        <input
          ref={docInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleScanFile}
        />

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => cameraInputRef.current?.click()}
            disabled={scanning}
            className="gap-1.5 bg-primary"
          >
            {scanning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            <span>फोटो खिच्नुहोस् (Camera)</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => docInputRef.current?.click()}
            disabled={scanning}
            className="gap-1.5"
          >
            <Upload className="h-4 w-4" />
            <span>कागजात अपलोड (File)</span>
          </Button>
        </div>
      </div>

      {scanNotice && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-2.5 text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{scanNotice}</span>
        </div>
      )}

      {/* Header fields */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <Label>मिति (BS) *</Label>
          <BSDatePicker value={dateBs} onChange={setDateBs} />
        </div>
        <div className="grid gap-1.5">
          <Label>बिल नं.</Label>
          <Input
            value={billNumber}
            onChange={(e) => setBillNumber(e.target.value)}
            placeholder="Bill No."
          />
        </div>
        <div className="grid gap-1.5 col-span-2 md:col-span-1">
          <Label>भेन्डर (Vendor Master)</Label>
          <Select value={vendorId || "none"} onValueChange={pickVendor}>
            <SelectTrigger>
              <SelectValue placeholder="भेन्डर छान्नुस्..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— कुनै छैन / बिलबाट —</SelectItem>
              {(vendors || []).map((v) => (
                <SelectItem key={v.id} value={v.id!}>
                  {v.name} {v.pan_vat ? `(PAN: ${v.pan_vat})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(!vendorId || vendorId === "none") && (
          <div className="grid gap-1.5 col-span-2 md:col-span-3">
            <Label>भेन्डरको नाम (बिलबाट / नयाँ भेन्डर)</Label>
            <Input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Vendor name from bill (will be linked)"
            />
          </div>
        )}

        {/* New Vendor Save Prompt */}
        {vendorName.trim() && (!vendorId || vendorId === "none") && !vendorSaved && (
          <div className="col-span-2 md:col-span-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <span>
                <b>"{vendorName}"</b> — नयाँ Vendor हो। Vendor Master मा सेभ गर्ने हो?
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setVendorName("")}
              >
                रद्द
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={savingVendor}
                onClick={handleSaveNewVendor}
              >
                {savingVendor ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                Vendor Master मा सेभ
              </Button>
            </div>
          </div>
        )}
        {vendorSaved && vendorName.trim() && (
          <div className="col-span-2 md:col-span-3 rounded-xl border border-green-500/30 bg-green-500/5 p-2.5 flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              <b>"{vendorName}"</b> Vendor Master मा सफलतापूर्वक सेभ भयो!
            </span>
          </div>
        )}

        {/* ─── DATA VALIDATION: LINKED ENTITIES (MEMBERS, EMPLOYEES, EVENTS) ─── */}
        <div className="grid gap-1.5">
          <Label className="flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5 text-primary" />
            सम्बन्धित सदस्य (Member)
          </Label>
          <Select
            value={linkedMember || "none"}
            onValueChange={(v) => setLinkedMember(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="सदस्य छान्नुहोस्..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— कुनै छैन —</SelectItem>
              {(members || []).map((m) => (
                <SelectItem key={m.id} value={m.id!}>
                  {m.name} ({m.designation || "सदस्य"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            सम्बन्धित कर्मचारी (Employee)
          </Label>
          <Select
            value={linkedEmployee || "none"}
            onValueChange={(v) => {
              setLinkedEmployee(v === "none" ? "" : v);
              setIsReimbursement(false);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="कर्मचारी छान्नुहोस्..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— कुनै छैन —</SelectItem>
              {(employees || []).map((e) => (
                <SelectItem key={e.id} value={e.id!}>
                  {e.name} ({e.designation || "कर्मचारी"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ─── REIMBURSEMENT QUESTION ─── */}
        {linkedEmployee && linkedEmployee !== "none" && (
          <div className="col-span-1 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs space-y-1.5">
            <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              के यो बिल कर्मचारी रिइम्बर्समेन्ट (Reimbursement) हो?
            </p>
            <p className="text-muted-foreground text-[11px]">
              "हो" छाने बिल रकम भेन्डरको बाहक (Payable) मा जाँदैन — यो सिधा उक्त कर्मचारीको लेजरमा बाहक (Dr) भनी अंकित हुन्छ।
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={isReimbursement ? "default" : "outline"}
                onClick={() => setIsReimbursement(true)}
              >
                हो — कर्मचारीको बाहक भार
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!isReimbursement ? "default" : "outline"}
                onClick={() => setIsReimbursement(false)}
              >
                होइन — सामान्य भेन्डर बिल
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            परियोजना / कार्यक्रम (Project)
          </Label>
          <Select
            value={linkedEvent || "none"}
            onValueChange={(v) => setLinkedEvent(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="कार्यक्रम छान्नुहोस्..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— कुनै छैन —</SelectItem>
              {(events || []).map((e) => (
                <SelectItem key={e.id} value={e.id!}>
                  {e.title} ({e.locality})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Live Project Budget Validation Card */}
      {selectedEvent && (
        <div
          className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            budgetExceeded
              ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
              : "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            <span>
              <strong>{selectedEvent.title}</strong> ({selectedEvent.locality}) — कुल बजेट: रु.{" "}
              {fmt(eventBudget)} | हालसम्म खर्च: रु. {fmt(eventSpent)} | बाँकी: रु.{" "}
              {fmt(Math.max(0, eventBudget - eventSpent))}
            </span>
          </div>
          {budgetExceeded && (
            <Badge variant="destructive" className="shrink-0 text-[10px] gap-1">
              <AlertTriangle className="h-3 w-3" />
              बजेट नाघ्ने (रु. {fmt(eventSpent + finalAmount - eventBudget)})
            </Badge>
          )}
        </div>
      )}

      {/* Item Table */}
      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 text-xs">
              <TableHead className="w-[100px]">Item Code</TableHead>
              <TableHead>सामानको नाम (Name)</TableHead>
              <TableHead className="w-[80px]">Lot</TableHead>
              <TableHead className="w-[70px]">UOM</TableHead>
              <TableHead className="w-[70px] text-right">Qty</TableHead>
              <TableHead className="w-[90px] text-right">Rate</TableHead>
              <TableHead className="w-[100px] text-right">Amount</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Input
                    className="h-8 text-xs"
                    value={row.item_code}
                    onChange={(e) => updateRow(i, "item_code", e.target.value)}
                    placeholder="ITM-001"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8 text-xs"
                    list={`items-datalist-${type}`}
                    value={row.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateRow(i, "name", val);
                      if (type === "item") {
                        const found = masterItems.find(
                          (m) => m.name.toLowerCase() === val.toLowerCase(),
                        );
                        if (found) {
                          if (found.item_code) updateRow(i, "item_code", found.item_code);
                          if (found.uom) updateRow(i, "uom", found.uom);
                          if (found.amount || found.last_rate)
                            updateRow(i, "rate", Number(found.amount || found.last_rate));
                        }
                      } else {
                        const found = masterAssets.find(
                          (a) => a.name.toLowerCase() === val.toLowerCase(),
                        );
                        if (found) {
                          if (found.code) updateRow(i, "item_code", found.code);
                          if (found.uom) updateRow(i, "uom", found.uom);
                          if (found.amount) updateRow(i, "rate", Number(found.amount));
                        }
                      }
                    }}
                    placeholder="सामान छान्नुहोस् वा लेख्नुहोस्..."
                  />
                  <datalist id={`items-datalist-${type}`}>
                    {(type === "item" ? masterItems : masterAssets).map((m: any) => (
                      <option key={m.id || m.item_code || m.code} value={m.name}>
                        {m.item_code || m.code} {m.parent ? `(${m.parent})` : ""} - रु.{" "}
                        {m.amount || m.last_rate || 0}
                      </option>
                    ))}
                  </datalist>
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8 text-xs font-mono"
                    value={row.lot}
                    readOnly
                    placeholder="Auto"
                  />
                </TableCell>
                <TableCell>
                  <Select value={row.uom} onValueChange={(v) => updateRow(i, "uom", v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UOM_OPTIONS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8 text-xs text-right"
                    type="number"
                    value={row.qty}
                    onChange={(e) => updateRow(i, "qty", Number(e.target.value))}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8 text-xs text-right"
                    type="number"
                    value={row.rate}
                    onChange={(e) => updateRow(i, "rate", Number(e.target.value))}
                  />
                </TableCell>
                <TableCell className="text-right text-xs font-mono font-semibold">
                  {fmt(row.amount)}
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeRow(i)}
                    disabled={rows.length === 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button variant="outline" size="sm" onClick={addRow} className="w-fit gap-1">
        <Plus className="h-3 w-3" /> सामान लाइन थप्नुस्
      </Button>

      {/* Master-fill section: खर्च सेभ गर्दा सामान/स्थिर सम्पत्ति मास्टरमा स्वतः सुरक्षित */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="mb-2">
          <div className="text-sm font-bold flex items-center gap-1.5 text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            मास्टर भर्नुहोस् — सेभ गर्दा{" "}
            {type === "fixed_asset"
              ? "स्थिर सम्पत्ति मास्टर (Fixed Asset Master)"
              : "सामान मास्टर (Item Master)"}{" "}
            मा स्वतः सुरक्षित हुन्छ
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            कुल रकम (अन्य शुल्क तथा छुट सहित) सामानको मूल्य अनुसार <b>प्रोराटा (pro-rata)</b>{" "}
            बाँडिन्छ — भ्याट/ढुवानी जस्ता अन्य शुल्क पनि सम्पत्तिको मूल्यमा समावेश हुन्छ, छुट
            घटाइन्छ। हरेक सामान अनिवार्य मास्टरमा सेभ हुन्छ; चाहना भए रकम/विवरण मिलाउनुहोस्।
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-background text-xs">
              <TableHead className="w-[46px]">सेभ</TableHead>
              <TableHead className="w-[100px]">कोड</TableHead>
              <TableHead>सामान</TableHead>
              <TableHead className="min-w-[200px]">Parent Category</TableHead>
              <TableHead className="w-[110px]">UOM</TableHead>
              <TableHead className="w-[80px] text-right">Units</TableHead>
              <TableHead className="w-[110px] text-right">मास्टर रकम</TableHead>
              <TableHead className="w-[80px]">स्थिति</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const matched =
                type === "item"
                  ? matchItemMaster(row.name, row.item_code, masterItems)
                  : matchAssetMaster(row.name, row.item_code, masterAssets);
              const mr = masterRows[i];
              if (!mr) return null;
              return (
                <TableRow key={i}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={mr.include}
                      onChange={(e) => updateMasterRow(i, { include: e.target.checked })}
                      aria-label="मास्टरमा सेभ गर्नुहोस्"
                      className="size-3.5 accent-primary"
                    />
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {row.item_code ||
                      nextMasterCode(
                        type === "item" ? masterItems : masterAssets,
                        type === "item" ? "ITM-" : "FA-",
                      )}
                  </TableCell>
                  <TableCell className="text-xs">{row.name}</TableCell>
                  <TableCell>
                    <Select
                      value={mr.parent || "none"}
                      onValueChange={(v) => updateMasterRow(i, { parent: v === "none" ? "" : v })}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— छान्नुहोस् —</SelectItem>
                        {(type === "item" ? ITEM_PARENTS : FIXED_ASSET_PARENTS).map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mr.uom || "nos"}
                      onValueChange={(v) => updateMasterRow(i, { uom: v, uomTouched: true })}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UOM_OPTIONS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-7 text-xs text-right"
                      type="number"
                      min={0}
                      value={mr.units}
                      onChange={(e) => {
                        updateMasterRow(i, {
                          units: Number(e.target.value) || 0,
                          unitsTouched: true,
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-7 text-xs text-right font-mono"
                      type="number"
                      step="0.01"
                      value={
                        mr.amountOverride !== undefined && mr.amountOverride !== null
                          ? mr.amountOverride
                          : (prorata[i] ?? 0)
                      }
                      onChange={(e) =>
                        updateMasterRow(i, { amountOverride: Number(e.target.value) || 0 })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${
                        matched ? "" : "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {matched ? "अपडेट" : "नयाँ"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="mt-1 text-[11px] text-muted-foreground">
          प्रोराटा जम्मा: <b className="text-foreground">रु. {fmt(finalAmount)}</b> (कुल रकमसँग
          मिल्छ — गोलाइन फरक सब भन्दा ठूलो लाइनले बहन गर्छ)
        </p>
      </div>

      {/* Totals + Bill scan comparison */}
      <div className="rounded border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
        कुल रकम = सामान जम्मा <b className="text-foreground">+ अन्य शुल्क</b> (भ्याट, ढुवानी,
        लोड-अनलोड जस्ता थपिने शुल्क) <b className="text-foreground">- छुट</b> (काटिने रकम)। यही कुल
        रकम स्क्यान गरिएको बिलसँग तुलना हुन्छ।
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="अन्य शुल्क विवरण (+) — भ्याट / ढुवानी / लोड अनलोड / सेवा शुल्क"
              value={otherChargesDesc}
              onChange={(e) => setOtherChargesDesc(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="+ 0.00"
              value={otherCharges || ""}
              onChange={(e) => setOtherCharges(Number(e.target.value))}
              className="w-28 text-right"
            />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="छुट विवरण (−) — छुट / रिबेट / भत्ता समेत"
              value={discountDesc}
              onChange={(e) => setDiscountDesc(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="− 0.00"
              value={discount || ""}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-28 text-right"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>टिप्पणी (Remarks)</Label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Remarks..."
            />
          </div>
        </div>

        <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
          <div className="flex justify-between text-sm">
            <span>सामान जम्मा (Subtotal):</span>
            <span className="font-mono">रु. {fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>अन्य शुल्क (+) {otherChargesDesc ? `· ${otherChargesDesc}` : ""}:</span>
            <span className="font-mono">+ रु. {fmt(otherCharges)}</span>
          </div>
          <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
            <span>छुट (−) {discountDesc ? `· ${discountDesc}` : ""}:</span>
            <span className="font-mono">− रु. {fmt(discount)}</span>
          </div>
          <div className="flex justify-between font-bold border-t pt-2">
            <span>अन्तिम कुल रकम (Final Amount):</span>
            <span className="font-mono text-primary text-base">रु. {fmt(finalAmount)}</span>
          </div>
          <div className="border-t pt-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1 text-xs">
                <ScanLine className="h-3.5 w-3.5 text-primary" />
                स्क्यान गरिएको बिल रकम (Scanned Total)
              </Label>
              {billScanned > 0 && (
                <BillMatchBadge
                  status={billMatchStatus}
                  computed={finalAmount}
                  scanned={billScanned}
                />
              )}
            </div>
            <div className="flex gap-2">
              <Input
                ref={billInputRef}
                type="number"
                placeholder="0.00"
                value={billScanned || ""}
                onChange={(e) => setBillScanned(Number(e.target.value))}
                className="text-right font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBillScanned(finalAmount)}
                title="अन्तिम कुल रकम स्क्यान गरिएको बिल रकममा राख्नुस्"
              >
                = अन्तिम रकम
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
                title="क्यामेराबाट खिच्नुस्"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onClose}>
          रद्द
        </Button>
        <Button onClick={handleSave} disabled={saving || !dateBs}>
          {saving ? "सुरक्षित हुँदैछ..." : "खर्च सुरक्षित गर्नुस्"}
        </Button>
      </div>
    </div>
  );
}

// ─── OPEX EXPENSE FORM ────────────────────────────────────────────
function OpExForm({
  vendors,
  members,
  employees,
  events,
  allExpenses,
  initial,
  onSave,
  onClose,
  saveRecordFn,
  saveVendorFn,
  onVendorSaved,
  fiscalYearProp,
  config,
}: {
  vendors: Vendor[];
  members: Member[];
  employees: Employee[];
  events: ClubEvent[];
  allExpenses: ExpenseRecord[];
  initial?: ExpenseRecord | undefined;
  onSave: (r: ExpenseRecord) => void;
  onClose: () => void;
  saveRecordFn: (payload: any) => Promise<ExpenseRecord>;
  saveVendorFn: (payload: any) => Promise<any>;
  onVendorSaved?: () => void;
  fiscalYearProp: number;
  config: AppConfig;
}) {
  const today = todayBS ? todayBS() : "";
  const [dateBs, setDateBs] = useState(initial?.date_bs ?? today);
  const [billNumber, setBillNumber] = useState(initial?.bill_number ?? "");
  const [vendorId, setVendorId] = useState(initial?.vendor_id ?? "");
  const [vendorName, setVendorName] = useState(initial?.vendor_name ?? "");
  const [linkedMember, setLinkedMember] = useState(initial?.linked_member_id ?? "");
  const [linkedEmployee, setLinkedEmployee] = useState(initial?.linked_employee_id ?? "");
  const [linkedEvent, setLinkedEvent] = useState(initial?.linked_event_id ?? "");
  const [rows, setRows] = useState<ExpenseLineItem[]>(
    (initial?.line_items as ExpenseLineItem[]) ?? [makeExpenseRow()],
  );
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");
  const [discount, setDiscount] = useState(initial?.discount ?? 0);
  const [discountDesc, setDiscountDesc] = useState(initial?.discount_desc ?? "");
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [savingVendor, setSavingVendor] = useState(false);
  const [vendorSaved, setVendorSaved] = useState(false);
  const [isReimbursement, setIsReimbursement] = useState<boolean>(
    initial?.employee_reimbursed ?? false,
  );

  const [masterItems, setMasterItems] = useState<ItemMaster[]>([]);
  const [masterAssets, setMasterAssets] = useState<FixedAssetMaster[]>([]);

  useEffect(() => {
    try {
      const itmStr = localStorage.getItem(hamiCacheKey("hami_items_master_cache"));
      if (itmStr) setMasterItems(JSON.parse(itmStr));
      const astStr = localStorage.getItem(hamiCacheKey("hami_fixed_asset_master_cache"));
      if (astStr) setMasterAssets(JSON.parse(astStr));
    } catch {}
  }, []);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  function addRow() {
    setRows((prev) => [...prev, makeExpenseRow()]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, key: keyof ExpenseLineItem, val: string | number | boolean) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const updated: ExpenseLineItem = { ...r, [key]: val };
        if (key === "qty" || key === "rate") {
          updated.amount =
            Math.round((Number(updated.qty) || 0) * (Number(updated.rate) || 0) * 100) / 100;
        }
        if (key === "amount" || key === "tds_rate" || key === "tds_applicable") {
          const amt = Number(updated.amount) || 0;
          const tdsR = updated.tds_applicable ? Number(updated.tds_rate) || 0 : 0;
          updated.tds_amount = Math.round(((amt * tdsR) / 100) * 100) / 100;
          updated.net_amount = Math.round((amt - updated.tds_amount) * 100) / 100;
        }
        return updated;
      }),
    );
  }

  const total = rows.reduce((s, r) => s + (Number(r.net_amount) || 0), 0);
  const finalAmount = total - (Number(discount) || 0);

  // Event budget verification
  const selectedEvent = (events || []).find((ev) => ev.id === linkedEvent);
  const eventSpent = (allExpenses || [])
    .filter((x) => x.linked_event_id === linkedEvent && x.id !== initial?.id)
    .reduce((s, x) => s + (Number(x.final_amount) || 0), 0);
  const eventBudget = selectedEvent
    ? Number(selectedEvent.budget_allocated) || Number(selectedEvent.budget_required) || 0
    : 0;
  const budgetExceeded = selectedEvent && eventBudget > 0 && eventSpent + finalAmount > eventBudget;

  function pickVendor(vid: string) {
    if (vid === "none") {
      setVendorId("");
      return;
    }
    setVendorId(vid);
    const v = (vendors || []).find((v) => v.id === vid);
    if (v) setVendorName(v.name);
    setVendorSaved(false);
  }

  async function handleSaveNewVendor() {
    if (!vendorName.trim()) return;
    setSavingVendor(true);
    try {
      const saved = await saveVendorFn({ data: { name: vendorName.trim() } });
      if (saved?.id) {
        setVendorId(saved.id);
        setVendorSaved(true);
        onVendorSaved?.();
      }
    } catch (e: any) {
      alert("Vendor सेभ गर्न सकिएन: " + e.message);
    } finally {
      setSavingVendor(false);
    }
  }

  // Handle AI Scan
  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanNotice(null);
    try {
      const data = await scanBillWithAI(file, config);
      if (data.vendor_name) {
        setVendorName(data.vendor_name);
        const match = (vendors || []).find(
          (v) =>
            (data.pan_vat && v.pan_vat && v.pan_vat === data.pan_vat) ||
            v.name.toLowerCase().includes(data.vendor_name!.toLowerCase()) ||
            data.vendor_name!.toLowerCase().includes(v.name.toLowerCase()),
        );
        if (match?.id) setVendorId(match.id);
      }
      if (data.bill_number) setBillNumber(data.bill_number);
      if (data.date_bs) setDateBs(data.date_bs);

      if (data.line_items && data.line_items.length > 0) {
        const newRows: ExpenseLineItem[] = data.line_items.map((item) => ({
          description: item.name || "Expense Item",
          uom: item.uom || "nos",
          qty: Number(item.qty) || 1,
          rate: Number(item.rate) || 0,
          amount: Number(item.amount) || (Number(item.qty) || 1) * (Number(item.rate) || 0),
          tds_applicable: false,
          tds_rate: 0,
          tds_amount: 0,
          net_amount: Number(item.amount) || 0,
        }));
        setRows(newRows);
      }
      setScanNotice(
        `AI ले बिल सफलतापूर्वक स्क्यान गर्‍यो! जम्मा: रु. ${fmt(data.total_amount || 0)}`,
      );
    } catch (err: any) {
      alert("बिल स्क्यान गर्न सकिएन: " + err.message);
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    if (!dateBs.trim()) {
      alert("कृपया मिति (BS) भर्नुहोस्।");
      return;
    }
    // सेटिङको आर्थिक वर्ष भित्रको मिति मात्र स्वीकार्य
    const fyDateErr = validateDateInFiscalYear(dateBs.trim(), fiscalYearProp, "खर्च मिति");
    if (fyDateErr) {
      alert(fyDateErr);
      return;
    }

    // Same vendor + same bill number must not be saved twice.
    const billNo = billNumber.trim();
    if (billNo) {
      const dup = (allExpenses || []).find(
        (e) =>
          e.id !== initial?.id &&
          (e.bill_number ?? "").trim().toLowerCase() === billNo.toLowerCase() &&
          ((vendorId && e.vendor_id === vendorId) ||
            (!vendorId &&
              !!vendorName.trim() &&
              (e.vendor_name ?? "").trim().toLowerCase() === vendorName.trim().toLowerCase())),
      );
      if (dup) {
        alert(
          `${dup.vendor_name || vendorName} जना/विक्रेताको बिल नं. ${billNo} पहिले नै दर्ता भइसकेको छ।`,
        );
        return;
      }
    }

    const cleanMember = linkedMember && linkedMember !== "none" ? linkedMember : "";
    const cleanEmployee = linkedEmployee && linkedEmployee !== "none" ? linkedEmployee : "";
    const cleanEvent = linkedEvent && linkedEvent !== "none" ? linkedEvent : "";

    if (cleanMember && !(members || []).some((m) => m.id === cleanMember)) {
      alert("छानिएको सदस्य प्रणालीमा फेला परेन।");
      return;
    }
    if (cleanEmployee && !(employees || []).some((e) => e.id === cleanEmployee)) {
      alert("छानिएको कर्मचारी प्रणालीमा फेला परेन।");
      return;
    }
    if (cleanEvent && !(events || []).some((ev) => ev.id === cleanEvent)) {
      alert("छानिएको कार्यक्रम प्रणालीमा फेला परेन।");
      return;
    }
    if (
      rows.length === 0 ||
      !rows.some((r) => (Number(r.amount) || 0) > 0 || r.description.trim() !== "")
    ) {
      alert("कृपया कम्तिमा एउटा खर्चको विवरण र रकम प्रविष्ट गर्नुहोस्।");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(initial?.id && !initial.id.startsWith("local-") ? { id: initial.id } : {}),
        expense_type: "expense" as const,
        date_bs: dateBs.trim(),
        bill_number: billNumber.trim(),
        vendor_id: vendorId === "none" ? "" : vendorId,
        vendor_name: vendorName.trim(),
        linked_member_id: cleanMember,
        linked_employee_id: cleanEmployee,
        employee_reimbursed: cleanEmployee ? isReimbursement : false,
        linked_event_id: cleanEvent,
        line_items: rows,
        subtotal: total,
        discount: Number(discount) || 0,
        discount_desc: discountDesc,
        final_amount: finalAmount,
        remarks,
        status: "draft" as const,
      };
      const saved = await saveRecordFn(payload);
      onSave(saved);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── AI SCANNER BAR ────────────────────────── */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Sparkles className="h-4 w-4 text-amber-500" />
              AI बिल स्क्यानर (OpEx OCR Scanner)
            </div>
            <Badge
              variant="outline"
              className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30 text-[10px] py-0 px-2 font-mono gap-1"
            >
              <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
              AI Vault:{" "}
              {config.openrouter_api_key
                ? "OpenRouter"
                : config.gemini_api_key
                  ? "Gemini"
                  : "Active"}{" "}
              ({(config.openrouter_model || config.gemini_model || "ready").split("/").pop()})
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            बिलको फोटो खिच्नुहोस् वा कागजात अपलोड गर्नुहोस्—AI ले भेन्डर, विवरण र दर स्वतः भर्छ।
          </div>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleScanFile}
        />
        <input
          ref={docInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleScanFile}
        />

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => cameraInputRef.current?.click()}
            disabled={scanning}
            className="gap-1.5 bg-primary"
          >
            {scanning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            <span>फोटो खिच्नुहोस् (Camera)</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => docInputRef.current?.click()}
            disabled={scanning}
            className="gap-1.5"
          >
            <Upload className="h-4 w-4" />
            <span>कागजात अपलोड (File)</span>
          </Button>
        </div>
      </div>

      {scanNotice && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-2.5 text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{scanNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <Label>मिति (BS) *</Label>
          <BSDatePicker value={dateBs} onChange={setDateBs} />
        </div>
        <div className="grid gap-1.5">
          <Label>बिल नं.</Label>
          <Input
            value={billNumber}
            onChange={(e) => setBillNumber(e.target.value)}
            placeholder="Bill No."
          />
        </div>
        <div className="grid gap-1.5">
          <Label>भेन्डर</Label>
          <Select value={vendorId || "none"} onValueChange={pickVendor}>
            <SelectTrigger>
              <SelectValue placeholder="भेन्डर..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— कुनै छैन / बिलबाट —</SelectItem>
              {(vendors || []).map((v) => (
                <SelectItem key={v.id} value={v.id!}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(!vendorId || vendorId === "none") && (
          <div className="grid gap-1.5 col-span-2 md:col-span-3">
            <Label>भेन्डरको नाम (बिलबाट / नयाँ भेन्डर)</Label>
            <Input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Vendor name from bill..."
            />
          </div>
        )}

        {/* New Vendor Save Prompt */}
        {vendorName.trim() && (!vendorId || vendorId === "none") && !vendorSaved && (
          <div className="col-span-2 md:col-span-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <span>
                <b>"{vendorName}"</b> — नयाँ Vendor हो। Vendor Master मा सेभ गर्ने हो?
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setVendorName("")}
              >
                रद्द
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={savingVendor}
                onClick={handleSaveNewVendor}
              >
                {savingVendor ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                Vendor Master मा सेभ
              </Button>
            </div>
          </div>
        )}
        {vendorSaved && vendorName.trim() && (
          <div className="col-span-2 md:col-span-3 rounded-xl border border-green-500/30 bg-green-500/5 p-2.5 flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              <b>"{vendorName}"</b> Vendor Master मा सफलतापूर्वक सेभ भयो!
            </span>
          </div>
        )}

        {/* Linked entities */}
        <div className="grid gap-1.5">
          <Label className="flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5 text-primary" />
            सम्बन्धित सदस्य (Member)
          </Label>
          <Select
            value={linkedMember || "none"}
            onValueChange={(v) => setLinkedMember(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="सदस्य..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— कुनै छैन —</SelectItem>
              {(members || []).map((m) => (
                <SelectItem key={m.id} value={m.id!}>
                  {m.name} ({m.designation || "सदस्य"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            सम्बन्धित कर्मचारी (Employee)
          </Label>
          <Select
            value={linkedEmployee || "none"}
            onValueChange={(v) => {
              setLinkedEmployee(v === "none" ? "" : v);
              setIsReimbursement(false);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="कर्मचारी..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— कुनै छैन —</SelectItem>
              {(employees || []).map((e) => (
                <SelectItem key={e.id} value={e.id!}>
                  {e.name} ({e.designation || "कर्मचारी"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ─── REIMBURSEMENT QUESTION ─── */}
        {linkedEmployee && linkedEmployee !== "none" && (
          <div className="col-span-1 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs space-y-1.5">
            <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              के यो बिल कर्मचारी रिइम्बर्समेन्ट (Reimbursement) हो?
            </p>
            <p className="text-muted-foreground text-[11px]">
              "हो" छाने बिल रकम भेन्डरको बाहक (Payable) मा जाँदैन — यो सिधा उक्त कर्मचारीको लेजरमा बाहक (Dr) भनी अंकित हुन्छ।
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={isReimbursement ? "default" : "outline"}
                onClick={() => setIsReimbursement(true)}
              >
                हो — कर्मचारीको बाहक भार
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!isReimbursement ? "default" : "outline"}
                onClick={() => setIsReimbursement(false)}
              >
                होइन — सामान्य भेन्डर बिल
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            कार्यक्रम / परियोजना (Project)
          </Label>
          <Select
            value={linkedEvent || "none"}
            onValueChange={(v) => setLinkedEvent(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="कार्यक्रम..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— कुनै छैन —</SelectItem>
              {(events || []).map((e) => (
                <SelectItem key={e.id} value={e.id!}>
                  {e.title} ({e.locality})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Live Event Budget Validation Card */}
      {selectedEvent && (
        <div
          className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            budgetExceeded
              ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
              : "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            <span>
              <strong>{selectedEvent.title}</strong> ({selectedEvent.locality}) — कुल बजेट: रु.{" "}
              {fmt(eventBudget)} | हालसम्म खर्च: रु. {fmt(eventSpent)} | बाँकी: रु.{" "}
              {fmt(Math.max(0, eventBudget - eventSpent))}
            </span>
          </div>
          {budgetExceeded && (
            <Badge variant="destructive" className="shrink-0 text-[10px] gap-1">
              <AlertTriangle className="h-3 w-3" />
              बजेट नाघ्ने (रु. {fmt(eventSpent + finalAmount - eventBudget)})
            </Badge>
          )}
        </div>
      )}

      {/* Expense table */}
      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 text-xs">
              <TableHead>विवरण (Description)</TableHead>
              <TableHead className="w-[70px]">UOM</TableHead>
              <TableHead className="w-[70px] text-right">Qty</TableHead>
              <TableHead className="w-[90px] text-right">Rate</TableHead>
              <TableHead className="w-[100px] text-right">Amount</TableHead>
              <TableHead className="w-[55px] text-center">TDS?</TableHead>
              <TableHead className="w-[70px] text-right">TDS%</TableHead>
              <TableHead className="w-[90px] text-right">TDS Amt</TableHead>
              <TableHead className="w-[100px] text-right">Net Amount</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Input
                    className="h-8 text-xs"
                    value={row.description}
                    onChange={(e) => updateRow(i, "description", e.target.value)}
                    placeholder="Description..."
                  />
                </TableCell>
                <TableCell>
                  <Select value={row.uom} onValueChange={(v) => updateRow(i, "uom", v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UOM_OPTIONS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8 text-xs text-right"
                    type="number"
                    value={row.qty}
                    onChange={(e) => updateRow(i, "qty", Number(e.target.value))}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8 text-xs text-right"
                    type="number"
                    value={row.rate}
                    onChange={(e) => updateRow(i, "rate", Number(e.target.value))}
                  />
                </TableCell>
                <TableCell className="text-right text-xs font-mono">{fmt(row.amount)}</TableCell>
                <TableCell className="text-center">
                  <input
                    type="checkbox"
                    checked={row.tds_applicable}
                    onChange={(e) => updateRow(i, "tds_applicable", e.target.checked)}
                    className="h-4 w-4"
                  />
                </TableCell>
                <TableCell>
                  {row.tds_applicable ? (
                    <Input
                      className="h-8 text-xs text-right"
                      type="number"
                      value={row.tds_rate}
                      onChange={(e) => updateRow(i, "tds_rate", Number(e.target.value))}
                      placeholder="%"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs font-mono text-orange-600">
                  {row.tds_applicable ? fmt(row.tds_amount) : "—"}
                </TableCell>
                <TableCell className="text-right text-xs font-mono font-bold text-primary">
                  {fmt(row.net_amount || row.amount)}
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeRow(i)}
                    disabled={rows.length === 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
          <Plus className="h-3 w-3" /> लाइन थप्नुस्
        </Button>
        <div className="text-right space-y-1">
          <div className="text-sm text-muted-foreground">TDS कटाएपछि जम्मा:</div>
          <div className="text-xl font-bold text-primary font-mono">रु. {fmt(total)}</div>
        </div>
      </div>

      {/* Discount & Adjustments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">छुट / रिबेट (Discount / Rebate)</Label>
          <div className="flex gap-2">
            <Input
              placeholder="छुट विवरण (Discount / Rebate)"
              value={discountDesc}
              onChange={(e) => setDiscountDesc(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="0.00"
              value={discount || ""}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-28 text-right font-mono"
            />
          </div>
        </div>
        <div className="rounded-lg border p-3 space-y-2 bg-muted/30 flex flex-col justify-center">
          <div className="flex justify-between text-sm">
            <span>खर्च जम्मा (Subtotal):</span>
            <span className="font-mono">रु. {fmt(total)}</span>
          </div>
          {(Number(discount) || 0) > 0 && (
            <div className="flex justify-between text-sm text-orange-600 dark:text-orange-400">
              <span>छुट (Discount) (−):</span>
              <span className="font-mono">− रु. {fmt(discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t pt-2">
            <span>अन्तिम कुल रकम (Final Amount):</span>
            <span className="font-mono text-primary text-base">रु. {fmt(finalAmount)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>टिप्पणी (Remarks)</Label>
        <Input
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Remarks..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onClose}>
          रद्द
        </Button>
        <Button onClick={handleSave} disabled={saving || !dateBs}>
          {saving ? "सुरक्षित..." : "सुरक्षित गर्नुस्"}
        </Button>
      </div>
    </div>
  );
}

// ─── EXPENSE LIST TABLE WITH DATA VALIDATION BADGES ────────────────
function ExpenseListTable({
  records,
  type,
  members,
  employees,
  events,
  onEdit,
  onDelete,
}: {
  records: ExpenseRecord[];
  type: "fixed_asset" | "item" | "expense";
  members: Member[];
  employees: Employee[];
  events: ClubEvent[];
  onEdit: (r: ExpenseRecord) => void;
  onDelete: (r: ExpenseRecord) => void;
}) {
  const filtered = (records || []).filter((r) => r.expense_type === type);
  const typeLabel =
    type === "fixed_asset" ? "स्थायी सम्पत्ति" : type === "item" ? "सामान/वस्तु" : "खर्च";

  return (
    <div className="rounded-xl border overflow-auto shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 text-xs">
            <TableHead>मिति (BS)</TableHead>
            <TableHead>बिल नं.</TableHead>
            <TableHead>भेन्डर (Vendor)</TableHead>
            <TableHead>सम्बन्धित लिङ्क (Member/Emp/Project)</TableHead>
            {type !== "expense" && <TableHead>Items</TableHead>}
            <TableHead className="text-right">जम्मा (Total)</TableHead>
            {type !== "expense" && <TableHead>बिल रुजु</TableHead>}
            <TableHead>स्थिति</TableHead>
            <TableHead className="text-center">कार्यहरू</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                कुनै {typeLabel} फेला परेन। नयाँ थप्नुस् वा बिल स्क्यान गर्नुस्।
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((r) => {
              const matchedMember = (members || []).find((m) => m.id === r.linked_member_id);
              const matchedEmployee = (employees || []).find((e) => e.id === r.linked_employee_id);
              const matchedEvent = (events || []).find((e) => e.id === r.linked_event_id);

              return (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs">{r.date_bs}</TableCell>
                  <TableCell className="text-xs font-mono">{r.bill_number || "—"}</TableCell>
                  <TableCell className="max-w-[120px] truncate text-xs font-medium">
                    {r.vendor_name || "—"}
                  </TableCell>

                  {/* Validated Entity Badges */}
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-1">
                      {matchedMember && (
                        <Badge
                          variant="outline"
                          className="text-[11px] py-0 gap-1 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                        >
                          <UserCheck className="h-3 w-3" />
                          {matchedMember.name}
                        </Badge>
                      )}
                      {matchedEmployee && (
                        <Badge
                          variant="outline"
                          className="text-[11px] py-0 gap-1 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                        >
                          <Users className="h-3 w-3" />
                          {matchedEmployee.name}
                        </Badge>
                      )}
                      {matchedEvent && (
                        <Badge
                          variant="outline"
                          className="text-[11px] py-0 gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        >
                          <CalendarDays className="h-3 w-3" />
                          {matchedEvent.title}
                        </Badge>
                      )}
                      {!matchedMember && !matchedEmployee && !matchedEvent && (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </div>
                  </TableCell>

                  {type !== "expense" && (
                    <TableCell className="text-xs text-muted-foreground">
                      {np((Array.isArray(r.line_items) ? r.line_items : []).length)} items
                    </TableCell>
                  )}

                  <TableCell className="text-right font-mono font-semibold text-primary">
                    रु. {fmt(r.final_amount)}
                  </TableCell>

                  {type !== "expense" && (
                    <TableCell>
                      <BillMatchBadge
                        status={r.bill_match_status ?? "pending"}
                        computed={r.final_amount}
                        scanned={r.bill_scanned_amount ?? 0}
                      />
                    </TableCell>
                  )}

                  <TableCell>
                    <Badge
                      variant={r.status === "approved" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {r.status === "approved" ? "अनुमोदित" : "Draft"}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => onEdit(r)} title="सम्पादन">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(r)}
                        title="हटाउनुस्"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────
function ExpensesPage() {
  const app = useAppState();
  const config = useAppConfig();

  const fetchExpensesFn = useServerFn(getExpensesData);
  const saveExpenseFn = useServerFn(saveExpenseRecord);
  const deleteExpenseFn = useServerFn(deleteExpenseRecord);
  const fetchVendorsFn = useServerFn(getVendorsData);
  const saveVendorFn = useServerFn(saveVendor);
  const saveItemMasterFn = useServerFn(saveItemMaster);
  const saveAssetMasterFn = useServerFn(saveFixedAssetMaster);
  const fetchMembersFn = useServerFn(getMembersData);
  const fetchEmployeesFn = useServerFn(getEmployeesData);
  const fetchEventsFn = useServerFn(getEventsData);

  const [tab, setTab] = useState("fixed_asset");
  const [records, setRecords] = useState<ExpenseRecord[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(hamiCacheKey("hami_expenses_cache"));
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ExpenseRecord | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRecord | null>(null);

  useEffect(() => {
    if (app.signedIn) {
      loadAll();
    } else {
      setLoading(false);
    }
  }, [app.signedIn]);

  async function loadAll() {
    if (!app.signedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [recs, vens, mems, emps, evts] = await Promise.allSettled([
        fetchExpensesFn({ data: {} }),
        fetchVendorsFn(),
        fetchMembersFn(),
        fetchEmployeesFn(),
        fetchEventsFn(),
      ]);

      if (recs.status === "fulfilled" && Array.isArray(recs.value)) {
        setRecords(recs.value);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(hamiCacheKey("hami_expenses_cache"), JSON.stringify(recs.value));
          } catch {}
        }
      }
      if (vens.status === "fulfilled" && Array.isArray(vens.value)) {
        setVendors(vens.value);
      }
      if (mems.status === "fulfilled") {
        const d = mems.value as any;
        setMembers(Array.isArray(d) ? d : d?.members || []);
      }
      if (emps.status === "fulfilled" && Array.isArray(emps.value)) {
        setEmployees(emps.value);
      }
      if (evts.status === "fulfilled") {
        const d = evts.value as any;
        setEvents(Array.isArray(d) ? d : d?.events || []);
      }
    } catch {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(hamiCacheKey("hami_expenses_cache"));
        if (cached) {
          try {
            setRecords(JSON.parse(cached));
          } catch {}
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVendorSaved() {
    try {
      const vens = await fetchVendorsFn();
      if (Array.isArray(vens)) {
        setVendors(vens);
      }
    } catch {}
  }

  function openAdd() {
    setEditingRecord(undefined);
    setShowForm(true);
  }
  function openEdit(r: ExpenseRecord) {
    setEditingRecord(r);
    setShowForm(true);
  }

  async function handleSaveRecord(payload: any): Promise<ExpenseRecord> {
    const saved = await saveExpenseFn({ data: payload });
    return saved;
  }

  function handleSaved(r: ExpenseRecord) {
    setRecords((prev) => {
      let updated: ExpenseRecord[];
      if (editingRecord?.id) {
        updated = prev.map((x) => (x.id === r.id ? r : x));
      } else {
        updated = [r, ...prev];
      }
      try {
        localStorage.setItem(hamiCacheKey("hami_expenses_cache"), JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setShowForm(false);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    try {
      await deleteExpenseFn({ data: { id: deleteTarget.id } });
      setRecords((prev) => {
        const updated = prev.filter((r) => r.id !== deleteTarget.id);
        try {
          localStorage.setItem(hamiCacheKey("hami_expenses_cache"), JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setDeleteTarget(null);
    }
  }

  const tabLabel =
    tab === "fixed_asset" ? "स्थायी सम्पत्ति" : tab === "item" ? "सामान/वस्तु" : "खर्च (OpEx)";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            खर्च व्यवस्थापन तथा AI बिल स्क्यानर (Expenses)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            जम्मा: {np((records || []).length)} रेकर्डहरू • Fixed Assets:{" "}
            {np((records || []).filter((r) => r.expense_type === "fixed_asset").length)} • Items:{" "}
            {np((records || []).filter((r) => r.expense_type === "item").length)} • OpEx:{" "}
            {np((records || []).filter((r) => r.expense_type === "expense").length)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="outline" size="sm" className="gap-1.5" title="AI र संस्था सेटिङ">
              <Settings className="h-4 w-4" />
              <span>AI सेटिङ</span>
            </Button>
          </Link>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" /> नयाँ {tabLabel} थप्नुस्
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="fixed_asset" className="gap-1">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">स्थायी सम्पत्ति (Fixed Assets)</span>
            <span className="sm:hidden">Assets</span>
          </TabsTrigger>
          <TabsTrigger value="item" className="gap-1">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">सामान/वस्तु (Items)</span>
            <span className="sm:hidden">Items</span>
          </TabsTrigger>
          <TabsTrigger value="expense" className="gap-1">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">खर्च (OpEx)</span>
            <span className="sm:hidden">OpEx</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fixed_asset" className="mt-4">
          <ExpenseListTable
            records={records}
            type="fixed_asset"
            members={members}
            employees={employees}
            events={events}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        </TabsContent>
        <TabsContent value="item" className="mt-4">
          <ExpenseListTable
            records={records}
            type="item"
            members={members}
            employees={employees}
            events={events}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        </TabsContent>
        <TabsContent value="expense" className="mt-4">
          <ExpenseListTable
            records={records}
            type="expense"
            members={members}
            employees={employees}
            events={events}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecord
                ? "खर्च सम्पादन"
                : `नयाँ ${tabLabel} थप्नुस् (वा बिल स्क्यान गर्नुहोस्)`}
            </DialogTitle>
          </DialogHeader>
          {tab === "expense" ? (
            <OpExForm
              vendors={vendors}
              members={members}
              employees={employees}
              events={events}
              allExpenses={records}
              initial={editingRecord}
              onSave={handleSaved}
              onClose={() => setShowForm(false)}
              saveRecordFn={handleSaveRecord}
              saveVendorFn={async (payload: any) => saveVendorFn(payload)}
              fiscalYearProp={app.year}
              onVendorSaved={handleVendorSaved}
              config={config}
            />
          ) : (
            <AssetItemForm
              type={tab as "fixed_asset" | "item"}
              vendors={vendors}
              members={members}
              employees={employees}
              events={events}
              allExpenses={records}
              initial={editingRecord}
              onSave={handleSaved}
              onClose={() => setShowForm(false)}
              saveRecordFn={handleSaveRecord}
              saveVendorFn={async (payload: any) => saveVendorFn(payload)}
              saveItemMasterFn={async (payload: any) => saveItemMasterFn(payload)}
              saveAssetMasterFn={async (payload: any) => saveAssetMasterFn(payload)}
              fiscalYearProp={app.year}
              onVendorSaved={handleVendorSaved}
              config={config}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>रेकर्ड हटाउनुस्?</AlertDialogTitle>
            <AlertDialogDescription>
              मिति <strong>{deleteTarget?.date_bs}</strong> को रेकर्ड स्थायी रूपमा हटाइनेछ।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>रद्द</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              हटाउनुस्
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
