import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLES, MAP_STYLE_GROUPS, DEFAULT_MAP_STYLE, type MapStyleKey } from "@/lib/map-styles";
import { useWorkspace, WorkspacePage, money } from "@/components/workspace";
import { SearchSelect } from "@/components/search-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useTeamLocationBroadcast,
  useTeamLocationSubscribe,
  TEAM_ROLE_STYLE,
  type TeamMemberLocation,
} from "@/lib/team-location";
import {
  MapPin,
  Navigation,
  ExternalLink,
  LocateFixed,
  Phone,
  Search,
  Filter,
  Layers,
  ChevronRight,
  Receipt,
  Car,
  Compass,
  AlertTriangle,
  MousePointer,
  EyeOff,
  Eye,
  RotateCw,
  Target,
  Play,
  CheckCircle2,
  XCircle,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
  Flag,
  ArrowRight,
  Clock,
} from "lucide-react";
import {
  todayBS,
  np,
  getDueMonths,
  mergeOpeningDues,
  getCustomerTotalRate,
  type Person,
  type PlanItem,
  type DueMonth,
} from "@/lib/receipt-rules";
import {
  NEPAL_CENTER,
  BIRENDRANAGAR_CENTER,
  getDistanceInMeters,
  formatDistance,
  formatDrivingTime,
  resolveCustomerLocation,
} from "@/lib/geo";
import { natureEmoji } from "@/lib/nature";
import { CustomerPhotoButton } from "@/components/customer-photo-button";

// ── Collection Journey Types ──────────────────────────────────────────────────
interface JourneyCustomer {
  card: string;
  ward: string;
  name: string;
  tole: string;
  phone?: string;
  dueAmount: number;
  dueMonthCount: number;
  collectedAmount: number; // 0 until reconciled
  status: "pending" | "collected" | "skipped";
}

interface CollectionJourney {
  id: string;             // date-ward-tole key
  date: string;           // BS date string e.g. "२०८१/०८/०४"
  dateKey: string;        // ISO date YYYY-MM-DD for keying
  ward: string;           // ward filter ("all" or "1"–"16")
  tole: string;           // selected tole name
  targetAmount: number;   // sum of all due amounts at start
  targetCount: number;    // number of customers targeted
  customers: JourneyCustomer[];
  startedAt: string;      // ISO timestamp
  status: "active" | "reconciled";
  note: string;
}

