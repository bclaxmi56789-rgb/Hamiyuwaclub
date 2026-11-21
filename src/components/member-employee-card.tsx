/**
 * MemberEmployeeCard — Digital ID Card for Club Members & Employees
 * Features:
 * - On-screen preview with organization branding, photo placeholder, QR & Barcode
 * - Multi-size printing: Standard A4, ID Badge/Sticker (100x60mm), and 58mm Thermal
 * - Tailored sections for Member (Category: Main / Others, Designation, Fee)
 *   and Employee (Designation, Staff ID, PAN, Joining Date, Qualification)
 */

import { useEffect, useRef, useState } from "react";
import { X, Printer, CreditCard, User, Briefcase, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { np, type Member, type Employee } from "@/lib/receipt-rules";
import { useAppConfig } from "@/lib/app-config";

type PrintSize = "a4" | "sticker" | "thermal58";

export type MemberEmployeeCardTarget =
  | { type: "member"; item: Member }
  | { type: "employee"; item: Employee };

interface MemberEmployeeCardProps {
  target: MemberEmployeeCardTarget;
  onClose: () => void;
}

const escapeHtml = (s: string) =>
  (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

async function generateQrDataUrl(text: string, size = 260): Promise<string> {
  try {
    const QRCode = await import("qrcode");
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M" as const,
    });
  } catch (e) {
    console.error("QR generation failed", e);
    return "";
  }
}

async function generateBarcodeSvg(code: string, opts?: { width?: number; height?: number }): Promise<string> {
  try {
    const JsBarcode = (await import("jsbarcode")).default;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, code, {
      format: "CODE128",
      width: opts?.width ?? 1.6,
      height: opts?.height ?? 40,
      displayValue: false,
      margin: 0,
      background: "transparent",
      lineColor: "#000000",
    });
    return svg.outerHTML;
  } catch (e) {
    console.error("Barcode generation failed", e);
    return "";
  }
}

const SIZE_CSS: Record<PrintSize, string> = {
  a4: `
    @page { size: A4; margin: 12mm; }
    body { width: 186mm; font-size: 14px; }
    .card { max-width: 130mm; margin: 0 auto; border-radius: 4mm; border: 2.5px solid #0f172a; }
    .qr { width: 34mm; height: 34mm; }
    .bc { width: 68mm; height: 16mm; }
    .head { padding: 4.5mm 5mm; }
    .row { padding: 2mm 3.5mm; font-size: 13px; }
    .lbl { font-size: 11px; }
  `,
  sticker: `
    @page { size: 100mm 60mm; margin: 2mm; }
    body { width: 96mm; font-size: 9px; }
    .card { width: 96mm; border-radius: 2mm; border: 1.5px solid #0f172a; }
    .qr { width: 22mm; height: 22mm; }
    .bc { width: 44mm; height: 9mm; }
    .head { padding: 2mm 3mm; }
    .row { padding: 0.7mm 2.5mm; font-size: 8.5px; }
    .lbl { font-size: 7px; }
  `,
  thermal58: `
    @page { size: 58mm auto; margin: 1.5mm; }
    body { width: 55mm; font-size: 10px; }
    .card { width: 55mm; border-radius: 2mm; border: 1.5px solid #0f172a; }
    .qr { width: 26mm; height: 26mm; }
    .bc { width: 48mm; height: 10mm; }
    .head { padding: 2mm 1.5mm; }
    .row { padding: 0.6mm 1.5mm; font-size: 9px; }
    .lbl { font-size: 7.5px; }
  `,
};

