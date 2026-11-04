import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAppState, SignInPanel } from "@/components/app-shell";
import {
  getRpData,
  getRpRefPreview,
  saveRpAccount,
  deleteRpAccount,
  saveRpTransaction,
  deleteRpTransaction,
} from "@/lib/workspace.functions";
import {
  np,
  todayBS,
  fiscalYear,
  FISCAL_YEARS,
  validateDateInFiscalYear,
  validateReference,
  type RPAccount,
  type RPTransaction,
  type RPParty,
} from "@/lib/receipt-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BSDatePicker } from "@/components/bs-date-picker";
import { RPTransactionVoucher } from "@/components/rp-transaction-voucher";
import {
  Wallet,
  Plus,
  Edit2,
  Trash2,
  Landmark,
  Banknote,
  ArrowLeftRight,
  ReceiptText,
  LogIn,
  Send,
  UserCheck,
  Eye,
} from "lucide-react";

export const Route = createFileRoute("/receipts-payments")({
  head: () => ({
    meta: [
      { title: "Receipts & Payments — Hami Yuwa Club" },
      {
        name: "description",
        content:
          "Cash and bank book for Hami Yuwa Club — petty cash and bank masters, receipts, payments and account transfers.",
      },
    ],
  }),
  component: RPPage,
});

type Tab = "accounts" | "receipt" | "payment" | "transfer";

type AccForm = {
  id?: string;
  account_type: "cash" | "bank";
  name: string;
  account_number: string;
  opening_balance: string;
  address: string;
  remarks: string;
};

type TxnForm = {
  txn_date: string;
  account_id: string;
  to_account_id: string;
  party_type: "" | "customer" | "donation" | "vendor" | "employee" | "tax";
  party_id: string;
  party_name: string;
  amount: string;
  remarks: string;
  manual_ref: string;
  company_name?: string;
  linked_event_id?: string;
  linked_event_title?: string;
};

const money = (v: number) => np((v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }));

