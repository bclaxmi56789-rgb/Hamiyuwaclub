import { Button } from "@/components/ui/button";
import { MONTHS, np, todayBS, type PayrollRecord, type Employee } from "@/lib/receipt-rules";
import { useAppConfig } from "@/lib/app-config";
import { Printer, X } from "lucide-react";

const money = (n: number) => "रु. " + (n || 0).toLocaleString("en-IN");

export function PaySlipVoucher({
  record,
  employee,
  onClose,
}: {
  record: PayrollRecord;
  employee?: Employee;
  onClose: () => void;
}) {
  const config = useAppConfig();
  const monthName = MONTHS[record.month] || `महिना ${record.month + 1}`;
  const totalDeductions =
    (record.tax || 0) + (record.advance_adjusted || 0) + (record.other_deductions || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-xl border-2 border-foreground/30 bg-card p-6 shadow-2xl text-foreground">
        {/* Actions bar (hidden in print) */}
        <div className="no-print mb-4 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold text-muted-foreground">
            कर्मचारी तलब भरपाई / पे-स्लिप (Pay Slip)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="flex items-center gap-1.5"
            >
              <Printer className="size-4" />
              <span>प्रिन्ट गर्नुहोस्</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Printable Pay Slip Body */}
        <div className="printable-slip">
          {/* Organization Header */}
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <img
                src={config.logo_url || ""}
                alt={config.entity_name || "Club Logo"}
                className="size-14 rounded-sm object-contain"
              />
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">
                  {config.entity_name || ""}
                </h2>
                {config.entity_sub_name && (
                  <div className="text-xs font-semibold text-muted-foreground">
                    {config.entity_sub_name}
                  </div>
                )}
                <div className="text-xs">{config.address || ""}</div>
                {config.tagline && (
                  <div className="text-[11px] text-muted-foreground">{config.tagline}</div>
                )}
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="inline-block rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                मासिक तलब भरपाई (Pay Slip)
              </div>
              <div className="mt-1 font-medium">
                साल: <b>{np(record.year)}</b> महिना: <b>{monthName}</b>
              </div>
              <div className="text-muted-foreground">जारी मिति: {np(todayBS())}</div>
            </div>
          </div>

          {/* Employee Metadata */}
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-xs sm:grid-cols-4">
            <div>
              <div className="text-muted-foreground">कर्मचारीको नाम</div>
              <div className="font-bold text-ink">{record.employee_name}</div>
            </div>
            <div>
              <div className="text-muted-foreground">पद (Designation)</div>
              <div className="font-semibold">{record.designation}</div>
            </div>
            <div>
              <div className="text-muted-foreground">प्यान नं. (PAN No.)</div>
              <div className="font-mono">{employee?.pan || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">उपस्थित / कुल दिन</div>
              <div className="font-semibold">
                {np(record.days_worked)} / {np(record.total_days)} दिन
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">गरिएको ट्रिप संख्या</div>
              <div className="font-semibold">{np(record.trips || 0)} ट्रिप</div>
            </div>
            <div>
              <div className="text-muted-foreground">सम्पर्क नम्बर</div>
              <div>{employee?.phone || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">भुक्तानी माध्यम</div>
              <div className="font-semibold capitalize">{record.payment_mode || "नगद"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">भुक्तानी स्थिति</div>
              <div
                className={`font-bold ${record.payment_status === "paid" ? "text-emerald-600" : "text-amber-600"}`}
              >
                {record.payment_status === "paid" ? "भुक्तानी भइसकेको" : "बाँकी"}
              </div>
              {record.voucher_ref && (
                <div className="text-[10px] font-mono text-muted-foreground">
                  भौचर नं: {record.voucher_ref}
                </div>
              )}
            </div>
          </div>

          {/* Earnings & Deductions Tables */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Earnings */}
            <div className="rounded-lg border bg-card p-3">
              <div className="border-b pb-1.5 text-xs font-bold text-emerald-700">
                आम्दानी विवरण (Earnings)
              </div>
              <table className="mt-2 w-full text-xs">
                <tbody>
                  <tr className="border-b border-dashed">
                    <td className="py-1">आधारभूत तलब (Basic Salary)</td>
                    <td className="py-1 text-right font-medium">{money(record.basic_salary)}</td>
                  </tr>
                  <tr className="border-b border-dashed">
                    <td className="py-1">
                      भत्ता (Allowances)
                      {employee?.allowance_type === "trip" && ` (${record.trips} ट्रिप)`}
                      {employee?.allowance_type === "day" && ` (${record.days_worked} दिन)`}
                    </td>
                    <td className="py-1 text-right font-medium">{money(record.allowance)}</td>
                  </tr>
                  {!!record.other_allowance && (
                    <tr className="border-b border-dashed">
                      <td className="py-1">अन्य भत्ता (Other Allowance)</td>
                      <td className="py-1 text-right font-medium">{money(record.other_allowance)}</td>
                    </tr>
                  )}
                  <tr className="font-bold text-foreground">
                    <td className="pt-2">कुल आम्दानी (Gross Salary)</td>
                    <td className="pt-2 text-right text-emerald-700 font-extrabold">
                      {money(record.gross_salary)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Deductions */}
            <div className="rounded-lg border bg-card p-3">
              <div className="border-b pb-1.5 text-xs font-bold text-rose-700">
                कट्टी विवरण (Deductions)
              </div>
              <table className="mt-2 w-full text-xs">
                <tbody>
                  <tr className="border-b border-dashed">
                    <td className="py-1">आयकर / सामाजिक सुरक्षा कर (TDS/Tax)</td>
                    <td className="py-1 text-right font-medium text-rose-600">
                      - {money(record.tax || 0)}
                    </td>
                  </tr>
                  <tr className="border-b border-dashed">
                    <td className="py-1">पेश्की कट्टी (Advance Adjustment)</td>
                    <td className="py-1 text-right font-medium text-rose-600">
                      - {money(record.advance_adjusted || 0)}
                    </td>
                  </tr>
                  <tr className="border-b border-dashed">
                    <td className="py-1">अन्य कट्टी (Other Deductions)</td>
                    <td className="py-1 text-right font-medium text-rose-600">
                      - {money(record.other_deductions || 0)}
                    </td>
                  </tr>
                  <tr className="font-bold text-foreground">
                    <td className="pt-2">कुल कट्टी (Total Deductions)</td>
                    <td className="pt-2 text-right text-rose-700 font-extrabold">
                      {money(totalDeductions)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Net Pay Callout */}
          <div className="mt-4 flex flex-wrap items-center justify-between rounded-lg border-2 border-primary bg-primary/5 p-3.5">
            <div>
              <div className="text-xs font-semibold text-muted-foreground">
                खुद भुक्तानी रकम (Take-Home Net Pay)
              </div>
              <div className="text-xl font-extrabold text-primary">
                {money(record.net_salary)}
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="font-medium text-muted-foreground">
                {record.payment_status === "paid"
                  ? `भुक्तानी मिति: ${record.payment_date || np(todayBS())}`
                  : "भुक्तानी हुन बाँकी"}
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-8 flex justify-between text-xs">
            <div className="text-center">
              <div className="h-8 border-b border-foreground/40 w-32" />
              <div className="pt-1 font-medium">कर्मचारीको सही</div>
            </div>
            <div className="text-center">
              <div className="h-8 border-b border-foreground/40 w-32" />
              <div className="pt-1 font-medium">तयार गर्ने (लेखापाल)</div>
            </div>
            <div className="text-center">
              <div className="h-8 border-b border-foreground/40 w-32" />
              <div className="pt-1 font-medium">स्वीकृत गर्ने (अध्यक्ष / कोषाध्यक्ष)</div>
            </div>
          </div>

          <div className="mt-5 text-center text-[10px] text-muted-foreground">
            यो कम्प्युटर प्रणालीबाट तयार गरिएको आधिकारिक पे-स्लिप हो।
          </div>
        </div>

        {/* Close button at bottom */}
        <div className="no-print mt-6 flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={onClose}>
            बन्द गर्नुहोस्
          </Button>
          <Button onClick={() => window.print()} className="font-bold">
            <Printer className="mr-1.5 size-4" />
            प्रिन्ट गर्नुहोस्
          </Button>
        </div>
      </div>
    </div>
  );
}