function journeyStorageKey(userId: string, dateKey: string) {
  return `hami_journey_v1_${userId}_${dateKey}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const Route = createFileRoute("/collection-map")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Collection & Driver Map — Sangstha" },
      {
        name: "description",
        content:
          "Interactive map for waste collectors and drivers showing customer dues, bubble sizes, live location and direct receipt creation.",
      },
      { property: "og:title", content: "Waste Collection Map — Sangstha" },
    ],
  }),
  component: CollectionMapPage,
});

// Compact amount label e.g. 500 -> "500", 2500 -> "2.5k", 15000 -> "15k"
function formatCompactAmount(amt: number): string {
  if (amt <= 0) return "✓";
  if (amt < 1000) return String(amt);
  if (amt < 10000) return `${(amt / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(amt / 1000)}k`;
}

interface CustomerWithDue extends Person {
  dueMonths: DueMonth[];
  dueAmount: number;
  overdueCount: number;
  monthlyFee: number;
  displayLat: number;
  displayLng: number;
  isApproximateArea: boolean;
  distanceFromDriver?: number | undefined;
}

// ── Journey Customer Row Component ──────────────────────────────────────────
function JourneyCustomerRow({
  c,
  updateCustomer,
  navigate,
}: {
  c: JourneyCustomer;
  updateCustomer: (card: string, ward: string, patch: Partial<JourneyCustomer>) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editAmt, setEditAmt] = useState(String(c.dueAmount));

  const bgClass =
    c.status === "collected"
      ? "bg-success/5"
      : c.status === "skipped"
        ? "bg-muted/40"
        : "";

  return (
    <div className={`p-3 text-xs ${bgClass} transition-colors`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-foreground text-sm">{c.name}</span>
            <span className="text-muted-foreground">कार्ड: {c.card}</span>
            {c.status === "collected" && (
              <Badge className="text-[10px] bg-success/15 text-success border-success/30 border h-4">✓ संकलित</Badge>
            )}
            {c.status === "skipped" && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground h-4">नभेटिए</Badge>
            )}
          </div>
          <p className="text-muted-foreground">{c.tole} • वडा {c.ward} • {c.dueMonthCount} महिना बाँकी</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono font-extrabold text-destructive">{money(c.dueAmount)}</p>
          {c.status === "collected" && c.collectedAmount !== c.dueAmount && (
            <p className="text-[10px] text-success font-mono">संकलित: {money(c.collectedAmount)}</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {c.status === "pending" && !editMode && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {c.phone && (
            <Button asChild size="sm" variant="outline" className="h-7 text-[11px] gap-1 px-2">
              <a href={`tel:${c.phone}`}><Phone className="size-3 text-success" />{c.phone}</a>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => updateCustomer(c.card, c.ward, { status: "collected", collectedAmount: c.dueAmount })}
            className="h-7 text-[11px] gap-1 bg-success hover:bg-success/90 text-success-foreground px-3 font-bold"
          >
            <CheckCircle2 className="size-3" /> पूरै संकलित ({money(c.dueAmount)})
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditMode(true); setEditAmt(""); }}
            className="h-7 text-[11px] gap-1 px-2 border-primary/40 text-primary font-medium"
          >
            आंशिक रकम
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => updateCustomer(c.card, c.ward, { status: "skipped" })}
            className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-destructive"
          >
            <XCircle className="size-3" /> नभेटिए
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate({ to: "/", search: { card: c.card, ward: c.ward } })}
            className="h-7 text-[11px] gap-1 px-2 text-primary hover:bg-primary/10"
          >
            <Receipt className="size-3" /> रसिद काट्नुहोस्
          </Button>
        </div>
      )}

      {c.status === "pending" && editMode && (
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1 flex-1">
            <span className="text-muted-foreground font-mono">रु.</span>
            <input
              type="number"
              className="flex-1 rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:border-primary font-mono"
              placeholder="संकलित रकम"
              value={editAmt}
              onChange={(e) => setEditAmt(e.target.value)}
              min={0}
              max={c.dueAmount}
              autoFocus
            />
          </div>
          <Button
            size="sm"
            onClick={() => {
              const amt = Number(editAmt);
              if (amt > 0) {
                updateCustomer(c.card, c.ward, { status: "collected", collectedAmount: amt });
                setEditMode(false);
              }
            }}
            className="h-7 text-[11px] bg-success text-success-foreground px-3 font-bold"
          >
            बचत
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={() => setEditMode(false)}>
            रद्द
          </Button>
        </div>
      )}

      {c.status !== "pending" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => updateCustomer(c.card, c.ward, { status: "pending", collectedAmount: 0 })}
          className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-1 mt-1"
        >
          ↩ पूर्ववत् गर्नुहोस्
        </Button>
      )}
    </div>
  );
}

// ── Collection Journey Tab Component ─────────────────────────────────────────
function CollectionJourneyTab({
  customersWithDues,
  userId,
  navigate,
}: {
  customersWithDues: CustomerWithDue[];
  userId: string | null | undefined;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const dateKey = todayKey();
  const storageKey = userId ? journeyStorageKey(userId, dateKey) : null;

  // Load persisted journey for today
  const [journey, setJourney] = useState<CollectionJourney | null>(() => {
    if (!storageKey) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as CollectionJourney) : null;
    } catch {
      return null;
    }
  });

  // Setup-screen state
  const [setupWard, setSetupWard] = useState("all");
  const [setupTole, setSetupTole] = useState("");
  const [searchQ, setSearchQ] = useState("");

  // Persist whenever journey changes
  const persistJourney = useCallback((j: CollectionJourney | null) => {
    setJourney(j);
    if (!storageKey) return;
    try {
      if (j) localStorage.setItem(storageKey, JSON.stringify(j));
      else localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  // Distinct wards and toles available from data
  const wardOptions = useMemo(() => {
    const wards = new Set(customersWithDues.map((c) => c.ward));
    return Array.from(wards).sort((a, b) => Number(a) - Number(b));
  }, [customersWithDues]);

  const toleOptions = useMemo(() => {
    const src = setupWard === "all"
      ? customersWithDues
      : customersWithDues.filter((c) => c.ward === setupWard);
    const toles = new Set(src.map((c) => c.tole.trim()).filter(Boolean));
    return Array.from(toles).sort();
  }, [customersWithDues, setupWard]);

  // Preview: customers in selected tole with dues
  const previewCustomers = useMemo(() => {
    if (!setupTole) return [];
    return customersWithDues.filter((c) => {
      if (setupWard !== "all" && c.ward !== setupWard) return false;
      if (c.tole.trim() !== setupTole) return false;
      return c.dueAmount > 0;
    });
  }, [customersWithDues, setupWard, setupTole]);

  const previewTotal = useMemo(() => previewCustomers.reduce((s, c) => s + c.dueAmount, 0), [previewCustomers]);

  // Start journey — lock in the target
  const handleStartJourney = () => {
    if (!setupTole || previewCustomers.length === 0) return;
    const today = todayBS();
    const j: CollectionJourney = {
      id: `${dateKey}-W${setupWard}-${setupTole}`,
      date: `${today.year}/${String(today.month).padStart(2, "0")}/${String(today.day).padStart(2, "0")}`,
      dateKey,
      ward: setupWard,
      tole: setupTole,
      targetAmount: previewTotal,
      targetCount: previewCustomers.length,
      customers: previewCustomers.map((c) => ({
        card: c.card,
        ward: c.ward,
        name: c.name,
        tole: c.tole,
        phone: c.phone,
        dueAmount: c.dueAmount,
        dueMonthCount: c.dueMonths.length,
        collectedAmount: 0,
        status: "pending",
      })),
      startedAt: new Date().toISOString(),
      status: "active",
      note: "",
    };
    persistJourney(j);
  };

  // Update a customer's collected amount & status
  const updateCustomer = (card: string, ward: string, patch: Partial<JourneyCustomer>) => {
    if (!journey) return;
    const updated: CollectionJourney = {
      ...journey,
      customers: journey.customers.map((c) =>
        c.card === card && c.ward === ward ? { ...c, ...patch } : c,
      ),
    };
    // Auto-mark reconciled if all done
    const allDone = updated.customers.every((c) => c.status !== "pending");
    persistJourney({ ...updated, status: allDone ? "reconciled" : "active" });
  };

  // Reset journey for today
  const resetJourney = () => persistJourney(null);

  // ── Filtered active-journey customers ────────────────────────────────────
  const filteredJourneyCustomers = useMemo(() => {
    if (!journey) return [];
    if (!searchQ.trim()) return journey.customers;
    const q = searchQ.toLowerCase();
    return journey.customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.card.toLowerCase().includes(q),
    );
  }, [journey, searchQ]);

  // Stats
  const collectedTotal = useMemo(
    () => journey?.customers.reduce((s, c) => s + (c.status === "collected" ? c.collectedAmount : 0), 0) ?? 0,
    [journey],
  );
  const skippedCount = useMemo(
    () => journey?.customers.filter((c) => c.status === "skipped").length ?? 0,
    [journey],
  );
  const pendingCount = useMemo(
    () => journey?.customers.filter((c) => c.status === "pending").length ?? 0,
    [journey],
  );
  const collectedCount = useMemo(
    () => journey?.customers.filter((c) => c.status === "collected").length ?? 0,
    [journey],
  );
  const progressPct = journey ? Math.min(100, Math.round((collectedTotal / journey.targetAmount) * 100)) : 0;

  // ─────────────────────────── RENDER ──────────────────────────────────────

  // If no journey started today, show setup screen
  if (!journey) {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="rounded-xl border bg-gradient-to-r from-primary/5 to-primary/10 p-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="rounded-lg bg-primary/15 p-2">
              <Target className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-foreground">संकलन यात्रा सुरु गर्नुहोस्</h2>
              <p className="text-xs text-muted-foreground">टोल छानेर आजको संकलन लक्ष्य तोक्नुहोस् र Reconcile गर्नुहोस्</p>
            </div>
          </div>
        </div>

        {/* Step 1: Select Ward + Tole */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-extrabold">१</span>
            टोल (Tole) छान्नुहोस्
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">वडा नं. (Ward)</label>
              <SearchSelect
                value={setupWard}
                onChange={(v) => { setSetupWard(v); setSetupTole(""); }}
                placeholder="सबै वडा"
                options={[
                  { value: "all", label: "सबै वडा (All)" },
                  ...wardOptions.map((w) => ({ value: w, label: `वडा नं. ${w}` })),
                ]}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">टोल (Tole)</label>
              <SearchSelect
                value={setupTole}
                onChange={setSetupTole}
                placeholder="टोल छान्नुहोस्..."
                options={toleOptions.map((t) => ({ value: t, label: t }))}
              />
            </div>
          </div>
        </div>

        {/* Step 2: Preview */}
        {setupTole && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 p-3 border-b bg-muted/30">
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-extrabold">२</span>
                लक्ष्य पूर्वावलोकन — {setupTole}
                {setupWard !== "all" && <span className="text-xs font-normal text-muted-foreground">(वडा {setupWard})</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  <Users className="size-3.5 inline mr-0.5" /> {previewCustomers.length} ग्राहक
                </span>
              </div>
            </div>

            {previewCustomers.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="size-8 mx-auto mb-2 text-success opacity-60" />
                यस टोलमा कुनै बक्यौता छैन — सबै चुक्ता!
              </div>
            ) : (
              <>
                {/* Target Summary Banner */}
                <div className="p-3 bg-destructive/5 border-b border-destructive/15 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">आजको संकलन लक्ष्य (Target)</p>
                    <p className="font-mono text-2xl font-extrabold text-destructive">{money(previewTotal)}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p><b className="text-foreground">{previewCustomers.length}</b> जनाको बाँकी</p>
                    <p>औसत {money(Math.round(previewTotal / previewCustomers.length))} / जना</p>
                  </div>
                </div>

                {/* Customer List */}
                <div className="divide-y max-h-72 overflow-y-auto">
                  {previewCustomers.map((c) => (
                    <div key={`${c.ward}-${c.card}`} className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-muted/30">
                      <div>
                        <span className="font-bold text-foreground">{c.name}</span>
                        <span className="text-muted-foreground ml-1.5">कार्ड: {c.card}</span>
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="ml-1.5 text-info hover:underline">
                            {c.phone}
                          </a>
                        )}
                        <div className="text-muted-foreground">{c.dueMonths.length} महिना बाँकी</div>
                      </div>
                      <span className="font-mono font-extrabold text-destructive shrink-0">{money(c.dueAmount)}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="p-3 border-t">
                  <Button
                    onClick={handleStartJourney}
                    className="w-full h-11 font-extrabold gap-2 bg-primary text-primary-foreground shadow-md hover:opacity-90"
                  >
                    <Play className="size-4" />
                    यात्रा सुरु गर्नुहोस् — लक्ष्य: {money(previewTotal)}
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {!setupTole && (
          <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            <Flag className="size-8 mx-auto mb-2 text-primary/40" />
            माथि वडा र टोल छानेपछि संकलन लक्ष्य देखिनेछ
          </div>
        )}
      </div>
    );
  }

  // ── Active / Reconciled Journey View ─────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Journey Header */}
      <div className={`rounded-xl border p-4 ${journey.status === "reconciled" ? "bg-success/5 border-success/30" : "bg-primary/5 border-primary/20"}`}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-extrabold text-base text-foreground">
                {journey.status === "reconciled" ? "✅ Reconciled" : "🚀 यात्रा जारी छ"}
              </h2>
              <Badge variant="outline" className="text-[11px]">
                {journey.tole} {journey.ward !== "all" && `• वडा ${journey.ward}`}
              </Badge>
              <Badge variant="secondary" className="text-[11px]">
                <Clock className="size-2.5 mr-0.5" />{journey.date}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {journey.targetCount} ग्राहक • {new Date(journey.startedAt).toLocaleTimeString("ne-NP", { hour: "2-digit", minute: "2-digit" })} मा सुरु
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={resetJourney}
            className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1 shrink-0"
            title="आजको यात्रा मेट्नुहोस्"
          >
            <RefreshCw className="size-3" /> नयाँ यात्रा
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-muted-foreground">संकलन प्रगति</span>
            <span className={progressPct >= 100 ? "text-success" : "text-primary"}>{progressPct}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressPct >= 100 ? "bg-success" : "bg-primary"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="rounded-lg bg-card border p-2 text-center">
            <p className="text-[10px] text-muted-foreground">लक्ष्य</p>
            <p className="font-mono font-extrabold text-sm text-destructive">{money(journey.targetAmount)}</p>
          </div>
          <div className="rounded-lg bg-card border p-2 text-center">
            <p className="text-[10px] text-muted-foreground">संकलित</p>
            <p className="font-mono font-extrabold text-sm text-success">{money(collectedTotal)}</p>
          </div>
          <div className="rounded-lg bg-card border p-2 text-center">
            <p className="text-[10px] text-muted-foreground">बाँकी</p>
            <p className="font-mono font-bold text-sm text-warning">{pendingCount} जना</p>
          </div>
          <div className="rounded-lg bg-card border p-2 text-center">
            <p className="text-[10px] text-muted-foreground">नभेटिएका</p>
            <p className="font-mono font-bold text-sm text-muted-foreground">{skippedCount} जना</p>
          </div>
        </div>

        {journey.status === "reconciled" && (
          <div className="mt-3 rounded-lg bg-success/10 border border-success/30 p-2.5 text-xs text-success font-bold flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            सम्पूर्ण संकलन Reconcile सम्पन्न! संकलित: {money(collectedTotal)} / लक्ष्य: {money(journey.targetAmount)}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <input
          className="w-full rounded-lg border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
          placeholder="नाम वा कार्ड खोज्नुहोस्..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
      </div>

      {/* Customer Reconciliation List */}
      <div className="rounded-xl border bg-card overflow-hidden divide-y">
        {filteredJourneyCustomers.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">कुनै ग्राहक फेला परेन</div>
        ) : (
          filteredJourneyCustomers.map((c) => (
            <JourneyCustomerRow
              key={`${c.ward}-${c.card}`}
              c={c}
              updateCustomer={updateCustomer}
              navigate={navigate}
            />
          ))
        )}
      </div>

      {/* Bottom summary */}
      <div className="rounded-xl border bg-card p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <TrendingUp className="size-4 text-primary" />
          <span className="font-bold text-foreground">दिनको अन्तिम Reconciliation</span>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">संकलित / लक्ष्य</p>
          <p className="font-mono font-extrabold text-sm">
            <span className="text-success">{money(collectedTotal)}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-destructive">{money(journey.targetAmount)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function CollectionMapPage() {
  const { query, ward, setWard, signedIn, userId, userEmail, activeEmployeeId, employees } = useWorkspace();
  const navigate = useNavigate();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.Layer | null>(null);

  // Driver/Collector Location
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [trackingLocation, setTrackingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locatingStatus, setLocatingStatus] = useState("");
  const [settingDriverMode, setSettingDriverMode] = useState(false);
  const settingDriverModeRef = useRef(false);
  settingDriverModeRef.current = settingDriverMode;

  const watchIdRef = useRef<number | null>(null);
  const firstFixRef = useRef(false);

  // ── Live team locations from other workers (drivers etc.) ──────────────
  const [teamMembers, setTeamMembers] = useState<TeamMemberLocation[]>([]);
  const teamMemberMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  // Latched count of live members for the on-map legend (updates in real time)
  useTeamLocationSubscribe(userId ?? null, setTeamMembers);

  // Map instance generation — bumped whenever the Leaflet map is re-created
  // (e.g. entering/exiting fullscreen) so marker effects re-add their layers.
  const [mapReady, setMapReady] = useState(0);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>(DEFAULT_MAP_STYLE);

  // Compute broadcaster's actual employee name and designation
  const activeEmployee = employees?.find((e) => e.id === activeEmployeeId);
  const broadcasterName = activeEmployee?.name || (userEmail ? userEmail.split("@")[0] : (userId ? "संकलक" : "संकलक"));
  const broadcasterDesignation = activeEmployee?.designation || "संकलक";

  // ── Broadcast this collector's live location to the dashboard map ──────
  const broadcastToDashboard = useTeamLocationBroadcast({
    userId: userId ?? null,
    userEmail: userEmail ?? null,
    employeeId: activeEmployeeId ?? "collector",
    name: broadcasterName,
    designation: broadcasterDesignation,
    role: "collector",
    active: trackingLocation,
  });

  // Always keep dashboard updated whenever collector location updates
  useEffect(() => {
    if (driverLocation) {
      broadcastToDashboard(driverLocation.latitude, driverLocation.longitude);
    }
  }, [driverLocation, broadcastToDashboard]);

  // ── Screen Wake Lock: keep the phone screen on while GPS tracking runs so
  // the browser never suspends the tab (which would kill live location sharing) ──
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    let released = !trackingLocation;
    const acquire = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: WakeLock };
        if (!released && wakeLockRef.current === null && nav.wakeLock) {
          wakeLockRef.current = await nav.wakeLock.request("screen");
          wakeLockRef.current.addEventListener("release", () => {
            wakeLockRef.current = null;
          });
        }
      } catch {
        // wake lock unsupported — tracking still works without it
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && trackingLocation) {
        released = false;
        void acquire();
      }
    };
    if (trackingLocation) {
      released = false;
      void acquire();
      document.addEventListener("visibilitychange", onVisibility);
    } else {
      released = true;
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    }
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [trackingLocation]);

  // Selected customer for navigation / route
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithDue | null>(null);

  // ─── Map view controls: fullscreen & hide overlay boxes ───
  // Hidden-boxes preference is remembered for the browser session so switching
  // tabs or reloading doesn't bring the info boxes back.
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const [mapFull, setMapFull] = useState(false);
  const [hideBoxes, setHideBoxes] = useState(() => {
    try {
      return sessionStorage.getItem("hami_map_hide_boxes_v1") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("hami_map_hide_boxes_v1", hideBoxes ? "1" : "0");
    } catch {}
  }, [hideBoxes]);

  // While the map is fullscreen, lock the page scroll so tabs underneath
  // can't drift; restore when leaving.
  useEffect(() => {
    if (!mapFull) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mapFull]);

  const toggleMapFullscreen = () => {
    const el = mapWrapperRef.current;
    if (!el) return;
    if (mapFull) {
      // Exiting: close native fullscreen if active, clear the CSS fallback flag
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      setMapFull(false);
    } else if (el.requestFullscreen) {
      void el.requestFullscreen()
        .then(() => setMapFull(true))
        .catch(() => setMapFull(true)); // API blocked (e.g. preview iframe): CSS fallback
    } else {
      setMapFull(true); // Fullscreen API unavailable (e.g. iOS Safari): CSS fallback
    }
    if (mapRef.current) setTimeout(() => mapRef.current!.invalidateSize(), 350);
  };

  useEffect(() => {
    const onFsChange = () => setMapFull(Boolean(document.fullscreenElement));
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mapFull && !document.fullscreenElement) setMapFull(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("keydown", onEsc);
    };
  }, [mapFull]);

  // ── Main Page Tab State: "map" | "journey" ───────────────────────────────
  const [activeTab, setActiveTab] = useState<"map" | "journey">("map");

  // Invalidate map size when switching back to the map tab
  useEffect(() => {
    if (activeTab === "map" && mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 150);
    }
  }, [activeTab]);

  // Filter states; the section drawer (बक्यौता/थेली tabs) starts open on desktop
  const [selectedWard, setSelectedWard] = useState<string>("all");
  const [selectedTole, setSelectedTole] = useState<string>("all");
  const [filterOnlyDues, setFilterOnlyDues] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024,
  );

  const plans: PlanItem[] = query.data?.plans ?? [];
  const allPeople: Person[] = query.data?.people ?? [];
  const allReceipts = query.data?.receipts ?? [];

  // Distinct toles for selected ward
  const toleOptions = useMemo(() => {
    const src =
      selectedWard === "all"
        ? allPeople
        : allPeople.filter((p) => p.ward === selectedWard);
    const toles = new Set(src.map((p) => p.tole?.trim()).filter(Boolean));
    return Array.from(toles).sort();
  }, [allPeople, selectedWard]);

  // Compute customers with their calculated dues and GPS coordinates
  const customersWithDues: CustomerWithDue[] = useMemo(() => {
    return allPeople.map((person) => {
      const customerPaidSet = new Set(
        allReceipts
          .filter(
            (r) => r.ward === person.ward && r.card.toLowerCase() === person.card.toLowerCase(),
          )
          .flatMap((r) => r.months.map((m) => `${m.year ?? r.year}:${m.m}`)),
      );

      const autoDues = person.joining_date
        ? getDueMonths(person.joining_date, customerPaidSet, todayBS())
        : [];
      const dueMonths = mergeOpeningDues(autoDues, person.opening_dues, customerPaidSet);
      const monthlyFee = getCustomerTotalRate(person, plans);
      const dueAmount = dueMonths.reduce((s, dm) => s + (dm.amount ?? monthlyFee), 0);
      const overdueCount = dueMonths.filter((d) => d.isOverdue).length;

      const loc = resolveCustomerLocation(person);

      let distanceFromDriver: number | undefined;
      if (driverLocation) {
        distanceFromDriver = getDistanceInMeters(
          driverLocation.latitude,
          driverLocation.longitude,
          loc.lat,
          loc.lng,
        );
      }

      return {
        ...person,
        dueMonths,
        dueAmount,
        overdueCount,
        monthlyFee,
        displayLat: loc.lat,
        displayLng: loc.lng,
        isApproximateArea: loc.isApproximateArea,
        distanceFromDriver,
      };
    });
  }, [allPeople, allReceipts, plans, driverLocation]);

  // Filtered customers for map and list
  const filteredCustomers = useMemo(() => {
    return customersWithDues.filter((c) => {
      if (selectedWard !== "all" && c.ward !== selectedWard) return false;
      if (selectedTole !== "all" && c.tole.trim() !== selectedTole) return false;
      if (filterOnlyDues && c.dueAmount <= 0) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          c.name.toLowerCase().includes(q) ||
          c.card.toLowerCase().includes(q) ||
          c.tole.toLowerCase().includes(q) ||
          (c.nature && c.nature.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [customersWithDues, selectedWard, selectedTole, filterOnlyDues, searchQuery]);

  // Count exact GPS vs approximate Ward area
  const exactGpsCount = useMemo(() => {
    return filteredCustomers.filter((c) => !c.isApproximateArea).length;
  }, [filteredCustomers]);

  const approximateCount = useMemo(() => {
    return filteredCustomers.filter((c) => c.isApproximateArea).length;
  }, [filteredCustomers]);

  // Statistics
  const totalDuesAmount = useMemo(() => {
    return filteredCustomers.reduce((acc, c) => acc + c.dueAmount, 0);
  }, [filteredCustomers]);

  const customersWithDueCount = useMemo(() => {
    return filteredCustomers.filter((c) => c.dueAmount > 0).length;
  }, [filteredCustomers]);

  // Initialize Leaflet Map
  // NOTE: on first visit the container is not mounted yet (records still
  // loading), so re-run when the workspace query settles — map inits then.
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || mapRef.current) return;
    let resizeObserver: ResizeObserver | null = null;

    // Start centered on Nepal, will smoothly zoom in
    const map = L.map(el, {
      center: NEPAL_CENTER,
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapRef.current = map;
    setMapReady((v) => (v ? v + 1 : 1));

    // Keep tiles correctly sized when layout changes (sidebar, fullscreen)
    resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    resizeObserver.observe(el);

    // Click on map: if setting driver mode, sets vehicle position; otherwise clears selection
    map.on("click", (e) => {
      if (settingDriverModeRef.current) {
        const lat = Number(e.latlng.lat.toFixed(7));
        const lng = Number(e.latlng.lng.toFixed(7));
        setDriverLocation({ latitude: lat, longitude: lng });
        setSettingDriverMode(false);
        setLocationError("");
        setLocatingStatus("गाडीको स्थान नक्सामा तोकियो (Vehicle location set).");
        setTimeout(() => setLocatingStatus(""), 4000);
      }
    });

    // Smooth zoom into Birendranagar after brief delay
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.flyTo(BIRENDRANAGAR_CENTER, 14, { duration: 1.8 });
      }
    }, 500);

    return () => {
      resizeObserver?.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersLayerRef.current = null;
      driverMarkerRef.current = null;
      routeLineRef.current = null;
      teamMemberMarkersRef.current.clear();
      setMapReady(0);
    };
  }, [query.isPending]);

  // Keep tiles and viewport properly sized across fullscreen transitions
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timers = [
      setTimeout(() => map.invalidateSize({ animate: false }), 50),
      setTimeout(() => map.invalidateSize({ animate: false }), 150),
      setTimeout(() => map.invalidateSize({ animate: false }), 300),
      setTimeout(() => map.invalidateSize({ animate: false }), 600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [mapFull]);

  // Tile layer switching (OpenFreeMap vector / ESRI satellite / CartoDB raster)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (tileLayerRef.current) {
      try { map.removeLayer(tileLayerRef.current); } catch { /* already removed */ }
      tileLayerRef.current = null;
    }

    const cfg = MAP_STYLES[mapStyle] ?? MAP_STYLES.liberty;

    if (cfg.type === "vector") {
      try {
        const glLayer = maplibreGL({ style: cfg.url }).addTo(map);
        tileLayerRef.current = glLayer;

        const maplibreMap = (glLayer as any).getMaplibreMap?.();
        if (maplibreMap) {
          maplibreMap.on("error", () => {
            console.warn("MapLibre runtime error, switching to raster OSM fallback");
            try { map.removeLayer(glLayer); } catch {}
            tileLayerRef.current = L.tileLayer(MAP_STYLES.osm.url, {
              subdomains: MAP_STYLES.osm.subdomains,
              maxZoom: MAP_STYLES.osm.maxZoom,
            }).addTo(map);
          });
        }
      } catch (err) {
        console.warn("MapLibre vector tiles failed, using raster fallback:", err);
        tileLayerRef.current = L.tileLayer(MAP_STYLES.osm.url, {
          subdomains: MAP_STYLES.osm.subdomains,
          maxZoom: MAP_STYLES.osm.maxZoom,
        }).addTo(map);
      }
    } else if (cfg.type === "hybrid") {
      const base = L.tileLayer(cfg.url, { maxZoom: cfg.maxZoom ?? 19 });
      const overlay = L.tileLayer(cfg.overlayUrl!, { maxZoom: cfg.maxZoom ?? 19 });
      tileLayerRef.current = L.layerGroup([base, overlay]).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer(cfg.url, {
        subdomains: cfg.subdomains,
        maxZoom: cfg.maxZoom ?? 19,
        detectRetina: Boolean(cfg.isRetina),
      }).addTo(map);
    }
  }, [mapReady, mapStyle]);

  // Render live team members (other workers) as vehicle cards — real
  // 🚚/🛻 vehicle markers, never plain pins.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const myKey = `${userId}:${activeEmployeeId ?? "collector"}`;
    const liveIds = new Set(teamMembers.map((m) => m.id || `${m.userId}:${m.role}`));
    for (const [id, marker] of teamMemberMarkersRef.current) {
      if (!liveIds.has(id)) {
        map.removeLayer(marker);
        teamMemberMarkersRef.current.delete(id);
      }
    }

    teamMembers.forEach((m) => {
      const markerId = m.id || `${m.userId}:${m.role}`;
      if (markerId === myKey) return; // own marker handled by driver marker effect

      const st = TEAM_ROLE_STYLE[m.role] ?? TEAM_ROLE_STYLE.other;
      const stale = Date.now() - m.updatedAt > 90_000;
      const badgeBg = stale ? "#94a3b8" : st.color;
      const label = m.designation ? `${m.name} (${m.designation})` : (m.name || st.label);

      const icon = L.divIcon({
        className: "team-vehicle-icon",
        html: `
          <div style="position:relative; width:46px; height:42px; cursor:pointer;">
            ${
              !stale
                ? `<div style="position:absolute; inset:-6px; border-radius:12px; background:${st.color}; opacity:0.25; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>`
                : ""
            }
            <div style="
              width:46px; height:42px; border-radius:12px;
              background:#ffffff;
              border:3px solid ${badgeBg};
              box-shadow:0 4px 14px rgba(0,0,0,0.4);
              display:flex; align-items:center; justify-content:center;
              font-size:24px; line-height:1;
            ">${st.emoji}</div>
            <div style="
              position:absolute; bottom:-20px; left:50%; transform:translateX(-50%);
              background:${badgeBg}; color:#ffffff;
              font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;
              white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.3);
              max-width:140px; overflow:hidden; text-overflow:ellipsis;
            ">${label}</div>
          </div>`,
        iconSize: [46, 42],
        iconAnchor: [23, 21],
      });

      const tooltipHtml = `<b>${m.name}</b>${m.designation ? ` (${m.designation})` : ` (${st.label})`}<br/>
        <span style="font-size:10px;color:${stale ? "#d97706" : "#059669"};">
          ${stale ? "⚠️ पुरानो स्थान" : "🟢 लाइभ GPS सक्रिय"}</span>`;

      const existing = teamMemberMarkersRef.current.get(markerId);
      if (existing) {
        existing.setLatLng([m.lat, m.lng]);
        existing.setIcon(icon);
        existing.setTooltipContent(tooltipHtml);
      } else {
        const marker = L.marker([m.lat, m.lng], { icon, zIndexOffset: 2200 })
          .addTo(map)
          .bindTooltip(tooltipHtml, { direction: "top", offset: [0, -24] });
        teamMemberMarkersRef.current.set(markerId, marker);

        // First sighting of a teammate: bring the view to them
        map.setView([m.lat, m.lng], Math.max(map.getZoom(), 14));
      }
    });
  }, [teamMembers, userId, activeEmployeeId, mapReady]);

  // Update Driver Marker on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !driverLocation) {
      if (driverMarkerRef.current && map) {
        map.removeLayer(driverMarkerRef.current);
        driverMarkerRef.current = null;
      }
      return;
    }

    const { latitude, longitude } = driverLocation;

    const driverIcon = L.divIcon({
      className: "driver-live-location-icon",
      html: `
        <div style="position: relative; width: 44px; height: 44px; cursor: grab;">
          <div style="position: absolute; inset: 0; border-radius: 9999px; background-color: #2563eb; opacity: 0.3; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 44px; height: 44px; border-radius: 9999px; background-color: #1e40af; border: 3px solid #ffffff; box-shadow: 0 4px 14px rgba(37,99,235,0.6); display: flex; align-items: center; justify-content: center; font-size: 20px;">
            🚚
          </div>
          <div style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); background-color: #1e3a8a; color: #ffffff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
            ${broadcasterName} (${broadcasterDesignation})
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([latitude, longitude]);
    } else {
      const marker = L.marker([latitude, longitude], {
        icon: driverIcon,
        zIndexOffset: 2000,
        draggable: true,
      }).addTo(map);

      marker.on("dragend", (e) => {
        const ll = (e.target as L.Marker).getLatLng();
        setDriverLocation({ latitude: ll.lat, longitude: ll.lng });
      });

      driverMarkerRef.current = marker;
    }
  }, [driverLocation, mapReady]);

  // Update Customer Bubbles on Map (both exact GPS & Ward area)
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    filteredCustomers.forEach((c) => {
      const lat = c.displayLat;
      const lng = c.displayLng;
      const isSelected = selectedCustomer?.card === c.card && selectedCustomer?.ward === c.ward;
      const hasDue = c.dueAmount > 0;

      // Determine bubble size based on due amount:
      let size = 26; // default
      let color = "#ef4444"; // red
      let zIndex = 100;

      if (!hasDue) {
        size = 18;
        color = "#10b981"; // green (no due)
        zIndex = 50;
      } else if (c.dueAmount < 2000) {
        size = 24;
        color = "#f87171"; // soft red
        zIndex = 150;
      } else if (c.dueAmount < 5000) {
        size = 30;
        color = "#ef4444"; // red
        zIndex = 200;
      } else if (c.dueAmount < 10000) {
        size = 36;
        color = "#dc2626"; // deeper red
        zIndex = 300;
      } else {
        size = 44;
        color = "#991b1b"; // big overdue crimson
        zIndex = 400;
      }

      if (isSelected) {
        size += 6;
        zIndex = 1000;
      }

      const compactText = formatCompactAmount(c.dueAmount);

      const bubbleIcon = L.divIcon({
        className: "customer-due-bubble-container",
        html: `
          <div style="position: relative; width: ${size}px; height: ${size}px; cursor: pointer; z-index: ${zIndex};">
            ${
              hasDue && c.dueAmount >= 5000
                ? `<div style="position: absolute; inset: -4px; border-radius: 9999px; background-color: ${color}; opacity: 0.35; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
                : ""
            }
            <div style="
              width: ${size}px;
              height: ${size}px;
              border-radius: 9999px;
              background-color: ${color};
              border: ${isSelected ? "3px solid #2563eb" : c.isApproximateArea ? "2px dashed #fbbf24" : "2px solid #ffffff"};
              box-shadow: 0 4px 10px rgba(0,0,0,0.35);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-weight: 800;
              font-size: ${size >= 36 ? "11px" : size >= 28 ? "10px" : "9px"};
              letter-spacing: -0.5px;
            ">
              ${compactText}
            </div>
            ${
              natureEmoji(c.nature)
                ? `<span style="position: absolute; top: -6px; right: -6px; display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; font-size: 11px; line-height: 1; background-color: #ffffff; border: 1px solid #d4d4d8; border-radius: 9999px; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">${natureEmoji(c.nature)}</span>`
                : ""
            }
            ${
              isSelected
                ? `<div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #2563eb;"></div>`
                : ""
            }
            ${
              c.isApproximateArea
                ? `<div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background-color: #78350f; color: #fef3c7; font-size: 8px; font-weight: bold; padding: 1px 4px; border-radius: 3px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">वडा ${c.ward}</div>`
                : ""
            }
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([lat, lng], { icon: bubbleIcon });

      // Click customer bubble
      marker.on("click", () => {
        handleSelectCustomer(c);
      });

      // Tooltip hover
      marker.bindTooltip(
        `<b>${c.name}</b> (कार्ड: ${c.card})<br/>वडा ${c.ward}, ${c.tole}${c.isApproximateArea ? ' <span style="color:#d97706;font-weight:bold;">(वडा क्षेत्र)</span>' : ""}${c.nature ? `<br/>🏷️ व्यवसाय: ${natureEmoji(c.nature)} ${c.nature}` : ""}<br/>${
          hasDue
            ? `<span style="color:#ef4444;font-weight:bold;">बाँकी रकम: रु. ${c.dueAmount.toLocaleString("en-IN")}</span>`
            : `<span style="color:#10b981;">✓ सबै चुक्ता</span>`
        }${c.distanceFromDriver !== undefined ? `<br/><span style="color:#2563eb;font-weight:bold;">🚗 दुरी: ${formatDistance(c.distanceFromDriver)}</span>` : ""}`,
        { direction: "top", offset: [0, -size / 2 - 4] },
      );

      markersLayer.addLayer(marker);
    });
  }, [filteredCustomers, selectedCustomer]);

  // Update Route Polyline and Distance Display on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    if (driverLocation && selectedCustomer) {
      const cLat = selectedCustomer.displayLat;
      const cLng = selectedCustomer.displayLng;
      const dist = getDistanceInMeters(
        driverLocation.latitude,
        driverLocation.longitude,
        cLat,
        cLng,
      );

      const line = L.polyline(
        [
          [driverLocation.latitude, driverLocation.longitude],
          [cLat, cLng],
        ],
        {
          color: "#2563eb",
          weight: 4,
          dashArray: "8, 8",
          opacity: 0.9,
        },
      ).addTo(map);

      // Tooltip showing driving distance & time directly on the map line
      line
        .bindTooltip(
          `<div style="font-size:11px; font-weight:800; color:#1e40af; background:#eff6ff; border:1.5px solid #60a5fa; padding:3px 8px; border-radius:6px; box-shadow:0 3px 8px rgba(37,99,235,0.25); white-space:nowrap;">
          🚗 ${formatDistance(dist)} (${formatDrivingTime(dist)})
        </div>`,
          { permanent: true, direction: "center", className: "route-distance-tooltip" },
        )
        .openTooltip();

      routeLineRef.current = line;

      // Fit map bounds nicely to show both driver and customer
      map.fitBounds(
        [
          [driverLocation.latitude, driverLocation.longitude],
          [cLat, cLng],
        ],
        { padding: [70, 70], maxZoom: 16 },
      );
    }
  }, [driverLocation, selectedCustomer, mapReady]);

  // Keep the live-team legend count fresh during fullscreen so it stays readable
  const liveMembers = useMemo(
    () => teamMembers.filter((m) => m.userId !== userId && Date.now() - m.updatedAt <= 90_000),
    [teamMembers, userId],
  );
  // Driver Location Tracking with 3-Stage Fallback (eliminates Timeout expired)
  const toggleLocationTracking = () => {
    if (trackingLocation) {
      // Stop tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setTrackingLocation(false);
      setLocatingStatus("");
      firstFixRef.current = false;
    } else {
      // Start tracking
      if (!navigator.geolocation) {
        setLocationError(
          "तपाईंको ब्राउजरमा GPS लोकेसन सुविधा उपलब्ध छैन। कृपया 'नक्सामा गाडी राख्नुहोस्' प्रयोग गर्नुहोस्।",
        );
        return;
      }

      setLocationError("");
      setLocatingStatus("GPS लोकेसन खोज्दैछ...");
      setTrackingLocation(true);
      firstFixRef.current = false;

      const updatePos = (position: GeolocationPosition, msg = "") => {
        const { latitude, longitude } = position.coords;
        setDriverLocation({ latitude, longitude });
        setLocatingStatus(msg || "✓ लोकेसन सक्रिय छ");

        // Broadcast to dashboard live map
        broadcastToDashboard(latitude, longitude);

        // Center on the driver only once (the first fix); watch updates must not
        // keep dragging the map while the driver moves or pans manually.
        const map = mapRef.current;
        if (map && !firstFixRef.current && !selectedCustomer) {
          firstFixRef.current = true;
          map.flyTo([latitude, longitude], 16, { duration: 1.2 });
        }
      };

      // Stage 1: Try high accuracy with 8s timeout
      navigator.geolocation.getCurrentPosition(
        (pos) => updatePos(pos, "✓ GPS लोकेसन प्राप्त भयो"),
        (errHigh) => {
          // Stage 2: Automatic fallback to standard network GPS (no timeout!)
          setLocatingStatus("सामान्य नेटवर्क GPS खोजिँदैछ...");
          navigator.geolocation.getCurrentPosition(
            (pos) => updatePos(pos, "✓ सामान्य GPS/नेटवर्क मार्फत स्थान प्राप्त भयो"),
            async (errLow) => {
              // Stage 3: Network IP geolocation fallback
              setLocatingStatus("इन्टरनेट नेटवर्क स्थान खोजिँदैछ...");
              try {
                const ipRes = await fetch("https://get.geojs.io/v1/ip/geo.json", {
                  signal: AbortSignal.timeout(4000),
                });
                if (ipRes.ok) {
                  const ipData = await ipRes.json();
                  if (ipData.latitude && ipData.longitude) {
                    const lat = Number(Number(ipData.latitude).toFixed(7));
                    const lng = Number(Number(ipData.longitude).toFixed(7));
                    setDriverLocation({ latitude: lat, longitude: lng });
                    setLocatingStatus(
                      "✓ नेटवर्क आधारित स्थान प्राप्त (गाडी तानेर स्थान मिलाउन सक्नुहुन्छ)",
                    );
                    if (mapRef.current && !firstFixRef.current && !selectedCustomer) {
                      firstFixRef.current = true;
                      mapRef.current.flyTo([lat, lng], 15, { duration: 1.2 });
                    }
                    return;
                  }
                }
              } catch {
                // Fall through to error
              }

              setTrackingLocation(false);
              setLocatingStatus("");
              setLocationError(
                "GPS समय समाप्त भयो। कृपया तलको '📍 नक्सामा गाडी राख्नुहोस्' बटन थिचेर नक्सामा जहाँ हुनुहुन्छ त्यहाँ क्लिक गर्नुहोस्।",
              );
            },
            {
              enableHighAccuracy: false,
              timeout: 15000,
              maximumAge: 120000, // accept recent cached position
            },
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 30000,
        },
      );

      // Watch continuously for movement
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => updatePos(pos),
        (err) => console.warn("Watch pos error:", err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
      );
    }
  };

  // Center on Driver location
  const centerOnDriver = () => {
    if (driverLocation && mapRef.current) {
      mapRef.current.flyTo([driverLocation.latitude, driverLocation.longitude], 17, {
        duration: 1,
      });
    }
  };

  // Zoom to Nepal view
  const zoomToNepal = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(NEPAL_CENTER, 7, { duration: 1.5 });
    }
  };

  // Zoom to Birendranagar
  const zoomToBirendranagar = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(BIRENDRANAGAR_CENTER, 14, { duration: 1.2 });
    }
  };

  // Select customer & zoom to them
  const handleSelectCustomer = (c: CustomerWithDue) => {
    setSelectedCustomer(c);
    const map = mapRef.current;
    if (!map) return;

    if (driverLocation) {
      // Zoom to fit both driver and customer
      map.fitBounds(
        [
          [driverLocation.latitude, driverLocation.longitude],
          [c.displayLat, c.displayLng],
        ],
        { padding: [70, 70], maxZoom: 16 },
      );
    } else {
      // Zoom to customer location
      map.flyTo([c.displayLat, c.displayLng], 16, { duration: 1 });
    }
  };

  // One-click Navigate to New Receipt
  const handleCreateReceipt = (c: CustomerWithDue) => {
    void navigate({
      to: "/",
      search: {
        card: c.card,
        ward: c.ward,
      },
    });
  };

  // Open Driving Directions safely without Google Maps API errors
  const handleOpenDirections = (c: CustomerWithDue) => {
    const destLat = c.displayLat;
    const destLng = c.displayLng;
    if (
      typeof destLat !== "number" ||
      typeof destLng !== "number" ||
      isNaN(destLat) ||
      isNaN(destLng)
    ) {
      return;
    }

    // 1. Zoom and highlight route in our in-app map
    const map = mapRef.current;
    if (map) {
      if (driverLocation) {
        map.fitBounds(
          [
            [driverLocation.latitude, driverLocation.longitude],
            [destLat, destLng],
          ],
          { padding: [80, 80], maxZoom: 16 },
        );
      } else {
        map.flyTo([destLat, destLng], 16, { duration: 1 });
      }
    }

    // 2. Open Google Maps safely with explicit coordinates (never throws directions error)
    let mapsUrl = "";
    if (
      driverLocation &&
      typeof driverLocation.latitude === "number" &&
      typeof driverLocation.longitude === "number"
    ) {
      mapsUrl = `https://www.google.com/maps/dir/${driverLocation.latitude},${driverLocation.longitude}/${destLat},${destLng}`;
    } else {
      mapsUrl = `https://www.google.com/maps?q=${destLat},${destLng}`;
    }

    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <WorkspacePage title="संकलन तथा चालक नक्सा (Collection & Driver Map)">
      {/* ────────────────── Main Tab Switcher ────────────────── */}
      <div className="mb-3 flex items-center gap-2 border-b border-border pb-2.5">
        <button
          type="button"
          onClick={() => setActiveTab("map")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === "map"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground border border-border"
          }`}
        >
          <MapPin className="size-3.5" />
          <span>🗺️ नक्सा दृश्य (Map View)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("journey")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === "journey"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground border border-border"
          }`}
        >
          <Target className="size-3.5" />
          <span>🚀 संकलन यात्रा सुरु गर्नुहोस् (Start Collection Journey)</span>
        </button>
      </div>

      {/* Journey Tab Content */}
      <div className={activeTab === "journey" ? "block" : "hidden"}>
        <CollectionJourneyTab
          customersWithDues={customersWithDues}
          userId={userId}
          navigate={navigate}
        />
      </div>

      {/* Map Tab Content */}
      <div className={activeTab === "map" ? "block" : "hidden"}>
        {/* Top Controls & Metrics Bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border bg-card p-3 shadow-xs">
        {/* Left: Quick Metrics */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 px-2.5 py-1 text-destructive font-bold">
            <span className="size-2 rounded-full bg-destructive animate-pulse" />
            <span>कुल बाँकी: {money(totalDuesAmount)}</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-muted-foreground font-semibold">
            <AlertTriangle className="size-3 text-warning" />
            <span>{customersWithDueCount} ग्राहकको बक्यौता</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-muted-foreground font-semibold">
            <MapPin className="size-3 text-primary" />
            <span>
              {filteredCustomers.length} नक्सामा ({exactGpsCount > 0 ? `${exactGpsCount} GPS` : ""}
              {exactGpsCount > 0 && approximateCount > 0 ? " • " : ""}
              {approximateCount > 0 ? `${approximateCount} वडा क्षेत्र` : ""})
            </span>
          </div>
        </div>

        {/* Right: Driver Location & Map Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Ward filter dropdown */}
          <SearchSelect
            className="w-36"
            value={selectedWard}
            onChange={(v) => {
              setSelectedWard(v);
              setSelectedTole("all");
            }}
            placeholder="सबै वडा (All Wards)"
            options={[
              { value: "all", label: "सबै वडा (All Wards)" },
              ...Array.from({ length: 16 }, (_, i) => ({ value: String(i + 1), label: `वडा नं. ${i + 1}` })),
            ]}
          />

          {/* Tole filter dropdown */}
          <SearchSelect
            className="w-36"
            value={selectedTole}
            onChange={(v) => setSelectedTole(v)}
            placeholder="सबै टोल (All Toles)"
            options={[
              { value: "all", label: "सबै टोल (All Toles)" },
              ...toleOptions.map((t) => ({ value: t, label: t })),
            ]}
          />

          {/* Hide/Show Map Overlays Button */}
          <Button
            type="button"
            size="sm"
            variant={hideBoxes ? "secondary" : "outline"}
            onClick={() => setHideBoxes((v) => !v)}
            className={`h-8 px-2.5 text-xs font-bold gap-1.5 ${
              hideBoxes ? "border-primary/50 bg-primary/10 text-primary" : "text-muted-foreground"
            }`}
            title={hideBoxes ? "नक्सामा बक्सहरू देखाउनुहोस् (Show Boxes)" : "नक्सामा बक्सहरू लुकाउनुहोस् (Hide Boxes)"}
          >
            {hideBoxes ? <Eye className="size-3.5 text-primary" /> : <EyeOff className="size-3.5" />}
            <span>{hideBoxes ? "बक्स देखाउनुहोस्" : "लुकाउनुहोस्"}</span>
          </Button>

          {/* Refresh Button */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => query.refetch()}
            className="h-8 px-2 text-xs font-bold gap-1 text-primary hover:bg-primary/10"
            title="ग्राहक तथा बक्यौता विवरण ताजा गर्नुहोस् (Refresh)"
          >
            <RotateCw className="size-3.5" /> ताजा
          </Button>

          {/* Driver Location Toggle Button */}
          <Button
            type="button"
            size="sm"
            variant={trackingLocation ? "default" : "outline"}
            onClick={toggleLocationTracking}
            className={`gap-1.5 text-xs font-bold ${
              trackingLocation
                ? "bg-info hover:bg-info/90 text-info-foreground shadow-md"
                : "border-primary/40 text-primary hover:bg-primary/10"
            }`}
          >
            <LocateFixed className={`size-3.5 ${trackingLocation ? "animate-spin" : ""}`} />
            {trackingLocation
              ? "लोकेसन सक्रिय छ (GPS ON)"
              : "मेरो लोकेसन सुरु गर्नुहोस् (Access GPS)"}
          </Button>

          {/* Manual Placement Button */}
          <Button
            type="button"
            size="sm"
            variant={settingDriverMode ? "secondary" : "outline"}
            onClick={() => {
              setSettingDriverMode(!settingDriverMode);
              if (!settingDriverMode) {
                setLocationError("");
                setLocatingStatus("👉 नक्सामा चालक/गाडी भएको ठाउँमा क्लिक गर्नुहोस्...");
              } else {
                setLocatingStatus("");
              }
            }}
            className={`h-8 text-xs gap-1 ${settingDriverMode ? "border-warning/50 bg-warning/10 text-warning font-bold" : ""}`}
            title="नक्सामा जहाँ हुनुहुन्छ त्यहाँ क्लिक गरेर गाडी राख्न सक्नुहुन्छ"
          >
            <MousePointer className="size-3.5" />
            {settingDriverMode ? "नक्सामा थिच्नुहोस्..." : "📍 नक्सामा गाडी राख्नुहोस्"}
          </Button>

          {driverLocation && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={centerOnDriver}
              className="h-8 text-xs gap-1 text-info border-info/50 hover:bg-info/10"
              title="गाडी भएको ठाउँमा जानुहोस्"
            >
              <Car className="size-3.5" /> म भएको ठाउँ
            </Button>
          )}

          {/* Quick Zoom Buttons */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={zoomToBirendranagar}
            className="h-8 text-xs gap-1"
            title="वीरेन्द्रनगर जुम"
          >
            <Compass className="size-3.5 text-primary" /> वीरेन्द्रनगर
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={zoomToNepal}
            className="h-8 text-xs gap-1 text-muted-foreground"
            title="सम्पूर्ण नेपाल दृश्य"
          >
            नेपाल नक्सा
          </Button>

          <Button
            type="button"
            size="sm"
            variant={sidebarOpen ? "secondary" : "outline"}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 text-xs gap-1"
          >
            <Filter className="size-3" /> ग्राहक सूची ({filteredCustomers.length})
          </Button>
        </div>
      </div>

      {locatingStatus && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-info/10 border border-info/20 p-2 text-xs text-info font-medium">
          <LocateFixed className="size-3.5 shrink-0 animate-spin text-info" />
          <span>{locatingStatus}</span>
        </div>
      )}

      {locationError && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-warning/10 border border-warning/30 p-2.5 text-xs text-warning">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-warning" />
            <span>{locationError}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[11px] font-bold border-warning/50 text-warning hover:bg-warning/10"
            onClick={() => {
              setSettingDriverMode(true);
              setLocationError("");
              setLocatingStatus("👉 नक्सामा चालक/गाडी भएको ठाउँमा क्लिक गर्नुहोस्...");
            }}
          >
            नक्सामा थिच्नुहोस्
          </Button>
        </div>
      )}

      {/* Main Map View Area with Floating Overlay Panels */}
      {/* leaflet-map-wrapper creates an isolated stacking context so Leaflet's
          internal z-indexes don't bleed above the sticky app navbar on mobile. */}
      <div
        ref={mapWrapperRef}
        className={`leaflet-map-wrapper relative w-full overflow-hidden rounded-xl border-2 border-border shadow-lg ${
          mapFull ? "map-fullscreen" : ""
        }`}
      >
        {/* Leaflet Map Canvas */}
        <div
          ref={mapContainerRef}
          className={`h-full w-full bg-muted ${settingDriverMode ? "cursor-crosshair" : ""}`}
        />

        {/* Map view controls: navigate, hide boxes, map style */}
        <div className="absolute top-3 right-3 z-[1001] flex items-center gap-1.5 bg-card/95 backdrop-blur-md p-1 pl-1.5 rounded-full border border-border shadow-md">
          {selectedCustomer && (
            <button
              type="button"
              title="ग्राहकसम्म Google Maps navigation (Navigate)"
              onClick={() => handleOpenDirections(selectedCustomer)}
              className="rounded-full bg-primary p-1.5 text-white shadow-xs hover:bg-primary/90"
            >
              <Navigation className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            title={hideBoxes ? "बक्सहरू देखाउनुहोस् (Show info boxes)" : "नक्सामा बक्सहरू लुकाउनुहोस् (Hide boxes)"}
            onClick={() => setHideBoxes((v) => !v)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              hideBoxes
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/70 hover:bg-muted text-foreground border border-border/60"
            }`}
          >
            {hideBoxes ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            <span>{hideBoxes ? "बक्स देखाउनुहोस्" : "लुकाउनुहोस्"}</span>
          </button>
          {/* Map Style Selector */}
          <select
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value as MapStyleKey)}
            className="max-w-[155px] sm:max-w-[175px] truncate rounded-full bg-card px-2 py-1 text-[11px] text-foreground border border-border/80 hover:bg-accent cursor-pointer focus:outline-none"
            title="नक्सा प्रकार छान्नुहोस् (Select map style)"
          >
            {MAP_STYLE_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.keys.map((key) => (
                  <option key={key} value={key}>{MAP_STYLES[key].label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Live team members on this route (updates in real time; works in fullscreen) */}
        {liveMembers.length > 0 && !hideBoxes && (
          <div className="absolute bottom-3 right-3 z-[1000] max-w-[220px] rounded-lg border border-border/80 bg-card/95 p-2.5 text-[11px] shadow-lg backdrop-blur-md">
            <div className="mb-1.5 flex items-center gap-1 font-bold text-foreground">
              <Car className="size-3.5 text-info" />
              <span>लाइभ टोली ({liveMembers.length})</span>
            </div>
            <div className="space-y-1 text-muted-foreground">
              {liveMembers.map((m) => {
                const st = TEAM_ROLE_STYLE[m.role] ?? TEAM_ROLE_STYLE.other;
                return (
                  <div key={m.userId} className="flex items-center gap-1.5">
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded-md text-[10px]"
                      style={{ background: st.color }}
                    >
                      {st.emoji}
                    </span>
                    <span className="truncate font-semibold text-foreground">
                      {m.name || st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Floating Bubble Legend on Top-Left */}
        {!hideBoxes && (
        <div className="absolute top-3 left-3 z-[1000] rounded-lg bg-card/95 backdrop-blur-md p-2.5 shadow-lg border border-border/80 text-[11px] max-w-[210px]">
          <div className="font-bold text-foreground mb-1.5 flex items-center gap-1">
            <span className="size-2 rounded-full bg-destructive" />
            <span>बक्यौता रकम अनुसार बबल (Dues)</span>
          </div>
          <div className="space-y-1 text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="size-6 rounded-full bg-destructive text-destructive-foreground font-mono text-[9px] font-bold flex items-center justify-center shrink-0">
                15k
              </span>
              <span>धेरै बक्यौता (&gt; १० हजार)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-5 rounded-full bg-destructive text-destructive-foreground font-mono text-[8px] font-bold flex items-center justify-center shrink-0">
                5k
              </span>
              <span>मध्यम (५ - १० हजार)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-4 rounded-full bg-destructive/60 text-destructive-foreground font-mono text-[7px] font-bold flex items-center justify-center shrink-0">
                1k
              </span>
              <span>सामान्य (&lt; ५ हजार)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-success shrink-0" />
              <span>चुक्ता / कुनै बाँकी छैन</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border border-warning bg-warning/20" />
              <span>पहेँलो किनारा: वडा/टोल क्षेत्र</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="size-2.5 rounded-full border border-white bg-destructive" />
              <span>सेतो किनारा: निश्चित GPS पिन</span>
            </div>
          </div>
        </div>
        )}

        {/* Setting Driver Mode Alert Banner on Map */}
        {settingDriverMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] rounded-lg bg-warning text-warning-foreground font-bold text-xs px-3 py-1.5 shadow-xl animate-bounce flex items-center gap-1.5">
            <MousePointer className="size-4" />
            <span>नक्सामा जहाँ गाडी छ त्यहाँ क्लिक गर्नुहोस्</span>
          </div>
        )}

        {/* Selected Customer Floating Card (Bottom-Center / Bottom-Left) */}
        {selectedCustomer && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-[1000] rounded-xl bg-card/95 backdrop-blur-md p-4 shadow-2xl border-2 border-primary/50 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-start justify-between gap-2 border-b pb-2 mb-2.5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-base text-foreground">
                    {selectedCustomer.name}
                  </h3>
                  <span className="rounded bg-primary/10 border border-primary/30 px-1.5 py-0.5 font-mono text-xs font-bold text-primary">
                    कार्ड: {selectedCustomer.card}
                  </span>
                  {selectedCustomer.isApproximateArea && (
                    <span className="rounded bg-warning/10 border border-warning/30 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                      वडा {selectedCustomer.ward} क्षेत्र
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  वडा {selectedCustomer.ward}, टोल: {selectedCustomer.tole}
                  {selectedCustomer.full_address && ` • ${selectedCustomer.full_address}`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {/* Customer Due Highlight & Distance */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-center">
                <span className="block text-[10px] text-muted-foreground">
                  बाँकी बक्यौता (Due Amount)
                </span>
                <span className="font-mono text-base font-extrabold text-destructive">
                  {selectedCustomer.dueAmount > 0
                    ? money(selectedCustomer.dueAmount)
                    : "✓ कुनै छैन"}
                </span>
                {selectedCustomer.dueMonths.length > 0 && (
                  <span className="block text-[10px] font-semibold text-destructive">
                    {selectedCustomer.dueMonths.length} महिना बाँकी ({selectedCustomer.overdueCount}{" "}
                    Overdue)
                  </span>
                )}
              </div>

              <div className="rounded-lg bg-muted/60 p-2 text-center flex flex-col justify-center">
                <span className="block text-[10px] text-muted-foreground">
                  मासिक दर (Monthly Rate)
                </span>
                <span className="font-mono text-sm font-bold text-foreground">
                  {money(selectedCustomer.monthlyFee)}/महिना
                </span>
                {selectedCustomer.distanceFromDriver !== undefined ? (
                  <div className="mt-1 pt-1 border-t border-border/60">
                    <span className="block text-xs font-extrabold text-info">
                      📍 {formatDistance(selectedCustomer.distanceFromDriver)} टाढा
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {formatDrivingTime(selectedCustomer.distanceFromDriver)}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSettingDriverMode(true);
                      setLocatingStatus("👉 नक्सामा चालक/गाडी भएको ठाउँमा क्लिक गर्नुहोस्...");
                    }}
                    className="mt-1 text-[10px] font-bold text-info hover:underline"
                  >
                    + गाडीको स्थान तोक्नुहोस्
                  </button>
                )}
              </div>
            </div>

            {/* Actions: Navigation & Receipt Creation */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
              {/* Phone Call */}
              {selectedCustomer.phone && (
                <Button asChild size="sm" variant="outline" className="h-9 gap-1 text-xs">
                  <a href={`tel:${selectedCustomer.phone}`}>
                    <Phone className="size-3.5 text-success" />
                    <span>फोन ({selectedCustomer.phone})</span>
                  </a>
                </Button>
              )}

              {/* Customer Photo (fullscreen viewer) */}
              <CustomerPhotoButton value={selectedCustomer.locality_photo} />

              {/* Google Maps Turn-by-Turn Driving Navigation */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleOpenDirections(selectedCustomer)}
                className="h-9 gap-1 text-xs border-info/40 text-info hover:bg-info/10"
                title="Google Maps मा दिशा हेर्नुहोस्"
              >
                <Navigation className="size-3.5" />
                <span>दिशा (Drive)</span>
              </Button>

              {/* ONE-CLICK CREATE RECEIPT */}
              <Button
                type="button"
                size="sm"
                onClick={() => handleCreateReceipt(selectedCustomer)}
                className="flex-1 h-9 gap-1.5 bg-primary font-extrabold text-primary-foreground hover:opacity-90 shadow-md"
              >
                <Receipt className="size-4" />
                <span>रसिद काट्नुहोस्</span>
              </Button>
            </div>
          </div>
        )}

        {/* Customer List Drawer (Collapsible Right Side) */}
        {sidebarOpen && (
          <div
            className={`absolute top-0 right-0 bottom-0 z-[1000] w-full sm:w-80 bg-card/95 backdrop-blur-md shadow-2xl border-l border-border flex flex-col animate-in slide-in-from-right duration-200`}
          >
            <div className="p-3 border-b">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">बक्यौता (Dues)</span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <>
                <div className="p-3 border-b space-y-2 bg-muted/20">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      className="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      placeholder="नाम, कार्ड वा टोल खोज्नुहोस्..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={filterOnlyDues}
                        onChange={(e) => setFilterOnlyDues(e.target.checked)}
                        className="rounded border"
                      />
                      <span>बाँकी बक्यौता मात्र</span>
                    </label>

                    <SearchSelect
                      className="w-32"
                      value={ward}
                      onChange={(v) => setWard(v)}
                      placeholder="सबै वडा (All)"
                      options={[
                        { value: "", label: "सबै वडा (All)" },
                        ...Array.from({ length: 16 }, (_, i) => ({ value: String(i + 1), label: `वडा ${i + 1}` })),
                      ]}
                    />
                  </div>
                </div>

                {/* Scrollable Customer Rows */}
                <div className="flex-1 overflow-y-auto divide-y divide-border">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      कुनै ग्राहक फेला परेन।
                    </div>
                  ) : (
                    filteredCustomers.map((c) => {
                      const isSelected =
                        selectedCustomer?.card === c.card && selectedCustomer?.ward === c.ward;

                      return (
                        <div
                          key={`${c.ward}-${c.card}`}
                          onClick={() => handleSelectCustomer(c)}
                          className={`p-3 text-xs cursor-pointer transition-colors hover:bg-accent/60 ${
                            isSelected ? "bg-primary/10 border-l-4 border-primary" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <div className="font-bold text-foreground flex items-center gap-1.5">
                                <span>{c.name}</span>
                                {!c.isApproximateArea ? (
                                  <span title="निश्चित GPS पिन">
                                    <MapPin className="size-3 text-success" />
                                  </span>
                                ) : (
                                  <span
                                    title="वडा क्षेत्र अनुसार"
                                    className="text-[10px] text-warning font-normal"
                                  >
                                    (वडा {c.ward})
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                कार्ड: <b>{c.card}</b> • वडा {c.ward}, {c.tole}
                              </div>
                            </div>

                            <div className="text-right">
                              <span
                                className={`font-mono font-bold block ${
                                  c.dueAmount > 0
                                    ? "text-destructive"
                                    : "text-success"
                                }`}
                              >
                                {c.dueAmount > 0 ? money(c.dueAmount) : "चुक्ता"}
                              </span>
                              {c.distanceFromDriver !== undefined && (
                                <span className="text-[10px] font-semibold text-info">
                                  {formatDistance(c.distanceFromDriver)}
                                </span>
                              )}
                            </div>
                          </div>

                          {c.dueMonths.length > 0 && (
                            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>{c.dueMonths.length} महिना बाँकी</span>
                              <span className="text-primary font-semibold flex items-center gap-0.5">
                                नक्सामा दुरी हेर्नुहोस् <ChevronRight className="size-3" />
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            </div>
          </div>
        )}
      </div>
      </div>
    </WorkspacePage>
  );
}
