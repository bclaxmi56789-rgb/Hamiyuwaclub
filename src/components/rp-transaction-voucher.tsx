import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  np,
  fiscalYear,
  fiscalLabel,
  type RPTransaction,
  type RPAccount,
} from "@/lib/receipt-rules";
import { useAppConfig } from "@/lib/app-config";

const money = (n: number) =>
  np(Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }));

const partyLabel = (t: RPTransaction) =>
  t.txn_type === "receipt"
    ? "जना ग्राहक"
    : t.party_type === "vendor"
      ? "विक्रेता"
      : t.party_type === "employee"
        ? "कर्मचारी"
        : "पार्टी";

export function RPTransactionVoucher({
  t,
  fromAcc,
  toAcc,
  onClose,
}: {
  t: RPTransaction;
  fromAcc?: RPAccount | null;
  toAcc?: RPAccount | null;
  onClose: () => void;
}) {
  const config = useAppConfig();
  const fy = t.fiscal_year || fiscalYear(t.txn_date) || 0;
  const amount = Number(t.amount);

  useEffect(() => {
    document.body.classList.add("print-voucher-open");
    return () => document.body.classList.remove("print-voucher-open");
  }, []);

  const accountText = (a?: RPAccount | null) =>
    a
      ? `${a.name}${a.account_type === "bank" && a.account_number ? ` · A/C ${a.account_number}` : ""} (${a.account_type === "bank" ? "बैंक" : "नगद"})`
      : "";
  const fromText = accountText(fromAcc);
  const toText = accountText(toAcc);
  const party = t.party_name || "";

  const narration =
    t.txn_type === "receipt"
      ? `${party ? `श्री ${party} (${partyLabel(t)}) बाट ` : ""}${fromText} खातामा रु. ${money(amount)} प्राप्त भयो।`
      : t.txn_type === "payment"
        ? `${party ? `श्री ${party} (${partyLabel(t)}) लाई` : ""} ${fromText} खाताबाट रु. ${money(amount)} भुक्तानी गरियो।`
        : `${fromText} खाताबाट ${toText} खातामा रु. ${money(amount)} सारसम्पर्क गरियो।`;

  const drLabel =
    t.txn_type === "receipt"
      ? `${t.account_name || fromText}`
      : t.txn_type === "payment"
        ? `${partyLabel(t)}${party ? `: ${party}` : ""}`
        : `${toText}`;
  const crLabel =
    t.txn_type === "receipt"
      ? `${partyLabel(t)}${party ? `: ${party}` : ""}`
      : t.txn_type === "payment"
        ? `${t.account_name || fromText}`
        : `${t.account_name || fromText}`;

  const title =
    t.txn_type === "receipt"
      ? "आम्दानी रसिद प्रमाण"
      : t.txn_type === "payment"
        ? "भुक्तानी (खर्च) प्रमाण"
        : "खाता हस्तान्तरण प्रमाण";

  return createPortal(
    <div className="print-portal fixed inset-0 z-50 overflow-auto bg-black/50 p-4">
      <div className="mx-auto w-full max-w-2xl rounded-lg border-2 border-foreground bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-3">
            {config.logo_url && (
              <img src={config.logo_url} alt="Logo" className="size-14 rounded-sm object-contain" />
            )}
            <div>
              <h3 className="text-base font-bold text-foreground">
                {config.entity_name || "हामी युवा क्लब"}
              </h3>
              <div className="text-xs text-muted-foreground">
                {config.address || "वीरेन्द्रनगर, सुर्खेत"}
              </div>
              {config.pan_vat && (
                <div className="font-mono text-xs text-muted-foreground">PAN: {config.pan_vat}</div>
              )}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-extrabold">{title}</h2>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
          <span>
            र.नं.: <b className="text-primary">{t.ref_no}</b>
          </span>
          <span>
            मिति: <b>{np(t.txn_date)}</b>
          </span>
          <span>
            आ.व.: <b>{fiscalLabel(fy)}</b>
          </span>
        </div>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b font-bold">
              <th className="py-1 text-left">विवरण</th>
              <th className="py-1 text-right">डेबिट (रु.)</th>
              <th className="py-1 text-right">क्रेडिट (रु.)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-1.5">{drLabel}</td>
              <td className="py-1.5 text-right tabular-nums">{money(amount)}</td>
              <td className="py-1.5 text-right text-muted-foreground">—</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5">{crLabel}</td>
              <td className="py-1.5 text-right text-muted-foreground">—</td>
              <td className="py-1.5 text-right tabular-nums">{money(amount)}</td>
            </tr>
            <tr className="font-extrabold">
              <td className="py-1.5">जम्मा</td>
              <td className="py-1.5 text-right tabular-nums">{money(amount)}</td>
              <td className="py-1.5 text-right tabular-nums">{money(amount)}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-3 break-all text-sm">
          {narration}
          {t.remarks ? (
            <>
              {" "}
              <span className="italic">(कैफियत: {t.remarks})</span>
            </>
          ) : null}
        </p>

        <div className="mt-10 flex justify-between text-sm">
          <span className="border-t border-foreground pt-1">बुझाउनेको सही</span>
          <span className="border-t border-foreground pt-1">बुझिलिनेको सही</span>
        </div>
        <div className="no-print mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            बन्द
          </Button>
          <Button type="button" onClick={() => window.print()} className="font-bold">
            प्रिन्ट
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
