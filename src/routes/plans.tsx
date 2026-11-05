import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useWorkspace, WorkspacePage, EmptyRows, money } from "@/components/workspace";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { savePlan, deletePlan } from "@/lib/workspace.functions";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Layers,
  Users,
  CheckCircle2,
  AlertCircle,
  Car,
} from "lucide-react";
import type { PlanItem } from "@/lib/receipt-rules";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Plan Master — Sangstha" },
      {
        name: "description",
        content:
          "Manage waste management service plans, base fee, incentives and chargeable amounts.",
      },
      { property: "og:title", content: "Sangstha Plan Master" },
      {
        property: "og:description",
        content: "Waste management service plans, rates, incentives, and net chargeable fees.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlansPage,
});

const getEmptyPlan = (): PlanItem => ({
  id: "",
  name: "",
  uom: "महिना (Month)",
  rate: 500,
  trips: 1,
  no_of_trips: 1,
  amount: 500,
  incentive: 0,
  chargeable_amount: 500,
  description: "",
  is_active: true,
});

function PlansPage() {
  const { query, signedIn } = useWorkspace();
  const [openModal, setOpenModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [form, setForm] = useState<PlanItem>(getEmptyPlan());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const queryClient = useQueryClient();
  const savePlanFn = useServerFn(savePlan);
  const deletePlanFn = useServerFn(deletePlan);

  const plans = query.data?.plans ?? [];
  const people = query.data?.people ?? [];

  const handleOpenAdd = () => {
    setForm(getEmptyPlan());
    setEditingPlan(null);
    setErr("");
    setOpenModal(true);
  };

  const handleOpenEdit = (plan: PlanItem) => {
    setForm({
      ...plan,
      uom: plan.uom || "महिना (Month)",
      rate: plan.rate != null ? plan.rate : plan.amount,
      trips: Number(plan.trips ?? plan.no_of_trips ?? 1) || 1,
      no_of_trips: Number(plan.no_of_trips ?? plan.trips ?? 1) || 1,
    });
    setEditingPlan(plan);
    setErr("");
    setOpenModal(true);
  };

  const handleAmountChange = (amt: number) => {
    const inc = form.incentive || 0;
    const chg = Math.max(0, amt - inc);
    setForm((prev) => ({ ...prev, amount: amt, rate: amt, chargeable_amount: chg }));
  };

  const handleIncentiveChange = (inc: number) => {
    const amt = form.amount || 0;
    const chg = Math.max(0, amt - inc);
    setForm((prev) => ({ ...prev, incentive: inc, chargeable_amount: chg }));
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setErr("योजनाको नाम अनिवार्य छ (Plan name is required).");
      return;
    }
    if (form.amount < 0 || form.chargeable_amount < 0) {
      setErr("रकम ऋणात्मक हुन सक्दैन (Amounts cannot be negative).");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await savePlanFn({
        data: {
          id: form.id || undefined,
          name: form.name.trim(),
          uom: form.uom?.trim() || "महिना (Month)",
          rate: Number(form.rate ?? form.amount) || 0,
          trips: Number(form.trips ?? form.no_of_trips ?? 1) || 1,
          no_of_trips: Number(form.no_of_trips ?? form.trips ?? 1) || 1,
          amount: Number(form.amount) || 0,
          incentive: Number(form.incentive) || 0,
          chargeable_amount: Number(form.chargeable_amount) || 0,
          description: form.description?.trim() || "",
          is_active: form.is_active ?? true,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
      setOpenModal(false);
      setForm(getEmptyPlan());
      setEditingPlan(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "योजना सुरक्षित गर्न सकिएन (Could not save plan).");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(plan: PlanItem) {
    const linkedCount = people.filter((p) => p.plan_id === plan.id || p.plan === plan.name).length;
    const msg =
      linkedCount > 0
        ? `'${plan.name}' योजना ${linkedCount} जना ग्राहकसँग जोडिएको छ। के तपाईं पक्का यसलाई हटाउन चाहनुहुन्छ?`
        : `के तपाईं '${plan.name}' योजना मेटाउन चाहनुहुन्छ?`;
    if (!window.confirm(msg)) return;

    try {
      await deletePlanFn({ data: { id: plan.id } });
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "योजना मेटाउन सकिएन।");
    }
  }

  return (
    <WorkspacePage title="Plan Master (योजना व्यवस्थापन)">
      {/* Top Header & Navigation Tabs */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
            <Link to="/masters">
              <Users className="size-4 text-muted-foreground" />
              People Master (ग्राहक सूची)
            </Link>
          </Button>
          <Button variant="default" size="sm" className="gap-1.5 text-xs font-semibold">
            <Layers className="size-4" />
            Plan Master (योजना दर)
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            कुल योजना: <b>{plans.length}</b>
          </span>
          <Button onClick={handleOpenAdd} disabled={!signedIn} size="sm">
            <Plus className="mr-1 size-4" /> नयाँ योजना थप्नुहोस् (Add Plan)
          </Button>
        </div>
      </div>

      {/* Plan Master Table */}
      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-accent/70 font-semibold text-foreground">
            <tr>
              <th className="px-4 py-3">योजनाको नाम (Plan Name)</th>
              <th className="px-4 py-3">इकाई (UOM)</th>
              <th className="px-4 py-3 text-center">ट्रिप संख्या (Trips)</th>
              <th className="px-4 py-3 text-right">आधार दर (Rate)</th>
              <th className="px-4 py-3 text-right">प्रोत्साहन / छूट (Incentive)</th>
              <th className="px-4 py-3 text-right font-bold text-primary">
                शुल्क रकम (Chargeable)
              </th>
              <th className="px-4 py-3">विवरण (Description)</th>
              <th className="px-4 py-3 text-center">सम्बन्धित ग्राहक</th>
              <th className="px-4 py-3 text-center">स्थिति</th>
              <th className="px-4 py-3 text-right">कार्य</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => {
              const linkedCount = people.filter((cust) => {
                if (cust.plans && cust.plans.some((sp) => sp.plan_id === p.id)) return true;
                return cust.plan_id === p.id || cust.plan?.includes(p.name);
              }).length;
              return (
                <tr key={p.id} className="border-b transition-colors hover:bg-accent/40">
                  <td className="p-4 font-bold text-foreground">
                    <div className="flex items-center gap-2">
                      <span className="inline-block size-2 rounded-full bg-primary" />
                      {p.name}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {p.uom || "महिना (Month)"}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center gap-1 rounded bg-accent px-2.5 py-0.5 text-xs font-semibold text-foreground">
                      <Car className="size-3 text-primary" />
                      {p.trips ?? p.no_of_trips ?? 1} ट्रिप
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono font-medium">
                    {money(p.rate ?? p.amount)}
                  </td>
                  <td className="p-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    {p.incentive > 0 ? `- ${money(p.incentive)}` : "रु. ०"}
                  </td>
                  <td className="p-4 text-right font-mono text-base font-extrabold text-primary">
                    {money(p.chargeable_amount)}
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">{p.description || "—"}</td>
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-foreground">
                      <Users className="size-3 text-muted-foreground" />
                      {linkedCount} ग्राहक
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {p.is_active !== false ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <CheckCircle2 className="size-3" /> सक्रिय
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        निष्क्रिय
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-primary"
                        title="सम्पादन (Edit plan)"
                        onClick={() => handleOpenEdit(p)}
                      >
                        <Edit2 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        title="मेटाउनुहोस् (Delete plan)"
                        onClick={() => handleDelete(p)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!plans.length && (
              <EmptyRows
                columns={10}
                text="कुनै योजना भेटिएन। 'Add Plan' थिचेर नयाँ योजना दर्ता गर्नुहोस्।"
              />
            )}
          </tbody>
        </table>
      </div>

      {/* Info Callout */}
      <div className="mt-6 flex items-start gap-3 rounded-lg border bg-accent/30 p-4 text-xs text-muted-foreground">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="font-semibold text-foreground">योजना व्यवस्थापन (Plan Master Linking):</p>
          <p className="mt-0.5 leading-relaxed">
            यहाँ सिर्जना गरिएका योजनाहरू People Master मा प्रत्येक ग्राहकको दर्ता फाराममा छनोटका
            लागि स्वतः उपलब्ध हुनेछन्। ग्राहकले आवश्यकता अनुसार एक वा धेरै योजनाहरू (Multiple Plans)
            लिन सक्नेछन् र रसिद काट्दा सोही बमोजिम कुल दर गणना हुनेछ।
          </p>
        </div>
      </div>

      {/* Add / Edit Plan Modal */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <div className="my-8 w-full max-w-lg rounded-xl border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {editingPlan ? "योजना सम्पादन (Edit Plan)" : "नयाँ योजना दर्ता (Add Plan Master)"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  योजनाको नाम, मापन इकाई (UOM), आधार दर, छूट र भुक्तानी गर्नुपर्ने रकम तोक्नुहोस्।
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    योजनाको नाम (Plan Name) *
                  </label>
                  <input
                    aria-label="Plan Name"
                    className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground font-medium"
                    placeholder="उदा: घरायसी, पसल, होटल, ट्रिप"
                    value={form.name}
                    maxLength={100}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    मापन इकाई (UOM) *
                  </label>
                  <div className="mt-1 flex gap-1.5">
                    <select
                      aria-label="UOM Select"
                      className="w-1/2 rounded border bg-background px-1.5 py-2 text-xs text-foreground"
                      value={
                        [
                          "महिना (Month)",
                          "ट्रिप (Trip)",
                          "घर / युनिट (House/Unit)",
                          "कोठा / फ्ल्याट (Room/Flat)",
                          "के.जी. / टन (Kg/Ton)",
                          "संख्या (Pcs)",
                        ].includes(form.uom || "")
                          ? form.uom
                          : "custom"
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v !== "custom") setForm({ ...form, uom: v });
                        else setForm({ ...form, uom: "" });
                      }}
                    >
                      <option value="महिना (Month)">महिना (Month)</option>
                      <option value="ट्रिप (Trip)">ट्रिप (Trip)</option>
                      <option value="घर / युनिट (House/Unit)">घर / युनिट</option>
                      <option value="कोठा / फ्ल्याट (Room/Flat)">कोठा / फ्ल्याट</option>
                      <option value="के.जी. / टन (Kg/Ton)">के.जी. / टन</option>
                      <option value="संख्या (Pcs)">संख्या (Pcs)</option>
                      <option value="custom">अन्य</option>
                    </select>
                    <input
                      aria-label="Custom UOM"
                      className="w-1/2 rounded border bg-background px-2 py-2 text-xs text-foreground"
                      placeholder="उदा: ट्रिप"
                      value={form.uom ?? ""}
                      onChange={(e) => setForm({ ...form, uom: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    ट्रिप संख्या (No. of Trips) *
                  </label>
                  <div className="mt-1 flex items-center gap-1.5">
                    <input
                      aria-label="No of Trips"
                      type="number"
                      min="1"
                      className="w-full rounded border bg-background px-3 py-2 text-sm text-foreground font-mono"
                      value={form.trips ?? form.no_of_trips ?? 1}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        setForm({ ...form, trips: val, no_of_trips: val });
                      }}
                      required
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">ट्रिप</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">प्रति अवधि संकलन ट्रिप</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    प्रति इकाई दर / रकम (Rate) *
                  </label>
                  <input
                    aria-label="Base Amount"
                    type="number"
                    min="0"
                    step="10"
                    className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground font-mono"
                    value={form.amount}
                    onChange={(e) => handleAmountChange(Number(e.target.value) || 0)}
                    required
                  />
                  <span className="text-[11px] text-muted-foreground">
                    प्रति {form.uom || "इकाई"} दर
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    प्रोत्साहन / छूट (Incentive)
                  </label>
                  <input
                    aria-label="Incentive"
                    type="number"
                    min="0"
                    step="10"
                    className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground font-mono"
                    value={form.incentive}
                    onChange={(e) => handleIncentiveChange(Number(e.target.value) || 0)}
                  />
                  <span className="text-[11px] text-muted-foreground">छूट रकम</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary">
                    लागू शुल्क (Chargeable) *
                  </label>
                  <input
                    aria-label="Chargeable Amount"
                    type="number"
                    min="0"
                    step="10"
                    className="mt-1 w-full rounded border-2 border-primary/40 bg-background px-3 py-2 text-sm font-bold text-primary font-mono"
                    value={form.chargeable_amount}
                    onChange={(e) =>
                      setForm({ ...form, chargeable_amount: Number(e.target.value) || 0 })
                    }
                    required
                  />
                  <span className="text-[11px] text-muted-foreground">कुल तिर्नुपर्ने दर</span>
                </div>
              </div>

              <div className="rounded-md border bg-accent/20 p-2.5 text-xs">
                <span className="text-muted-foreground">गणना सूत्र: </span>
                <span className="font-semibold text-foreground">
                  आधार दर ({money(form.amount)}) - छूट ({money(form.incentive)}) ={" "}
                  <b>{money(form.chargeable_amount)}</b> प्रति {form.uom || "इकाई"}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  कैफियत / विवरण (Description / Notes){" "}
                  <span className="font-normal">(वैकल्पिक)</span>
                </label>
                <textarea
                  aria-label="Description"
                  rows={2}
                  className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="उदा: साना पसल तथा व्यवसायहरूका लागि लागू हुने दर"
                  value={form.description ?? ""}
                  maxLength={250}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_active"
                  className="size-4 rounded border"
                  checked={form.is_active !== false}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                <label
                  htmlFor="is_active"
                  className="text-xs font-semibold text-foreground cursor-pointer"
                >
                  यो योजना सक्रिय छ (Active Plan - People Master मा देखाउनुहोस्)
                </label>
              </div>

              {err && <p className="text-xs font-semibold text-destructive">{err}</p>}

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenModal(false)}
                  disabled={busy}
                >
                  रद्द (Cancel)
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "सेभ हुँदैछ…" : "सेभ गर्नुहोस् (Save Plan)"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </WorkspacePage>
  );
}
