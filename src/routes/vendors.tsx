import { hamiCacheKey } from "@/lib/hami-cache";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAppState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, Pencil, Trash2, BookOpen, Building2, ArrowUpDown, Search } from "lucide-react";
import { np } from "@/lib/receipt-rules";
import type { Vendor, VendorLedgerEntry } from "@/lib/receipt-rules";
import {
  getVendorsData,
  saveVendor,
  deleteVendor,
  getVendorLedger,
} from "@/lib/workspace.functions";

export const Route = createFileRoute("/vendors")({
  component: VendorsPage,
});

const EMPTY_VENDOR: Vendor = {
  name: "",
  address: "",
  pan_vat: "",
  phone: "",
  email: "",
  due_days: 30,
  opening_balance: 0,
  balance_type: "cr",
  is_active: true,
};

function fmt(n: number) {
  return n.toLocaleString("ne-NP", { minimumFractionDigits: 2 });
}

function VendorsPage() {
  const state = useAppState();
  const fetchVendorsFn = useServerFn(getVendorsData);
  const saveVendorFn = useServerFn(saveVendor);
  const deleteVendorFn = useServerFn(deleteVendor);
  const getVendorLedgerFn = useServerFn(getVendorLedger);

  const [vendors, setVendors] = useState<Vendor[]>(() => {
    try {
      const cached = localStorage.getItem(hamiCacheKey("hami_vendors_cache"));
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState<Vendor>({ ...EMPTY_VENDOR });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

  // Ledger
  const [ledgerVendor, setLedgerVendor] = useState<Vendor | null>(null);
  const [ledger, setLedger] = useState<VendorLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  useEffect(() => {
    loadVendors();
  }, []);

  async function loadVendors() {
    setLoading(true);
    try {
      const data = await fetchVendorsFn();
      if (Array.isArray(data)) {
        setVendors(data);
        try {
          localStorage.setItem(hamiCacheKey("hami_vendors_cache"), JSON.stringify(data));
        } catch {}
      }
    } catch {
      const cached = localStorage.getItem(hamiCacheKey("hami_vendors_cache"));
      if (cached) {
        try {
          setVendors(JSON.parse(cached));
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  }

  async function openLedger(v: Vendor) {
    setLedgerVendor(v);
    setLedger([]);
    setLedgerLoading(true);
    try {
      const data = await getVendorLedgerFn({ data: { vendor_id: v.id! } });
      setLedger(Array.isArray(data) ? data : []);
    } catch {
      setLedger([]);
    } finally {
      setLedgerLoading(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_VENDOR });
    setShowModal(true);
  }

  function openEdit(v: Vendor) {
    setEditing(v);
    setForm({ ...v });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const saved = await saveVendorFn({
        data: {
          ...(editing?.id ? { id: editing.id } : {}),
          name: form.name.trim(),
          address: form.address ?? "",
          pan_vat: form.pan_vat ?? "",
          phone: form.phone ?? "",
          email: form.email ?? "",
          due_days: Number(form.due_days) || 30,
          opening_balance: Number(form.opening_balance) || 0,
          balance_type: (form.balance_type as "dr" | "cr") ?? "cr",
          is_active: form.is_active !== false,
        },
      });
      setVendors((prev) => {
        let updated: Vendor[];
        if (editing?.id) {
          updated = prev.map((v) => (v.id === editing.id ? saved : v));
        } else {
          updated = [...prev, saved];
        }
        try {
          localStorage.setItem(hamiCacheKey("hami_vendors_cache"), JSON.stringify(updated));
        } catch {}
        return updated;
      });
      setShowModal(false);
    } catch (e: any) {
      alert("Error saving vendor: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    try {
      await deleteVendorFn({ data: { id: deleteTarget.id } });
      setVendors((prev) => {
        const updated = prev.filter((v) => v.id !== deleteTarget.id);
        try {
          localStorage.setItem(hamiCacheKey("hami_vendors_cache"), JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } catch (e: any) {
      alert("Error deleting: " + e.message);
    } finally {
      setDeleteTarget(null);
    }
  }

  const filtered = vendors.filter(
    (v) =>
      !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.pan_vat ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (v.phone ?? "").includes(search)
  );

  // Running balance for ledger (opening balance + entries)
  function computeLedgerWithBalance(entries: VendorLedgerEntry[], vendor: Vendor) {
    let bal = vendor.opening_balance ?? 0;
    const balType = vendor.balance_type ?? "cr";
    // Opening balance entry
    const rows: (VendorLedgerEntry & { running: number; runType: string })[] = [];
    // Add opening
    rows.push({
      id: "opening",
      vendor_id: vendor.id!,
      date_bs: "-",
      description: "प्रारम्भिक शेष (Opening Balance)",
      dr: balType === "dr" ? bal : 0,
      cr: balType === "cr" ? bal : 0,
      balance: bal,
      running: bal,
      runType: balType,
    });
    let running = balType === "dr" ? bal : -bal; // positive = dr balance
    for (const e of entries) {
      running = running + (e.dr ?? 0) - (e.cr ?? 0);
      rows.push({
        ...e,
        running: Math.abs(running),
        runType: running >= 0 ? "dr" : "cr",
      });
    }
    return rows;
  }

  const ledgerRows = ledgerVendor
    ? computeLedgerWithBalance(ledger, ledgerVendor)
    : [];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            भेन्डर मास्टर (Vendor Master)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {np(vendors.length)} भेन्डरहरू • Active: {np(vendors.filter((v) => v.is_active !== false).length)}
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" /> नयाँ भेन्डर थप्नुस्
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="नाम, PAN/VAT, फोन खोज्नुस्..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>भेन्डरको नाम</TableHead>
              <TableHead>PAN/VAT</TableHead>
              <TableHead>ठेगाना</TableHead>
              <TableHead>फोन</TableHead>
              <TableHead className="text-right">प्रारम्भिक शेष</TableHead>
              <TableHead>Due Days</TableHead>
              <TableHead>स्थिति</TableHead>
              <TableHead className="text-center">कार्यहरू</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  लोड हुँदैछ...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  कुनै भेन्डर फेला परेन
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((v) => (
                <TableRow key={v.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.pan_vat || "-"}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{v.address || "-"}</TableCell>
                  <TableCell>{v.phone || "-"}</TableCell>
                  <TableCell className="text-right font-mono">
                    रु. {fmt(v.opening_balance ?? 0)}{" "}
                    <span className="text-xs text-muted-foreground">({v.balance_type?.toUpperCase()})</span>
                  </TableCell>
                  <TableCell>{np(v.due_days ?? 30)} दिन</TableCell>
                  <TableCell>
                    <Badge variant={v.is_active !== false ? "default" : "secondary"}>
                      {v.is_active !== false ? "सक्रिय" : "निष्क्रिय"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openLedger(v)}
                        title="Ledger हेर्नुस्"
                      >
                        <BookOpen className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(v)}
                        title="सम्पादन"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(v)}
                        title="हटाउनुस्"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Vendor Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "भेन्डर सम्पादन" : "नयाँ भेन्डर थप्नुस्"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>भेन्डरको नाम *</Label>
              <Input
                placeholder="Vendor Name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>PAN / VAT नं.</Label>
                <Input
                  placeholder="PAN/VAT"
                  value={form.pan_vat ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, pan_vat: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>फोन</Label>
                <Input
                  placeholder="Phone"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>ठेगाना (Address)</Label>
              <Input
                placeholder="Address"
                value={form.address ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>ईमेल</Label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Due Days</Label>
                <Input
                  type="number"
                  placeholder="30"
                  value={form.due_days ?? 30}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, due_days: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>प्रारम्भिक शेष</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.opening_balance ?? 0}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, opening_balance: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Dr / Cr</Label>
                <Select
                  value={form.balance_type ?? "cr"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, balance_type: v as "dr" | "cr" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cr">Cr (दिनु पर्ने)</SelectItem>
                    <SelectItem value="dr">Dr (पाउनु पर्ने)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active !== false}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="is_active">सक्रिय (Active)</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              रद्द गर्नुस्
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "सुरक्षित हुँदैछ..." : "सुरक्षित गर्नुस्"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vendor Ledger Modal */}
      <Dialog open={!!ledgerVendor} onOpenChange={(o) => !o && setLedgerVendor(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {ledgerVendor?.name} — खाता बही (Vendor Ledger)
              {ledgerVendor?.pan_vat && (
                <span className="text-sm font-normal text-muted-foreground">
                  PAN/VAT: {ledgerVendor.pan_vat}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto flex-1">
            {ledgerLoading ? (
              <p className="text-center py-8 text-muted-foreground">लोड हुँदैछ...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>मिति (BS)</TableHead>
                    <TableHead>विवरण</TableHead>
                    <TableHead className="text-right">Dr (रु.)</TableHead>
                    <TableHead className="text-right">Cr (रु.)</TableHead>
                    <TableHead className="text-right">शेष (Balance)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerRows.map((row, i) => (
                    <TableRow key={row.id ?? i} className={i === 0 ? "bg-blue-50 dark:bg-blue-950/20 font-medium" : ""}>
                      <TableCell className="font-mono">{row.date_bs}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {row.dr > 0 ? fmt(row.dr) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        {row.cr > 0 ? fmt(row.cr) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {fmt(row.running)}{" "}
                        <span className={`text-xs ${row.runType === "cr" ? "text-green-600" : "text-red-600"}`}>
                          {row.runType.toUpperCase()}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {ledgerRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        कुनै लेनदेन फेला परेन
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setLedgerVendor(null)}>
              बन्द गर्नुस्
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>भेन्डर हटाउनुस्?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> लाई स्थायी रूपमा हटाइनेछ। यो कार्य पूर्वावस्थामा फर्काउन सकिँदैन।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>रद्द गर्नुस्</AlertDialogCancel>
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