export function MemberEmployeeCard({ target, onClose }: MemberEmployeeCardProps) {
  const isMember = target.type === "member";
  const member = isMember ? target.item : null;
  const employee = !isMember ? target.item : null;

  const config = useAppConfig();
  const [printSize, setPrintSize] = useState<PrintSize>("sticker");
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const barcodeSvgRef = useRef<SVGSVGElement>(null);

  const cardId = isMember
    ? member?.id || `MEM-${member?.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`
    : employee?.id || `EMP-${employee?.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;

  const displayName = isMember ? member?.name || "" : employee?.name || "";
  const designation = isMember ? member?.designation || "" : employee?.designation || "";
  const phone = isMember ? member?.phone || "" : employee?.phone || "";
  const status = isMember ? member?.status || "active" : employee?.status || "active";
  const isMainMember = isMember && (member?.category || "main") === "main";

  // Build QR payload
  const qrPayload = JSON.stringify(
    isMember
      ? {
          type: "CLUB_MEMBER",
          id: cardId,
          name: displayName,
          designation,
          category: isMainMember ? "Main Member (मुख्य सदस्य)" : "Others (अन्य सदस्य)",
          phone,
          address: member?.address || "",
          fee: member?.membership_fee || 0,
          status,
          org: config.entity_name || "Hami Yuwa Club",
        }
      : {
          type: "STAFF_EMPLOYEE",
          id: cardId,
          name: displayName,
          designation,
          phone,
          pan: employee?.pan || "",
          qualification: employee?.qualification || "",
          joined: employee?.joining_date || "",
          status,
          org: config.entity_name || "Hami Yuwa Club",
        },
  );

  useEffect(() => {
    let cancelled = false;
    const generateCodes = async () => {
      try {
        const QRCode = await import("qrcode");
        const canvas = qrCanvasRef.current;
        if (canvas && !cancelled) {
          await QRCode.toCanvas(canvas, qrPayload, {
            width: 220,
            margin: 1,
            color: { dark: "#0f172a", light: "#ffffff" },
            errorCorrectionLevel: "M" as const,
          });
        }

        const JsBarcode = (await import("jsbarcode")).default;
        const svg = barcodeSvgRef.current;
        if (svg && !cancelled && cardId) {
          JsBarcode(svg, cardId, {
            format: "CODE128",
            width: 1.5,
            height: 38,
            displayValue: false,
            margin: 0,
            background: "transparent",
            lineColor: "#0f172a",
          });
        }
      } catch (err) {
        console.error("Failed to render QR or barcode", err);
      }
    };

    generateCodes();
    return () => {
      cancelled = true;
    };
  }, [qrPayload, cardId]);

  const openPrintWindow = async () => {
    const size = printSize;
    let qrUrl = "";
    let bcSvg = "";
    try {
      [qrUrl, bcSvg] = await Promise.all([
        generateQrDataUrl(qrPayload, 600),
        generateBarcodeSvg(cardId),
      ]);
    } catch {}

    const cardTitle = isMember ? "सदस्य परिचय पत्र (MEMBER IDENTITY CARD)" : "कर्मचारी परिचय पत्र (STAFF IDENTITY CARD)";
    const themeBg = isMember ? "#047857" : "#0284c7"; // Green for Member, Blue for Staff

    const rowsHtml = isMember
      ? `
        <div class="row"><span class="lbl">सदस्यता वर्ग:</span><span class="val">${isMainMember ? "★ मुख्य सदस्य (Main Member)" : "अन्य सदस्य (Others)"}</span></div>
        <div class="row"><span class="lbl">पद (Designation):</span><span class="val">${escapeHtml(designation)}</span></div>
        ${member?.phone ? `<div class="row"><span class="lbl">सम्पर्क (Phone):</span><span class="val mono">${escapeHtml(member.phone)}</span></div>` : ""}
        ${member?.address ? `<div class="row"><span class="lbl">ठेगाना (Address):</span><span class="val">${escapeHtml(member.address)}</span></div>` : ""}
        ${member?.occupation ? `<div class="row"><span class="lbl">पेशा (Occupation):</span><span class="val">${escapeHtml(member.occupation)}</span></div>` : ""}
        ${member?.dob ? `<div class="row"><span class="lbl">जन्म मिति (DOB):</span><span class="val mono">${escapeHtml(np(member.dob))}</span></div>` : ""}
        ${member?.membership_fee ? `<div class="row"><span class="lbl">वार्षिक शुल्क:</span><span class="val">रु. ${(member.membership_fee || 0).toLocaleString("en-IN")}</span></div>` : ""}
        <div class="row"><span class="lbl">सदस्य स्थिति:</span><span class="val">${status === "active" ? "सक्रिय (Active)" : "निष्कृय"}</span></div>
      `
      : `
        <div class="row"><span class="lbl">पद (Designation):</span><span class="val">${escapeHtml(designation)}</span></div>
        <div class="row"><span class="lbl">कर्मचारी कोड:</span><span class="val mono">${escapeHtml(cardId)}</span></div>
        ${employee?.phone ? `<div class="row"><span class="lbl">सम्पर्क (Phone):</span><span class="val mono">${escapeHtml(employee.phone)}</span></div>` : ""}
        ${employee?.pan ? `<div class="row"><span class="lbl">PAN No:</span><span class="val mono">${escapeHtml(employee.pan)}</span></div>` : ""}
        ${employee?.qualification ? `<div class="row"><span class="lbl">योग्यता:</span><span class="val">${escapeHtml(employee.qualification)}</span></div>` : ""}
        ${employee?.joining_date ? `<div class="row"><span class="lbl">नियुक्ति मिति:</span><span class="val mono">${escapeHtml(np(employee.joining_date))}</span></div>` : ""}
        <div class="row"><span class="lbl">कार्य स्थिति:</span><span class="val">${status === "active" ? "सक्रिय (Active)" : status === "on_leave" ? "बिदामा (On Leave)" : "निष्कृय"}</span></div>
      `;

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${isMember ? "Member Card" : "Staff Card"} – ${escapeHtml(displayName)}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              margin: 0 auto;
              background: #fff;
              color: #0f172a;
              font-family: 'Noto Sans', 'Segoe UI', Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .card {
              overflow: hidden;
              background: #fff;
              box-shadow: none;
            }
            .head {
              background: ${themeBg};
              color: #fff;
              text-align: center;
              border-bottom: 2px solid #0f172a;
            }
            .head .org { font-size: 1.1em; font-weight: 800; letter-spacing: 0.02em; }
            .head .org-sub { font-size: 0.78em; opacity: 0.9; margin-top: 1px; }
            .head .card-title {
              display: inline-block;
              background: #fff;
              color: ${themeBg};
              font-weight: 800;
              font-size: 0.75em;
              padding: 1px 8px;
              border-radius: 9999px;
              margin-top: 3px;
              text-transform: uppercase;
            }
            .body { padding: 3mm 4mm; }
            .person-header {
              text-align: center;
              margin-bottom: 2mm;
              padding-bottom: 2mm;
              border-bottom: 1px solid #e2e8f0;
            }
            .person-name { font-size: 1.2em; font-weight: 800; color: #0f172a; }
            .person-sub { font-size: 0.85em; font-weight: 700; color: ${themeBg}; margin-top: 1px; }
            .row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px dashed #cbd5e1;
            }
            .lbl { color: #475569; font-weight: 600; }
            .val { font-weight: 700; text-align: right; }
            .mono { font-family: ui-monospace, monospace; }
            .code-box {
              display: flex;
              flex-direction: column;
              align-items: center;
              margin-top: 3mm;
              padding-top: 2mm;
              border-top: 1px solid #e2e8f0;
              gap: 1.5mm;
            }
            .qr { display: block; image-rendering: pixelated; }
            .bc { display: block; }
            .card-foot {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 4mm;
              padding-top: 2mm;
              font-size: 0.72em;
              color: #475569;
            }
            .sign-box {
              text-align: center;
              border-top: 1px solid #475569;
              padding-top: 1mm;
              width: 32mm;
              font-weight: 700;
            }
            ${SIZE_CSS[size]}
          </style>
        </head>
        <body>
          <div class="card">
            <div class="head">
              <div class="org">${escapeHtml(config.entity_name || "हामी युवा क्लब (Hami Yuwa Club)")}</div>
              ${config.address ? `<div class="org-sub">${escapeHtml(config.address)}${config.phone ? " • " + escapeHtml(config.phone) : ""}</div>` : ""}
              <div class="card-title">${cardTitle}</div>
            </div>
            <div class="body">
              <div class="person-header">
                <div class="person-name">${escapeHtml(displayName)}</div>
                <div class="person-sub">${escapeHtml(designation)}</div>
              </div>
              ${rowsHtml}
              <div class="code-box">
                ${qrUrl ? `<img class="qr" src="${qrUrl}" alt="QR Code" />` : ""}
                ${bcSvg ? `<div class="bc">${bcSvg}</div><div class="mono" style="font-size: 0.8em; font-weight: 700;">${escapeHtml(cardId)}</div>` : ""}
              </div>
              <div class="card-foot">
                <div>जारी मिति: ${escapeHtml(np(new Date().toISOString().slice(0, 10)))}</div>
                <div class="sign-box">अधिकृत हस्ताक्षर<br/><span style="font-size:0.8em;font-weight:normal">(Authorized Sign)</span></div>
              </div>
            </div>
          </div>
          <script>
            setTimeout(() => { window.print(); }, 400);
          </script>
        </body>
      </html>
    `;

    const printWin = window.open("", "_blank", "width=520,height=720");
    if (!printWin) return;
    printWin.document.write(printHtml);
    printWin.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs animate-in fade-in-50">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl border bg-card shadow-2xl overflow-hidden">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b px-5 py-3.5 bg-muted/40">
          <div className="flex items-center gap-2">
            <CreditCard className={`size-5 ${isMember ? "text-emerald-600" : "text-sky-600"}`} />
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {isMember ? "सदस्य डिजिटल परिचय पत्र" : "कर्मचारी डिजिटल परिचय पत्र"}
              </h3>
              <p className="text-[11px] text-muted-foreground">Digital ID Card Preview &amp; Print</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Print Size Selection */}
            <div className="hidden sm:flex items-center rounded-lg border bg-background p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPrintSize("sticker")}
                className={`rounded px-2 py-1 transition-colors ${
                  printSize === "sticker" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="आईडी कार्ड / स्टिकर (100×60 mm)"
              >
                स्टिकर (ID)
              </button>
              <button
                type="button"
                onClick={() => setPrintSize("a4")}
                className={`rounded px-2 py-1 transition-colors ${
                  printSize === "a4" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="A4 पाना (Standard Paper)"
              >
                A4
              </button>
              <button
                type="button"
                onClick={() => setPrintSize("thermal58")}
                className={`rounded px-2 py-1 transition-colors ${
                  printSize === "thermal58" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="थर्मल प्रिन्टर (58mm)"
              >
                ५८मिमी
              </button>
            </div>

            <Button size="sm" onClick={openPrintWindow} className="gap-1.5 text-xs font-bold shadow-xs">
              <Printer className="size-3.5" />
              <span>प्रिन्ट</span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body: Realistic ID Card Preview */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7 flex flex-col items-center justify-center bg-muted/20">
          <div className="w-full max-w-[360px] rounded-2xl border-2 border-border bg-card shadow-lg overflow-hidden transition-all">
            {/* Card Header */}
            <div
              className={`p-4 text-center text-white relative ${
                isMember ? "bg-gradient-to-br from-emerald-600 to-teal-700" : "bg-gradient-to-br from-sky-600 to-blue-700"
              }`}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                {config.logo_url ? (
                  <img
                    src={config.logo_url}
                    alt="Logo"
                    className="size-7 rounded-full bg-white p-0.5 object-contain shadow-xs"
                  />
                ) : (
                  <div className="size-7 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-xs">
                    हा
                  </div>
                )}
                <div className="text-xs font-black tracking-wide truncate max-w-[240px]">
                  {config.entity_name || "हामी युवा क्लब"}
                </div>
              </div>
              <div className="text-[10px] text-white/85 font-medium truncate">
                {config.address || "वीरेन्द्रनगर, सुर्खेत"}
              </div>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-xs text-white">
                <Sparkles className="size-3" />
                <span>
                  {isMember
                    ? isMainMember
                      ? "मुख्य सदस्य परिचय पत्र"
                      : "सदस्य परिचय पत्र (Member ID)"
                    : "कर्मचारी परिचय पत्र (Staff ID)"}
                </span>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-4 space-y-3">
              {/* Person Profile Box */}
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div
                  className={`size-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner font-extrabold text-base ${
                    isMember
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                  }`}
                >
                  {isMember ? <User className="size-6" /> : <Briefcase className="size-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-extrabold text-sm text-foreground truncate">{displayName}</h4>
                    {isMember && isMainMember && (
                      <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.2 text-[9px] font-black text-primary">
                        ★ मुख्य
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-muted-foreground truncate">{designation}</div>
                  <div className="text-[10px] font-mono text-muted-foreground/80 mt-0.5">ID: {cardId}</div>
                </div>
              </div>

              {/* Data Rows */}
              <div className="space-y-1.5 text-xs">
                {isMember ? (
                  <>
                    <div className="flex justify-between py-0.5 border-b border-dotted border-border/70">
                      <span className="text-muted-foreground font-medium">सदस्यता वर्ग:</span>
                      <span className="font-bold text-foreground">
                        {isMainMember ? "★ मुख्य सदस्य (Main Member)" : "👥 अन्य सदस्य (Others)"}
                      </span>
                    </div>
                    {member?.phone && (
                      <div className="flex justify-between py-0.5 border-b border-dotted border-border/70">
                        <span className="text-muted-foreground font-medium">सम्पर्क (Phone):</span>
                        <span className="font-mono font-bold text-foreground">{member.phone}</span>
                      </div>
                    )}
                    {member?.address && (
                      <div className="flex justify-between py-0.5 border-b border-dotted border-border/70">
                        <span className="text-muted-foreground font-medium">ठेगाना (Address):</span>
                        <span className="font-semibold text-foreground text-right truncate max-w-[180px]">
                          {member.address}
                        </span>
                      </div>
                    )}
                    {member?.occupation && (
                      <div className="flex justify-between py-0.5 border-b border-dotted border-border/70">
                        <span className="text-muted-foreground font-medium">पेशा (Occupation):</span>
                        <span className="font-semibold text-foreground">{member.occupation}</span>
                      </div>
                    )}
                    {member?.dob && (
                      <div className="flex justify-between py-0.5 border-b border-dotted border-border/70">
                        <span className="text-muted-foreground font-medium">जन्म मिति (DOB):</span>
                        <span className="font-mono font-semibold text-foreground">{np(member.dob)}</span>
                      </div>
                    )}
                    {member?.membership_fee ? (
                      <div className="flex justify-between py-0.5 border-b border-dotted border-border/70">
                        <span className="text-muted-foreground font-medium">वार्षिक शुल्क:</span>
                        <span className="font-mono font-bold text-foreground">
                          रु. {(member.membership_fee || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between py-0.5 border-b border-dotted border-border/70">
                      <span className="text-muted-foreground font-medium">पद (Designation):</span>
                      <span className="font-bold text-foreground">{designation}</span>
                    </div>
                    {employee?.phone && (
                      <div className="flex justify-between py-0.5 border-b border-dotted border-border/70">
                        <span className="text-muted-foreground font-medium">सम्पर्क (Phone):</span>
                        <span className="font-mono font-bold text-foreground">{employee.phone}</span>
                      </div>
                    )}
                    {employee?.pan && (
                      <div className="flex justify-between py-0.5 border-b border-dotted border-border/70">
                        <span className="text-muted-foreground font-medium">स्थायी लेखा नं. (PAN):</span>
                        <span className="font-mono font-bold text-foreground">{employee.pan}</span>
                      </div>
                    )}
                    {employee?.qualification && (
                      <div className="flex justify-between py-0.5 border-b border-dotted border-border/70">
                        <span className="text-muted-foreground font-medium">योग्यता (Qual.):</span>
                        <span className="font-semibold text-foreground">{employee.qualification}</span>
                      </div>
                    )}
                    {employee?.joining_date && (
                      <div className="flex justify-between py-0.5 border-b border-dotted border-border/70">
                        <span className="text-muted-foreground font-medium">नियुक्ति (Joined):</span>
                        <span className="font-mono font-semibold text-foreground">{np(employee.joining_date)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground font-medium">स्थिति (Status):</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                    <CheckCircle2 className="size-3" />
                    <span>{status === "active" ? "सक्रिय (Active)" : status}</span>
                  </span>
                </div>
              </div>

              {/* Dynamic QR & Barcode Container */}
              <div className="pt-2 flex flex-col items-center justify-center gap-1 bg-muted/40 rounded-xl p-2.5 border border-border">
                <canvas ref={qrCanvasRef} className="size-24 rounded bg-white p-1 shadow-2xs" />
                <svg ref={barcodeSvgRef} className="max-w-[180px] h-8" />
                <span className="text-[10px] font-mono font-bold text-muted-foreground">{cardId}</span>
              </div>

              {/* Card Footer */}
              <div className="pt-2 flex items-end justify-between text-[10px] text-muted-foreground border-t border-border">
                <div>जारी: {np(new Date().toISOString().slice(0, 10))}</div>
                <div className="text-center font-bold border-t border-border pt-0.5 px-2">
                  अधिकृत हस्ताक्षर
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
          <div className="text-xs text-muted-foreground">
            आकार: <span className="font-bold text-foreground uppercase">{printSize}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              बन्द गर्नुहोस्
            </Button>
            <Button size="sm" onClick={openPrintWindow} className="gap-1.5 text-xs font-bold">
              <Printer className="size-3.5" />
              <span>प्रिन्ट कार्ड (Print)</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
