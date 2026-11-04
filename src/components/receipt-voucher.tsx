import { Button } from "@/components/ui/button";
import { MONTHS, np, fiscalLabel, monthYear, receiptReference, type Receipt } from "@/lib/receipt-rules";
import { useAppConfig } from "@/lib/app-config";
const money = (n: number) => "रु. " + n.toLocaleString("en-IN");
export function ReceiptVoucher({ r, onClose }: { r: Receipt; onClose: () => void }) {
  const config = useAppConfig();
  const distinctYears = Array.from(new Set(r.months.map((m) => (m.year ? String(m.year) : r.year)))).sort();
  const fiscalYearsText = distinctYears.length === 1 ? fiscalLabel(distinctYears[0] ?? r.year) : distinctYears.map((y) => fiscalLabel(y)).join(", ");

  return (
    <div className="mt-8 rounded-lg border-2 border-foreground bg-card p-6">
      <div className="flex items-center justify-between border-b pb-3 mb-4 gap-3">
        <div className="flex items-center gap-3">
          {config.logo_url && (
            <img src={config.logo_url} alt="Logo" className="size-14 object-contain rounded-sm" />
          )}
          <div>
            <h3 className="text-base font-bold text-foreground">{config.entity_name || ""}</h3>
            <div className="text-xs text-muted-foreground">{config.address || ""}</div>
            {config.pan_vat && <div className="text-xs font-mono text-muted-foreground">PAN: {config.pan_vat}</div>}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-extrabold">वीरेन्द्रनगर नगरपालिका, {r.ward} नं. वडा कार्यालय</h2>
          <span className="mt-1 inline-block rounded bg-foreground px-3 py-0.5 text-xs font-bold text-background">फोहोरमैला व्यवस्थापन</span>
        </div>
      </div>
      <div className="mt-4 flex justify-between"><span>र.नं.: <b className="text-primary">{r.no}</b></span><span>मिति: <b>{np(r.date)}</b></span></div>
      <p className="mt-2 break-all text-sm">Reference number: <b>{receiptReference(r)}</b></p>
      <p className="mt-3 leading-8">
        वीरेन्द्रनगर नगरपालिका वडा नं. <b className="text-ink">{r.ward}</b> टोल <b className="text-ink">{r.tole || "—"}</b>
        {r.full_address ? <> (ठेगाना: <b className="text-ink">{r.full_address}</b>)</> : null}
        {" "}कार्ड नं. <b className="text-ink">{r.card}</b> अन्तरगत फर्म/व्यक्ति श्री <b className="text-ink">{r.name}</b>
        {r.pan ? <> (प्यान नं.: <b className="font-mono text-ink">{r.pan}</b>)</> : null}
        {r.phone ? <> (सम्पर्क: <b className="text-ink">{r.phone}</b>)</> : null} बाट साल <b className="text-ink">{fiscalYearsText}</b> का <b className="text-ink">{r.months.map((m) => `${MONTHS[m.m]}${distinctYears.length > 1 ? ` (${fiscalLabel(m.year || r.year)})` : ""}`).join(", ")}</b> महिनाको फोहोरमैला व्यवस्थापन शुल्क बापत प्राप्त भयो।
      </p>
      <table className="mt-3 w-full text-sm"><tbody>
        {r.months.map((m, idx) => {
          const itemYear = m.year ? String(m.year) : r.year;
          return (
            <tr key={`${itemYear}-${m.m}-${idx}`} className="border-b">
              <td>
                {MONTHS[m.m]} {np(monthYear(itemYear, m.m))}
                {distinctYears.length > 1 && (
                  <span className="ml-2 text-xs font-semibold text-muted-foreground">(आ.व. {fiscalLabel(itemYear)})</span>
                )}
              </td>
              <td className="text-right">{money(m.amt)}</td>
            </tr>
          );
        })}
        <tr className="font-bold"><td>कुल जम्मा</td><td className="text-right">{money(r.total)}</td></tr>
      </tbody></table>
      <p className="mt-2">भुक्तानी माध्यम: <b>{r.mode}</b></p>
      <div className="mt-10 flex justify-between text-sm"><span className="border-t border-foreground pt-1">बुझाउनेको सही</span><span className="border-t border-foreground pt-1">बुझिलिनेको सही</span></div>
      <p className="mt-4 text-center text-xs">"फोहोर नगरौं, वीरेन्द्रनगर नगरपालिका वडा नं. {r.ward} लाई फोहोरमुक्त बनाऔं।"</p>
      <div className="no-print mt-4 flex justify-end gap-2">
        <Button onClick={onClose} className="rounded border px-4 py-2">बन्द</Button>
        <Button onClick={() => window.print()} className="rounded bg-primary px-4 py-2 font-bold text-primary-foreground">प्रिन्ट</Button>
      </div>
    </div>
  );
}