function RPPage() {
  const app = useAppState();
  const queryClient = useQueryClient();
  const fetchRpDataFn = useServerFn(getRpData);
  const saveAccFn = useServerFn(saveRpAccount);
  const deleteAccFn = useServerFn(deleteRpAccount);
  const saveTxnFn = useServerFn(saveRpTransaction);
  const deleteTxnFn = useServerFn(deleteRpTransaction);

  const dataQuery = useQuery({
    queryKey: ["rp_data", app.userId],
    queryFn: () => fetchRpDataFn(),
    enabled: app.ready && app.signedIn,
  });

  const accounts: RPAccount[] = useMemo(() => dataQuery.data?.accounts || [], [dataQuery.data]);
  const transactions = useMemo(() => dataQuery.data?.transactions || [], [dataQuery.data]);
  const customers = useMemo(() => dataQuery.data?.customers || [], [dataQuery.data]);
  const vendors = useMemo(() => dataQuery.data?.vendors || [], [dataQuery.data]);
  const employees = useMemo(() => dataQuery.data?.employees || [], [dataQuery.data]);
  const events = useMemo(
    () => ((dataQuery.data as any)?.events as Array<{ id: string; title: string; locality?: string; status?: string }>) || [],
    [dataQuery.data],
  );
  const tds_sst = useMemo(
    () => (dataQuery.data as any)?.tds_sst || { accrued: 0, paid: 0, balance: 0 },
    [dataQuery.data],
  );

  const [tab, setTab] = useState<Tab>("receipt");
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [accForm, setAccForm] = useState<AccForm>({
    account_type: "cash",
    name: "",
    account_number: "",
    opening_balance: "",
    address: "",
    remarks: "",
  });
  const [txnForm, setTxnForm] = useState<TxnForm>({
    txn_date: todayBS(),
    account_id: "",
    to_account_id: "",
    party_type: "customer",
    party_id: "",
    party_name: "",
    company_name: "",
    linked_event_id: "",
    linked_event_title: "",
    amount: "",
    remarks: "",
    manual_ref: "",
  });

  const refPreviewFn = useServerFn(getRpRefPreview);
  const refPreview = useQuery({
    queryKey: ["rp_ref_preview", app.userId, txnForm.txn_date],
    queryFn: () => refPreviewFn({ data: { txn_date: txnForm.txn_date } }),
    enabled: app.ready && app.signedIn,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [viewing, setViewing] = useState<RPTransaction | null>(null);

  const accById = useMemo(() => {
    const map: Record<string, RPAccount> = {};
    for (const a of accounts) map[a.id] = a;
    return map;
  }, [accounts]);

  /** Opening + receipts + transfer-in − payments − transfer-out, per account */
  const balanceById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of accounts) map[a.id] = a.opening_balance || 0;
    for (const t of transactions) {
      if (t.txn_type === "receipt") {
        map[t.account_id] = (map[t.account_id] || 0) + t.amount;
      } else if (t.txn_type === "payment") {
        map[t.account_id] = (map[t.account_id] || 0) - t.amount;
      } else {
        map[t.account_id] = (map[t.account_id] || 0) - t.amount;
        if (t.to_account_id) map[t.to_account_id] = (map[t.to_account_id] || 0) + t.amount;
      }
    }
    return map;
  }, [accounts, transactions]);

  /** Newest first so every freshly saved receipt/payment/transfer appears at the top */
  const shownTxns = useMemo(
    () => transactions.filter((t) => (tab === "accounts" ? true : t.txn_type === tab)),
    [transactions, tab],
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["rp_data"] });
    void queryClient.invalidateQueries({ queryKey: ["rp_ref_preview"] });
  };

  const openAccModal = (type: "cash" | "bank", acc?: RPAccount) => {
    setErr("");
    setAccForm(
      acc
        ? {
            id: acc.id,
            account_type: acc.account_type,
            name: acc.name,
            account_number: acc.account_number || "",
            opening_balance: String(acc.opening_balance ?? 0),
            address: acc.address || "",
            remarks: acc.remarks || "",
          }
        : {
            account_type: type,
            name: "",
            account_number: "",
            opening_balance: "",
            address: "",
            remarks: "",
          },
    );
    setAccModalOpen(true);
  };

  const handleSaveAcc = async () => {
    if (!accForm.name.trim()) {
      setErr("खाताको नाम लेख्नुहोस्।");
      return;
    }
    const opening =
      accForm.opening_balance.trim() === ""
        ? 0
        : Number(accForm.opening_balance.replace(/[,\s]/g, ""));
    if (Number.isNaN(opening)) {
      setErr("प्रारम्भिक मौज्दात नम्बरमा हुनुपर्छ।");
      return;
    }
    if (accForm.account_type === "bank" && !accForm.account_number.trim()) {
      setErr("बैंक खाता नम्बर लेख्नुहोस्।");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await saveAccFn({
        data: {
          id: accForm.id || undefined,
          account_type: accForm.account_type,
          name: accForm.name.trim(),
          account_number: accForm.account_number.trim(),
          opening_balance: opening,
          address: accForm.address.trim(),
          remarks: accForm.remarks.trim(),
        },
      });
      setAccModalOpen(false);
      setOkMsg("खाता सुरक्षित भयो।");
      refresh();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "खाता सुरक्षित भएन।");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAcc = async (acc: RPAccount) => {
    if (!window.confirm(`"${acc.name}" खाता मेट्ने हो?`)) return;
    setBusy(true);
    setErr("");
    try {
      await deleteAccFn({ data: { id: acc.id } });
      setOkMsg("खाता मेटियो।");
      refresh();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "खाता मेटिएन।");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTxn = async () => {
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(txnForm.txn_date)) {
      setErr("मिति यस ढाँचामा लेख्नुहोस्: २०८२/०४/१५ (अर्थात् 2082/04/15)");
      return;
    }
    const fy = fiscalYear(txnForm.txn_date);
    if (!fy || !FISCAL_YEARS.includes(fy)) {
      setErr("मिति आर्थिक वर्ष २०७९/८० देखि २१००/१०१ भित्र हुनुपर्छ।");
      return;
    }
    const fyDateErr = validateDateInFiscalYear(txnForm.txn_date, app.year, "मिति");
    if (fyDateErr) {
      setErr(fyDateErr);
      return;
    }
    if (tab === "payment") {
      const refv = txnForm.manual_ref.trim();
      if (refv) {
        const refErr = validateReference(refv);
        if (refErr) {
          setErr(refErr);
          return;
        }
      }
    }
    const amt = Number(txnForm.amount);
    if (!txnForm.amount.trim() || Number.isNaN(amt) || amt <= 0) {
      setErr("रकम राख्नुहोस् (शून्यभन्दा बढी)।");
      return;
    }
    if (!txnForm.account_id || !accById[txnForm.account_id]) {
      setErr("खाता छान्नुहोस्।");
      return;
    }
    if (tab === "transfer") {
      if (!txnForm.to_account_id || !accById[txnForm.to_account_id]) {
        setErr("पठाउने खाता छान्नुहोस्।");
        return;
      }
      if (txnForm.to_account_id === txnForm.account_id) {
        setErr("दुवै एउटै खाता हुन सक्दैन।");
        return;
      }
    } else {
      if (!txnForm.party_name.trim()) {
        setErr(
          tab === "receipt"
            ? txnForm.party_type === "donation"
              ? "कम्पनी वा दाताको नाम भर्नुहोस्।"
              : "जना थिचेर ग्राहक छान्नुहोस्।"
            : "जना थिचेर विक्रेता वा कर्मचारी छान्नुहोस्।",
        );
        return;
      }
      if (tab === "receipt" && txnForm.party_type === "donation" && !txnForm.linked_event_id) {
        setErr("कृपया दान/सहयोगसँग सम्बन्धित कार्यक्रम वा कोष छान्नुहोस्।");
        return;
      }
    }
    setBusy(true);
    setErr("");
    try {
      const saved = await saveTxnFn({
        data: {
          txn_type: tab === "accounts" ? "receipt" : tab,
          txn_date: txnForm.txn_date,
          account_id: txnForm.account_id,
          to_account_id: tab === "transfer" ? txnForm.to_account_id : "",
          party_type: tab === "receipt" ? (txnForm.party_type === "donation" ? "donation" : "customer") : txnForm.party_type,
          party_id: txnForm.party_id,
          party_name: txnForm.party_name.trim(),
          amount: amt,
          remarks: txnForm.remarks.trim(),
          manual_ref: tab === "payment" ? txnForm.manual_ref.trim() : "",
          company_name: txnForm.party_type === "donation" ? txnForm.company_name?.trim() || txnForm.party_name.trim() : undefined,
          linked_event_id: txnForm.party_type === "donation" ? txnForm.linked_event_id : undefined,
          linked_event_title: txnForm.party_type === "donation" ? txnForm.linked_event_title : undefined,
        },
      });
      const prefix = saved.ref_no.split("-")[0];
      setOkMsg(`${saved.party_name || saved.account_name} — ${saved.ref_no} सुरक्षित भयो।`);
      setTxnForm((prev) => ({
        ...prev,
        party_id: "",
        party_name: "",
        company_name: "",
        linked_event_id: "",
        linked_event_title: "",
        amount: "",
        remarks: "",
        to_account_id: "",
        manual_ref: "",
      }));
      refresh();
      return prefix;
    } catch (e) {
      const raw = e instanceof Error && e.message ? e.message : "सुरक्षित भएन।";
      setErr(
        raw.includes("Fiscal year out of range")
          ? "मिति आर्थिक वर्ष २०७९/८० देखि २१००/१०१ भित्र हुनुपर्छ।"
          : raw.includes("Reference number already used")
            ? "यो सन्दर्भ नम्बर पहिले नै प्रयोग भइसकेको छ।"
            : raw,
      );
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTxn = async (t: RPTransaction) => {
    if (!window.confirm(`${t.ref_no} मेट्ने हो? मौज्दात फेरिनेछ।`)) return;
    setBusy(true);
    setErr("");
    try {
      await deleteTxnFn({ data: { id: t.id } });
      setOkMsg(`${t.ref_no} मेटियो।`);
      refresh();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "मेटिएन।");
    } finally {
      setBusy(false);
    }
  };

  if (!app.ready) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
        <p role="status">Opening cash book…</p>
      </main>
    );
  }

  if (!app.signedIn) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
        <SignInPanel />
      </main>
    );
  }

  const cashAccounts = accounts.filter((a) => a.account_type === "cash");
  const bankAccounts = accounts.filter((a) => a.account_type === "bank");

  const partyOptions: RPParty[] =
    tab === "payment"
      ? txnForm.party_type === "vendor"
        ? vendors
        : txnForm.party_type === "employee"
          ? employees
          : []
      : customers;

  const fromAcc = txnForm.account_id ? accById[txnForm.account_id] : undefined;
  const toAcc = txnForm.to_account_id ? accById[txnForm.to_account_id] : undefined;
  const transferKind =
    fromAcc && toAcc ? (fromAcc.account_type === toAcc.account_type ? "Intra" : "Inter") : "";

  const accountSelect = (
    value: string,
    onChange: (v: string) => void,
    filterType?: "cash" | "bank",
    placeholder = "खाता छान्नुहोस्…",
  ) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border bg-background px-3 text-xs font-semibold"
    >
      <option value="">{placeholder}</option>
      {accounts
        .filter((a) => (filterType ? a.account_type === filterType : true))
        .map((a) => (
          <option key={a.id} value={a.id || ""}>
            {a.name}
            {a.account_type === "bank" && a.account_number ? ` · A/C ${a.account_number}` : ""}
          </option>
        ))}
    </select>
  );

  const tabs: { id: Tab; label: string; icon: typeof Wallet }[] = [
    { id: "accounts", label: "नगद तथा बैंक मास्टर", icon: Wallet },
    { id: "receipt", label: "रसिद (Receipt)", icon: LogIn },
    { id: "payment", label: "भुक्तानी (Payment)", icon: Send },
    { id: "transfer", label: "सार्नुहोस् (Transfer)", icon: ArrowLeftRight },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-2.5">
          <Wallet className="size-6 text-primary" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              रसिद तथा भुक्तानी (Receipts & Payments)
            </h1>
            <p className="text-xs text-muted-foreground">
              नगद तथा बैंक खाता मास्टर, रसिद, भुक्तानी र खाताहरूबीच सारसम्पर्क
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setErr("");
              setOkMsg("");
            }}
            className={
              "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors " +
              (tab === id
                ? "border-primary bg-primary/10 text-primary"
                : "bg-background text-muted-foreground hover:border-primary/40")
            }
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {err && (
        <p className="mb-3 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
          {err}
        </p>
      )}
      {okMsg && (
        <p className="mb-3 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {okMsg}
        </p>
      )}

      {/* Accounts master */}
      {tab === "accounts" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Petty cash */}
            <section className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 font-bold text-foreground">
                  <Banknote className="size-4 text-amber-600" /> खुद्रा नगद (Petty Cash)
                </h2>
                <Button type="button" size="sm" onClick={() => openAccModal("cash")}>
                  <Plus className="mr-1 size-3" /> थप्नुहोस्
                </Button>
              </div>
              {cashAccounts.length === 0 ? (
                <p className="py-4 text-center text-xs italic text-muted-foreground">
                  अझै नगद खाता थपिएको छैन — "थप्नुहोस्" थिच्नुहोस्।
                </p>
              ) : (
                <ul className="space-y-2">
                  {cashAccounts.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-foreground">{a.name}</div>
                        {a.remarks && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {a.remarks}
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        <div
                          className={
                            "text-sm font-extrabold tabular-nums " +
                            ((balanceById[a.id] || 0) < 0
                              ? "text-destructive"
                              : "text-emerald-700 dark:text-emerald-400")
                          }
                        >
                          रु. {money(balanceById[a.id] || 0)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openAccModal("cash", a)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                          title="सम्पादन"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAcc(a)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="मेट्नुहोस्"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Bank */}
            <section className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 font-bold text-foreground">
                  <Landmark className="size-4 text-sky-600" /> बैंक खाता (Bank)
                </h2>
                <Button type="button" size="sm" onClick={() => openAccModal("bank")}>
                  <Plus className="mr-1 size-3" /> थप्नुहोस्
                </Button>
              </div>
              {bankAccounts.length === 0 ? (
                <p className="py-4 text-center text-xs italic text-muted-foreground">
                  अझै बैंक खाता थपिएको छैन — "थप्नुहोस्" थिच्नुहोस्।
                </p>
              ) : (
                <ul className="space-y-2">
                  {bankAccounts.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-foreground">{a.name}</div>
                        {a.account_number && (
                          <div className="text-[11px] text-muted-foreground">
                            A/C: {a.account_number}
                          </div>
                        )}
                        {a.address && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {a.address}
                          </div>
                        )}
                        {a.remarks && (
                          <div className="truncate text-[11px] italic text-muted-foreground">
                            {a.remarks}
                          </div>
                        )}
                      </div>
                      <div
                        className={
                          "text-sm font-extrabold tabular-nums " +
                          ((balanceById[a.id] || 0) < 0
                            ? "text-destructive"
                            : "text-emerald-700 dark:text-emerald-400")
                        }
                      >
                        रु. {money(balanceById[a.id] || 0)}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openAccModal("bank", a)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                          title="सम्पादन"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAcc(a)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="मेट्नुहोस्"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {shownTxns.length > 0 && (
            <p className="text-center text-[11px] text-muted-foreground">
              सबै लेनदेन तल बुक भएका छन् — खाताहरूको मौज्दात यहीँबाट गणना गरिएको हो।
            </p>
          )}
        </div>
      )}

      {/* Receipt / Payment / Transfer forms */}
      {tab !== "accounts" && (
        <section className="mb-5 rounded-xl border-2 border-primary/25 bg-primary/5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 font-bold text-foreground">
              {tab === "receipt" && <ReceiptText className="size-4 text-emerald-600" />}
              {tab === "payment" && <Send className="size-4 text-amber-600" />}
              {tab === "transfer" && <ArrowLeftRight className="size-4 text-sky-600" />}
              {tab === "receipt" && "नयाँ रसिद (आम्दानी)"}
              {tab === "payment" && "भुक्तानी (खर्च जाने)"}
              {tab === "transfer" && "खाताबीच सार्नुहोस्"}
            </h2>
            <span className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs">
              <span className="font-semibold text-muted-foreground">सन्दर्भ नम्बर</span>
              <span className="font-extrabold tabular-nums text-primary">
                {tab === "payment" && txnForm.manual_ref.trim()
                  ? txnForm.manual_ref.trim()
                  : (refPreview.data?.[tab] ?? "…")}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {tab === "payment" && txnForm.manual_ref.trim()
                  ? "(हस्तलिखित रहनेछ)"
                  : "(स्वतः तोकिनेछ)"}
              </span>
            </span>
          </div>
          {tab === "receipt" && (
            <p className="mb-3 text-[11px] text-muted-foreground">
              फोहोरमैला शुल्कका बुक गरेका रसिदहरू{" "}
              <Link
                to="/receipts"
                className="font-bold text-primary underline-offset-2 hover:underline"
              >
                रसिद इतिहास (Receipts) पृष्ठमा
              </Link>{" "}
              हेर्न र फेरि प्रिन्ट गर्न सकिन्छ — त्यो पृष्ठसँग यो रसिद प्रत्यक्ष जोडिएको छ।
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="text-xs font-semibold">मिति (BS) *</Label>
              <div className="mt-1">
                <BSDatePicker
                  value={txnForm.txn_date}
                  onChange={(v) => setTxnForm((p) => ({ ...p, txn_date: v }))}
                />
              </div>
            </div>

            {tab === "receipt" && (
              <>
                <div className="sm:col-span-2 lg:col-span-3 pb-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      रसिदको प्रकार (Receipt / Income Type)
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      {txnForm.party_type === "donation"
                        ? "🎁 संस्था/कम्पनीबाट प्राप्त हुने दान तथा कार्यक्रम सहयोग"
                        : "👤 नियमित ग्राहकको मासिक शुल्क तथा संकलन"}
                    </span>
                  </div>
                  <div className="mt-1.5 inline-flex rounded-lg border bg-muted/40 p-1 gap-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setTxnForm((p) => ({
                          ...p,
                          party_type: "customer",
                          party_id: "",
                          party_name: "",
                          company_name: "",
                          linked_event_id: "",
                          linked_event_title: "",
                        }));
                      }}
                      className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                        txnForm.party_type !== "donation"
                          ? "bg-card text-foreground shadow-2xs font-extrabold text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <UserCheck className="size-3.5" />
                      <span>ग्राहक शुल्क (Customer Fee)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTxnForm((p) => ({
                          ...p,
                          party_type: "donation",
                          party_id: "",
                          party_name: "",
                          company_name: "",
                          linked_event_id: "",
                          linked_event_title: "",
                        }));
                      }}
                      className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                        txnForm.party_type === "donation"
                          ? "bg-emerald-600 text-white shadow-2xs font-extrabold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>🎁 दान / सहयोग (Donation & Sponsorship)</span>
                    </button>
                  </div>
                </div>

                {txnForm.party_type !== "donation" ? (
                  <div>
                    <Label className="text-xs font-semibold">जना (ग्राहक) *</Label>
                    <select
                      value={txnForm.party_id}
                      onChange={(e) => {
                        const sel = customers.find((c) => c.id === e.target.value);
                        setTxnForm((p) => ({
                          ...p,
                          party_id: e.target.value,
                          party_name: sel?.name || "",
                        }));
                      }}
                      className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs font-semibold"
                    >
                      <option value="">ग्राहक छान्नुहोस्…</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id || ""}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                        कम्पनी वा दाताको नाम (Company / Donor Name) *
                      </Label>
                      <Input
                        value={txnForm.company_name ?? txnForm.party_name}
                        onChange={(e) =>
                          setTxnForm((p) => ({
                            ...p,
                            company_name: e.target.value,
                            party_name: e.target.value,
                          }))
                        }
                        list="donation-company-suggestions"
                        placeholder="जस्तै: सूर्य नेपाल / चौधरी ग्रुप / दाताको नाम"
                        className="mt-1 h-9 text-xs font-semibold bg-background border-emerald-500/40"
                      />
                      <datalist id="donation-company-suggestions">
                        {vendors.map((v) => (
                          <option key={v.id} value={v.name} />
                        ))}
                        {customers.map((c) => (
                          <option key={c.id} value={c.name} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                          सम्बन्धित कार्यक्रम (Link to Programme) *
                        </Label>
                        <Link
                          to="/events"
                          className="text-[10px] text-primary hover:underline"
                          target="_blank"
                        >
                          + कार्यक्रमहरू
                        </Link>
                      </div>
                      <select
                        value={txnForm.linked_event_id || ""}
                        onChange={(e) => {
                          const evId = e.target.value;
                          const ev = events.find((x) => x.id === evId);
                          const evTitle =
                            evId === "general"
                              ? "साधारण / संस्थागत कोष"
                              : ev?.title || "";
                          setTxnForm((p) => ({
                            ...p,
                            linked_event_id: evId,
                            linked_event_title: evTitle,
                            party_id: evId,
                          }));
                        }}
                        className="mt-1 h-9 w-full rounded-md border border-emerald-500/40 bg-background px-3 text-xs font-semibold"
                      >
                        <option value="">— कार्यक्रम छान्नुहोस् —</option>
                        <option value="general">🏛️ साधारण / संस्थागत कोष (General Club Fund)</option>
                        {events.map((ev) => (
                          <option key={ev.id} value={ev.id || ""}>
                            📌 {ev.title} {ev.locality ? `(${ev.locality})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </>
            )}

            {tab === "payment" && (
              <div>
                <Label className="text-xs font-semibold">कसलाई भुक्तानी? *</Label>
                <select
                  value={txnForm.party_type}
                  onChange={(e) => {
                    const val = e.target.value as TxnForm["party_type"];
                    setTxnForm((p) => ({
                      ...p,
                      party_type: val,
                      party_id: val === "tax" ? "TDS/SST" : "",
                      party_name: val === "tax" ? "TDS/SST" : "",
                      remarks: val === "tax" ? "TDS/SST कर दाखिला भुक्तानी" : p.remarks,
                    }));
                  }}
                  className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs font-semibold"
                >
                  <option value="">छान्नुहोस्…</option>
                  <option value="vendor">विक्रेता (Vendor)</option>
                  <option value="employee">कर्मचारी (Employee)</option>
                  <option value="tax">TDS/SST (कर कट्टी / सामाजिक सुरक्षा कर)</option>
                </select>

                {txnForm.party_type && txnForm.party_type !== "tax" && (
                  <select
                    value={txnForm.party_id}
                    onChange={(e) => {
                      const list = txnForm.party_type === "vendor" ? vendors : employees;
                      const sel = list.find((x) => x.id === e.target.value);
                      setTxnForm((p) => ({
                        ...p,
                        party_id: e.target.value,
                        party_name: sel?.name || "",
                      }));
                    }}
                    className="mt-1.5 h-9 w-full rounded-md border bg-background px-3 text-xs font-semibold"
                  >
                    <option value="">
                      {txnForm.party_type === "vendor"
                        ? "विक्रेता छान्नुहोस्…"
                        : "कर्मचारी छान्नुहोस्…"}
                    </option>
                    {partyOptions.map((p) => (
                      <option key={p.id} value={p.id || ""}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}

                {txnForm.party_type === "tax" && (
                  <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                    <div className="font-bold text-amber-900 flex items-center justify-between">
                      <span>संचित TDS/SST विवरण (TDS/SST Payable)</span>
                      <span className="text-[10px] rounded bg-amber-500/20 px-1.5 py-0.5 font-semibold text-amber-800">
                        आन्तरिक राजस्व खाता
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded bg-background/80 p-2 border">
                        <div className="text-[10px] text-muted-foreground">पेरोलबाट कट्टी</div>
                        <div className="font-bold text-foreground">{money(tds_sst.accrued)}</div>
                      </div>
                      <div className="rounded bg-background/80 p-2 border">
                        <div className="text-[10px] text-muted-foreground">दाखिला भएको</div>
                        <div className="font-bold text-emerald-700">{money(tds_sst.paid)}</div>
                      </div>
                      <div className="rounded bg-background/80 p-2 border border-amber-500/40">
                        <div className="text-[10px] text-muted-foreground">बाँकी तिर्नुपर्ने</div>
                        <div className="font-bold text-rose-600">{money(tds_sst.balance)}</div>
                      </div>
                    </div>
                    {tds_sst.balance > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTxnForm((p) => ({
                            ...p,
                            amount: String(tds_sst.balance),
                            remarks: p.remarks || "TDS/SST कर दाखिला भुक्तानी",
                          }));
                        }}
                        className="mt-2.5 w-full text-xs font-bold border-amber-600/40 text-amber-800 hover:bg-amber-100"
                      >
                        बाँकी रकम (रु. {tds_sst.balance.toLocaleString("en-IN")}) भर्नुहोस्
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold">
                {tab === "receipt"
                  ? "कुन खातामा भित्रियो? *"
                  : tab === "payment"
                    ? "कुन खाताबाट भुक्तानी? *"
                    : "कुन खाताबाट? *"}
              </Label>
              <div className="mt-1">
                {accountSelect(
                  txnForm.account_id,
                  (v) => setTxnForm((p) => ({ ...p, account_id: v })),
                  undefined,
                  tab === "receipt" ? "नगद वा बैंक छान्नुहोस्…" : "खाता छान्नुहोस्…",
                )}
              </div>
            </div>

            {tab === "transfer" && (
              <div>
                <Label className="text-xs font-semibold">कुन खातामा पठाइयो? *</Label>
                <div className="mt-1">
                  {accountSelect(
                    txnForm.to_account_id,
                    (v) => setTxnForm((p) => ({ ...p, to_account_id: v })),
                    undefined,
                    "पठाउने खाता छान्नुहोस्…",
                  )}
                </div>
                {transferKind && (
                  <p className="mt-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                    {transferKind} transfer — {fromAcc?.name} → {toAcc?.name}
                  </p>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold">रकम रु. *</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={txnForm.amount}
                onChange={(e) => setTxnForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0"
                className="mt-1 h-9 text-sm"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <Label className="text-xs font-semibold">कैफियत (Remarks)</Label>
              <Input
                value={txnForm.remarks}
                onChange={(e) => setTxnForm((p) => ({ ...p, remarks: e.target.value }))}
                placeholder="जस्तै: डस्टरीको भुक्तानी, बैंक जम्मा, ÷ बाट लेनदेन…"
                className="mt-1 h-9 text-sm"
              />
            </div>

            {tab === "payment" && (
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-sm">
                  <span className="text-muted-foreground">
                    भुक्तानी सन्दर्भ नं. (Payment Reference) *
                  </span>
                  <input
                    aria-label="Payment Reference Number"
                    className="w-full border-0 border-b-2 border-dotted border-border bg-transparent px-1 py-1 font-semibold text-ink outline-none focus:border-primary"
                    value={txnForm.manual_ref}
                    maxLength={40}
                    placeholder="eSewa/Khalti/Bank Ref. वा नगद रसिद नं."
                    onChange={(e) => setTxnForm((p) => ({ ...p, manual_ref: e.target.value }))}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              className="font-bold"
              disabled={busy}
              onClick={() => void handleSaveTxn()}
            >
              {busy
                ? "सुरक्षित हुँदैछ…"
                : tab === "transfer"
                  ? "सार्नुहोस्"
                  : tab === "receipt"
                    ? "रसिद बुक गर्नुहोस्"
                    : "भुक्तानी बुक गर्नुहोस्"}
            </Button>
          </div>
        </section>
      )}

      {/* Transaction journal per tab */}
      <section className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <UserCheck className="size-4 text-primary" />
          <h2 className="font-bold text-foreground">
            {tab === "accounts"
              ? "सबै लेनदेन"
              : tab === "receipt"
                ? "रसिद लेनदेन"
                : tab === "payment"
                  ? "भुक्तानी लेनदेन"
                  : "सारसम्पर्क लेनदेन"}
          </h2>
          <span className="text-[11px] text-muted-foreground">({shownTxns.length})</span>
        </div>
        {shownTxns.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs italic text-muted-foreground">
            अझै कुनै लेनदेन छैन — मिति सुरुवात: {np(todayBS())}
          </p>
        ) : (
          <ul className="divide-y">
            {shownTxns.map((t) => {
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs"
                >
                  <span className="w-24 shrink-0 font-semibold tabular-nums text-muted-foreground">
                    {np(t.txn_date)}
                  </span>
                  <span
                    className={
                      "w-16 shrink-0 font-bold " +
                      (t.txn_type === "receipt"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : t.txn_type === "payment"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-sky-600 dark:text-sky-400")
                    }
                  >
                    {t.ref_no}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-bold text-foreground">
                      {t.txn_type === "transfer"
                        ? `${accById[t.to_account_id]?.name || t.to_account_id} ← ${t.account_name || accById[t.account_id]?.name || t.account_id}`
                        : t.account_name || accById[t.account_id]?.name || t.account_id}
                    </span>
                    <span className="text-muted-foreground">
                      {t.txn_type === "transfer"
                        ? " खाताबीच सारियो"
                        : t.party_name
                          ? ` · ${t.company_name || t.party_name}`
                          : ""}
                    </span>
                    {t.party_type === "donation" && (
                      <span className="ml-1.5 inline-flex items-center rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300">
                        🎁 दान / सहयोग
                      </span>
                    )}
                    {t.linked_event_title && (
                      <span className="block text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        📌 कार्यक्रम: {t.linked_event_title}
                      </span>
                    )}
                    {t.remarks && !t.remarks.includes(t.linked_event_title || "___NONE___") && (
                      <span className="block text-[11px] italic text-muted-foreground">
                        {t.remarks}
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      "shrink-0 font-extrabold tabular-nums " +
                      (t.txn_type === "receipt"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-foreground")
                    }
                  >
                    रु. {money(Number(t.amount))}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setViewing(t)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      title={`हेर्नुहोस् (${t.ref_no})`}
                    >
                      <Eye className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTxn(t)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="मेट्नुहोस्"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Account modal */}
      {accModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl">
            <h2 className="mb-4 text-lg font-extrabold text-foreground">
              {accForm.id
                ? "खाता सम्पादन"
                : accForm.account_type === "cash"
                  ? "नयाँ नगद खाता (Petty Cash)"
                  : "नयाँ बैंक खाता (Bank)"}
            </h2>
            {err && (
              <p className="mb-3 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                {err}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold">
                  {accForm.account_type === "cash" ? "नगदको नाम *" : "बैंकको नाम *"}
                </Label>
                <Input
                  value={accForm.name}
                  onChange={(e) => setAccForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder={
                    accForm.account_type === "cash" ? "जस्तै: कार्यालय नगद" : "जस्तै: Nabil Bank"
                  }
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">प्रारम्भिक मौज्दात रु.</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={accForm.opening_balance}
                  onChange={(e) => setAccForm((p) => ({ ...p, opening_balance: e.target.value }))}
                  placeholder="0"
                  className="mt-1 h-9 text-sm"
                />
              </div>
              {accForm.account_type === "bank" && (
                <>
                  <div>
                    <Label className="text-xs font-semibold">बैंक खाता नम्बर *</Label>
                    <Input
                      value={accForm.account_number}
                      onChange={(e) =>
                        setAccForm((p) => ({ ...p, account_number: e.target.value }))
                      }
                      placeholder="जस्तै: 0123456789"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">ठेगाना (Address)</Label>
                    <Input
                      value={accForm.address}
                      onChange={(e) => setAccForm((p) => ({ ...p, address: e.target.value }))}
                      placeholder="बैंक शाखा ठेगाना"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">कैफियत (Remarks)</Label>
                <Input
                  value={accForm.remarks}
                  onChange={(e) => setAccForm((p) => ({ ...p, remarks: e.target.value }))}
                  placeholder="जस्तै: महिला समितिको नगद"
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setAccModalOpen(false)}
              >
                रद्द
              </Button>
              <Button
                type="button"
                className="font-bold"
                disabled={busy}
                onClick={() => void handleSaveAcc()}
              >
                {busy ? "सुरक्षित हुँदैछ…" : "सुरक्षित गर्नुहोस्"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Voucher view / reprint overlay */}
      {viewing && (
        <RPTransactionVoucher
          t={viewing}
          fromAcc={accById[viewing.account_id] ?? null}
          toAcc={viewing.to_account_id ? (accById[viewing.to_account_id] ?? null) : null}
          onClose={() => setViewing(null)}
        />
      )}
    </main>
  );
}
