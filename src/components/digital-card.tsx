/**
 * DigitalCard — printable & on-screen digital membership card with embedded QR code.
 */

import { useEffect, useRef, useState } from "react";
import { X, Printer, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  np,
  MONTHS,
  type Person,
  type Receipt,
  type CustomerPlanSubscription,
} from "@/lib/receipt-rules";

/* ─────────────────────────────────── types ─────────────────────────────── */
interface PlanStat {
  sub: CustomerPlanSubscription;
  totalCharge: number;
  totalReceived: number;
  overdueAmount: number;
  overdueMonths: number;
  enrollDate: string;
}

interface DigitalCardProps {
  person: Person;
  receipts: Receipt[];
  onClose: () => void;
}

/* ─────────────────────────── helper utilities ───────────────────────────── */
function monthsBetweenBS(fromDate: string, toDate: string): number {
  const norm = (d: string) => d.replace(/[०-९]/g, (c) => String("०१२३४५६७८९".indexOf(c)));
  const parse = (d: string) => {
    const parts = norm(d).split("/").map(Number);
    return { y: parts[0] ?? 0, m: parts[1] ?? 1 };
  };
  const a = parse(fromDate);
  const b = parse(toDate);
  return Math.max(0, (b.y - a.y) * 12 + (b.m - a.m));
}

function todayBSStr(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kathmandu",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const p = (n: string) => Number(parts.find((x) => x.type === n)?.value);
    // dynamic import to avoid SSR issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const NepaliDate = require("nepali-date-converter").default;
    return NepaliDate.fromAD(new Date(p("year"), p("month") - 1, p("day"))).format("YYYY/MM/DD", "en");
  } catch {
    return "2081/07/13";
  }
}

