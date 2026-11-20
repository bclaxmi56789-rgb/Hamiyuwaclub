import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_EMPLOYEE_RESPONSIBILITIES,
  DEFAULT_INSURANCE_CLAUSE,
  EMPTY_OFFER_DETAILS,
  fiscalLabel,
  fiscalYear,
  normalizeOfferDetails,
  np,
  offerMoney,
  todayBS,
  type Employee,
  type EmployeeOfferLetter,
  type OfferDetails,
  type OfferTerm,
} from "@/lib/receipt-rules";
import { useAppConfig } from "@/lib/app-config";
import { FileText, Pencil, Plus, Printer, RotateCcw, Save, ShieldCheck, Trash2, X } from "lucide-react";

export type OfferDraft = {
  id?: string | undefined;
  employee_id: string;
  offer_no: string;
  letter_date: string;
  designation: string;
  offered_salary: number;
  joining_date: string;
  status: "draft" | "issued";
  terms: OfferTerm[];
  details: OfferDetails;
};

function draftFromLetter(letter: EmployeeOfferLetter, employee: Employee): OfferDraft {
  const details = normalizeOfferDetails(letter.details);
  const basic = Number(details.basic_salary) || Number(employee.basic_salary) || 0;
  const allowance =
    Number(details.allowance) ||
    (employee.allowance_type === "fixed"
      ? Number(employee.allowance_rate) || 0
      : Number(employee.other_allowance) || 0);
  const offeredSalary = Number(letter.offered_salary) || basic + allowance;

  return {
    id: letter.id,
    employee_id: letter.employee_id,
    offer_no: letter.offer_no,
    letter_date: letter.letter_date || todayBS(),
    designation: letter.designation || employee.designation || "",
    offered_salary: offeredSalary,
    joining_date: letter.joining_date || employee.joining_date || "",
    status: letter.status === "issued" ? "issued" : "draft",
    terms: Array.isArray(letter.terms) ? letter.terms : [],
    details: {
      ...details,
      employee_address: details.employee_address || employee.address || "",
      employee_contact: details.employee_contact || employee.phone || "",
      basic_salary: basic,
      allowance: allowance,
      responsibilities:
        Array.isArray(details.responsibilities) && details.responsibilities.length > 0
          ? details.responsibilities
          : [...DEFAULT_EMPLOYEE_RESPONSIBILITIES],
      insurance_clause: details.insurance_clause || DEFAULT_INSURANCE_CLAUSE,
    },
  };
}

function draftForNew(employee: Employee, offerNo: string, configAddress: string): OfferDraft {
  const basic = Number(employee.basic_salary) || 0;
  const allowance =
    employee.allowance_type === "fixed"
      ? Number(employee.allowance_rate) || 0
      : Number(employee.other_allowance) || 0;
  const total = basic + allowance;

  return {
    employee_id: employee.id || "",
    offer_no: offerNo,
    letter_date: todayBS(),
    designation: employee.designation || "",
    offered_salary: total,
    joining_date: employee.joining_date || todayBS(),
    status: "draft",
    terms: [],
    details: {
      ...EMPTY_OFFER_DETAILS,
      employee_address: employee.address || "",
      employee_contact: employee.phone || "",
      work_location: configAddress || "",
      department: "प्रशासन तथा संकलन शाखा",
      reporting_officer: "शाखा प्रमुख / प्रबन्ध निर्देशक",
      basic_salary: basic,
      allowance: allowance,
      payment_method: "बैंक खातामार्फत",
      payment_day: "७",
      probation_months: 3,
      responsibilities: [...DEFAULT_EMPLOYEE_RESPONSIBILITIES],
      insurance_clause: DEFAULT_INSURANCE_CLAUSE,
      offer_accept_by: "",
      authorized_name: "",
      authorized_position: "अधिकृत हस्ताक्षरकर्ता",
    },
  };
}

