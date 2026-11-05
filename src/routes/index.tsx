import { createFileRoute, Link } from "@tanstack/react-router";
import { useAppConfig } from "@/lib/app-config";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAppState, SignInPanel } from "@/components/app-shell";
import { BSDatePicker } from "@/components/bs-date-picker";
import { ReceiptVoucher } from "@/components/receipt-voucher";
import { getReceiptData, lookupCustomerByCard, saveReceipt } from "@/lib/receipts.functions";
import { getRpAccounts } from "@/lib/workspace.functions";
import {
  MONTHS,
  FISCAL_MONTHS,
  MODES,
  np,
  todayBS,
  fiscalYear,
  fiscalLabel,
  FISCAL_YEARS,
  monthYear,
  matchingPeople,
  validateReceipt,
  validateReference,
  validateDateInFiscalYear,
  getCustomerTotalRate,
  getDueMonths,
  mergeOpeningDues,
  DEFAULT_PLANS,
  type Person,
  type Receipt,
  type PlanItem,
  type DueMonth,
} from "@/lib/receipt-rules";
import { CameraBarcodeScanner } from "@/components/camera-barcode-scanner";
import { ScanLine, X, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

const money = (n: number) => "रु. " + n.toLocaleString("en-IN");

export type ReceiptSearchParams = {
  card?: string | undefined;
  ward?: string | undefined;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): ReceiptSearchParams => ({
    card: typeof search["card"] === "string" ? search["card"] : undefined,
    ward: typeof search["ward"] === "string" ? search["ward"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "New Receipt — Sangstha" },
      {
        name: "description",
        content: "वडा कार्यालयको फोहोरमैला व्यवस्थापन रसिद, महिनाअनुसार भुक्तानी र प्रिन्ट।",
      },
      { property: "og:title", content: "Sangstha — Payment Receipt" },
      {
        property: "og:description",
        content: "Nepali receipt system with multi-month payments, payment mode and contact.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

/* ─────────────── parse QR/barcode scan ─────────────── */
function parseScannedData(raw: string, people: Person[], ward: string): Person | null {
  let cardCandidate = "";
  let phoneCandidate = "";
  let qrWard = "";
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") {
      cardCandidate = String(obj.card ?? "");
      phoneCandidate = String(obj.phone ?? "");
      qrWard = String(obj.ward ?? "");
    }
  } catch {
    /* not JSON */
  }
  if (!cardCandidate && !phoneCandidate) cardCandidate = raw.trim();
  // Labeled formats like "CARD: 1234", "कार्ड = 001", "card-1234"
  if (!cardCandidate || !/[\dA-Za-z]/.test(cardCandidate)) cardCandidate = "";
  if (!cardCandidate) {
    const labelMatch = raw.match(/(?:card|कार्ड)\s*[:=-]?\s*([A-Za-z0-9]+)/i);
    if (labelMatch?.[1]) cardCandidate = labelMatch[1];
  }

  const norm = (v: string) => v.replace(/\D/g, "").replace(/^0+/, "");
  // Prefer the customer that matches the ward embedded in the QR, then the
  // currently selected ward, then any ward.
  const byCardExact = (c: string) => {
    const all = people.filter((x) => x.card.toLowerCase() === c.toLowerCase());
    if (qrWard) {
      const m = all.find((x) => x.ward === qrWard);
      if (m) return m;
    }
    return all.find((x) => x.ward === ward) || all[0];
  };
  const byCardNorm = (c: string) => {
    const all = people.filter((x) => norm(x.card) === norm(c) && norm(c) !== "");
    if (qrWard) {
      const m = all.find((x) => x.ward === qrWard);
      if (m) return m;
    }
    return all.find((x) => x.ward === ward) || all[0];
  };

  if (cardCandidate) {
    const m = byCardExact(cardCandidate) || byCardNorm(cardCandidate);
    if (m) return m;
  }
  if (phoneCandidate) {
    const p = norm(phoneCandidate);
    if (p) {
      const m =
        (qrWard
          ? people.find((x) => x.ward === qrWard && x.phone && norm(x.phone) === p)
          : undefined) ||
        people.find((x) => x.ward === ward && x.phone && norm(x.phone) === p) ||
        people.find((x) => x.phone && norm(x.phone) === p);
      if (m) return m;
    }
  }
  return null;
}

/** Extract a card/music number from a scanned raw string (same rules as parseScannedData). */
function scanCardCandidate(raw: string): string {
  let candidate = "";
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") candidate = String(obj.card ?? "");
  } catch {
    /* not JSON */
  }
  if (!candidate) candidate = raw.trim();
  if (!/[\dA-Za-z]/.test(candidate)) {
    const labelMatch = raw.match(/(?:card|कार्ड)\s*[:=-]?\s*([A-Za-z0-9]+)/i);
    candidate = labelMatch?.[1] || "";
  }
  return candidate.trim();
}

function Index() {
  const searchParams = Route.useSearch();
  const { ward, setWard, signedIn, ready, signOut } = useAppState();
  const appConfig = useAppConfig();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>(DEFAULT_PLANS);
  const [payments, setPayments] = useState<{ card: string; month: number; year?: number }[]>([]);
  const [date, setDate] = useState("");
  const [year, setYear] = useState("");
  const [p, setP] = useState<Person>({
    card: "",
    name: "",
    ward: ward || "1",
    tole: "",
    phone: "",
  });
  const [mode, setMode] = useState("");
  const [accounts, setAccounts] = useState<
    Array<{
      id: string;
      name: string;
      account_type: "cash" | "bank";
      account_number: string | null;
      opening_balance: number;
    }>
  >([]);
  const [accountId, setAccountId] = useState("");
  const [sel, setSel] = useState<Record<string, string>>({});

  useEffect(() => {
    if (signedIn && !ward) {
      setWard("1");
    }
  }, [signedIn, ward, setWard]);

  useEffect(() => {
    if (searchParams.ward && searchParams.ward !== ward) {
      setWard(searchParams.ward);
    }
  }, [searchParams.ward, ward, setWard]);

  useEffect(() => {
    if (searchParams.card && people.length > 0) {
      const match = people.find((x) => x.card.toLowerCase() === searchParams.card?.toLowerCase());
      if (match) {
        setP({ ...match });
      }
    }
  }, [searchParams.card, people]);
  const [err, setErr] = useState("");
  const [printed, setPrinted] = useState<Receipt | null>(null);
  const [nextNo, setNextNo] = useState(1);
  const [refNo, setRefNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(false);
  const [revision, setRevision] = useState(0);

  /* scanner */
  const [scanMode, setScanMode] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [scanErr, setScanErr] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  const fetchRecords = useServerFn(getReceiptData);
  const lookupFn = useServerFn(lookupCustomerByCard);
  const saveRecord = useServerFn(saveReceipt);
  const fetchAccounts = useServerFn(getRpAccounts);
  const queryClient = useQueryClient();

  /* cash/bank accounts for the भुक्तानी खाता picker (नगद तथा बैंक मास्टर) */
  useEffect(() => {
    let active = true;
    if (!signedIn) {
      setAccounts([]);
      setAccountId("");
      return;
    }
    fetchAccounts()
      .then((arr) => {
        if (active) setAccounts(arr);
      })
      .catch(() => {
        if (active) setAccounts([]);
      });
    return () => {
      active = false;
    };
  }, [signedIn, revision]);

  useEffect(() => {
    setDate(todayBS());
  }, []);
  useEffect(() => {
    setYear(String(fiscalYear(todayBS()) ?? 2082));
  }, []);

  useEffect(() => {
    if (!signedIn || !ward || !year) {
      setPeople([]);
      setReceipts([]);
      setPayments([]);
      setNextNo(1);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setPeople([]);
    setReceipts([]);
    setPayments([]);
    fetchRecords({ data: { ward, year: Number(year) } })
      .then((data) => {
        if (!active) return;
        setPeople(data.people);
        setReceipts(data.receipts);
        setPayments(data.payments);
        setNextNo(data.nextNo);
        if (data.plans && data.plans.length > 0) setPlans(data.plans);
      })
      .catch(() => {
        if (active) setErr("Could not load records. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [signedIn, ward, year, revision]);

  useEffect(() => {
    // When the ward changes, clear the form — but keep a scanned customer whose
    // own ward matches the newly selected one.
    setP((prev) => (prev.name && prev.ward === ward ? prev : { card: "", name: "", ward, tole: "", phone: "" }));
    setSel({});
    setMode("");
    setPrinted(null);
    setAccountId("");
  }, [ward]);

  useEffect(() => {
    if (scanMode) setTimeout(() => scanRef.current?.focus(), 80);
  }, [scanMode]);

  const matches = useMemo(
    () => matchingPeople(people, ward, p.name, p.card, p.phone),
    [people, ward, p.name, p.card, p.phone],
  );
  const found = useMemo(
    () => people.find((x) => x.ward === ward && x.card === p.card),
    [people, ward, p.card],
  );

  /* paid set */
  const paid = useMemo(
    () =>
      new Set(
        payments
          .filter((x) => x.card === p.card)
          .map((x) => `${x.year ?? Number(year)}:${x.month}`),
      ),
    [payments, p.card, year],
  );

  /* due months from joining date — merged with manual opening dues */
  const dueMonths: DueMonth[] = useMemo(() => {
    const auto = found?.joining_date ? getDueMonths(found.joining_date, paid, todayBS()) : [];
    return mergeOpeningDues(auto, found?.opening_dues, paid);
  }, [found?.card, found?.joining_date, found?.opening_dues, paid]);

  /* auto-select all due months when customer changes */
  useEffect(() => {
    if (!found || dueMonths.length === 0) {
      setSel({});
      return;
    }
    const defRate = String(getCustomerTotalRate(found, plans) || 500);
    const auto: Record<string, string> = {};
    dueMonths.forEach(({ fy, month, amount }) => {
      auto[`${fy}:${month}`] = amount !== undefined ? String(amount) : defRate;
    });
    setSel(auto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found?.card, found?.joining_date, found?.opening_dues]);

  const dueByFY = useMemo(() => {
    const map = new Map<number, DueMonth[]>();
    dueMonths.forEach((dm) => {
      if (!map.has(dm.fy)) map.set(dm.fy, []);
      map.get(dm.fy)!.push(dm);
    });
    return map;
  }, [dueMonths]);

  const overdueCount = dueMonths.filter((d) => d.isOverdue).length;

  const defaultRate = useMemo(() => {
    if (!found) return "500";
    return String(getCustomerTotalRate(found, plans) || 500);
  }, [found, plans]);

  const total = Object.values(sel).reduce((a, v) => a + (Number(v) || 0), 0);
  const selectedCount = Object.keys(sel).length;

  /* person helpers */
  const handleCardChange = (c: string) => {
    setSuggestions(true);
    const exact = people.find(
      (x) => x.ward === ward && x.card.toLowerCase() === c.trim().toLowerCase(),
    );
    if (exact) setP({ ...exact });
    else setP((prev) => ({ ...prev, card: c }));
  };
  const handleNameChange = (n: string) => {
    setSuggestions(true);
    const exact = people.find(
      (x) => x.ward === ward && x.name.trim().toLowerCase() === n.trim().toLowerCase(),
    );
    if (exact) setP({ ...exact });
    else setP((prev) => ({ ...prev, name: n }));
  };
  const handlePhoneChange = (raw: string) => {
    const ph = raw.replace(/\D/g, "");
    setSuggestions(true);
    const exact = people.find((x) => x.ward === ward && x.phone && x.phone === ph);
    if (exact) setP({ ...exact });
    else setP((prev) => ({ ...prev, phone: ph }));
  };
  const selectPerson = (person: Person) => {
    setP({ ...person });
    setSuggestions(false);
  };

  const toggle = (fy: number, m: number) => {
    const key = `${fy}:${m}`;
    const targetDue = dueMonths.find((dm) => dm.fy === fy && dm.month === m);
    const rateToUse = targetDue?.amount !== undefined ? String(targetDue.amount) : defaultRate;
    setSel((s) => {
      const n = { ...s };
      if (key in n) delete n[key];
      else n[key] = rateToUse;
      return n;
    });
  };

  const handleScan = async (raw: string) => {
    let person = parseScannedData(raw, people, ward);
    if (!person) {
      // Local list only holds the selected ward — fall back to a server lookup
      for (const card of [scanCardCandidate(raw), raw.trim()]) {
        if (!card) continue;
        try {
          const remote = await lookupFn({ data: { card: card.substring(0, 30) } });
          if (remote) {
            person = remote as unknown as Person;
            break;
          }
        } catch {
          /* try next candidate */
        }
      }
    }
    if (!person) {
      setScanErr(`कार्ड "${raw.substring(0, 30)}" — People Master मा फेला परेन।`);
      return;
    }
    // The matched customer may belong to a different ward than currently selected —
    // follow the customer so their master data and dues line up.
    if (person.ward && person.ward !== ward) {
      setWard(person.ward);
    }
    setP({ ...person });
    setScanMode(false);
    setScanInput("");
    setScanErr("");
    setSuggestions(false);
  };

  async function save() {
    const months = Object.entries(sel)
      .map(([k, a]) => {
        const parts = k.split(":").map(Number);
        return { year: parts[0] as number, m: parts[1] as number, amt: Number(a) };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return (a.year ?? 0) - (b.year ?? 0);
        return FISCAL_MONTHS.indexOf(a.m ?? 0) - FISCAL_MONTHS.indexOf(b.m ?? 0);
      });
    if (!p.card.trim()) return setErr("कार्ड नं. आवश्यक छ।");
    if (!found) return setErr(`कार्ड नं. '${p.card}' People Master मा दर्ता छैन।`);
    const registeredCards = new Set(people.map((x) => x.card));
    const error =
      validateReference(refNo) ||
      validateDateInFiscalYear(date, Number(year), "रसिद मिति") ||
      validateReceipt(p, date, mode, months, registeredCards);
    if (error) return setErr(error);
    if (!mode) return setErr("भुक्तानी माध्यम छान्नुहोस् (नगद/बैंक)।");
    if (accounts.length === 0)
      return setErr(
        "नगद/बैंक खाता छैन — पहिले Receipts & Payments → नगद तथा बैंक मास्टर मा खाता थप्नुहोस्।",
      );
    if (!accountId) return setErr("कुन नगद/बैंक खाता छान्नुहोस्।");
    if (months.some((m) => paid.has(`${m.year}:${m.m}`)))
      return setErr("A selected month is already paid.");
    if (!signedIn) return setErr("Sign in to save receipts.");
    setBusy(true);
    setErr("");
    try {
      const chosenAcc = accounts.find((a) => a.id === accountId);
      const r = await saveRecord({
        data: {
          ...p,
          date,
          mode,
          months,
          year,
          ref: refNo.trim(),
          accountId: accountId || undefined,
          accountName: chosenAcc?.name,
        },
      });
      setPrinted(r);
      setSel({});
      setMode("");
      setRefNo("");
      setAccountId("");
      setSuggestions(false);
      setRevision((n) => n + 1);
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save receipt.");
      setRevision((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground animate-pulse">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span>प्रणाली खुल्दैछ (Checking credentials)…</span>
        </div>
      </div>
    );
  }

  if (!signedIn) {
    return <SignInPanel />;
  }

  const currentWard = ward || "1";

  const field =
    "w-full border-0 border-b-2 border-dotted border-border bg-transparent px-1 py-1 text-ink font-semibold outline-none focus:border-primary";

  return (
    <div className="min-h-screen px-4 py-8 font-sans">
      <div className="mx-auto max-w-3xl">
        <div className="no-print border-t-2 border-ink bg-card px-3 py-6 sm:px-6">
          {/* top bar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">वडा (Ward):</span>
              <select
                aria-label="Select ward"
                value={currentWard}
                onChange={(e) => {
                  setWard(e.target.value);
                  setP({ card: "", name: "", ward: e.target.value, tole: "", phone: "" });
                  setSel({});
                  setMode("");
                }}
                className="rounded-md border bg-card px-2.5 py-1 text-xs font-bold text-foreground focus:ring-1 focus:ring-primary outline-none"
              >
                {Array.from({ length: 16 }, (_, i) => String(i + 1)).map((w) => (
                  <option key={w} value={w}>
                    वडा नं. {w}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                <Link to="/landing">🌐 Landing Page</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPrinted(null);
                  void signOut();
                }}
                disabled={busy}
                className="h-8 text-xs text-muted-foreground hover:text-destructive"
              >
                Sign out
              </Button>
            </div>
          </div>

          <header className="text-center">
            <h1 className="text-2xl font-extrabold">
              वीरेन्द्रनगर नगरपालिका, {currentWard} नं. वडा कार्यालय
            </h1>
            <p className="text-sm text-muted-foreground">{appConfig.entity_name ? `${appConfig.entity_name}द्वारा संचालित` : ""}</p>
            <span className="mt-3 inline-block rounded bg-foreground px-4 py-1 font-bold text-background">
              फोहोरमैला व्यवस्थापन
            </span>
          </header>

          {loading && (
            <p className="mt-3 text-center" role="status">
              Loading records…
            </p>
          )}

          {/* ── Receipt fields ── */}
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <L t="र.नं.">
              <div className="py-1 text-xl font-extrabold text-primary">
                {loading ? "…" : signedIn ? nextNo : "—"}
              </div>
            </L>
            <div className="text-sm text-muted-foreground">
              <span>मिति (वि.सं.)</span>
              <BSDatePicker
                value={date}
                onChange={(v) => {
                  setDate(v);
                  const fy = fiscalYear(v);
                  if (fy) setYear(String(fy));
                  setPrinted(null);
                }}
              />
            </div>
            <L t="वडा नं.">
              <input className={field} value={p.ward} readOnly />
            </L>

            {/* Card # + scanner button */}
            <div className="relative">
              <L t="कार्ड नं. *">
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    className={field}
                    placeholder="उदा: 0001"
                    value={p.card}
                    maxLength={20}
                    onChange={(e) => handleCardChange(e.target.value)}
                  />
                  <button
                    type="button"
                    title="QR / Barcode स्क्यानर खोल्नुहोस्"
                    className="flex-shrink-0 rounded-lg border border-primary/40 bg-primary/10 p-1.5 text-primary hover:bg-primary/20"
                    onClick={() => {
                      setScanMode(true);
                      setScanErr("");
                      setScanInput("");
                    }}
                  >
                    <ScanLine className="size-4" />
                  </button>
                </div>
              </L>
            </div>

            <div className="relative col-span-2">
              <L t="फर्म/व्यक्ति श्री *">
                <input
                  className={field}
                  value={p.name}
                  maxLength={100}
                  placeholder="नाम टाइप वा खोज्नुहोस्"
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </L>
            </div>
            <div className="col-span-1">
              <L t="टोल *">
                <input
                  className={field}
                  value={p.tole}
                  maxLength={80}
                  placeholder="टोल"
                  readOnly={Boolean(found)}
                  onChange={(e) => setP({ ...p, tole: e.target.value })}
                />
              </L>
            </div>
            <div className="col-span-2">
              <L t="सम्पर्क नं.">
                <input
                  className={field}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="९८XXXXXXXX"
                  value={p.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                />
              </L>
            </div>
          </div>

          {/* suggestions */}
          {matches.length > 0 && suggestions && (
            <div className="mt-3 rounded-md border bg-popover p-2 shadow-lg">
              <div className="flex items-center justify-between border-b pb-1 px-2 text-xs font-bold text-muted-foreground">
                <span>फेला परेका ग्राहकहरू ({matches.length})</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[11px]"
                  onClick={() => setSuggestions(false)}
                >
                  बन्द
                </Button>
              </div>
              <div className="mt-1 divide-y max-h-48 overflow-y-auto">
                {matches.map((m) => (
                  <Button
                    variant="ghost"
                    key={`${m.ward}-${m.card}`}
                    className="h-auto min-h-10 w-full justify-start whitespace-normal px-3 py-2 text-left hover:bg-accent"
                    onClick={() => selectPerson(m)}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="font-bold">{m.name}</span>
                      <span className="font-semibold text-primary">कार्ड: {m.card}</span>
                      {m.plan && (
                        <span className="rounded bg-primary/10 px-1.5 text-xs font-semibold text-primary">
                          {m.plan}
                        </span>
                      )}
                      <span className="text-muted-foreground">टोल: {m.tole}</span>
                      {m.phone && <span className="text-muted-foreground">📞 {m.phone}</span>}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* found person banner */}
          {found ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-2.5 text-xs sm:text-sm text-green-800">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  ✓ <b>{found.name}</b>
                </span>
                <span className="text-muted-foreground">|</span>
                <span>
                  कार्ड: <b>{found.card}</b>
                </span>
                {found.plans && found.plans.length > 0 ? (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <div className="inline-flex flex-wrap gap-1">
                      {found.plans.map((sp, i) => (
                        <span
                          key={i}
                          className="rounded bg-primary/10 px-1.5 text-xs font-semibold text-primary"
                        >
                          {sp.name}
                          {sp.trips || sp.no_of_trips
                            ? ` (${sp.trips ?? sp.no_of_trips} ट्रिप)`
                            : ""}
                          {sp.quantity && sp.quantity > 1 ? ` ×${sp.quantity}` : ""} (रु.{" "}
                          {((sp.chargeable_amount || 0) * (sp.quantity || 1)).toLocaleString(
                            "en-IN",
                          )}
                          )
                        </span>
                      ))}
                    </div>
                    <span className="rounded bg-primary/20 px-1.5 text-xs font-bold text-ink">
                      मासिक: रु. {getCustomerTotalRate(found, plans).toLocaleString("en-IN")}
                    </span>
                  </>
                ) : found.plan ? (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span className="font-semibold text-primary">{found.plan}</span>
                  </>
                ) : null}
                {found.joining_date && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span>दर्ता: {np(found.joining_date)}</span>
                  </>
                )}
                <span className="text-muted-foreground">|</span>
                <span>
                  {found.municipality ? `${found.municipality}, ` : ""}टोल: {found.tole}
                </span>
                {found.pan && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span className="font-mono font-semibold">PAN: {found.pan}</span>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-green-800"
                onClick={() => {
                  setP({
                    card: "",
                    name: "",
                    ward,
                    tole: "",
                    phone: "",
                    email: "",
                    pan: "",
                    full_address: "",
                    district: "",
                    municipality: "",
                    plan: "",
                    joining_date: "",
                  });
                  setSel({});
                }}
              >
                खाली
              </Button>
            </div>
          ) : p.card.trim() || p.name.trim() || p.phone.trim() ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800">
              <span>⚠ यो ग्राहक People Master मा दर्ता छैन।</span>
              <Button
                asChild
                size="sm"
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Link to="/masters">People Master मा दर्ता गर्नुहोस्</Link>
              </Button>
            </div>
          ) : null}

          {/* ══════ DUE MONTHS GRID ══════ */}
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
              <div>
                <h2 className="text-base font-bold text-ink">बाँकी महिनाको भुक्तानी</h2>
                <p className="text-xs text-muted-foreground">
                  {found
                    ? dueMonths.length > 0
                      ? `दर्ता मिति (${np(found.joining_date ?? "")}) देखि स्वतः गणना — ${overdueCount > 0 ? `${overdueCount} महिना बाँकी` : "सबै तिरिएको"}`
                      : "✓ सबै महिना तिरिसकेको — कुनै बाँकी छैन"
                    : "ग्राहक छान्नुहोस् — बाँकी महिना स्वतः देखाइनेछ"}
                </p>
              </div>
              {found && dueMonths.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const a: Record<string, string> = {};
                      dueMonths.forEach(({ fy, month, amount }) => {
                        a[`${fy}:${month}`] = amount !== undefined ? String(amount) : defaultRate;
                      });
                      setSel(a);
                    }}
                  >
                    सबै छान्नुहोस्
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setSel({})}
                  >
                    खाली
                  </Button>
                </div>
              )}
            </div>

            {found && dueMonths.length > 0 ? (
              <div className="space-y-4">
                {Array.from(dueByFY.entries()).map(([fy, months]) => {
                  const fyTotal = months.reduce(
                    (s, { fy: f, month: m }) => s + (Number(sel[`${f}:${m}`]) || 0),
                    0,
                  );
                  const fyCount = months.filter(({ fy: f, month: m }) => `${f}:${m}` in sel).length;
                  return (
                    <div key={fy} className="rounded-lg border bg-card p-3 sm:p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink">आर्थिक वर्ष {fiscalLabel(fy)}</span>
                          {fyCount > 0 && (
                            <span className="rounded bg-accent px-2 py-0.5 text-xs font-semibold">
                              {fyCount} महिना · {money(fyTotal)}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              setSel((s) => {
                                const n = { ...s };
                                months.forEach(({ fy: f, month: m, amount }) => {
                                  n[`${f}:${m}`] =
                                    amount !== undefined ? String(amount) : defaultRate;
                                });
                                return n;
                              })
                            }
                          >
                            सबै
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setSel((s) => {
                                const n = { ...s };
                                months.forEach(({ fy: f, month: m }) => {
                                  delete n[`${f}:${m}`];
                                });
                                return n;
                              })
                            }
                          >
                            खाली
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {months.map(({ fy: f, month: m, isOverdue }) => {
                          const key = `${f}:${m}`;
                          const on = key in sel;
                          return (
                            <div
                              key={key}
                              className={`rounded border-2 p-2 transition-colors ${
                                on
                                  ? isOverdue
                                    ? "border-red-400 bg-red-50 shadow-sm dark:bg-red-950/30"
                                    : "border-primary bg-accent shadow-sm"
                                  : isOverdue
                                    ? "border-red-300/60 bg-red-50/40 hover:border-red-400"
                                    : "border-border hover:border-border/80"
                              }`}
                            >
                              <label className="flex cursor-pointer flex-wrap items-center gap-1.5 text-sm font-semibold">
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => toggle(f, m)}
                                  className="accent-primary"
                                />
                                {MONTHS[m]} {np(monthYear(f, m))}
                              </label>
                              {isOverdue ? (
                                <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-red-600">
                                  <AlertTriangle className="size-3" /> बाँकी (Overdue)
                                </div>
                              ) : (
                                <div className="mt-0.5 text-[11px] font-medium text-primary">
                                  यस महिना
                                </div>
                              )}
                              {on && (
                                <input
                                  className={`${field} mt-1 text-xs`}
                                  inputMode="numeric"
                                  value={sel[key]}
                                  onChange={(e) =>
                                    setSel({ ...sel, [key]: e.target.value.replace(/\D/g, "") })
                                  }
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : found && dueMonths.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 py-8 text-emerald-700 dark:bg-emerald-950/30">
                <CheckCircle2 className="size-8 text-emerald-500" />
                <p className="font-semibold">सबै महिना तिरिसकेको छ!</p>
                <p className="text-xs">All months cleared — no dues pending.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-muted bg-muted/20 py-10 text-center text-sm text-muted-foreground">
                माथि ग्राहक छान्नुहोस् — बाँकी महिना यहाँ देखाइनेछ
              </div>
            )}
          </div>

          {/* payment mode */}
          <h2 className="mt-6 font-bold">भुक्तानी माध्यम *</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODES.map((m) => (
              <Button
                variant={mode === m ? "default" : "outline"}
                aria-pressed={mode === m}
                key={m}
                onClick={() => setMode(m)}
                className="border-2 px-4 py-1 font-semibold"
              >
                {m}
              </Button>
            ))}
          </div>

          {/* cash / bank account from नगद तथा बैंक मास्टर */}
          {mode && (
            <div className="mt-3">
              <h2 className="font-bold">कुन खाता (नगद/बैंक) *</h2>
              <select
                aria-label="Cash or bank account"
                className="mt-2 h-10 w-full max-w-md rounded-md border bg-card px-3 font-semibold text-ink"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">छान्नुहोस्…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_type === "cash" ? "नगद (Cash)" : "बैंक (Bank)"} — {a.name}
                    {a.account_number ? ` (${a.account_number})` : ""}
                  </option>
                ))}
              </select>
              {accounts.length === 0 && (
                <p className="mt-1 text-xs font-semibold text-destructive">
                  कुनै नगद/बैंक खाता छैन — रसिद सुरक्षित गर्नुअघि Receipts & Payments → नगद तथा बैंक
                  मास्टर मा खाता थप्नुहोस्।
                </p>
              )}
            </div>
          )}

          {/* payment reference – normal size, below payment mode */}
          <div className="mt-4">
            <label className="block text-sm text-muted-foreground">
              भुक्तानी सन्दर्भ नं. (Payment Reference) *
              <input
                aria-label="Payment Reference Number"
                className="w-full border-0 border-b-2 border-dotted border-border bg-transparent px-1 py-1 font-semibold text-ink outline-none focus:border-primary"
                value={refNo}
                maxLength={40}
                placeholder="eSewa/Khalti/Bank Ref. वा नगद रसिद नं."
                onChange={(e) => setRefNo(e.target.value)}
              />
            </label>
          </div>

          {/* total + save */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded border-2 border-foreground p-4">
            <div>
              <div className="text-sm">कुल जम्मा · {selectedCount} महिना</div>
              <div className="text-3xl font-extrabold text-ink">{money(total)}</div>
              {overdueCount > 0 && (
                <div className="mt-1 text-xs font-semibold text-red-600">
                  ⚠ {overdueCount} महिना बाँकी (Overdue)
                </div>
              )}
            </div>
            <Button
              onClick={save}
              disabled={busy || loading || !signedIn || !year}
              className="rounded bg-primary px-6 py-3 font-bold text-primary-foreground hover:opacity-90"
            >
              {busy ? "Saving…" : "सेभ र रसिद प्रिन्ट"}
            </Button>
          </div>
          {err && <p className="mt-3 font-semibold text-destructive">{err}</p>}
        </div>

        {printed && <ReceiptVoucher r={printed} onClose={() => setPrinted(null)} />}

        {receipts.length > 0 && (
          <div className="no-print mt-8 rounded-lg bg-card p-4">
            <h2 className="mb-2 font-bold">हालका रसिदहरू</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th>र.नं.</th>
                    <th>मिति</th>
                    <th>नाम</th>
                    <th>सम्पर्क</th>
                    <th>माध्यम</th>
                    <th className="text-right">रकम</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.slice(0, 15).map((r) => (
                    <tr
                      key={r.id ?? `${r.ward}-${r.year}-${r.no}`}
                      className="cursor-pointer border-b hover:bg-accent"
                      onClick={() => setPrinted(r)}
                    >
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => setPrinted(r)}>
                          {r.no}
                        </Button>
                      </td>
                      <td>{np(r.date)}</td>
                      <td>{r.name}</td>
                      <td>{r.phone}</td>
                      <td>{r.mode}</td>
                      <td className="text-right">{money(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ══════ SCANNER MODAL ══════ */}
      {scanMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-2xl my-auto">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold">
                <ScanLine className="size-5 text-primary" />
                लाइभ Barcode / QR स्क्यानर
              </h3>
              <button
                type="button"
                onClick={() => {
                  setScanMode(false);
                  setScanErr("");
                }}
                className="rounded-full p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* LIVE CAMERA BARCODE SCANNER */}
            <CameraBarcodeScanner
              onScan={(scanned) => handleScan(scanned)}
              onClose={() => setScanMode(false)}
            />

            {/* Manual / Handheld USB Scanner fallback */}
            <div className="mt-4 border-t border-border pt-3">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                वा कार्ड नं. टाइप गर्नुहोस् / USB स्क्यानर प्रयोग गर्नुहोस्:
              </label>
              <div className="relative flex gap-2">
                <input
                  ref={scanRef}
                  className="flex-1 rounded-lg border-2 border-primary/30 bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none"
                  placeholder="कार्ड नं. टाइप वा स्क्यान..."
                  value={scanInput}
                  autoComplete="off"
                  onChange={(e) => {
                    setScanInput(e.target.value);
                    setScanErr("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && scanInput.trim()) handleScan(scanInput.trim());
                  }}
                />
                <Button
                  onClick={() => {
                    if (scanInput.trim()) handleScan(scanInput.trim());
                  }}
                  disabled={!scanInput.trim()}
                >
                  खोज्नुहोस्
                </Button>
              </div>
            </div>

            {scanErr && (
              <p className="mt-2.5 flex items-center gap-1.5 rounded bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" /> {scanErr}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <p className="text-[11px] text-muted-foreground">
                स्क्यान भएपछि ग्राहक र बाँकी महिना स्वतः भरिनेछ।
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setScanMode(false);
                  setScanErr("");
                }}
              >
                बन्द
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function L({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-muted-foreground">
      {t}
      {children}
    </label>
  );
}
