/**
 * DigitalCard — on-screen member card (details + QR + barcode only, no ledger)
 * with size-flexible printing (A4 card, ID sticker, 58mm Sunmi V2 thermal)
 * and a printable member receipt.
 */

import { useEffect, useRef, useState } from "react";
import { X, Printer, CreditCard, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  np,
  MONTHS,
  type Person,
  type Receipt,
} from "@/lib/receipt-rules";
import { useAppConfig } from "@/lib/app-config";

/* ─────────────────────────────────── types ─────────────────────────────── */
type PrintSize = "a4" | "sticker" | "thermal58";

interface DigitalCardProps {
  person: Person;
  receipts: Receipt[];
  onClose: () => void;
}

/* ─────────────────── helpers ───────────────────────────────────────────── */
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function todayBSStr(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kathmandu",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const p = (n: string) => Number(parts.find((x) => x.type === n)?.value);
    const NepaliDate = require("nepali-date-converter").default;
    return NepaliDate.fromAD(new Date(p("year"), p("month") - 1, p("day"))).format("YYYY/MM/DD", "en");
  } catch {
    return "";
  }
}

async function qrDataUrl(person: Person, size = 260): Promise<string> {
  const QRCode = await import("qrcode");
  const qrData = JSON.stringify({
    card: person.card,
    name: person.name,
    ward: person.ward,
    tole: person.tole,
    phone: person.phone,
    plans: (person.plans ?? []).map((p) => p.name).join(", ") || person.plan || "",
    joined: person.joining_date || "",
  });
  return QRCode.toDataURL(qrData, {
    width: size,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M" as const,
  });
}

async function barcodeSvg(card: string, opts?: { width?: number; height?: number }) {
  const JsBarcode = (await import("jsbarcode")).default;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, card, {
    format: "CODE128",
    width: opts?.width ?? 1.6,
    height: opts?.height ?? 42,
    displayValue: false,
    margin: 0,
    background: "#ffffff",
    lineColor: "#000000",
  });
  return svg.outerHTML;
}

/* vector scaling: CODE128 barcode stays crisp at any print size */
const SIZE_CSS: Record<PrintSize, string> = {
  a4: `
    @page { size: A4; margin: 10mm; }
    body { width: 190mm; font-size: 14px; }
    .qr { width: 34mm; height: 34mm; }
    .bc { width: 70mm; height: 18mm; }
    .head { font-size: 22px; padding: 6mm; }
    .row { padding: 2.5mm 4mm; font-size: 14px; }
    .lbl { font-size: 11px; }
  `,
  sticker: `
    @page { size: 100mm 60mm; margin: 3mm; }
    body { width: 94mm; font-size: 9px; }
    .qr { width: 20mm; height: 20mm; }
    .bc { width: 44mm; height: 10mm; }
    .head { font-size: 12px; padding: 2mm 3mm; }
    .row { padding: 0.6mm 3mm; font-size: 8.5px; }
    .lbl { font-size: 7px; }
  `,
  thermal58: `
    @page { size: 58mm auto; margin: 2mm; }
    body { width: 54mm; font-size: 10px; }
    .qr { width: 26mm; height: 26mm; }
    .bc { width: 48mm; height: 10mm; }
    .head { font-size: 12px; padding: 2mm 1mm; }
    .row { padding: 0.4mm 1mm; font-size: 9.5px; }
    .lbl { font-size: 7.5px; }
  `,
};