export function EmployeeOfferLetterModal({
  employee,
  letter,
  previewOfferNo,
  canEdit,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  employee: Employee;
  letter?: EmployeeOfferLetter | null;
  previewOfferNo: string;
  canEdit: boolean;
  saving?: boolean;
  onSave: (draft: OfferDraft) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const config = useAppConfig();
  const [mode, setMode] = useState<"form" | "preview">(letter ? "preview" : "form");
  const [draft, setDraft] = useState<OfferDraft>(() =>
    letter ? draftFromLetter(letter, employee) : draftForNew(employee, previewOfferNo, config.address),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (letter?.id) setDraft(draftFromLetter(letter, employee));
  }, [letter?.id, letter?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.classList.add("print-voucher-open");
    return () => document.body.classList.remove("print-voucher-open");
  }, []);

  const set = <K extends keyof OfferDraft>(key: K, value: OfferDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setDetail = <K extends keyof OfferDetails>(key: K, value: OfferDetails[K]) => {
    setDraft((d) => {
      const nextDetails = { ...d.details, [key]: value };
      let offeredSalary = d.offered_salary;
      if (key === "basic_salary" || key === "allowance") {
        offeredSalary = (Number(nextDetails.basic_salary) || 0) + (Number(nextDetails.allowance) || 0);
      }
      return {
        ...d,
        offered_salary: offeredSalary,
        details: nextDetails,
      };
    });
  };

  const setResponsibility = (index: number, val: string) => {
    setDraft((d) => ({
      ...d,
      details: {
        ...d.details,
        responsibilities: d.details.responsibilities.map((r, i) => (i === index ? val : r)),
      },
    }));
  };

  const addResponsibility = () => {
    setDraft((d) => ({
      ...d,
      details: {
        ...d.details,
        responsibilities: [...d.details.responsibilities, ""],
      },
    }));
  };

  const removeResponsibility = (index: number) => {
    setDraft((d) => ({
      ...d,
      details: {
        ...d.details,
        responsibilities: d.details.responsibilities.filter((_, i) => i !== index),
      },
    }));
  };

  const resetResponsibilities = () => {
    setDraft((d) => ({
      ...d,
      details: {
        ...d.details,
        responsibilities: [...DEFAULT_EMPLOYEE_RESPONSIBILITIES],
      },
    }));
  };

  const setTerm = (index: number, field: keyof OfferTerm, value: string) =>
    setDraft((d) => ({
      ...d,
      terms: d.terms.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.designation.trim()) return;
    await onSave(draft);
    setMode("preview");
  };

  const orgName = config.entity_name || "कम्पनी / संस्था";
  const orgAddress = config.address || "";
  const orgPanVat = config.pan_vat || "";
  const orgPhone = config.phone || "";
  const orgEmail = config.email || "";

  const fy = fiscalYear(draft.letter_date) ?? fiscalYear(todayBS()) ?? 0;
  const extraTerms = draft.terms.filter((t) => t.np.trim() || t.en.trim());

  const basicSalaryVal = Number(draft.details.basic_salary) || 0;
  const allowanceVal = Number(draft.details.allowance) || 0;
  const totalMonthlyVal = draft.offered_salary || (basicSalaryVal + allowanceVal);
  const responsibilitiesList =
    draft.details.responsibilities && draft.details.responsibilities.length > 0
      ? draft.details.responsibilities
      : DEFAULT_EMPLOYEE_RESPONSIBILITIES;

  const letterBody = createPortal(
    <div className="print-portal fixed inset-0 z-50 overflow-auto bg-black/60 p-4 backdrop-blur-xs">
      <div className="mx-auto w-full max-w-4xl rounded-xl border-2 border-foreground/30 bg-card p-6 shadow-2xl sm:p-8">
        {/* Toolbar */}
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <FileText className="size-4 text-primary" />
            <span>रोजगारीका लागि नियुक्ति प्रस्तावपत्र (Offer Letter)</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                draft.status === "issued"
                  ? "bg-success/10 text-success"
                  : "bg-warning/10 text-warning"
              }`}
            >
              {draft.status === "issued" ? "जारी (Issued)" : "मस्यौदा (Draft)"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && mode === "preview" && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5"
                onClick={() => setMode("form")}
              >
                <Pencil className="size-3.5" />
                <span>सम्पादन (Edit)</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 font-bold"
              onClick={() => window.print()}
            >
              <Printer className="size-4" />
              <span>प्रिन्ट / PDF</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {mode === "form" ? (
          /* ── Form Mode ─────────────────────────────────────────────── */
          <form onSubmit={handleSave} className="space-y-5 text-xs">
            {/* Header info */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <h3 className="font-bold text-foreground text-sm">
                १. पत्र तथा कर्मचारी सामान्य विवरण (General Details)
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs font-semibold">पत्र संख्या (Offer Ref No.)</Label>
                  <Input
                    readOnly
                    value={draft.offer_no}
                    className="mt-1 text-xs font-mono font-bold bg-muted/40"
                    title="सुरक्षित गर्दा स्वतः निर्धारण हुनेछ"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">चलानी नं. (Challan No.)</Label>
                  <Input
                    placeholder="चलानी नं. (e.g. १२४)"
                    value={draft.details.challan_no}
                    onChange={(e) => setDetail("challan_no", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">पत्र मिति (Date BS) *</Label>
                  <Input
                    required
                    placeholder="२०८२/०८/०१"
                    value={draft.letter_date}
                    onChange={(e) => set("letter_date", e.target.value)}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">कर्मचारीको नाम (Name)</Label>
                  <Input
                    readOnly
                    value={employee.name}
                    className="mt-1 text-xs font-bold bg-muted/40"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">स्थायी ठेगाना (Permanent Address)</Label>
                  <Input
                    placeholder="e.g. वीरेन्द्रनगर-६, सुर्खेत"
                    value={draft.details.employee_address}
                    onChange={(e) => setDetail("employee_address", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">सम्पर्क नं. (Contact Phone)</Label>
                  <Input
                    placeholder="९८xxxxxxxx"
                    value={draft.details.employee_contact}
                    onChange={(e) => setDetail("employee_contact", e.target.value)}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">स्थिति (Letter Status)</Label>
                  <select
                    value={draft.status}
                    onChange={(e) => set("status", e.target.value as "draft" | "issued")}
                    className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs"
                  >
                    <option value="draft">मस्यौदा (Draft)</option>
                    <option value="issued">जारी गरिएको (Issued)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 1 & 2: Position & Joining */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <h3 className="font-bold text-foreground text-sm">
                २. पद, विभाग तथा कार्य प्रारम्भ मिति (Position & Work Details)
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs font-semibold">पद (Designation) *</Label>
                  <Input
                    required
                    placeholder="सवारी चालक / फोहोर संकलक / लेखापाल"
                    value={draft.designation}
                    onChange={(e) => set("designation", e.target.value)}
                    className="mt-1 text-xs font-bold"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">विभाग/शाखा (Department/Branch)</Label>
                  <Input
                    placeholder="प्रशासन तथा संकलन शाखा"
                    value={draft.details.department}
                    onChange={(e) => setDetail("department", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">कार्यस्थल (Work Location)</Label>
                  <Input
                    placeholder="कार्यालय तथा कार्यक्षेत्र"
                    value={draft.details.work_location}
                    onChange={(e) => setDetail("work_location", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">प्रत्यक्ष रिपोर्टिङ गर्ने अधिकारी</Label>
                  <Input
                    placeholder="शाखा प्रमुख / प्रबन्ध निर्देशक"
                    value={draft.details.reporting_officer}
                    onChange={(e) => setDetail("reporting_officer", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">कार्यको प्रकृति (Work Nature)</Label>
                  <select
                    value={draft.details.work_nature}
                    onChange={(e) => setDetail("work_nature", e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs"
                  >
                    <option value="पूर्णकालीन">पूर्णकालीन (Full-Time)</option>
                    <option value="अंशकालीन">अंशकालीन (Part-Time)</option>
                    <option value="करार">करार (Contract)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">नियुक्ति प्रारम्भ मिति (Joining Date BS) *</Label>
                  <Input
                    required
                    placeholder="२०८२/०८/१५"
                    value={draft.joining_date}
                    onChange={(e) => set("joining_date", e.target.value)}
                    className="mt-1 text-xs font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Section 3 & 4: Remuneration & Probation */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <h3 className="font-bold text-foreground text-sm">
                ३. पारिश्रमिक, सुविधा तथा परीक्षणकाल (Remuneration & Probation)
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs font-semibold">मासिक आधारभूत पारिश्रमिक (रु.) *</Label>
                  <Input
                    required
                    type="number"
                    min="0"
                    step="100"
                    value={basicSalaryVal}
                    onChange={(e) => setDetail("basic_salary", Number(e.target.value) || 0)}
                    className="mt-1 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">भत्ता तथा अन्य सुविधा (रु.)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={allowanceVal}
                    onChange={(e) => setDetail("allowance", Number(e.target.value) || 0)}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">कुल मासिक पारिश्रमिक (रु.)</Label>
                  <Input
                    readOnly
                    value={totalMonthlyVal}
                    className="mt-1 text-xs font-mono font-bold bg-muted/40 text-success"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">भुक्तानी विधि</Label>
                  <Input
                    placeholder="बैंक खातामार्फत"
                    value={draft.details.payment_method}
                    onChange={(e) => setDetail("payment_method", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">भुक्तानी अवधि (प्रत्येक महिनाको ... गतेभित्र)</Label>
                  <Input
                    placeholder="७"
                    value={draft.details.payment_day}
                    onChange={(e) => setDetail("payment_day", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">परीक्षणकाल (महिना)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="24"
                    value={draft.details.probation_months}
                    onChange={(e) => setDetail("probation_months", Number(e.target.value) || 0)}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Section 6: Employee Responsibilities (Editable) */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-foreground text-sm">
                    ४. कर्मचारीको जिम्मेवारी (६. Employee Responsibilities)
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    कर्मचारीको पद र जिम्मेवारीअनुसार बुँदाहरू सम्पादन गर्न, थप्न वा हटाउन सक्नुहुन्छ।
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={resetResponsibilities}
                    title="पूर्वनिर्धारित ५ बुँदाहरू लोड गर्नुहोस्"
                  >
                    <RotateCcw className="mr-1 size-3" />
                    पूर्वनिर्धारित
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={addResponsibility}
                  >
                    <Plus className="mr-1 size-3.5" />
                    जिम्मेवारी थप्नुहोस्
                  </Button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {responsibilitiesList.map((resp, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border bg-background p-2">
                    <span className="w-5 shrink-0 text-center font-mono font-bold text-primary">
                      {np(i + 1)}.
                    </span>
                    <Input
                      placeholder={`जिम्मेवारी बुँदा नं. ${np(i + 1)}…`}
                      value={resp}
                      onChange={(e) => setResponsibility(i, e.target.value)}
                      className="text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-destructive hover:bg-destructive/10"
                      title="यो जिम्मेवारी हटाउनुहोस्"
                      onClick={() => removeResponsibility(i)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
                {responsibilitiesList.length === 0 && (
                  <p className="text-muted-foreground text-xs italic">
                    कुनै जिम्मेवारी बुँदा छैन। "जिम्मेवारी थप्नुहोस्" थिच्नुहोस्।
                  </p>
                )}
              </div>
            </div>

            {/* Insurance Clause (Editable) */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <h3 className="font-bold text-foreground text-sm">
                    ५. कर्मचारी बीमा सुविधा (७. Insurance Clause)
                  </h3>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDetail("insurance_clause", DEFAULT_INSURANCE_CLAUSE)}
                  title="पूर्वनिर्धारित बीमा व्यहोरा लोड गर्नुहोस्"
                >
                  <RotateCcw className="mr-1 size-3" />
                  पूर्वनिर्धारित व्यहोरा
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                दुर्घटना, स्वास्थ्य तथा श्रम ऐनबमोजिमको बीमा सुविधासम्बन्धी सर्त यहाँ सम्पादन गर्नुहोस्।
              </p>
              <div className="mt-2.5">
                <textarea
                  rows={3}
                  value={draft.details.insurance_clause}
                  onChange={(e) => setDetail("insurance_clause", e.target.value)}
                  placeholder="कर्मचारीको बीमा सम्बन्धी सर्त तथा व्यहोरा…"
                  className="w-full rounded-md border bg-background p-2.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Section 10: Signatory & Acceptance deadline */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <h3 className="font-bold text-foreground text-sm">
                ६. प्रस्ताव स्वीकृति तथा अधिकृत विवरण (Signatory & Authorization)
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs font-semibold">प्रस्ताव स्वीकृति अन्तिम मिति (BS)</Label>
                  <Input
                    placeholder="२०८२/०८/०७"
                    value={draft.details.offer_accept_by}
                    onChange={(e) => setDetail("offer_accept_by", e.target.value)}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">अधिकृत व्यक्तिको नाम</Label>
                  <Input
                    placeholder="हस्ताक्षरकर्ताको नाम"
                    value={draft.details.authorized_name}
                    onChange={(e) => setDetail("authorized_name", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">अधिकृत व्यक्तिको पद/अधिकार</Label>
                  <Input
                    placeholder="प्रबन्ध निर्देशक / प्रशासकीय अधिकृत"
                    value={draft.details.authorized_position}
                    onChange={(e) => setDetail("authorized_position", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Extra terms if needed */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-foreground text-sm">
                    ७. अन्य थप सर्तहरू (१०. Extra Clauses)
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    दफा १० (अन्य सर्तहरू) को मुनि थप बुँदा समावेश गर्न यहाँ थप्न सक्नुहुन्छ।
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => set("terms", [...draft.terms, { np: "", en: "" }])}
                >
                  <Plus className="mr-1 size-3.5" />
                  थप सर्त थप्नुहोस्
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {draft.terms.map((term, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border bg-background p-2">
                    <span className="w-5 shrink-0 text-center font-mono font-bold text-primary">
                      {np(i + 1)}.
                    </span>
                    <Input
                      placeholder="थप सर्त प्रविष्ट गर्नुहोस्…"
                      value={term.np}
                      onChange={(e) => setTerm(i, "np", e.target.value)}
                      className="text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-destructive hover:bg-destructive/10"
                      onClick={() => set("terms", draft.terms.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => (letter ? setMode("preview") : onClose())}
              >
                रद्द गर्नुहोस्
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="flex items-center gap-1.5 bg-success font-bold text-success-foreground hover:bg-success/90"
              >
                <Save className="size-3.5" />
                {saving ? "सुरक्षित गर्दै…" : "सुरक्षित गरी पत्र हेर्नुहोस्"}
              </Button>
            </div>
          </form>
        ) : (
          /* ── Printable A4 Official Nepali Offer Letter ───────────── */
          <div className="relative rounded-lg bg-background p-6 text-foreground sm:p-10 print:bg-white print:p-0 print:text-black print:shadow-none font-serif leading-normal overflow-hidden">
            {/* Background Watermark (Company logo and name) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center overflow-hidden opacity-[0.04] print:opacity-[0.065]"
            >
              {config.logo_url && (
                <img
                  src={config.logo_url}
                  alt=""
                  className="max-h-64 max-w-64 object-contain grayscale"
                />
              )}
              <div className="mt-4 -rotate-12 text-center">
                <span className="block text-4xl sm:text-5xl font-black uppercase tracking-widest text-foreground print:text-black">
                  {orgName}
                </span>
                {config.entity_sub_name && (
                  <span className="block text-base font-bold text-muted-foreground print:text-black mt-1">
                    {config.entity_sub_name}
                  </span>
                )}
              </div>
            </div>

            {/* Header / Letterhead */}
            <div className="relative z-10 border-b-2 border-foreground/80 pb-4 text-center print:border-black">
              {config.logo_url && (
                <img
                  src={config.logo_url}
                  alt="Logo"
                  className="mx-auto mb-2.5 max-h-20 object-contain print:max-h-16"
                />
              )}
              <h1 className="text-2xl font-black tracking-wide uppercase print:text-2xl">{orgName}</h1>
              {config.entity_sub_name && (
                <p className="text-sm font-bold text-primary print:text-black mt-0.5">
                  {config.entity_sub_name}
                </p>
              )}
              <p className="mt-1 text-sm font-bold text-foreground print:text-black">
                {orgAddress || "[कम्पनीको ठेगाना]"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground print:text-black">
                {orgPanVat ? `PAN/VAT नं.: ${np(orgPanVat)}` : "PAN/VAT नं.: [...............]"}
                {" | "}
                {orgPhone ? `सम्पर्क नं.: ${np(orgPhone)}` : "सम्पर्क नं.: [...............]"}
                {" | "}
                {orgEmail ? `इमेल: ${orgEmail}` : "इमेल: [...............]"}
              </p>
            </div>

            {/* Meta Strip */}
            <div className="relative z-10 mt-4 flex flex-wrap justify-between gap-2 text-xs font-semibold print:text-xs">
              <div className="space-y-1">
                <div>
                  पत्र संख्या: <span className="font-mono font-bold text-primary print:text-black">{np(draft.offer_no)}</span>
                  {fy ? ` (${fiscalLabel(fy)})` : ""}
                </div>
                <div>
                  चलानी नं.: <span>{draft.details.challan_no ? np(draft.details.challan_no) : "...................."}</span>
                </div>
              </div>
              <div className="text-right">
                <div>
                  मिति: <span className="font-bold">{np(draft.letter_date || todayBS())}</span>
                </div>
              </div>
            </div>

            {/* Addressee */}
            <div className="relative z-10 mt-5 text-sm leading-relaxed">
              <p className="font-bold text-base">
                श्री {employee.name}
              </p>
              <p className="text-xs text-muted-foreground print:text-black">
                {draft.details.employee_address || "[स्थायी ठेगाना]"}
              </p>
              <p className="text-xs text-muted-foreground print:text-black">
                {draft.details.employee_contact ? np(draft.details.employee_contact) : (employee.phone ? np(employee.phone) : "[सम्पर्क नं.]")}
              </p>
            </div>

            {/* Subject */}
            <div className="relative z-10 mt-4 text-center">
              <h2 className="text-base font-black underline decoration-1 underline-offset-4">
                विषय: रोजगारीका लागि नियुक्ति प्रस्ताव (नियुक्ति प्रस्तावपत्र)
              </h2>
            </div>

            {/* Body */}
            <div className="relative z-10 mt-4 space-y-3.5 text-sm leading-relaxed text-justify">
              <p>महोदय/महोदया,</p>
              <p>
                यस <b>{orgName}</b> मा तपाईंले <b>{draft.designation || "[पदको नाम]"}</b> पदका लागि
                दिनुभएको आवेदन, अन्तर्वार्ता तथा छनोट प्रक्रियाका आधारमा तपाईंलाई यस कम्पनीमा उक्त
                पदमा कार्य गर्न नियुक्ति प्रस्ताव गर्न पाउँदा हामीलाई खुसी लागेको छ।
              </p>
              <p>तपाईंको नियुक्तिसम्बन्धी प्रमुख सर्त तथा विवरणहरू देहायबमोजिम रहनेछन्।</p>

              {/* Clause 1 */}
              <div>
                <h3 className="font-bold text-foreground print:text-black">१. पद तथा कार्य विवरण</h3>
                <ul className="mt-1 list-disc space-y-1 pl-6 text-xs sm:text-sm">
                  <li>
                    <b>पद:</b> {draft.designation || "[पदको नाम]"}
                  </li>
                  <li>
                    <b>विभाग/शाखा:</b> {draft.details.department || "[विभागको नाम]"}
                  </li>
                  <li>
                    <b>कार्यस्थल:</b> {draft.details.work_location || orgAddress || "[कार्यालयको ठेगाना]"}
                  </li>
                  <li>
                    <b>प्रत्यक्ष रिपोर्टिङ गर्ने अधिकारी:</b> {draft.details.reporting_officer || "[अधिकारीको पद]"}
                  </li>
                  <li>
                    <b>कार्यको प्रकृति:</b> {draft.details.work_nature || "[पूर्णकालीन/अंशकालीन/करार]"}
                  </li>
                </ul>
              </div>

              {/* Clause 2 */}
              <div>
                <h3 className="font-bold text-foreground print:text-black">२. नियुक्ति प्रारम्भ मिति</h3>
                <p className="mt-1 text-xs sm:text-sm">
                  तपाईंको कार्य प्रारम्भ मिति <b>{draft.joining_date ? np(draft.joining_date) : "[साल/महिना/गते]"}</b> हुनेछ।
                  उक्त मितिदेखि तपाईंले कम्पनीको नियम, नीति तथा निर्देशनअनुसार आफ्नो जिम्मेवारी निर्वाह गर्नुपर्नेछ।
                </p>
              </div>

              {/* Clause 3 */}
              <div>
                <h3 className="font-bold text-foreground print:text-black">३. पारिश्रमिक तथा सुविधा</h3>
                <p className="mt-1 text-xs sm:text-sm">तपाईंलाई देहायबमोजिम पारिश्रमिक तथा सुविधा उपलब्ध गराइनेछ।</p>
                <ul className="mt-1 list-disc space-y-1 pl-6 text-xs sm:text-sm">
                  <li>
                    <b>मासिक आधारभूत पारिश्रमिक:</b> {basicSalaryVal > 0 ? offerMoney(basicSalaryVal) : "रु. [........]"}
                  </li>
                  <li>
                    <b>भत्ता तथा अन्य सुविधा:</b> {allowanceVal > 0 ? offerMoney(allowanceVal) : "रु. [........] / कम्पनीको नीतिअनुसार"}
                  </li>
                  <li>
                    <b>कुल मासिक पारिश्रमिक:</b> <span className="font-bold">{totalMonthlyVal > 0 ? offerMoney(totalMonthlyVal) : "रु. [........]"}</span>
                  </li>
                  <li>
                    <b>भुक्तानी विधि:</b> {draft.details.payment_method || "बैंक खातामार्फत"}
                  </li>
                  <li>
                    <b>भुक्तानी अवधि:</b> प्रत्येक महिनाको {draft.details.payment_day ? np(draft.details.payment_day) : "[........]"} गतेभित्र
                  </li>
                </ul>
                <p className="mt-1.5 text-xs text-muted-foreground print:text-black italic">
                  प्रचलित कानुनअनुसार लाग्ने कर, सामाजिक सुरक्षा कोष (SSF) तथा अन्य वैधानिक कट्टीहरू नियमानुसार लागू हुनेछन्।
                </p>
              </div>

              {/* Clause 4 */}
              <div>
                <h3 className="font-bold text-foreground print:text-black">४. परीक्षणकाल</h3>
                <p className="mt-1 text-xs sm:text-sm">
                  नियुक्तिको प्रारम्भिक अवधि <b>{draft.details.probation_months ? np(draft.details.probation_months) : "[........]"}</b> महिनाको
                  परीक्षणकाल रहनेछ। परीक्षणकालमा तपाईंको कार्यक्षमता, अनुशासन, जिम्मेवारी निर्वाह तथा कार्यसम्पादनको
                  मूल्याङ्कन गरिनेछ। परीक्षणकाल तथा त्यसपछिको नियुक्तिसम्बन्धी व्यवस्था प्रचलित श्रम कानुनअनुसार हुनेछ।
                </p>
              </div>

              {/* Clause 5 */}
              <div>
                <h3 className="font-bold text-foreground print:text-black">५. कार्य समय तथा बिदा</h3>
                <p className="mt-1 text-xs sm:text-sm">
                  तपाईंले कम्पनीले निर्धारण गरेको कार्यतालिकाअनुसार काम गर्नुपर्नेछ। साप्ताहिक बिदा, सार्वजनिक बिदा,
                  वार्षिक बिदा, बिरामी बिदा तथा अन्य बिदाहरू प्रचलित श्रम कानुन र कम्पनीको स्वीकृत नीतिअनुसार उपलब्ध गराइनेछन्।
                </p>
              </div>

              {/* Clause 6 (Customizable Responsibilities) */}
              <div>
                <h3 className="font-bold text-foreground print:text-black">६. कर्मचारीको जिम्मेवारी</h3>
                <p className="mt-1 text-xs sm:text-sm">तपाईंले:</p>
                <ul className="mt-1 list-disc space-y-1 pl-6 text-xs sm:text-sm">
                  {responsibilitiesList.map((resp, idx) => (
                    <li key={idx}>{resp}</li>
                  ))}
                </ul>
              </div>

              {/* Clause 7 (Insurance Policy & Coverage) */}
              <div>
                <h3 className="font-bold text-foreground print:text-black">७. बीमा सुविधा (Insurance Policy & Benefits)</h3>
                <p className="mt-1 text-xs sm:text-sm leading-relaxed">
                  {draft.details.insurance_clause || DEFAULT_INSURANCE_CLAUSE}
                </p>
              </div>

              {/* Clause 8 */}
              <div>
                <h3 className="font-bold text-foreground print:text-black">८. गोपनीयता तथा व्यावसायिक आचरण</h3>
                <p className="mt-1 text-xs sm:text-sm">
                  कम्पनीको व्यावसायिक सूचना, आर्थिक विवरण, ग्राहकको विवरण, आन्तरिक कागजात, व्यापारिक रणनीति तथा अन्य गोप्य
                  जानकारी कम्पनीको पूर्वस्वीकृतिबिना तेस्रो पक्षलाई खुलासा गर्न पाइने छैन। यो दायित्व रोजगारी समाप्त भएपछि पनि
                  लागू हुनेछ, प्रचलित कानुनले अनुमति दिएको हदसम्म।
                </p>
              </div>

              {/* Clause 9 */}
              <div>
                <h3 className="font-bold text-foreground print:text-black">९. नियुक्ति समाप्ति तथा राजीनामा</h3>
                <p className="mt-1 text-xs sm:text-sm">
                  कर्मचारी वा कम्पनीबाट रोजगारी सम्बन्ध समाप्त गर्दा प्रचलित श्रम कानुन तथा लागू सेवा सर्तअनुसार आवश्यक सूचना
                  अवधि, प्रक्रिया र दायित्वहरू पालना गर्नुपर्नेछ। राजीनामा, बर्खास्तगी वा अन्य कारणबाट सेवा समाप्त हुँदा कर्मचारीले
                  कम्पनीको सम्पत्ति, कागजात तथा जिम्मेवारीहरू विधिवत् हस्तान्तरण गर्नुपर्नेछ।
                </p>
              </div>

              {/* Clause 10 */}
              <div>
                <h3 className="font-bold text-foreground print:text-black">१०. अन्य सर्तहरू</h3>
                <p className="mt-1 text-xs sm:text-sm">
                  यस प्रस्तावपत्रमा उल्लेख नभएका विषयहरू प्रचलित नेपाल कानुन, श्रम ऐन, श्रम नियमावली तथा कम्पनीको स्वीकृत
                  कर्मचारी सेवा विनियमावली/नीतिअनुसार लागू हुनेछन्। यस प्रस्तावपत्र र प्रचलित कानुनबीच बाझिएको अवस्थामा
                  प्रचलित कानुन मान्य हुनेछ।
                </p>
                {extraTerms.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-1 pl-6 text-xs sm:text-sm">
                    {extraTerms.map((t, idx) => (
                      <li key={idx}>
                        <span>{t.np}</span>
                        {t.en && <span className="block text-xs italic text-muted-foreground print:text-black">({t.en})</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Clause 11 */}
              <div>
                <h3 className="font-bold text-foreground print:text-black">११. प्रस्ताव स्वीकृति</h3>
                <p className="mt-1 text-xs sm:text-sm">
                  यस नियुक्ति प्रस्तावका सम्पूर्ण सर्तहरू अध्ययन गरी स्वीकार गर्नुभएको अवस्थामा यसै पत्रको प्रतिलिपिमा
                  हस्ताक्षर गरी {draft.details.offer_accept_by ? <b>{np(draft.details.offer_accept_by)}</b> : "[मिति]"} भित्र
                  कम्पनीमा बुझाउनुहुन अनुरोध गरिन्छ।
                </p>
              </div>

              <p className="pt-1">
                तपाईंको सफल, जिम्मेवार तथा व्यावसायिक कार्यकालको शुभकामना व्यक्त गर्दछौँ।
              </p>
            </div>

            {/* Closing Signature of Company */}
            <div className="relative z-10 mt-8 flex justify-between items-end text-xs sm:text-sm">
              <div />
              <div className="text-center min-w-[200px]">
                <p className="font-semibold mb-8">भवदीय,</p>
                <div className="border-b border-foreground/60 print:border-black mx-auto w-48 mb-2" />
                <p className="font-bold">
                  नाम: {draft.details.authorized_name || "[अधिकृत व्यक्तिको नाम]"}
                </p>
                <p className="text-xs text-muted-foreground print:text-black">
                  पद: {draft.details.authorized_position || "[पद/अधिकार]"}
                </p>
                <p className="text-xs font-bold mt-0.5">{orgName}</p>
                <p className="text-[11px] text-muted-foreground print:text-black mt-1">(कम्पनीको छाप)</p>
              </div>
            </div>

            {/* Divider */}
            <div className="relative z-10 my-8 border-t-2 border-dashed border-foreground/50 print:border-black" />

            {/* Employee Acceptance Block */}
            <div className="relative z-10 space-y-4 text-xs sm:text-sm">
              <h3 className="text-center text-base font-black underline decoration-1 underline-offset-4">
                कर्मचारीको स्वीकृति
              </h3>
              <p className="text-justify leading-relaxed">
                म, श्री/श्रीमती <b>{employee.name}</b>, यस नियुक्ति प्रस्तावपत्रमा उल्लेखित सर्त तथा सुविधाहरू
                अध्ययन गरी बुझेर स्वीकार गर्दछु। यस कम्पनीमा तोकिएको मितिदेखि आफ्नो जिम्मेवारी इमानदारीपूर्वक निर्वाह
                गर्ने प्रतिबद्धता व्यक्त गर्दछु।
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4 text-xs sm:text-sm pt-4">
                <div className="space-y-3">
                  <div>
                    कर्मचारीको हस्ताक्षर: ................................................
                  </div>
                  <div>
                    नाम: <b>{employee.name}</b>
                  </div>
                </div>
                <div className="space-y-3 text-right sm:text-left">
                  <div>
                    मिति: ................................................
                  </div>
                  <div>
                    सम्पर्क नं.: <b>{draft.details.employee_contact ? np(draft.details.employee_contact) : (employee.phone ? np(employee.phone) : "................................")}</b>
                  </div>
                </div>
              </div>

              {/* Required Enclosures */}
              <div className="mt-6 rounded-md border border-muted bg-muted/10 p-3 print:border-black print:bg-transparent">
                <p className="font-bold text-xs sm:text-sm">संलग्न कागजातहरू (आवश्यकताअनुसार):</p>
                <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                  <p>१. नागरिकताको प्रतिलिपि</p>
                  <p>२. शैक्षिक योग्यताको प्रमाणपत्र</p>
                  <p>३. पासपोर्ट साइज फोटो</p>
                  <p>४. व्यक्तिगत विवरण तथा सम्पर्क जानकारी</p>
                  <p>५. बैंक खाता विवरण</p>
                  <p>६. PAN विवरण (उपलब्ध भएमा)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div>
            {canEdit && letter?.id && mode === "preview" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-1 size-3.5" />
                प्रस्ताव पत्र हटाउनुहोस्
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              बन्द गर्नुहोस्
            </Button>
            <Button size="sm" className="font-bold" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-4" />
              प्रिन्ट / PDF गर्नुहोस्
            </Button>
          </div>
        </div>

        {/* Delete confirmation */}
        {confirmDelete && letter?.id && (
          <div className="no-print mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-xs font-semibold text-destructive">
              के तपाईं यो प्रस्ताव पत्र ({np(letter.offer_no)}) मेटाउन निश्चित हुनुहुन्छ?
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setConfirmDelete(false)}
              >
                रद्द
              </Button>
              <Button
                size="sm"
                className="bg-destructive text-xs font-bold text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  const id = letter.id;
                  if (id) await onDelete(id);
                  setConfirmDelete(false);
                }}
              >
                हटाउनुहोस्
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );

  return letterBody;
}