/* ─────────────────── Main Component ─────────────────────────────────────── */
export function DigitalCard({ person, receipts, onClose }: DigitalCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [qrReady, setQrReady] = useState(false);

  const personReceipts = receipts.filter(
    (r) => r.card === person.card && r.ward === person.ward
  );
  const totalReceived = personReceipts.reduce((s, r) => s + (r.total || 0), 0);
  const today = todayBSStr();

  const planStats: PlanStat[] = (person.plans && person.plans.length > 0
    ? person.plans
    : []
  ).map((sub) => {
    const qty = sub.quantity || 1;
    const monthlyCharge = (sub.chargeable_amount || 0) * qty;
    const enrollDate = person.joining_date || today;
    const monthsActive = Math.max(1, monthsBetweenBS(enrollDate, today));
    const totalCharge = monthlyCharge * monthsActive;

    const plansTotalMonthly = (person.plans ?? []).reduce(
      (s, p) => s + (p.chargeable_amount || 0) * (p.quantity || 1),
      0
    );
    const planRatio = plansTotalMonthly > 0 ? monthlyCharge / plansTotalMonthly : 1;
    const planReceived = totalReceived * planRatio;
    const overdueAmount = Math.max(0, totalCharge - planReceived);
    const overdueMonths = monthlyCharge > 0 ? Math.floor(overdueAmount / monthlyCharge) : 0;

    return { sub, totalCharge, totalReceived: planReceived, overdueAmount, overdueMonths, enrollDate };
  });

  const openingDuesTotal = (person.opening_dues ?? []).reduce((s, od) => s + (Number(od.amount) || 0), 0);
  const grandTotalCharge = planStats.reduce((s, p) => s + p.totalCharge, 0) + openingDuesTotal;
  const grandOverdueAmount = Math.max(0, grandTotalCharge - totalReceived);

  useEffect(() => {
    let cancelled = false;
    const gen = async () => {
      try {
        const QRCode = await import("qrcode");
        const canvas = qrRef.current;
        if (!canvas || cancelled) return;
        const qrData = JSON.stringify({
          card: person.card,
          name: person.name,
          ward: person.ward,
          phone: person.phone,
          plans: (person.plans ?? []).map((p) => p.name).join(", ") || person.plan || "",
          joined: person.joining_date || "",
          totalCharge: grandTotalCharge,
          totalReceived,
          overdue: grandOverdueAmount,
        });
        await QRCode.toCanvas(canvas, qrData, {
          width: 130,
          margin: 1,
          color: { dark: "#1e293b", light: "#ffffff" },
          errorCorrectionLevel: "M" as const,
        });
        if (!cancelled) setQrReady(true);
      } catch (e) {
        console.error("QR generation failed", e);
      }
    };
    gen();
    return () => { cancelled = true; };
  }, [person, grandTotalCharge, totalReceived, grandOverdueAmount]);

  useEffect(() => {
    const gen = async () => {
      try {
        const JsBarcode = (await import("jsbarcode")).default;
        const svg = barcodeRef.current;
        if (!svg || !person.card) return;
        JsBarcode(svg, person.card, {
          format: "CODE128",
          width: 1.4,
          height: 36,
          displayValue: true,
          fontSize: 10,
          margin: 4,
          background: "transparent",
          lineColor: "#1e293b",
        });
      } catch (e) {
        console.error("Barcode generation failed", e);
      }
    };
    gen();
  }, [person.card]);

  const handlePrint = () => {
    const content = cardRef.current;
    if (!content) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`
      <html><head><title>Digital Card – ${person.name}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #f1f5f9; display: flex; justify-content: center; padding: 24px; font-family: 'Segoe UI', sans-serif; }
        .no-print { display: none !important; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${content.outerHTML}
      <script>setTimeout(function(){ window.print(); window.close(); }, 600);<\/script>
      </body></html>
    `);
    w.document.close();
  };

  const getMonthName = (m: number) => MONTHS[m] ?? String(m);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-3 backdrop-blur-sm overflow-y-auto">
      <div className="my-4 w-full max-w-2xl">
        {/* Toolbar */}
        <div className="mb-3 flex items-center justify-between no-print">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CreditCard className="size-4" /> डिजिटल परिचय पत्र (Digital Member Card)
          </h2>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handlePrint} className="gap-1.5 text-xs">
              <Printer className="size-3.5" /> प्रिन्ट (Print)
            </Button>
            <button
              onClick={onClose}
              className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Card body */}
        <div
          ref={cardRef}
          style={{ fontFamily: "'Noto Sans', 'Segoe UI', Arial, sans-serif" }}
          className="rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 55%, #0ea5e9 100%)",
            }}
            className="relative px-5 py-5 text-white overflow-hidden"
          >
            <div className="absolute right-[-40px] top-[-40px] size-40 rounded-full bg-white/10" />
            <div className="absolute right-10 bottom-[-30px] size-24 rounded-full bg-white/5" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold tracking-widest uppercase text-sky-200 mb-0.5">
                  हामी युवा क्लब — Hami Yuwa Club
                </p>
                <h1 className="text-xl font-extrabold tracking-tight leading-tight">{person.name}</h1>
                <p className="mt-1 text-sm text-sky-100">
                  <span className="opacity-70">Card #</span>{" "}
                  <span className="font-mono font-bold text-white">{person.card}</span>
                  {person.phone && <span className="ml-3 opacity-80">📞 {person.phone}</span>}
                </p>
                <p className="text-xs text-sky-200 mt-0.5 leading-relaxed">
                  {[person.municipality, `वडा ${person.ward}`, person.tole]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
                {person.email && <p className="text-[11px] text-sky-300 mt-0.5">✉ {person.email}</p>}
                {person.pan && <p className="text-[11px] text-sky-300 mt-0.5 font-mono">PAN: {person.pan}</p>}
                {person.joining_date && (
                  <p className="mt-1.5 text-[11px] text-sky-200">
                    दर्ता मिति:{" "}
                    <span className="font-mono font-bold text-white">{np(person.joining_date)}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="rounded-xl bg-white p-1.5 shadow-lg">
                  <canvas
                    ref={qrRef}
                    width={130}
                    height={130}
                    style={{ display: "block" }}
                    className={qrReady ? "" : "opacity-20"}
                  />
                </div>
                <p className="text-[10px] text-sky-300">QR स्क्यान</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="bg-white px-5 py-4 space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "कुल दायित्व", sub: "Total Charge", val: grandTotalCharge, cls: "bg-blue-50 border-blue-100 text-blue-700" },
                { label: "कुल भुक्तान", sub: "Received", val: totalReceived, cls: "bg-emerald-50 border-emerald-100 text-emerald-700" },
                { label: "बाँकी रकम", sub: "Overdue", val: grandOverdueAmount, cls: grandOverdueAmount > 0 ? "bg-red-50 border-red-100 text-red-700" : "bg-gray-50 border-gray-100 text-gray-400" },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border p-2.5 text-center ${s.cls}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{s.label}</p>
                  <p className="mt-0.5 text-lg font-extrabold">रु. {s.val.toLocaleString("en-IN")}</p>
                  <p className="text-[10px] opacity-60">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Plan detail table */}
            {planStats.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  योजना विवरण · Plan-wise Details
                </h3>
                <div className="rounded-xl overflow-hidden border border-slate-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500">
                        <th className="px-3 py-2 text-left font-semibold">योजना</th>
                        <th className="px-3 py-2 text-left font-semibold">दर्ता</th>
                        <th className="px-3 py-2 text-right font-semibold">दायित्व</th>
                        <th className="px-3 py-2 text-right font-semibold">भुक्तान</th>
                        <th className="px-3 py-2 text-right font-semibold">बाँकी</th>
                        <th className="px-3 py-2 text-right font-semibold">महिना</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planStats.map((ps, idx) => {
                        const qty = ps.sub.quantity || 1;
                        return (
                          <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <div className="font-semibold text-slate-700">{ps.sub.name}</div>
                              <div className="text-[10px] text-slate-400">
                                रु. {((ps.sub.chargeable_amount || 0) * qty).toLocaleString("en-IN")}
                                /{ps.sub.uom || "महिना"}
                                {(ps.sub.trips || ps.sub.no_of_trips) ? (
                                  <span className="ml-1 text-slate-500 font-semibold">({ps.sub.trips ?? ps.sub.no_of_trips} ट्रिप)</span>
                                ) : null}
                                {qty > 1 && <span className="ml-1 text-blue-500 font-bold">×{qty}</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-500 text-[11px]">
                              {np(ps.enrollDate)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-700">
                              {ps.totalCharge.toLocaleString("en-IN")}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                              {Math.round(ps.totalReceived).toLocaleString("en-IN")}
                            </td>
                            <td className={`px-3 py-2 text-right font-bold ${ps.overdueAmount > 0 ? "text-red-600" : "text-slate-300"}`}>
                              {ps.overdueAmount > 0 ? ps.overdueAmount.toLocaleString("en-IN") : "—"}
                            </td>
                            <td className={`px-3 py-2 text-right font-bold ${ps.overdueMonths > 0 ? "text-red-500" : "text-emerald-500"}`}>
                              {ps.overdueMonths > 0 ? `${ps.overdueMonths}` : "✓"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent receipts */}
            {personReceipts.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  पछिल्ला भुक्तान · Recent Payments
                </h3>
                <div className="space-y-1">
                  {personReceipts.slice(0, 5).map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-[11px]">
                      <div className="flex items-center gap-2 text-slate-500">
                        <span className="font-mono">#{r.no}</span>
                        <span className="font-mono">{np(r.date)}</span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 font-medium">{r.mode}</span>
                        <span className="text-slate-400 truncate max-w-[120px]">
                          {r.months.map((m) => getMonthName(m.m)).join(", ")}
                        </span>
                      </div>
                      <span className="font-bold text-emerald-600">रु. {r.total.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Barcode */}
            <div className="flex flex-col items-center justify-center border-t border-dashed border-slate-200 pt-3">
              <svg ref={barcodeRef} className="max-w-full" />
              <p className="mt-0.5 text-[10px] text-slate-400 font-mono">
                {person.card} · हामी युवा क्लब
              </p>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{ background: "linear-gradient(90deg, #1e3a5f, #1d4ed8)" }}
            className="px-5 py-2 flex items-center justify-between text-[10px] text-sky-200"
          >
            <span>{person.municipality || "वीरेन्द्रनगर"} • {person.district || "सुर्खेत"}</span>
            <span className="font-mono">{np(today)}</span>
            <span>Hami Yuwa Club — Member Card</span>
          </div>
        </div>
      </div>
    </div>
  );
}