const PRINT_STYLE = (size: PrintSize, receipt: boolean) => `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    margin: 0 auto;
    background: #fff;
    color: #000;
    font-family: 'Noto Sans', 'Segoe UI', Arial, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .qr { display: block; image-rendering: pixelated; }
  .bc { display: block; }
  .card { border: 2px solid #000; border-radius: 3mm; overflow: hidden; }
  .head { background: #1d4ed8; color: #fff; }
  .head .name { font-weight: 800; }
  .head .sub { opacity: .85; }
  .rows { padding: 2mm 0; }
  .row { display: flex; justify-content: space-between; gap: 2mm; }
  .row + .row { border-top: 1px dashed #cbd5e1; }
  .lbl { color: #64748b; flex-shrink: 0; }
  .val { font-weight: 700; text-align: right; word-break: break-word; }
  .center { text-align: center; }
  .mono { font-family: ui-monospace, monospace; }
  .foot { border-top: 1px solid #000; padding: 1.5mm; text-align: center; font-size: 0.75em; }
  .company-tag { margin-top: 2mm; padding: 1.5mm 2mm; border: 1.5px solid #000; border-radius: 2mm; text-align: center; font-size: .9em; }
  .company-tag .cname { font-weight: 800; font-size: 1.15em; }
  .company-tag .caddr { margin-top: .5mm; opacity: .85; font-size: .85em; }
  .company-tag .cmeta { margin-top: .3mm; font-size: .8em; font-family: ui-monospace, monospace; }
  .sec-title { font-weight: 800; letter-spacing: .08em; border-bottom: 1px solid #000; padding: 1mm 0; margin-top: 2mm; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 1mm 1.5mm; text-align: left; vertical-align: top; }
  th { background: #e2e8f0; font-weight: 700; }
  .num { text-align: right; }
  .sign { display: flex; justify-content: space-between; margin-top: 8mm; gap: 10mm; }
  .sign div { flex: 1; border-top: 1px solid #000; padding-top: 1mm; text-align: center; font-size: .85em; }
  .qrbox { display: flex; flex-direction: column; align-items: center; gap: 1mm; margin: 2mm 0; }
  .slogan { text-align: center; font-size: .8em; margin-top: 2mm; font-style: italic; }
  ${SIZE_CSS[size]}
  ${receipt ? `.card { border-radius: 1mm; } .head { background: #fff; color: #000; border-bottom: 2px solid #000; }` : ""}
`;

/* ─────────────────── HTML builders (pure strings, printable anywhere) ──── */
function detailsRows(person: Person): string {
  const rows: [string, string][] = [];
  rows.push(["कार्ड नं.", person.card]);
  if (person.phone) rows.push(["सम्पर्क", person.phone]);
  if (person.email) rows.push(["इमेल", person.email]);
  if (person.municipality || person.district)
    rows.push(["स्थान", [person.municipality, person.district].filter(Boolean).join(", ")]);
  if (person.ward) rows.push(["वडा", String(person.ward)]);
  if (person.tole) rows.push(["टोल", person.tole]);
  if (person.place_detail) rows.push(["घर/तल्ला", person.place_detail]);
  if (person.full_address) rows.push(["ठेगाना", person.full_address]);
  if (person.ghardhani_name) rows.push(["घरधनी", person.ghardhani_name]);
  if (person.nature) rows.push(["व्यवसाय", person.nature]);
  if (person.pan) rows.push(["PAN", person.pan]);
  if (person.joining_date) rows.push(["दर्ता मिति", np(person.joining_date)]);
  const planNames =
    (person.plans ?? []).map((sp) => (sp.quantity && sp.quantity > 1 ? `${sp.name} (${sp.quantity}×)` : sp.name)).join(", ") ||
    person.plan;
  if (planNames) rows.push(["योजना", planNames]);
  return rows
    .map(
      ([l, v]) =>
        `<div class="row"><span class="lbl">${escapeHtml(l)}</span><span class="val">${escapeHtml(v)}</span></div>`
    )
    .join("");
}

function headHtml(person: Person, receipt: boolean): string {
  if (receipt)
    return `<div class="head center">
      <div class="name">सदस्य रसिद · MEMBER RECEIPT</div>
      <div class="sub">${escapeHtml([person.municipality, person.ward ? `वडा ${person.ward}` : ""].filter(Boolean).join(", "))}</div>
    </div>`;
  return `<div class="head">
    <div class="name">${escapeHtml(person.name)}</div>
    <div class="sub mono">Card # ${escapeHtml(person.card)}${person.phone ? " • " + escapeHtml(person.phone) : ""}</div>
  </div>`;
}

/* ─────────────────── Main Component ─────────────────────────────────────── */
export function DigitalCard({ person, receipts, onClose }: DigitalCardProps) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [qrReady, setQrReady] = useState(false);
  const [printSize, setPrintSize] = useState<PrintSize>("a4");
  const config = useAppConfig();
  const today = todayBSStr();

  const personReceipts = receipts.filter(
    (r) => r.card === person.card && r.ward === person.ward
  );
  const totalReceived = personReceipts.reduce((s, r) => s + (r.total || 0), 0);

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
          tole: person.tole,
          phone: person.phone,
          plans: (person.plans ?? []).map((p) => p.name).join(", ") || person.plan || "",
          joined: person.joining_date || "",
        });
        await QRCode.toCanvas(canvas, qrData, {
          width: 260,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
          errorCorrectionLevel: "M" as const,
        });
        if (!cancelled) setQrReady(true);
      } catch (e) {
        console.error("QR generation failed", e);
      }
    };
    gen();
    return () => { cancelled = true; };
  }, [person]);

  useEffect(() => {
    const gen = async () => {
      try {
        const JsBarcode = (await import("jsbarcode")).default;
        const svg = barcodeRef.current;
        if (!svg || !person.card) return;
        JsBarcode(svg, person.card, {
          format: "CODE128",
          width: 1.6,
          height: 42,
          displayValue: false,
          margin: 0,
          background: "transparent",
          lineColor: "#000000",
        });
      } catch (e) {
        console.error("Barcode generation failed", e);
      }
    };
    gen();
  }, [person.card]);

  /* build print document: QR as high-res PNG data URL (crisp at any size),
     barcode as vector SVG (scales infinitely) */
  const openPrintWindow = async (kind: "card" | "receipt") => {
    const size: PrintSize = printSize;
    let qr = "";
    let bc = "";
    try {
      [qr, bc] = await Promise.all([qrDataUrl(person, 600), barcodeSvg(person.card)]);
    } catch (e) {
      console.error("print asset generation failed", e);
    }

    const receiptBody =
      kind === "receipt"
        ? `<div class="sec-title">योजना तथा दर · PLANS & RATES</div>
        <table><thead><tr><th>योजना</th><th class="num">दर (रु.)</th><th class="num">परिमाण</th></tr></thead><tbody>
        ${(person.plans ?? person.plan
            ? (person.plans ?? [{ name: person.plan || "—", chargeable_amount: 0, quantity: 1 }])
            : []
          )
            .map(
              (p) =>
                `<tr><td>${escapeHtml(p.name)}</td><td class="num">${(p.chargeable_amount || 0).toLocaleString("en-IN")}</td><td class="num">${p.quantity || 1}</td></tr>`
            )
            .join("")}
        </tbody></table>
        <div class="sec-title">भुक्तानी विवरण · PAYMENTS</div>
        ${
          personReceipts.length > 0
            ? `<table><thead><tr><th>र.नं.</th><th>मिति</th><th>महिना</th><th>माध्यम</th><th class="num">रकम</th></tr></thead><tbody>
          ${personReceipts
            .map(
              (r) =>
                `<tr><td>${r.no}</td><td>${np(r.date)}</td><td>${r.months.map((m) => MONTHS[m.m]).join(", ")}</td><td>${escapeHtml(r.mode)}</td><td class="num">${r.total.toLocaleString("en-IN")}</td></tr>`
            )
            .join("")}
          <tr><td colspan="4" class="num"><b>कुल भुक्तानी</b></td><td class="num"><b>${totalReceived.toLocaleString("en-IN")}</b></td></tr>
          </tbody></table>`
            : `<div style="padding:1mm 0">कुनै भुक्तानी रेकर्ड छैन।</div>`
        }
        <div class="sign"><div>बुझाउनेको सही</div><div>बुझिलिनेको सही</div></div>`
        : "";

    const html = `<html><head><meta charset="utf-8"><title>${kind === "card" ? "Member Card" : "Member Receipt"} – ${escapeHtml(person.name)}</title>
      <style>${PRINT_STYLE(size, kind === "receipt")}</style></head><body>
      <div class="${kind === "card" ? "card" : ""}">
        ${headHtml(person, kind === "receipt")}
        <div class="rows">
          ${size === "a4" || size === "thermal58" ? `<div class="center" style="margin-bottom:1mm"><b>${escapeHtml(person.name)}</b>${kind === "receipt" ? ` <span class="mono">(${escapeHtml(person.card)})</span>` : ""}</div>` : ""}
          ${detailsRows(person)}
          ${receiptBody}
          <div class="qrbox">
            ${qr ? `<img class="qr" src="${qr}" alt="QR" />` : ""}
            ${bc ? `<div class="bc">${bc}</div><div class="mono" style="font-size:.85em">${escapeHtml(person.card)}</div>` : ""}
            <div style="font-size:.7em;opacity:.7">QR स्क्यान / बारकोड</div>
          </div>
        </div>
        <div class="foot">${np(today) || ""} • ${kind === "card" ? "Sangstha — Member Card" : "Member Receipt"}</div>
      </div>
      <div class="company-tag">
        ${config.logo_url ? `<img src="${escapeHtml(config.logo_url)}" alt="" style="max-height:10mm;max-width:100%;object-fit:contain;margin-bottom:1mm" />` : ""}
        <div class="cname">${escapeHtml(config.entity_name || "")}</div>
        ${config.address ? `<div class="caddr">${escapeHtml(config.address)}</div>` : ""}
        ${config.pan_vat ? `<div class="cmeta">PAN: ${escapeHtml(config.pan_vat)}${config.phone ? ` • ${escapeHtml(config.phone)}` : ""}</div>` : config.phone ? `<div class="cmeta">${escapeHtml(config.phone)}</div>` : ""}
      </div>
      <script>setTimeout(function(){ window.print(); }, 500);<\/script>
      </body></html>`;

    const w = window.open("", "_blank", "width=480,height=720");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-3 backdrop-blur-sm overflow-y-auto">
      <div className="my-4 w-full max-w-2xl">
        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 no-print">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CreditCard className="size-4" /> डिजिटल परिचय पत्र (Digital Member Card)
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={printSize}
              onChange={(e) => setPrintSize(e.target.value as PrintSize)}
              className="h-8 rounded-md border border-white/20 bg-white/10 px-2 text-xs font-semibold text-white"
              title="प्रिन्ट साइज छान्नुहोस्"
            >
              <option value="a4" className="text-black">A4 कार्ड</option>
              <option value="sticker" className="text-black">सानो स्टिकर (100×60mm)</option>
              <option value="thermal58" className="text-black">थर्मल 58mm (Sunmi V2)</option>
            </select>
            <Button size="sm" variant="secondary" onClick={() => openPrintWindow("card")} className="gap-1.5 text-xs">
              <Printer className="size-3.5" /> कार्ड प्रिन्ट
            </Button>
            <Button size="sm" variant="secondary" onClick={() => openPrintWindow("receipt")} className="gap-1.5 text-xs">
              <ReceiptText className="size-3.5" /> रसिद प्रिन्ट
            </Button>
            <button
              onClick={onClose}
              className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Card body — details + QR only, no ledger */}
        <div
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
                  द्वारा संचालित
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
                    width={260}
                    height={260}
                    style={{ display: "block", width: 130, height: 130 }}
                    className={qrReady ? "" : "opacity-20"}
                  />
                </div>
                <p className="text-[10px] text-sky-300">QR स्क्यान</p>
              </div>
            </div>
          </div>

          {/* Body — details only */}
          <div className="bg-white px-5 py-4">
            <div className="divide-y divide-dashed divide-slate-200">
              {[
                ["कार्ड नं.", person.card],
                person.email && ["इमेल", person.email],
                person.district && ["जिल्ला", person.district],
                person.ward && ["वडा", `वडा ${person.ward}`],
                person.tole && ["टोल", person.tole],
                person.place_detail && ["घर/तल्ला", person.place_detail],
                person.full_address && ["ठेगाना", person.full_address],
                person.ghardhani_name && ["घरधनी", person.ghardhani_name],
                person.nature && ["व्यवसाय", person.nature],
                person.pan && ["PAN", person.pan],
                person.joining_date && ["दर्ता मिति", np(person.joining_date)],
                ((person.plans?.length ?? 0) > 0 || person.plan) && [
                  "योजना",
                  (person.plans ?? [])
                    .map((sp) => (sp.quantity && sp.quantity > 1 ? `${sp.name} (${sp.quantity}×)` : sp.name))
                    .join(", ") || person.plan,
                ],
              ]
                .filter((r): r is [string, string] => Boolean(r))
                .map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
                    <span className="text-sm font-semibold text-slate-700 text-right break-words">{value}</span>
                  </div>
                ))}
            </div>

            {/* Barcode */}
            <div className="flex flex-col items-center justify-center border-t border-dashed border-slate-200 pt-3 mt-3">
              <svg ref={barcodeRef} className="max-w-full" />
              <p className="mt-0.5 text-[10px] text-slate-400 font-mono">
                {person.card}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{ background: "linear-gradient(90deg, #1e3a5f, #1d4ed8)" }}
            className="px-5 py-2 flex items-center justify-between text-[10px] text-sky-200"
          >
            <span>{person.municipality || ""} • {person.district || ""}</span>
            <span className="font-mono">{np(today)}</span>
            <span>Sangstha — Member Card</span>
          </div>
        </div>
      </div>
    </div>
  );
}
