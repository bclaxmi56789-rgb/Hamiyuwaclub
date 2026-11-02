import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAppState, SignInPanel } from "@/components/app-shell";
import {
  getMembersData,
  saveMember,
  deleteMember,
  saveEmployee,
  deleteEmployee,
  savePayrollRecords,
  payPayrollRecords,
  bookPayrollRecords,
  unbookPayrollRecords,
} from "@/lib/workspace.functions";
import {
  MONTHS,
  np,
  todayBS,
  fiscalYear,
  calculatePayrollRow,
  buildEmployeeLedger,
  employeeAdvanceTransactions,
  employeeOutstandingDr,
  type Member,
  type Employee,
  type PayrollRecord,
} from "@/lib/receipt-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaySlipVoucher } from "@/components/pay-slip-voucher";
import {
  UserCheck,
  Users,
  Briefcase,
  Calculator,
  Plus,
  Edit2,
  Trash2,
  Printer,
  Save,
  CheckCircle2,
  AlertCircle,
  Search,
  DollarSign,
  Truck,
  Calendar,
  X,
  FileText,
  CreditCard,
  Lock,
  BadgeCheck,
  BookOpen,
  BookCheck,
  History,
  User,
  LayoutGrid,
  Table as TableIcon,
  Check,
  ArrowRight,
  Clock,
  Sparkles,
  RotateCcw,
  Unlock,
} from "lucide-react";

export const Route = createFileRoute("/members")({
  head: () => ({
    meta: [
      { title: "Members, Staff & Payroll — Hami Yuwa Club" },
      {
        name: "description",
        content:
          "Manage Club Members, Employees, staff allowances, and generate monthly payroll.",
      },
    ],
  }),
  component: MembersPage,
});

const money = (n: number) => "रु. " + (n || 0).toLocaleString("en-IN");

// Starter fallback seed data if tables are empty
const SEED_MEMBERS: Member[] = [
  {
    id: "mem-seed-1",
    name: "नवीन गिरी",
    designation: "अध्यक्ष",
    occupation: "सामाजिक सेवा / व्यवसाय",
    dob: "२०४५-०२-१२",
    membership_fee: 1200,
    phone: "९८५८०१११११",
    address: "वीरेन्द्रनगर-४, सुर्खेत",
    status: "active",
  },
  {
    id: "mem-seed-2",
    name: "कमल बहादुर शाही",
    designation: "उपाध्यक्ष",
    occupation: "कृषि तथा व्यवसाय",
    dob: "२०४२-०६-१५",
    membership_fee: 1000,
    phone: "९८५८०२२२२२",
    address: "वीरेन्द्रनगर-६, सुर्खेत",
    status: "active",
  },
  {
    id: "mem-seed-3",
    name: "रमेश अधिकारी",
    designation: "सचिव",
    occupation: "शिक्षण तथा समाजसेवा",
    dob: "२०४८-०४-२२",
    membership_fee: 1000,
    phone: "९८४८०३३३३३",
    address: "वीरेन्द्रनगर-८, सुर्खेत",
    status: "active",
  },
  {
    id: "mem-seed-4",
    name: "सुनिता थापा",
    designation: "कोषाध्यक्ष",
    occupation: "लेखा तथा व्यापार",
    dob: "२०५०-०८-१०",
    membership_fee: 1000,
    phone: "९८४८०४४४४४",
    address: "वीरेन्द्रनगर-३, सुर्खेत",
    status: "active",
  },
  {
    id: "mem-seed-5",
    name: "सुरेश सुनार",
    designation: "सदस्य",
    occupation: "स्वास्थ्य सेवा",
    dob: "२०५२-०१-०५",
    membership_fee: 500,
    phone: "९८१२३५५५५५",
    address: "वीरेन्द्रनगर-५, सुर्खेत",
    status: "active",
  },
];

const SEED_EMPLOYEES: Employee[] = [
  {
    id: "emp-seed-1",
    name: "दिपक गुरुङ",
    age: 32,
    dob: "२०४९-०३-१२",
    designation: "सवारी चालक (Driver)",
    qualification: "८ कक्षा उतीर्ण (सवारी चालक अनुमतिपत्र)",
    basic_salary: 18000,
    allowance_type: "trip",
    allowance_rate: 150,
    phone: "९८४८१२३४५६",
    pan: "६०१२३४५६७",
    status: "active",
    joining_date: "२०८०-०४-०१",
  },
  {
    id: "emp-seed-2",
    name: "प्रकाश परियार",
    age: 26,
    dob: "२०५५-०७-२०",
    designation: "फोहोर संकलक (Collector)",
    qualification: "साक्षर",
    basic_salary: 15000,
    allowance_type: "day",
    allowance_rate: 250,
    phone: "९८१२३४५६७८",
    pan: "६०२३४५६७८",
    status: "active",
    joining_date: "२०८०-०५-१५",
  },
  {
    id: "emp-seed-3",
    name: "सन्तोष श्रेष्ठ",
    age: 29,
    dob: "२०५२-११-०५",
    designation: "फोहोर संकलक तथा लोडर",
    qualification: "SEE उतीर्ण",
    basic_salary: 15000,
    allowance_type: "day",
    allowance_rate: 250,
    phone: "९८०१२३४५६७",
    pan: "",
    status: "active",
    joining_date: "२०८०-०६-०१",
  },
  {
    id: "emp-seed-4",
    name: "अनिल चौधरी",
    age: 35,
    dob: "२०४६-०९-१८",
    designation: "क्षेत्र सुपरभाइजर (Supervisor)",
    qualification: "+२ (व्यवस्थापन)",
    basic_salary: 22000,
    allowance_type: "fixed",
    allowance_rate: 2500,
    phone: "९८५८०१२३४५",
    pan: "६००३४५६७९",
    status: "active",
    joining_date: "२०७९-०४-०१",
  },
];

type ActiveTab = "members" | "employees" | "payroll";

function MembersPage() {
  const app = useAppState();
  const queryClient = useQueryClient();
  const fetchMembersFn = useServerFn(getMembersData);
  const saveMemberFn = useServerFn(saveMember);
  const deleteMemberFn = useServerFn(deleteMember);
  const saveEmpFn = useServerFn(saveEmployee);
  const deleteEmpFn = useServerFn(deleteEmployee);
  const savePayrollFn = useServerFn(savePayrollRecords);
  const payPayrollFn = useServerFn(payPayrollRecords);
  const bookPayrollFn = useServerFn(bookPayrollRecords);
  const unbookPayrollFn = useServerFn(unbookPayrollRecords);

  const [activeTab, setActiveTab] = useState<ActiveTab>("members");

  // Query server data
  const query = useQuery({
    queryKey: ["members_data", app.userId],
    queryFn: () => fetchMembersFn(),
    enabled: app.ready && app.signedIn,
  });

  // Accounts list from server
  const [accountsList, setAccountsList] = useState<
    Array<{ id: string; name: string; account_type: "cash" | "bank" }>
  >([]);

  // Local state with seed fallbacks
  const [memberList, setMemberList] = useState<Member[]>(() => {
    try {
      const stored = localStorage.getItem("hami_members_cache");
      if (stored) return JSON.parse(stored);
    } catch {}
    return SEED_MEMBERS;
  });

  const [empList, setEmpList] = useState<Employee[]>(() => {
    try {
      const stored = localStorage.getItem("hami_emp_cache");
      if (stored) return JSON.parse(stored);
    } catch {}
    return SEED_EMPLOYEES;
  });

  const [payrollHistory, setPayrollHistory] = useState<PayrollRecord[]>(() => {
    try {
      const stored = localStorage.getItem("hami_payroll_cache");
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });

  // Sync server data into state when loaded
  useEffect(() => {
    if (query.data) {
      const fetchedMembers = query.data.members || (query.data as any).bodMembers;
      if (fetchedMembers && fetchedMembers.length > 0) {
        setMemberList(fetchedMembers);
        try {
          localStorage.setItem("hami_members_cache", JSON.stringify(fetchedMembers));
        } catch {}
      }
      if (query.data.employees && query.data.employees.length > 0) {
        setEmpList(query.data.employees);
        try {
          localStorage.setItem("hami_emp_cache", JSON.stringify(query.data.employees));
        } catch {}
      }
      if (query.data.payrollRecords && query.data.payrollRecords.length > 0) {
        setPayrollHistory((prev) => {
          const map = new Map<string, PayrollRecord>();
          for (const s of query.data.payrollRecords) {
            map.set(`${s.year}-${s.month}-${s.employee_id}`, s);
          }
          for (const local of prev) {
            const key = `${local.year}-${local.month}-${local.employee_id}`;
            const server = map.get(key);
            if (server) {
              if (
                (local.payment_status === "booked" || local.payment_status === "paid" || local.is_booked) &&
                server.payment_status === "pending"
              ) {
                map.set(key, {
                  ...server,
                  payment_status: local.payment_status,
                  is_booked: local.is_booked ?? true,
                  voucher_ref: local.voucher_ref || server.voucher_ref || "",
                });
              }
            } else {
              map.set(key, local);
            }
          }
          const merged = Array.from(map.values());
          try {
            localStorage.setItem("hami_payroll_cache", JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
      if ((query.data as any).accounts && (query.data as any).accounts.length > 0) {
        setAccountsList((query.data as any).accounts);
      }
      if ((query.data as any).employeeTransactions) {
        setEmpTransactions((query.data as any).employeeTransactions);
      }
    }
  }, [query.data]);

  // Employee transactions state
  const [empTransactions, setEmpTransactions] = useState<
    Array<{
      id: string;
      ref_no: string;
      txn_date: string;
      txn_type?: string;
      account_id: string;
      party_id: string;
      party_name: string;
      amount: number;
      remarks: string;
    }>
  >([]);

  // Search states
  const [searchMember, setSearchMember] = useState("");
  const [searchEmp, setSearchEmp] = useState("");

  // Sub-tabs in Payroll section: 'sheet' | 'history' | 'ledger'
  const [payrollSubTab, setPayrollSubTab] = useState<"sheet" | "history" | "ledger">("sheet");
  const [selectedLedgerEmpId, setSelectedLedgerEmpId] = useState<string>("");

  // History filters
  const [historySearch, setHistorySearch] = useState("");
  const [historyYear, setHistoryYear] = useState<string>("all");
  const [historyMonth, setHistoryMonth] = useState<string>("all");
  const [historyStatus, setHistoryStatus] = useState<"all" | "paid" | "pending" | "booked">("all");
  const [historyViewMode, setHistoryViewMode] = useState<"boxes" | "table">("boxes");

  const handleOpenEmpLedger = (empId?: string) => {
    if (!empId) return;
    setSelectedLedgerEmpId(empId);
    setActiveTab("payroll");
    setPayrollSubTab("ledger");
  };

  // Modals state
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberForm, setMemberForm] = useState<Member>({
    name: "",
    designation: "सदस्य",
    occupation: "",
    dob: "",
    membership_fee: 1000,
    phone: "",
    address: "",
    status: "active",
  });

  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState<Employee>({
    name: "",
    age: 25,
    dob: "",
    designation: "फोहोर संकलक (Collector)",
    qualification: "",
    basic_salary: 16000,
    allowance_type: "day",
    allowance_rate: 250,
    other_allowance: 0,
    phone: "",
    pan: "",
    status: "active",
    joining_date: "",
    opening_balance: 0,
    balance_type: "cr",
  });

  // Payroll selection states
  const currentBSYear = fiscalYear(todayBS()) ?? 2081;
  const [payrollYear, setPayrollYear] = useState<number>(currentBSYear);
  const [payrollMonth, setPayrollMonth] = useState<number>(0); // 0 = बैशाख
  const [payrollRows, setPayrollRows] = useState<PayrollRecord[]>([]);
  const [payrollNotice, setPayrollNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingPayroll, setSavingPayroll] = useState(false);
  const [bookingPayroll, setBookingPayroll] = useState(false);

  // Pay slip preview modal
  const [slipModalRecord, setSlipModalRecord] = useState<PayrollRecord | null>(null);

  // Payment voucher creation modal for Paid One / Paid All
  const [payModal, setPayModal] = useState<{
    open: boolean;
    target?: PayrollRecord;
    isAll?: boolean;
    account_id: string;
    payment_date: string;
    payment_mode: "cash" | "bank" | "esewa" | "cheque";
  }>({
    open: false,
    account_id: "",
    payment_date: todayBS(),
    payment_mode: "cash",
  });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Generate / Load payroll rows for selected year & month
  useEffect(() => {
    // Check if payroll already exists in history for this year & month
    const existing = payrollHistory.filter(
      (r) => r.year === payrollYear && r.month === payrollMonth,
    );

    const activeEmps = empList.filter((e) => e.status !== "inactive");

    const rows: PayrollRecord[] = activeEmps.map((emp) => {
      const savedRow = existing.find((r) => r.employee_id === emp.id);
      if (savedRow) return savedRow;

      // Auto-calculate fresh default row
      const daysWorked = 26;
      const totalDays = 26;
      const trips = emp.allowance_type === "trip" ? 20 : 0;
      const otherAllowance = Number(emp.other_allowance) || 0;
      const calcParams: Parameters<typeof calculatePayrollRow>[0] = {
        basic_salary: emp.basic_salary,
        days_worked: daysWorked,
        total_days: totalDays,
        trips,
        allowance_type: emp.allowance_type || "day",
        allowance_rate: emp.allowance_rate || 0,
        other_allowance: otherAllowance,
        tax: 0,
        other_deductions: 0,
      };
      const base = calculatePayrollRow({ ...calcParams, advance_adjusted: 0 });
      // Pre-fill advance katti from the employee's outstanding Dr ledger balance
      // (capped at what salary can absorb); the user can adjust it before booking
      const advanceAdj = Math.min(
        employeeOutstandingDr(emp, payrollHistory, empTransactions),
        base.gross_salary,
      );
      const breakdown =
        advanceAdj > 0
          ? calculatePayrollRow({ ...calcParams, advance_adjusted: advanceAdj })
          : base;

      return {
        year: payrollYear,
        month: payrollMonth,
        employee_id: emp.id || `emp-${emp.name}`,
        employee_name: emp.name,
        designation: emp.designation,
        basic_salary: emp.basic_salary,
        days_worked: daysWorked,
        total_days: totalDays,
        trips,
        allowance: breakdown.allowance,
        other_allowance: breakdown.other_allowance,
        gross_salary: breakdown.gross_salary,
        tax: breakdown.tax,
        advance_adjusted: breakdown.advance_adjusted,
        other_deductions: breakdown.other_deductions,
        net_salary: breakdown.net_salary,
        payment_status: "pending",
        payment_mode: "cash",
        payment_date: "",
        voucher_ref: "",
      };
    });

    setPayrollRows(rows);
  }, [payrollYear, payrollMonth, empList, payrollHistory, empTransactions]);

  // Update a single payroll row field and recalculate live (only if not paid)
  const updatePayrollField = (
    index: number,
    field: keyof PayrollRecord,
    value: any,
  ) => {
    setPayrollRows((prev) => {
      const next = [...prev];
      const currentRow = next[index];
      // Once paid OR booked, row stays frozen and cannot be changed
      if (currentRow.payment_status === "paid" || currentRow.payment_status === "booked" || currentRow.is_booked) {
        return prev;
      }

      const target = { ...currentRow, [field]: value };
      const matchedEmp = empList.find((e) => e.id === target.employee_id);

      // Recalculate salary breakdown
      const otherAllowance =
        field === "other_allowance"
          ? Number(value) || 0
          : Number(target.other_allowance) || 0;

      const breakdown = calculatePayrollRow({
        basic_salary: target.basic_salary,
        days_worked: target.days_worked,
        total_days: target.total_days,
        trips: target.trips,
        allowance_type: matchedEmp?.allowance_type || "day",
        allowance_rate: matchedEmp?.allowance_rate || 0,
        custom_allowance: field === "allowance" ? Number(value) : undefined,
        other_allowance: otherAllowance,
        tax: target.tax,
        advance_adjusted: target.advance_adjusted,
        other_deductions: target.other_deductions,
      });

      if (field !== "allowance") {
        target.allowance = breakdown.allowance;
      }
      target.other_allowance = breakdown.other_allowance;
      target.gross_salary = breakdown.gross_salary;
      target.tax = breakdown.tax;
      target.advance_adjusted = breakdown.advance_adjusted;
      target.other_deductions = breakdown.other_deductions;
      target.net_salary = breakdown.net_salary;

      next[index] = target;
      return next;
    });
  };

  // Save full monthly payroll
  const handleSavePayroll = async () => {
    setSavingPayroll(true);
    setPayrollNotice(null);
    try {
      await savePayrollFn({
        data: {
          year: payrollYear,
          month: payrollMonth,
          records: payrollRows,
        },
      });

      // Update local history
      const updatedHistory = [
        ...payrollHistory.filter(
          (r) => !(r.year === payrollYear && r.month === payrollMonth),
        ),
        ...payrollRows,
      ];
      setPayrollHistory(updatedHistory);
      try {
        localStorage.setItem("hami_payroll_cache", JSON.stringify(updatedHistory));
      } catch {}

      setPayrollNotice({
        type: "success",
        text: `${MONTHS[payrollMonth]} ${payrollYear} को पेरोल सफलतापूर्वक सुरक्षित गरियो!`,
      });
      void queryClient.invalidateQueries({ queryKey: ["members_data"] });
    } catch {
      // Local storage fallback
      const updatedHistory = [
        ...payrollHistory.filter(
          (r) => !(r.year === payrollYear && r.month === payrollMonth),
        ),
        ...payrollRows,
      ];
      setPayrollHistory(updatedHistory);
      try {
        localStorage.setItem("hami_payroll_cache", JSON.stringify(updatedHistory));
      } catch {}
      setPayrollNotice({
        type: "success",
        text: `पेरोल स्थानीय रूपमा सुरक्षित गरियो (${MONTHS[payrollMonth]} ${payrollYear})।`,
      });
    } finally {
      setSavingPayroll(false);
    }
  };

  // Book (lock) payroll for this month — prevents any further edits and enables payment
  const handleBookPayroll = async () => {
    const unbookedRows = payrollRows.filter(
      (r) => r.payment_status !== "paid" && r.payment_status !== "booked" && !r.is_booked,
    );
    if (unbookedRows.length === 0) {
      setPayrollNotice({ type: "error", text: "सबै पेरोल पहिले नै बुक भइसकेको छ।" });
      return;
    }
    setBookingPayroll(true);
    setPayrollNotice(null);
    try {
      // 1. Immediately create the booked version of rows:
      const bookedRows = payrollRows.map((row) => {
        if (row.payment_status === "paid") return row;
        return {
          ...row,
          payment_status: "booked" as const,
          is_booked: true,
        };
      });

      // 2. Set current sheet rows to booked immediately:
      setPayrollRows(bookedRows);

      // 3. Update history immediately so all tabs, stages and boxes reflect Stage 2 (Booked):
      const updatedHistory = [
        ...payrollHistory.filter((r) => !(r.year === payrollYear && r.month === payrollMonth)),
        ...bookedRows,
      ];
      setPayrollHistory(updatedHistory);
      try {
        localStorage.setItem("hami_payroll_cache", JSON.stringify(updatedHistory));
      } catch {}

      // 4. Save to server:
      const saved = await bookPayrollFn({
        data: {
          year: payrollYear,
          month: payrollMonth,
          records: bookedRows.filter((r) => r.payment_status !== "paid"),
        },
      });

      if (Array.isArray(saved) && saved.length > 0) {
        const serverMerged = bookedRows.map((row) => {
          const updated = saved.find((s: PayrollRecord) => s.employee_id === row.employee_id);
          return updated ? { ...row, ...updated, payment_status: "booked" as const, is_booked: true } : row;
        });
        setPayrollRows(serverMerged);
        const serverHistory = [
          ...payrollHistory.filter((r) => !(r.year === payrollYear && r.month === payrollMonth)),
          ...serverMerged,
        ];
        setPayrollHistory(serverHistory);
        try {
          localStorage.setItem("hami_payroll_cache", JSON.stringify(serverHistory));
        } catch {}
      }

      setPayrollNotice({
        type: "success",
        text: `${MONTHS[payrollMonth]} ${payrollYear} को पेरोल सफलतापूर्वक बुक गरियो — अब 'अर्को चरण ➔ सबै भुक्तानी गर्नुहोस्' बाट भुक्तानी गर्न सकिन्छ!`,
      });
      void queryClient.invalidateQueries({ queryKey: ["members_data"] });
    } catch (err: any) {
      setPayrollNotice({ type: "error", text: err?.message || "बुकिङमा त्रुटि भयो।" });
    } finally {
      setBookingPayroll(false);
    }
  };

  // Unbook (unlock) payroll for this month back to draft (if not paid yet)
  const handleUnbookPayroll = async () => {
    if (payrollRows.some((r) => r.payment_status === "paid")) {
      alert("यो महिनाका कर्मचारीको तलब भुक्तानी भइसकेको छ। भुक्तानी भइसकेको रेकर्ड अनलक गर्न मिल्दैन।");
      return;
    }
    try {
      await unbookPayrollFn({ data: { year: payrollYear, month: payrollMonth } });
      const unbookedRows = payrollRows.map((row) => ({
        ...row,
        payment_status: "pending" as const,
        is_booked: false,
      }));
      setPayrollRows(unbookedRows);
      const updatedHistory = [
        ...payrollHistory.filter((r) => !(r.year === payrollYear && r.month === payrollMonth)),
        ...unbookedRows,
      ];
      setPayrollHistory(updatedHistory);
      try {
        localStorage.setItem("hami_payroll_cache", JSON.stringify(updatedHistory));
      } catch {}
      setPayrollNotice({
        type: "success",
        text: `${MONTHS[payrollMonth]} ${payrollYear} को पेरोल ड्राफ्टमा फिर्ता गरियो (सम्पादन गर्न सकिन्छ)।`,
      });
      void queryClient.invalidateQueries({ queryKey: ["members_data"] });
    } catch (err: any) {
      alert("अनलक गर्न सकिएन: " + (err?.message || "त्रुटि भयो"));
    }
  };

  // Open payment dialog for single employee — requires record to be booked first
  const handleOpenPaySingle = (record: PayrollRecord) => {
    if (record.payment_status === "paid") {
      alert("यो रेकर्डको तलब भुक्तानी भइसकेको छ (Already Paid & Fixed)। दोहोरो भुक्तानी गर्न मिल्दैन।");
      return;
    }
    if (record.payment_status !== "booked" && !record.is_booked) {
      alert("पहिले पेरोल बुक गर्नुहोस् (Please Book Payroll first)। बुकिङ गरेर हिसाब लक गरेपछि मात्र भुक्तानी गर्न सकिन्छ।");
      return;
    }
    setPayModal({
      open: true,
      target: record,
      isAll: false,
      account_id: accountsList[0]?.id || "",
      payment_date: todayBS(),
      payment_mode: "cash",
    });
  };

  // Open payment dialog for all pending employees — requires all pending to be booked
  const handleOpenPayAll = () => {
    const unbookedPending = payrollRows.filter(
      (r) => r.payment_status !== "paid" && r.payment_status !== "booked" && !r.is_booked && r.net_salary > 0,
    );
    if (unbookedPending.length > 0) {
      alert("पहिले पेरोल बुक गर्नुहोस् (Please Book Payroll first)। सबै कर्मचारीको हिसाब बुक भएपछि मात्र भुक्तानी गर्न सकिन्छ।");
      return;
    }
    const pendingRows = payrollRows.filter(
      (r) => r.payment_status !== "paid" && r.net_salary > 0,
    );
    if (pendingRows.length === 0) {
      alert("सबै कर्मचारीहरूको तलब पहिल्यै भुक्तानी भइसकेको छ। यो महिनाको पेरोल पूर्ण रूपमा स्थिर (Fixed) छ।");
      return;
    }
    setPayModal({
      open: true,
      isAll: true,
      account_id: accountsList[0]?.id || "",
      payment_date: todayBS(),
      payment_mode: "cash",
    });
  };

  // Confirm payment & auto-generate payment voucher in rp_transactions
  const handleConfirmPayment = async () => {
    if (!payModal.account_id) {
      alert("कृपया भुक्तानी गर्ने खाता छान्नुहोस् (Cash or Bank account)।");
      return;
    }

    const recordsToPay = payModal.isAll
      ? payrollRows.filter((r) => r.payment_status !== "paid" && r.net_salary > 0)
      : payModal.target
        ? [payModal.target]
        : [];

    if (recordsToPay.length === 0) return;

    setIsProcessingPayment(true);
    try {
      const updatedRecords = await payPayrollFn({
        data: {
          account_id: payModal.account_id,
          payment_date: payModal.payment_date || todayBS(),
          payment_mode: payModal.payment_mode,
          records: recordsToPay.map((r) => ({
            id: r.id,
            year: r.year,
            month: r.month,
            employee_id: r.employee_id,
            employee_name: r.employee_name,
            designation: r.designation,
            basic_salary: r.basic_salary,
            days_worked: r.days_worked,
            total_days: r.total_days,
            trips: r.trips,
            allowance: r.allowance,
            other_allowance: r.other_allowance || 0,
            gross_salary: r.gross_salary,
            tax: r.tax,
            advance_adjusted: r.advance_adjusted,
            other_deductions: r.other_deductions,
            net_salary: r.net_salary,
            remarks: r.remarks,
          })),
        },
      });

      // Merge into current payrollRows
      setPayrollRows((prev) =>
        prev.map((row) => {
          const matchingUpdated = updatedRecords.find(
            (u) =>
              u.employee_id === row.employee_id &&
              u.year === row.year &&
              u.month === row.month,
          );
          if (matchingUpdated) return matchingUpdated;
          if (recordsToPay.some((rp) => rp.employee_id === row.employee_id)) {
            return {
              ...row,
              payment_status: "paid",
              is_booked: true,
              payment_date: payModal.payment_date || todayBS(),
              payment_mode: payModal.payment_mode,
            };
          }
          return row;
        }),
      );

      // Also merge into payrollHistory immediately so history boxes update live
      setPayrollHistory((prev) => {
        const next = prev.map((item) => {
          const matchingUpdated = updatedRecords.find(
            (u) =>
              u.employee_id === item.employee_id &&
              u.year === item.year &&
              u.month === item.month,
          );
          if (matchingUpdated) return matchingUpdated;
          if (
            recordsToPay.some(
              (rp) =>
                rp.employee_id === item.employee_id &&
                rp.year === item.year &&
                rp.month === item.month,
            )
          ) {
            return {
              ...item,
              payment_status: "paid" as const,
              is_booked: true,
              payment_date: payModal.payment_date || todayBS(),
              payment_mode: payModal.payment_mode,
            };
          }
          return item;
        });
        try {
          localStorage.setItem("hami_payroll_cache", JSON.stringify(next));
        } catch {}
        return next;
      });

      // Invalidate queries so cash/bank and receipts-payments update automatically
      void queryClient.invalidateQueries({ queryKey: ["members_data"] });
      void queryClient.invalidateQueries({ queryKey: ["rp_data"] });

      const voucherRefs = updatedRecords
        .map((u) => u.voucher_ref)
        .filter(Boolean)
        .join(", ");

      setPayrollNotice({
        type: "success",
        text: payModal.isAll
          ? `सबै ${recordsToPay.length} कर्मचारीहरूको तलब भुक्तानी भयो र भुक्तानी भौचर सिर्जना गरियो (${voucherRefs || "Payment Vouchers"})!`
          : `${payModal.target?.employee_name} को तलब भुक्तानी सम्पन्न भयो र भुक्तानी भौचर सिर्जना गरियो (${voucherRefs || "Payment Voucher"})!`,
      });

      setPayModal((p) => ({ ...p, open: false }));
    } catch (err: any) {
      alert("भुक्तानी असफल भयो: " + (err?.message || "त्रुटि भयो"));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Member Handlers
  const handleOpenAddMember = () => {
    setEditingMember(null);
    setMemberForm({
      name: "",
      designation: "सदस्य",
      occupation: "",
      dob: "",
      membership_fee: 1000,
      phone: "",
      address: "",
      status: "active",
    });
    setMemberModalOpen(true);
  };

  const handleOpenEditMember = (item: Member) => {
    setEditingMember(item);
    setMemberForm({ ...item });
    setMemberModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.name.trim()) return;

    try {
      const res = await saveMemberFn({
        data: {
          id: editingMember?.id,
          name: memberForm.name,
          designation: memberForm.designation,
          occupation: memberForm.occupation,
          dob: memberForm.dob,
          membership_fee: Number(memberForm.membership_fee) || 0,
          phone: memberForm.phone,
          address: memberForm.address,
          status: memberForm.status,
        },
      });

      const updated = editingMember
        ? memberList.map((b) => (b.id === editingMember.id ? res : b))
        : [...memberList, res];
      setMemberList(updated);
      try {
        localStorage.setItem("hami_members_cache", JSON.stringify(updated));
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ["members_data"] });
    } catch {
      // Local fallback
      const localItem: Member = {
        ...memberForm,
        id: editingMember?.id || `local-mem-${Date.now()}`,
      };
      const updated = editingMember
        ? memberList.map((b) => (b.id === editingMember.id ? localItem : b))
        : [...memberList, localItem];
      setMemberList(updated);
      try {
        localStorage.setItem("hami_members_cache", JSON.stringify(updated));
      } catch {}
    }
    setMemberModalOpen(false);
  };

  const handleDeleteMember = async (id?: string) => {
    if (!id || !confirm("के तपाईं यो सदस्य हटाउन निश्चित हुनुहुन्छ?")) return;
    try {
      await deleteMemberFn({ data: { id } });
    } catch {}
    const updated = memberList.filter((b) => b.id !== id);
    setMemberList(updated);
    try {
      localStorage.setItem("hami_members_cache", JSON.stringify(updated));
    } catch {}
  };

  // Employee Handlers
  const handleOpenAddEmp = () => {
    setEditingEmp(null);
    setEmpForm({
      name: "",
      age: 28,
      dob: "",
      designation: "फोहोर संकलक (Collector)",
      qualification: "",
      basic_salary: 16000,
      allowance_type: "day",
      allowance_rate: 250,
      other_allowance: 0,
      phone: "",
      pan: "",
      status: "active",
      joining_date: todayBS(),
      opening_balance: 0,
      balance_type: "cr",
    });
    setEmpModalOpen(true);
  };

  const handleOpenEditEmp = (item: Employee) => {
    setEditingEmp(item);
    setEmpForm({
      ...item,
      other_allowance: item.other_allowance || 0,
      opening_balance: item.opening_balance || 0,
      balance_type: item.balance_type ?? "cr",
    });
    setEmpModalOpen(true);
  };

  const handleSaveEmp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.name.trim()) return;

    try {
      const res = await saveEmpFn({
        data: {
          id: editingEmp?.id,
          name: empForm.name,
          age: Number(empForm.age) || 0,
          dob: empForm.dob,
          designation: empForm.designation,
          qualification: empForm.qualification,
          basic_salary: Number(empForm.basic_salary) || 0,
          allowance_type: empForm.allowance_type,
          allowance_rate: Number(empForm.allowance_rate) || 0,
          other_allowance: Number(empForm.other_allowance) || 0,
          phone: empForm.phone,
          pan: empForm.pan,
          status: empForm.status,
          joining_date: empForm.joining_date,
          opening_balance: Number(empForm.opening_balance) || 0,
          balance_type: empForm.balance_type ?? "cr",
        },
      });

      const updated = editingEmp
        ? empList.map((em) => (em.id === editingEmp.id ? res : em))
        : [...empList, res];
      setEmpList(updated);
      try {
        localStorage.setItem("hami_emp_cache", JSON.stringify(updated));
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ["members_data"] });
    } catch {
      // Local fallback
      const localItem: Employee = {
        ...empForm,
        id: editingEmp?.id || `local-emp-${Date.now()}`,
      };
      const updated = editingEmp
        ? empList.map((em) => (em.id === editingEmp.id ? localItem : em))
        : [...empList, localItem];
      setEmpList(updated);
      try {
        localStorage.setItem("hami_emp_cache", JSON.stringify(updated));
      } catch {}
    }
    setEmpModalOpen(false);
  };

  const handleDeleteEmp = async (id?: string) => {
    if (!id || !confirm("के तपाईं यो कर्मचारी हटाउन निश्चित हुनुहुन्छ?")) return;
    try {
      await deleteEmpFn({ data: { id } });
    } catch {}
    const updated = empList.filter((em) => em.id !== id);
    setEmpList(updated);
    try {
      localStorage.setItem("hami_emp_cache", JSON.stringify(updated));
    } catch {}
  };

  // Filtered lists
  const filteredMembers = useMemo(() => {
    const q = searchMember.trim().toLowerCase();
    if (!q) return memberList;
    return memberList.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.designation.toLowerCase().includes(q) ||
        (b.occupation && b.occupation.toLowerCase().includes(q)),
    );
  }, [memberList, searchMember]);

  const filteredEmp = useMemo(() => {
    const q = searchEmp.trim().toLowerCase();
    if (!q) return empList;
    return empList.filter(
      (em) =>
        em.name.toLowerCase().includes(q) ||
        em.designation.toLowerCase().includes(q) ||
        (em.qualification && em.qualification.toLowerCase().includes(q)),
    );
  }, [empList, searchEmp]);

  // Payroll summary totals
  const payrollTotals = useMemo(() => {
    return payrollRows.reduce(
      (acc, r) => ({
        basic: acc.basic + (r.basic_salary || 0),
        allowance: acc.allowance + (r.allowance || 0),
        other_allowance: acc.other_allowance + (r.other_allowance || 0),
        gross: acc.gross + (r.gross_salary || 0),
        tax: acc.tax + (r.tax || 0),
        advance: acc.advance + (r.advance_adjusted || 0),
        net: acc.net + (r.net_salary || 0),
      }),
      { basic: 0, allowance: 0, other_allowance: 0, gross: 0, tax: 0, advance: 0, net: 0 },
    );
  }, [payrollRows]);

  // Payroll History Filtered Records
  const filteredPayrollHistory = useMemo(() => {
    return payrollHistory.filter((r) => {
      if (historyYear !== "all" && r.year !== Number(historyYear)) return false;
      if (historyMonth !== "all" && r.month !== Number(historyMonth)) return false;
      if (historyStatus !== "all" && r.payment_status !== historyStatus) return false;
      if (historySearch.trim()) {
        const q = historySearch.trim().toLowerCase();
        const matchName = r.employee_name?.toLowerCase().includes(q);
        const matchDesig = r.designation?.toLowerCase().includes(q);
        const matchVoucher = r.voucher_ref?.toLowerCase().includes(q);
        if (!matchName && !matchDesig && !matchVoucher) return false;
      }
      return true;
    });
  }, [payrollHistory, historyYear, historyMonth, historyStatus, historySearch]);

  const historyTotals = useMemo(() => {
    return filteredPayrollHistory.reduce(
      (acc, r) => ({
        gross: acc.gross + (Number(r.gross_salary) || 0),
        tax: acc.tax + (Number(r.tax) || 0),
        advance: acc.advance + (Number(r.advance_adjusted) || 0),
        net: acc.net + (Number(r.net_salary) || 0),
        paidCount: acc.paidCount + (r.payment_status === "paid" ? 1 : 0),
      }),
      { gross: 0, tax: 0, advance: 0, net: 0, paidCount: 0 },
    );
  }, [filteredPayrollHistory]);

  // Current Payroll Sheet 3-Stage calculation (0 = No records, 1 = Draft, 2 = Booked, 3 = Paid & Fixed)
  const currentSheetStage = useMemo(() => {
    if (payrollRows.length === 0) return 0;
    const allPaid = payrollRows.every((r) => r.payment_status === "paid");
    if (allPaid) return 3;
    const allBooked = payrollRows.every(
      (r) => r.payment_status === "paid" || r.payment_status === "booked" || r.is_booked,
    );
    if (allBooked) return 2;
    return 1;
  }, [payrollRows]);

  // Year for Monthly History Boxes
  const historyBoxesYear = useMemo(() => {
    return historyYear === "all" ? payrollYear : Number(historyYear);
  }, [historyYear, payrollYear]);

  // Aggregated data for all 12 months in the selected BS year
  const monthlyHistoryBoxes = useMemo(() => {
    return MONTHS.map((monthName, monthIdx) => {
      const records = payrollHistory.filter(
        (r) => r.year === historyBoxesYear && r.month === monthIdx,
      );
      const hasRecords = records.length > 0;
      const allPaid = hasRecords && records.every((r) => r.payment_status === "paid");
      const anyPaid = records.some((r) => r.payment_status === "paid");
      const allBooked =
        hasRecords &&
        records.every(
          (r) => r.payment_status === "paid" || r.payment_status === "booked" || r.is_booked,
        );

      let stage: 0 | 1 | 2 | 3 = 0;
      if (!hasRecords) stage = 0; // Not created
      else if (allPaid) stage = 3; // Paid & Fixed
      else if (allBooked) stage = 2; // Booked, ready to pay
      else stage = 1; // Draft

      const totalEmployees = records.length;
      const totalGross = records.reduce((s, r) => s + (Number(r.gross_salary) || 0), 0);
      const totalTax = records.reduce((s, r) => s + (Number(r.tax) || 0), 0);
      const totalAdvance = records.reduce((s, r) => s + (Number(r.advance_adjusted) || 0), 0);
      const totalNet = records.reduce((s, r) => s + (Number(r.net_salary) || 0), 0);
      const paidEmployeesCount = records.filter((r) => r.payment_status === "paid").length;

      const voucherRefs = Array.from(
        new Set(records.map((r) => r.voucher_ref).filter(Boolean)),
      );
      const paymentDates = Array.from(
        new Set(records.map((r) => r.payment_date).filter(Boolean)),
      );

      return {
        monthIndex: monthIdx,
        monthName,
        year: historyBoxesYear,
        hasRecords,
        stage,
        allPaid,
        anyPaid,
        allBooked,
        totalEmployees,
        paidEmployeesCount,
        totalGross,
        totalTax,
        totalAdvance,
        totalNet,
        voucherRefs,
        paymentDates,
        records,
      };
    });
  }, [payrollHistory, historyBoxesYear]);

  const handleOpenMonthSheet = (year: number, monthIdx: number) => {
    setPayrollYear(year);
    setPayrollMonth(monthIdx);
    setPayrollSubTab("sheet");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Current selected employee for Ledger view
  const currentLedgerEmp = useMemo(() => {
    if (selectedLedgerEmpId) {
      const found = empList.find((e) => e.id === selectedLedgerEmpId);
      if (found) return found;
    }
    return empList[0] || null;
  }, [empList, selectedLedgerEmpId]);

  // Payroll records for current ledger employee
  const currentEmpPayrolls = useMemo(() => {
    if (!currentLedgerEmp?.id) return [];
    return payrollHistory
      .filter((r) => r.employee_id === currentLedgerEmp.id)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
  }, [payrollHistory, currentLedgerEmp]);

  // Ledger summary for current employee
  const currentEmpLedgerSummary = useMemo(() => {
    const totalGross = currentEmpPayrolls.reduce(
      (sum, r) => sum + (Number(r.gross_salary) || 0),
      0,
    );
    const totalTax = currentEmpPayrolls.reduce(
      (sum, r) => sum + (Number(r.tax) || 0),
      0,
    );
    const totalAdvance = currentEmpPayrolls.reduce(
      (sum, r) => sum + (Number(r.advance_adjusted) || 0),
      0,
    );
    const totalOtherDeductions = currentEmpPayrolls.reduce(
      (sum, r) => sum + (Number(r.other_deductions) || 0),
      0,
    );
    const totalNetEarned = currentEmpPayrolls.reduce(
      (sum, r) => sum + (Number(r.net_salary) || 0),
      0,
    );
    const totalPaid = currentEmpPayrolls
      .filter((r) => r.payment_status === "paid")
      .reduce((sum, r) => sum + (Number(r.net_salary) || 0), 0);
    const totalPending = currentEmpPayrolls
      .filter((r) => r.payment_status !== "paid")
      .reduce((sum, r) => sum + (Number(r.net_salary) || 0), 0);

    return {
      totalGross,
      totalTax,
      totalAdvance,
      totalOtherDeductions,
      totalNetEarned,
      totalPaid,
      totalPending,
    };
  }, [currentEmpPayrolls]);

  // Dr/Cr ledger rows for the selected employee (opening, booked, paid, advance)
  const empLedgerRows = useMemo(
    () =>
      buildEmployeeLedger({
        employee: currentLedgerEmp,
        payrolls: currentEmpPayrolls,
        transactions: empTransactions,
      }),
    [currentLedgerEmp, currentEmpPayrolls, empTransactions],
  );

  // Advance payments only — salary-payment vouchers are excluded
  const empAdvanceOnlyTxns = useMemo(
    () => employeeAdvanceTransactions(currentLedgerEmp?.id, empTransactions, payrollHistory),
    [currentLedgerEmp, empTransactions, payrollHistory],
  );

  if (!app.ready) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
        <p role="status">Opening members module…</p>
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      {/* Page Title & Navigation Tabs */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            सदस्य तथा कर्मचारी व्यवस्थापन (Members & Staff)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            हामी युवा क्लब - सदस्यहरू, कर्मचारी रेकर्ड तथा मासिक पेरोल
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-lg border bg-muted/40 p-1 shadow-xs">
          <button
            onClick={() => setActiveTab("members")}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "members"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BadgeCheck className="size-4 text-primary" />
            <span>सदस्यहरू (Members)</span>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
              {memberList.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("employees")}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "employees"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Briefcase className="size-4 text-emerald-600" />
            <span>कर्मचारीहरू (Employees)</span>
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-bold text-emerald-600">
              {empList.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("payroll")}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "payroll"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calculator className="size-4 text-amber-600" />
            <span>मासिक पेरोल (Payroll)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MEMBERS */}
      {/* ========================================================================= */}
      {activeTab === "members" && (
        <section className="space-y-5">
          {/* Members Stats Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="text-xs text-muted-foreground font-medium">कुल सदस्य संख्या (Total Members)</div>
              <div className="mt-1 text-2xl font-extrabold text-foreground">
                {memberList.length} जना
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="text-xs text-muted-foreground font-medium">सक्रिय सदस्यहरू (Active Members)</div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-600">
                {memberList.filter((b) => b.status === "active").length} जना
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="text-xs text-muted-foreground font-medium">वार्षिक सदस्यता शुल्क प्रतिबद्धता</div>
              <div className="mt-1 text-2xl font-extrabold text-primary">
                {money(memberList.reduce((acc, b) => acc + (b.membership_fee || 0), 0))}
              </div>
            </div>
          </div>

          {/* Members Action & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="नाम, पद वा पेशा खोज्नुहोस्…"
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <Button
              onClick={handleOpenAddMember}
              size="sm"
              className="flex items-center gap-1.5 font-bold shadow-xs"
            >
              <Plus className="size-4" />
              <span>नयाँ सदस्य थप्नुहोस्</span>
            </Button>
          </div>

          {/* Members Table */}
          <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">सि.नं.</th>
                  <th className="px-4 py-3">पद (Designation)</th>
                  <th className="px-4 py-3">पूरा नाम (Name)</th>
                  <th className="px-4 py-3">पेशा (Occupation)</th>
                  <th className="px-4 py-3">जन्म मिति (DOB)</th>
                  <th className="px-4 py-3 text-right">सदस्यता शुल्क (Fee)</th>
                  <th className="px-4 py-3">सम्पर्क / ठेगाना</th>
                  <th className="px-4 py-3">स्थिति</th>
                  <th className="no-print px-4 py-3 text-right">कार्य</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-muted-foreground">
                      कुनै सदस्य फेला परेन।
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-bold text-primary">
                          {item.designation}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground">{item.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.occupation || "—"}</td>
                      <td className="px-4 py-3 font-mono">{np(item.dob || "—")}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {money(item.membership_fee || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <div>{item.phone || "—"}</div>
                        <div className="text-[10px] text-muted-foreground">{item.address || ""}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.status === "active" ? "सक्रिय" : "निष्कृय"}
                        </span>
                      </td>
                      <td className="no-print px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="सम्पादन गर्नुहोस्"
                            onClick={() => handleOpenEditMember(item)}
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:bg-destructive/10"
                            title="हटाउनुहोस्"
                            onClick={() => handleDeleteMember(item.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Employees / Staff */}
      {/* ========================================================================= */}
      {activeTab === "employees" && (
        <section className="space-y-5">
          {/* Employee Stats */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="text-xs text-muted-foreground font-medium">कुल कर्मचारी संख्या</div>
              <div className="mt-1 text-2xl font-extrabold text-foreground">
                {empList.length} जना
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="text-xs text-muted-foreground font-medium">चालक तथा संकलकहरू</div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-600">
                {
                  empList.filter((e) =>
                    e.designation.includes("चालक") || e.designation.includes("संकलक"),
                  ).length
                }{" "}
                जना
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="text-xs text-muted-foreground font-medium">मासिक कुल आधारभूत तलब दायित्व</div>
              <div className="mt-1 text-2xl font-extrabold text-primary">
                {money(empList.reduce((acc, e) => acc + (e.basic_salary || 0), 0))}
              </div>
            </div>
          </div>

          {/* Employee Action & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="नाम, पद वा योग्यता खोज्नुहोस्…"
                value={searchEmp}
                onChange={(e) => setSearchEmp(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <Button
              onClick={handleOpenAddEmp}
              size="sm"
              className="flex items-center gap-1.5 font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="size-4" />
              <span>नयाँ कर्मचारी थप्नुहोस्</span>
            </Button>
          </div>

          {/* Employee Table */}
          <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">सि.नं.</th>
                  <th className="px-4 py-3">कर्मचारीको नाम (Name)</th>
                  <th className="px-4 py-3">पद (Designation)</th>
                  <th className="px-4 py-3">उमेर (Age)</th>
                  <th className="px-4 py-3">शैक्षिक योग्यता</th>
                  <th className="px-4 py-3 text-right">आधारभूत तलब (Basic)</th>
                  <th className="px-4 py-3">भत्ता आधार र दर (Allowance)</th>
                  <th className="px-4 py-3">सम्पर्क / प्यान</th>
                  <th className="px-4 py-3">स्थिति</th>
                  <th className="no-print px-4 py-3 text-right">कार्य</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEmp.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-muted-foreground">
                      कुनै कर्मचारी रेकर्ड फेला परेन।
                    </td>
                  </tr>
                ) : (
                  filteredEmp.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleOpenEmpLedger(item.id)}
                          className="font-bold text-foreground hover:text-primary hover:underline text-left flex items-center gap-1.5"
                          title="यस कर्मचारीको खाता / लेजर हेर्नुहोस्"
                        >
                          <span>{item.name}</span>
                          <BookOpen className="size-3 text-muted-foreground opacity-60" />
                        </button>
                        <div className="text-[10px] text-muted-foreground">
                          नियुक्ति: {np(item.joining_date || "—")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-700">
                          {item.designation}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{np(item.age || "—")} वर्ष</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.qualification || "—"}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        {money(item.basic_salary)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {item.allowance_type === "trip" && (
                            <span className="text-amber-700">प्रति ट्रिप {money(item.allowance_rate || 0)}</span>
                          )}
                          {item.allowance_type === "day" && (
                            <span className="text-blue-700">दैनिक {money(item.allowance_rate || 0)}</span>
                          )}
                          {item.allowance_type === "fixed" && (
                            <span className="text-purple-700">मासिक एकमुष्ट {money(item.allowance_rate || 0)}</span>
                          )}
                          {(!item.allowance_type || item.allowance_type === "none") && (
                            <span className="text-muted-foreground">भत्ता छैन</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{item.phone || "—"}</div>
                        {item.pan && <div className="text-[10px] font-mono text-muted-foreground">PAN: {item.pan}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : item.status === "on_leave"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.status === "active" ? "सक्रिय" : item.status === "on_leave" ? "बिदामा" : "निष्कृय"}
                        </span>
                      </td>
                      <td className="no-print px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px] font-semibold text-emerald-700 border-emerald-600/30 hover:bg-emerald-50"
                            title="यस कर्मचारीको खाता / लेजर हेर्नुहोस्"
                            onClick={() => handleOpenEmpLedger(item.id)}
                          >
                            <BookOpen className="mr-1 size-3 text-emerald-600" />
                            <span>लेजर</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="सम्पादन गर्नुहोस्"
                            onClick={() => handleOpenEditEmp(item)}
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:bg-destructive/10"
                            title="हटाउनुहोस्"
                            onClick={() => handleDeleteEmp(item.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Payroll Module (Sheet, History & Employee Ledger) */}
      {/* ========================================================================= */}
      {activeTab === "payroll" && (
        <section className="space-y-5">
          {/* Payroll Sub-Tabs Switcher */}
          <div className="no-print flex border-b gap-2 sm:gap-6">
            <button
              type="button"
              onClick={() => setPayrollSubTab("sheet")}
              className={`pb-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                payrollSubTab === "sheet"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calculator className="size-3.5" />
              <span>मासिक पेरोल सिट (Monthly Sheet)</span>
            </button>

            <button
              type="button"
              onClick={() => setPayrollSubTab("history")}
              className={`pb-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                payrollSubTab === "history"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <History className="size-3.5" />
              <span>पेरोल इतिहास (Payroll History)</span>
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono font-bold">
                {payrollHistory.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPayrollSubTab("ledger")}
              className={`pb-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                payrollSubTab === "ledger"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen className="size-3.5" />
              <span>कर्मचारी खाता / लेजर (Employee Ledger)</span>
            </button>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SUB-TAB 1: Monthly Payroll Sheet */}
          {/* ───────────────────────────────────────────────────────────── */}
          {payrollSubTab === "sheet" && (
            <div className="space-y-5">
              {/* Payroll Generator Controls */}
              <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">साल (Year - BS)</Label>
                    <select
                      value={payrollYear}
                      onChange={(e) => setPayrollYear(Number(e.target.value))}
                      className="mt-1 h-9 rounded-md border bg-background px-3 text-xs font-bold"
                    >
                      {[2080, 2081, 2082, 2083, 2084, 2085].map((y) => (
                        <option key={y} value={y}>
                          {y} साल
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">महिना (Month)</Label>
                    <select
                      value={payrollMonth}
                      onChange={(e) => setPayrollMonth(Number(e.target.value))}
                      className="mt-1 h-9 rounded-md border bg-background px-3 text-xs font-bold"
                    >
                      {MONTHS.map((m, idx) => (
                        <option key={m} value={idx}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-5">
                    <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700">
                      {MONTHS[payrollMonth]} {payrollYear} को पेरोल
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Step indicator & Action Buttons */}
                  {(() => {
                    const allBooked =
                      payrollRows.length > 0 &&
                      payrollRows.every(
                        (r) =>
                          r.payment_status === "paid" ||
                          r.payment_status === "booked" ||
                          r.is_booked,
                      );
                    const anyPaid = payrollRows.some((r) => r.payment_status === "paid");
                    const allPaid =
                      payrollRows.length > 0 &&
                      payrollRows.every((r) => r.payment_status === "paid");

                    if (allPaid) {
                      return (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-500/20">
                            <CheckCircle2 className="size-3.5" />
                            चरण ३: सबै भुक्तानी सम्पन्न (स्थिर)
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPayrollSubTab("history")}
                            className="text-xs font-semibold"
                          >
                            <History className="mr-1.5 size-3.5" />
                            <span>इतिहासमा हेर्नुहोस्</span>
                          </Button>
                        </div>
                      );
                    }

                    if (allBooked) {
                      return (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-500/20">
                            <Lock className="size-3.5" />
                            चरण २: बुक गरिएको (लक)
                          </span>

                          <Button
                            size="sm"
                            onClick={handleOpenPayAll}
                            className="text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md ring-2 ring-emerald-500/30 flex items-center gap-1.5 px-3.5"
                            title="अर्को चरण: सबै कर्मचारीको तलब भुक्तानी गर्नुहोस् र भुक्तानी भौचर सिर्जना गर्नुहोस्"
                          >
                            <CreditCard className="size-3.5" />
                            <span>अर्को चरण ➔ सबै भुक्तानी गर्नुहोस् (Pay All)</span>
                            <ArrowRight className="size-3.5" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleUnbookPayroll}
                            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                            title="हिसाब अनलक गरी फेरि सम्पादन गर्न"
                          >
                            <RotateCcw className="mr-1 size-3" />
                            <span>ड्राफ्टमा फिर्ता (अनलक)</span>
                          </Button>
                        </div>
                      );
                    }

                    // Otherwise Stage 1: Draft
                    return (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSavePayroll}
                          disabled={savingPayroll}
                          className="text-xs font-semibold"
                          title="पेरोल ड्राफ्ट सेभ गर्नुहोस्"
                        >
                          <Save className="mr-1.5 size-3.5" />
                          <span>{savingPayroll ? "सेभ हुँदैछ…" : "ड्राफ्ट सेभ"}</span>
                        </Button>

                        <Button
                          size="sm"
                          onClick={handleBookPayroll}
                          disabled={bookingPayroll || payrollRows.length === 0}
                          className="text-xs font-extrabold bg-amber-600 hover:bg-amber-700 text-white shadow-md flex items-center gap-1.5 px-3.5"
                          title="अर्को चरण: पेरोल बुक गर्नुहोस् — हिसाब लक गरी भुक्तानीका लागि तयार गर्नुहोस्"
                        >
                          <BookCheck className="size-3.5" />
                          <span>{bookingPayroll ? "बुक हुँदैछ…" : "अर्को चरण ➔ पेरोल बुक गर्नुहोस्"}</span>
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })()}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="text-xs"
                  >
                    <Printer className="mr-1.5 size-3.5" />
                    <span>सिट प्रिन्ट</span>
                  </Button>
                </div>
              </div>

              {/* 3-Stage Visual Workflow Pipeline Banner */}
              <div className="no-print rounded-xl border bg-card p-3.5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5 mb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      पेरोल प्रक्रिया चरणहरू (Payroll Processing Stages) — {MONTHS[payrollMonth]} {payrollYear}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="text-muted-foreground text-[11px]">वर्तमान अवस्था:</span>
                    {currentSheetStage === 3 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 text-[11px]">
                        <CheckCircle2 className="size-3 text-emerald-600" />
                        चरण ३: भुक्तानी सम्पन्न (स्थिर / Fixed)
                      </span>
                    ) : currentSheetStage === 2 ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 text-[11px]">
                        <Lock className="size-3 text-amber-600" />
                        चरण २: बुक गरिएको (भुक्तानीका लागि तयार)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sky-700 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/20 text-[11px]">
                        <Edit2 className="size-3 text-sky-600" />
                        चरण १: मस्यौदा / ड्राफ्ट (सम्पादन योग्य)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {/* Step 1 Card */}
                  <div
                    className={`p-3 rounded-lg border text-xs transition-all flex flex-col justify-between ${
                      currentSheetStage >= 1
                        ? currentSheetStage > 1
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-muted/20 opacity-60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold flex items-center gap-1.5">
                          {currentSheetStage > 1 ? (
                            <CheckCircle2 className="size-3.5 text-emerald-600" />
                          ) : (
                            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-white font-mono">
                              १
                            </span>
                          )}
                          <span>१. ड्राफ्ट तयार (Draft)</span>
                        </span>
                        {currentSheetStage > 1 && (
                          <span className="text-[10px] font-bold text-emerald-600">सम्पन्न ✓</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        हाजिरी, भत्ता, अन्य भत्ता र पेश्की समायोजन गरी 'पेरोल बुक गर्नुहोस्' थिच्नुहोस्।
                      </p>
                    </div>

                    {currentSheetStage === 1 && (
                      <div className="mt-2.5 pt-2 border-t">
                        <Button
                          size="sm"
                          onClick={handleBookPayroll}
                          disabled={bookingPayroll}
                          className="w-full h-7 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          <BookCheck className="mr-1 size-3" />
                          <span>{bookingPayroll ? "बुक हुँदैछ…" : "पेरोल बुक गर्नुहोस् ➔"}</span>
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Step 2 Card */}
                  <div
                    className={`p-3 rounded-lg border text-xs transition-all flex flex-col justify-between ${
                      currentSheetStage >= 2
                        ? currentSheetStage > 2
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/20"
                        : "border-border bg-muted/20 opacity-60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold flex items-center gap-1.5">
                          {currentSheetStage > 2 ? (
                            <CheckCircle2 className="size-3.5 text-emerald-600" />
                          ) : currentSheetStage === 2 ? (
                            <Lock className="size-3.5 text-amber-600" />
                          ) : (
                            <span className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/30 text-[10px] font-mono">
                              २
                            </span>
                          )}
                          <span>२. पेरोल बुकिङ (Booked)</span>
                        </span>
                        {currentSheetStage === 2 && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            सक्रिय
                          </span>
                        )}
                        {currentSheetStage > 2 && (
                          <span className="text-[10px] font-bold text-emerald-600">सम्पन्न ✓</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        हिसाब लक भई भुक्तानीको लागि खुला हुन्छ। बुकिङ पछि मात्र भुक्तानी गर्न सकिन्छ।
                      </p>
                    </div>

                    {currentSheetStage === 2 && (
                      <div className="mt-2.5 pt-2 border-t">
                        <Button
                          size="sm"
                          onClick={handleOpenPayAll}
                          className="w-full h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CreditCard className="mr-1 size-3" />
                          <span>सबै भुक्तानी गर्नुहोस् (Pay All) ➔</span>
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Step 3 Card */}
                  <div
                    className={`p-3 rounded-lg border text-xs transition-all flex flex-col justify-between ${
                      currentSheetStage === 3
                        ? "border-emerald-600 bg-emerald-500/10 ring-1 ring-emerald-600/30"
                        : "border-border bg-muted/20 opacity-60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold flex items-center gap-1.5">
                          {currentSheetStage === 3 ? (
                            <CheckCircle2 className="size-3.5 text-emerald-600" />
                          ) : (
                            <span className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/30 text-[10px] font-mono">
                              ३
                            </span>
                          )}
                          <span>३. भुक्तानी सम्पन्न (Paid & Fixed)</span>
                        </span>
                        {currentSheetStage === 3 && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            स्थिर / बन्द
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        भौचर सिर्जना भई तलब भुक्तानी भयो। रेकर्ड पूर्ण रूपमा स्थिर, परिवर्तन गर्न नमिल्ने।
                      </p>
                    </div>

                    {currentSheetStage === 3 && (
                      <div className="mt-2.5 pt-2 border-t">
                        <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="size-3" />
                          <span>भौचर जारी भएको छ</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Feedback banner */}
              {payrollNotice && (
                <div
                  className={`rounded-lg p-3 text-xs font-semibold ${
                    payrollNotice.type === "success"
                      ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                  }`}
                >
                  {payrollNotice.text}
                </div>
              )}

              {/* Payroll Print Header */}
              <div className="hidden print:block mb-4 text-center">
                <h2 className="text-xl font-extrabold">हामी युवा क्लब - कर्मचारी पेरोल रजिस्टर</h2>
                <p className="text-xs">वीरेन्द्रनगर, सुर्खेत | फोहोरमैला व्यवस्थापन</p>
                <p className="text-sm font-bold mt-1">
                  साल: {np(payrollYear)} महिना: {MONTHS[payrollMonth]}
                </p>
              </div>

              {/* Payroll Table */}
              <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
                <table className="w-full text-left text-xs min-w-[1000px]">
                  <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3">सि.नं.</th>
                      <th className="px-3 py-3 min-w-[140px]">कर्मचारी (Designation)</th>
                      <th className="px-3 py-3 text-right">आधारभूत तलब</th>
                      <th className="px-3 py-3 text-center w-20">उपस्थित दिन</th>
                      <th className="px-3 py-3 text-center w-16">ट्रिप</th>
                      <th className="px-3 py-3 text-right w-24">भत्ता (Allowance)</th>
                      <th className="px-3 py-3 text-right w-24">अन्य भत्ता (Other)</th>
                      <th className="px-3 py-3 text-right">कुल तलब (Gross)</th>
                      <th className="px-3 py-3 text-right w-24">कर (TDS/SST)</th>
                      <th className="px-3 py-3 text-right w-24">पेश्की कट्टी</th>
                      <th className="px-3 py-3 text-right font-extrabold text-foreground">
                        खुद भुक्तानी (Net Pay)
                      </th>
                      <th className="px-3 py-3 text-center">स्थिति</th>
                      <th className="no-print px-3 py-3 text-right">कार्य / भौचर</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payrollRows.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="py-12 text-center text-muted-foreground">
                          कुनै सक्रिय कर्मचारी भेटिएन। पहिले 'कर्मचारीहरू' ट्याबमा कर्मचारी थप्नुहोस्।
                        </td>
                      </tr>
                    ) : (
                      payrollRows.map((row, idx) => {
                        const isPaid = row.payment_status === "paid";
                        const isBooked = row.payment_status === "booked" || !!row.is_booked;
                        const isLocked = isPaid || isBooked; // locked = no edits
                        return (
                          <tr
                            key={row.employee_id || idx}
                            className={`transition-colors ${
                              isPaid
                                ? "bg-emerald-500/5 opacity-95"
                                : isBooked
                                  ? "bg-amber-500/5"
                                  : "hover:bg-muted/15"
                            }`}
                          >
                            <td className="px-3 py-2.5 font-mono">{idx + 1}</td>
                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEmpLedger(row.employee_id)}
                                className="font-bold text-foreground hover:text-primary hover:underline text-left flex items-center gap-1.5"
                                title="यस कर्मचारीको खाता / लेजर हेर्नुहोस्"
                              >
                                <span>{row.employee_name}</span>
                                {isPaid && (
                                  <Lock className="size-3 text-emerald-600/70 inline" title="भुक्तानी सम्पन्न — लक गरिएको" />
                                )}
                                {isBooked && !isPaid && (
                                  <Lock className="size-3 text-amber-600/70 inline" title="बुक गरिएको — भुक्तानी बाँकी" />
                                )}
                              </button>
                              <div className="text-[10px] text-muted-foreground">{row.designation}</div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium">
                              {money(row.basic_salary)}
                            </td>

                            {/* Days worked */}
                            <td className="px-2 py-2.5 text-center">
                              {isLocked ? (
                                <span className="font-mono text-xs">{row.days_worked}</span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  max="32"
                                  step="0.5"
                                  value={row.days_worked}
                                  onChange={(e) =>
                                    updatePayrollField(idx, "days_worked", Number(e.target.value) || 0)
                                  }
                                  className="w-16 rounded border bg-background px-1.5 py-1 text-center font-mono text-xs focus:ring-1 focus:ring-primary"
                                />
                              )}
                            </td>

                            {/* Trips */}
                            <td className="px-2 py-2.5 text-center">
                              {isLocked ? (
                                <span className="font-mono text-xs">{row.trips}</span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  max="200"
                                  value={row.trips}
                                  onChange={(e) =>
                                    updatePayrollField(idx, "trips", Number(e.target.value) || 0)
                                  }
                                  className="w-16 rounded border bg-background px-1.5 py-1 text-center font-mono text-xs focus:ring-1 focus:ring-primary"
                                />
                              )}
                            </td>

                            {/* Allowance */}
                            <td className="px-2 py-2.5 text-right">
                              {isLocked ? (
                                <span className="font-mono text-xs text-emerald-700 font-semibold">
                                  {money(row.allowance)}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  value={row.allowance}
                                  onChange={(e) =>
                                    updatePayrollField(idx, "allowance", Number(e.target.value) || 0)
                                  }
                                  className="w-20 rounded border bg-background px-1.5 py-1 text-right font-mono text-xs text-emerald-700 font-semibold focus:ring-1 focus:ring-primary"
                                />
                              )}
                            </td>

                            {/* Other Allowance */}
                            <td className="px-2 py-2.5 text-right">
                              {isLocked ? (
                                <span className="font-mono text-xs text-emerald-700 font-semibold">
                                  {money(row.other_allowance || 0)}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  value={row.other_allowance || ""}
                                  placeholder="0"
                                  onChange={(e) =>
                                    updatePayrollField(idx, "other_allowance", Number(e.target.value) || 0)
                                  }
                                  className="w-20 rounded border bg-background px-1.5 py-1 text-right font-mono text-xs text-emerald-700 font-semibold focus:ring-1 focus:ring-primary"
                                />
                              )}
                            </td>

                            {/* Gross */}
                            <td className="px-3 py-2.5 text-right font-bold text-foreground">
                              {money(row.gross_salary)}
                            </td>

                            {/* Tax (TDS/SST) */}
                            <td className="px-2 py-2.5 text-right">
                              {isLocked ? (
                                <span className="font-mono text-xs text-rose-600">
                                  {money(row.tax)}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  value={row.tax}
                                  onChange={(e) =>
                                    updatePayrollField(idx, "tax", Number(e.target.value) || 0)
                                  }
                                  placeholder="0"
                                  className="w-20 rounded border bg-background px-1.5 py-1 text-right font-mono text-xs text-rose-600 focus:ring-1 focus:ring-primary"
                                />
                              )}
                            </td>

                            {/* Advance adjusted */}
                            <td className="px-2 py-2.5 text-right">
                              {isLocked ? (
                                <span className="font-mono text-xs text-rose-600">
                                  {money(row.advance_adjusted)}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  value={row.advance_adjusted}
                                  onChange={(e) =>
                                    updatePayrollField(idx, "advance_adjusted", Number(e.target.value) || 0)
                                  }
                                  placeholder="0"
                                  className="w-20 rounded border bg-background px-1.5 py-1 text-right font-mono text-xs text-rose-600 focus:ring-1 focus:ring-primary"
                                />
                              )}
                            </td>

                            {/* Net Pay */}
                            <td className="px-3 py-2.5 text-right">
                              <span
                                className={`inline-block rounded-md px-2 py-1 font-extrabold text-xs ${
                                  isPaid
                                    ? "bg-emerald-500/15 text-emerald-700"
                                    : isBooked
                                      ? "bg-amber-500/15 text-amber-700"
                                      : "bg-primary/10 text-primary"
                                }`}
                              >
                                {money(row.net_salary)}
                              </span>
                            </td>

                            {/* Status Badge */}
                            <td className="px-3 py-2.5 text-center">
                              {isPaid ? (
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                    <CheckCircle2 className="size-3 text-emerald-600" />
                                    <span>भुक्तानी भयो</span>
                                  </span>
                                  {row.voucher_ref ? (
                                    <span
                                      className="font-mono text-[9px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-foreground/15"
                                      title="Payment Voucher Number"
                                    >
                                      {row.voucher_ref}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-muted-foreground">{row.payment_date}</span>
                                  )}
                                </div>
                              ) : isBooked ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                                  <Lock className="size-3" />
                                  <span>बुक गरिएको</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[10px] font-bold text-sky-700">
                                  <span>ड्राफ्ट</span>
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="no-print px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Pay button — only shown when booked and not yet paid */}
                                {isBooked && !isPaid && (
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                    onClick={() => handleOpenPaySingle(row)}
                                    title="यस कर्मचारीको तलब भुक्तानी गर्नुहोस् र भौचर बनाउनुहोस्"
                                  >
                                    <CreditCard className="mr-1 size-3" />
                                    <span>भुक्तानी</span>
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => setSlipModalRecord(row)}
                                  title="तलब भरपाई स्लिप हेर्नुहोस्"
                                >
                                  <FileText className="mr-1 size-3 text-muted-foreground" />
                                  <span>स्लिप</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-1.5 text-[11px] text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => handleOpenEmpLedger(row.employee_id)}
                                  title="यस कर्मचारीको खाता / लेजर हेर्नुहोस्"
                                >
                                  <BookOpen className="size-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>

                  {/* Payroll Totals Footer */}
                  {payrollRows.length > 0 && (
                    <tfoot className="border-t-2 bg-muted/60 font-bold text-xs">
                      <tr>
                        <td colSpan={2} className="px-3 py-3 text-foreground">
                          कुल जम्मा ({payrollRows.length} कर्मचारी)
                        </td>
                        <td className="px-3 py-3 text-right">{money(payrollTotals.basic)}</td>
                        <td colSpan={2} className="text-center text-muted-foreground text-[10px]">
                          —
                        </td>
                        <td className="px-3 py-3 text-right text-emerald-700">
                          {money(payrollTotals.allowance)}
                        </td>
                        <td className="px-3 py-3 text-right text-emerald-700">
                          {money(payrollTotals.other_allowance)}
                        </td>
                        <td className="px-3 py-3 text-right text-foreground">
                          {money(payrollTotals.gross)}
                        </td>
                        <td className="px-3 py-3 text-right text-rose-600">
                          - {money(payrollTotals.tax)}
                        </td>
                        <td className="px-3 py-3 text-right text-rose-600">
                          - {money(payrollTotals.advance)}
                        </td>
                        <td className="px-3 py-3 text-right text-primary text-sm font-extrabold">
                          {money(payrollTotals.net)}
                        </td>
                        <td colSpan={2} className="px-3 py-3 text-center text-muted-foreground text-[11px]">
                          {payrollRows.filter((r) => r.payment_status === "paid").length} जना भुक्तानी सम्पन्न
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Printable Signature Section for whole monthly register */}
              <div className="hidden print:flex mt-12 justify-between text-xs pt-4 border-t">
                <div className="text-center">
                  <div className="h-10 border-b border-foreground/40 w-36" />
                  <div className="pt-1">तयार गर्ने (लेखापाल)</div>
                </div>
                <div className="text-center">
                  <div className="h-10 border-b border-foreground/40 w-36" />
                  <div className="pt-1">जाँच गर्ने (सचिव)</div>
                </div>
                <div className="text-center">
                  <div className="h-10 border-b border-foreground/40 w-36" />
                  <div className="pt-1">स्वीकृत गर्ने (अध्यक्ष / कोषाध्यक्ष)</div>
                </div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SUB-TAB 2: Payroll History */}
          {/* ───────────────────────────────────────────────────────────── */}
          {payrollSubTab === "history" && (
            <div className="space-y-4">
              {/* Filter Toolbar & View Toggle */}
              <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs">
                <div className="flex flex-wrap items-center gap-3">
                  {/* View Mode Toggle: Monthly Boxes vs Detailed Table */}
                  <div className="flex rounded-lg border bg-muted/40 p-0.5">
                    <button
                      type="button"
                      onClick={() => setHistoryViewMode("boxes")}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                        historyViewMode === "boxes"
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="१२ महिनाको बक्स भ्यू (Monthly Boxes with Stages)"
                    >
                      <LayoutGrid className="size-3.5" />
                      <span>महिनावारी बक्स (Monthly Boxes)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryViewMode("table")}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                        historyViewMode === "table"
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="कर्मचारीगत विस्तृत तालिका (Detailed Table)"
                    >
                      <TableIcon className="size-3.5" />
                      <span>विस्तृत तालिका (Table)</span>
                    </button>
                  </div>

                  <div>
                    <select
                      value={historyYear}
                      onChange={(e) => setHistoryYear(e.target.value)}
                      className="h-9 rounded-md border bg-background px-3 text-xs font-bold"
                    >
                      <option value="all">चालु साल ({np(payrollYear)} साल)</option>
                      {[2080, 2081, 2082, 2083, 2084, 2085].map((y) => (
                        <option key={y} value={y}>
                          {y} साल
                        </option>
                      ))}
                    </select>
                  </div>

                  {historyViewMode === "table" && (
                    <>
                      <div className="relative w-48">
                        <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                        <Input
                          placeholder="कर्मचारी, पद वा भौचर नं…"
                          value={historySearch}
                          onChange={(e) => setHistorySearch(e.target.value)}
                          className="pl-8 text-xs h-9"
                        />
                      </div>

                      <div>
                        <select
                          value={historyMonth}
                          onChange={(e) => setHistoryMonth(e.target.value)}
                          className="h-9 rounded-md border bg-background px-3 text-xs font-semibold"
                        >
                          <option value="all">सबै महिना (All Months)</option>
                          {MONTHS.map((m, idx) => (
                            <option key={m} value={idx}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <select
                          value={historyStatus}
                          onChange={(e) => setHistoryStatus(e.target.value as "all" | "paid" | "pending" | "booked")}
                          className="h-9 rounded-md border bg-background px-3 text-xs font-semibold"
                        >
                          <option value="all">सबै स्थिति (All Status)</option>
                          <option value="paid">भुक्तानी सम्पन्न (Paid)</option>
                          <option value="booked">बुक गरिएको (Booked)</option>
                          <option value="pending">ड्राफ्ट / बाँकी (Pending)</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="text-xs font-semibold"
                  >
                    <Printer className="mr-1.5 size-3.5" />
                    <span>इतिहास प्रिन्ट</span>
                  </Button>
                </div>
              </div>

              {/* VIEW 1: MONTHLY BOXES GRID (Default View as requested) */}
              {historyViewMode === "boxes" && (
                <div className="space-y-4">
                  {/* Stages explanation header */}
                  <div className="rounded-xl border bg-card p-3.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-extrabold text-foreground flex items-center gap-1.5">
                          <Calendar className="size-4 text-primary" />
                          <span>{np(historyBoxesYear)} सालको १२ महिनाको पेरोल बक्स तथा चरणहरू (Monthly Payroll Stages)</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          पेरोल पहिले ड्राफ्ट हुन्छ, त्यसपछि बुक गरी हिसाब लक गरिन्छ, र अन्त्यमा भुक्तानी सम्पन्न भई भौचर बन्छ र रेकर्ड स्थिर (Fixed) हुन्छ।
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        <span className="flex items-center gap-1 rounded-full bg-sky-500/10 text-sky-700 px-2 py-0.5 border border-sky-500/20">
                          <Edit2 className="size-3" />
                          चरण १: ड्राफ्ट
                        </span>
                        <ArrowRight className="size-3 text-muted-foreground" />
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 px-2 py-0.5 border border-amber-500/20">
                          <Lock className="size-3" />
                          चरण २: बुक गरिएको (लक)
                        </span>
                        <ArrowRight className="size-3 text-muted-foreground" />
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 px-2 py-0.5 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" />
                          चरण ३: भुक्तानी सम्पन्न (स्थिर)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 12-Month Responsive Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {monthlyHistoryBoxes.map((box) => {
                      const isPaid = box.stage === 3;
                      const isBooked = box.stage === 2;
                      const isDraft = box.stage === 1;
                      const isNotStarted = box.stage === 0;

                      return (
                        <div
                          key={box.monthIndex}
                          className={`rounded-xl border transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md ${
                            isPaid
                              ? "bg-emerald-500/[0.03] border-emerald-500/30 ring-1 ring-emerald-500/10"
                              : isBooked
                                ? "bg-amber-500/[0.04] border-amber-500/40 ring-1 ring-amber-500/20"
                                : isDraft
                                  ? "bg-sky-500/[0.02] border-sky-500/30"
                                  : "bg-card border-border hover:border-foreground/20"
                          }`}
                        >
                          {/* Box Header */}
                          <div className="p-3.5 border-b space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-mono font-bold text-muted-foreground block">
                                  महिना {np(box.monthIndex + 1)} | {np(box.year)}
                                </span>
                                <h3 className="text-base font-extrabold text-foreground tracking-tight">
                                  {box.monthName}
                                </h3>
                              </div>

                              {/* Stage Badge */}
                              <div>
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-500/20">
                                    <CheckCircle2 className="size-3 text-emerald-600" />
                                    <span>भुक्तानी सम्पन्न</span>
                                  </span>
                                ) : isBooked ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-500/20">
                                    <Lock className="size-3 text-amber-600" />
                                    <span>बुक गरिएको</span>
                                  </span>
                                ) : isDraft ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-500/20">
                                    <Edit2 className="size-3 text-sky-600" />
                                    <span>ड्राफ्ट</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                    <span>तयार छैन</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 3-Stage Progress Segmented Bar */}
                            <div className="grid grid-cols-3 gap-1 pt-1">
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  box.stage >= 1
                                    ? isPaid
                                      ? "bg-emerald-600"
                                      : isBooked
                                        ? "bg-amber-500"
                                        : "bg-sky-500"
                                    : "bg-muted"
                                }`}
                                title="चरण १: ड्राफ्ट"
                              />
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  box.stage >= 2
                                    ? isPaid
                                      ? "bg-emerald-600"
                                      : "bg-amber-500"
                                    : "bg-muted"
                                }`}
                                title="चरण २: बुक गरिएको (लक)"
                              />
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  box.stage >= 3 ? "bg-emerald-600" : "bg-muted"
                                }`}
                                title="चरण ३: भुक्तानी सम्पन्न (स्थिर)"
                              />
                            </div>
                            <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                              <span className={box.stage >= 1 ? "font-bold text-foreground" : ""}>१. ड्राफ्ट</span>
                              <span className={box.stage >= 2 ? "font-bold text-foreground" : ""}>२. बुकिङ</span>
                              <span className={box.stage >= 3 ? "font-bold text-emerald-700" : ""}>३. भुक्तानी</span>
                            </div>
                          </div>

                          {/* Box Content Body */}
                          <div className="p-3.5 space-y-2.5 text-xs flex-1">
                            {box.hasRecords ? (
                              <>
                                <div className="flex items-baseline justify-between">
                                  <span className="text-[11px] text-muted-foreground">खुद तलब (Net Pay):</span>
                                  <span className={`text-base font-extrabold font-mono ${
                                    isPaid ? "text-emerald-700" : isBooked ? "text-amber-800" : "text-foreground"
                                  }`}>
                                    {money(box.totalNet)}
                                  </span>
                                </div>

                                <div className="space-y-1 pt-1 border-t text-[11px]">
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>कर्मचारी संख्या:</span>
                                    <span className="font-semibold text-foreground">
                                      {box.totalEmployees} जना {isPaid && `(${box.paidEmployeesCount} भुक्तान)`}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>कुल तलब (Gross):</span>
                                    <span className="font-mono">{money(box.totalGross)}</span>
                                  </div>
                                  <div className="flex justify-between text-rose-600">
                                    <span>TDS/SST कट्टी:</span>
                                    <span className="font-mono">- {money(box.totalTax)}</span>
                                  </div>
                                  {box.totalAdvance > 0 && (
                                    <div className="flex justify-between text-orange-600">
                                      <span>पेश्की कट्टी:</span>
                                      <span className="font-mono">- {money(box.totalAdvance)}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Paid Details Stamp */}
                                {isPaid && (
                                  <div className="mt-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-[10px] space-y-0.5">
                                    <div className="flex items-center justify-between font-bold text-emerald-800">
                                      <span>भुक्तानी भौचर:</span>
                                      <span className="font-mono bg-card px-1.5 py-0.2 rounded border border-emerald-500/30">
                                        {box.voucherRefs.join(", ") || "P-भौचर"}
                                      </span>
                                    </div>
                                    {box.paymentDates[0] && (
                                      <div className="flex items-center justify-between text-emerald-700">
                                        <span>भुक्तानी मिति:</span>
                                        <span className="font-mono">{box.paymentDates[0]}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1 text-[9px] text-emerald-700 font-semibold pt-0.5">
                                      <Lock className="size-2.5 text-emerald-600" />
                                      <span>यो पेरोल स्थिर (Fixed & Locked) छ</span>
                                    </div>
                                  </div>
                                )}

                                {/* Booked Details Stamp */}
                                {isBooked && !isPaid && (
                                  <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-[10px] space-y-0.5">
                                    <div className="flex items-center gap-1 font-bold text-amber-800">
                                      <Lock className="size-3 text-amber-600" />
                                      <span>पेरोल बुक भएको छ (हिसाब लक)</span>
                                    </div>
                                    <div className="text-[10px] text-amber-700">
                                      भुक्तानी गर्नका लागि 'भुक्तानी गर्नुहोस्' बटन थिच्नुहोस्।
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="py-6 text-center text-muted-foreground text-xs space-y-1">
                                <Clock className="size-5 mx-auto text-muted-foreground/40" />
                                <div className="font-medium">यस महिनाको पेरोल सुरु भएको छैन</div>
                                <div className="text-[10px] text-muted-foreground/80">कर्मचारीहरूको तलब तयार गर्न सिट खोल्नुहोस्</div>
                              </div>
                            )}
                          </div>

                          {/* Box Footer Action Button */}
                          <div className="p-3 border-t bg-muted/20">
                            {isPaid ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenMonthSheet(box.year, box.monthIndex)}
                                className="w-full h-8 text-xs font-bold text-emerald-700 border-emerald-500/30 hover:bg-emerald-50"
                              >
                                <CheckCircle2 className="mr-1.5 size-3.5 text-emerald-600" />
                                <span>स्लिप तथा सिट हेर्नुहोस्</span>
                              </Button>
                            ) : isBooked ? (
                              <Button
                                size="sm"
                                onClick={() => handleOpenMonthSheet(box.year, box.monthIndex)}
                                className="w-full h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                              >
                                <CreditCard className="mr-1.5 size-3.5" />
                                <span>भुक्तानी गर्नुहोस् (Pay All)</span>
                              </Button>
                            ) : isDraft ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenMonthSheet(box.year, box.monthIndex)}
                                className="w-full h-8 text-xs font-bold text-sky-700 border-sky-500/30 hover:bg-sky-50"
                              >
                                <Edit2 className="mr-1.5 size-3.5 text-sky-600" />
                                <span>सिट सम्पादन / बुक गर्नुहोस्</span>
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenMonthSheet(box.year, box.monthIndex)}
                                className="w-full h-8 text-xs font-semibold hover:bg-primary/5 hover:text-primary"
                              >
                                <Plus className="mr-1.5 size-3.5" />
                                <span>पेरोल सिट सुरु गर्नुहोस्</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VIEW 2: DETAILED EMPLOYEE TABLE (Available via Toggle) */}
              {historyViewMode === "table" && (
                <div className="space-y-4">
                  {/* Summary Metric Ribbon */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-xl border bg-card p-3 shadow-xs">
                      <div className="text-muted-foreground text-[11px]">कुल रेकर्डहरू</div>
                      <div className="text-base font-extrabold text-foreground mt-0.5">
                        {filteredPayrollHistory.length} वटा
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {historyTotals.paidCount} जना भुक्तानी भइसकेको
                      </div>
                    </div>
                    <div className="rounded-xl border bg-card p-3 shadow-xs">
                      <div className="text-muted-foreground text-[11px]">कुल तलब आम्दानी (Gross)</div>
                      <div className="text-base font-extrabold text-foreground mt-0.5">
                        {money(historyTotals.gross)}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">सकल आम्दानी</div>
                    </div>
                    <div className="rounded-xl border bg-card p-3 shadow-xs">
                      <div className="text-rose-600 text-[11px] font-semibold">कुल कर कट्टी (TDS/SST)</div>
                      <div className="text-base font-extrabold text-rose-600 mt-0.5">
                        {money(historyTotals.tax)}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">राजस्व खातामा संचित</div>
                    </div>
                    <div className="rounded-xl border bg-card p-3 shadow-xs">
                      <div className="text-emerald-700 text-[11px] font-semibold">कुल खुद तलब (Net Pay)</div>
                      <div className="text-base font-extrabold text-emerald-700 mt-0.5">
                        {money(historyTotals.net)}
                      </div>
                      <div className="text-[10px] text-emerald-600 mt-0.5">कर्मचारीलाई जाने</div>
                    </div>
                  </div>

                  {/* History Table */}
                  <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
                    <table className="w-full text-left text-xs min-w-[950px]">
                      <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-3 py-3">सि.नं.</th>
                          <th className="px-3 py-3">महिना / साल</th>
                          <th className="px-3 py-3 min-w-[140px]">कर्मचारी (Designation)</th>
                          <th className="px-3 py-3 text-right">आधारभूत तलब</th>
                          <th className="px-3 py-3 text-right">भत्ताहरू</th>
                          <th className="px-3 py-3 text-right">कुल तलब (Gross)</th>
                          <th className="px-3 py-3 text-right">कर (TDS/SST)</th>
                          <th className="px-3 py-3 text-right">पेश्की कट्टी</th>
                          <th className="px-3 py-3 text-right font-extrabold text-foreground">खुद तलब (Net Pay)</th>
                          <th className="px-3 py-3 text-center">स्थिति</th>
                          <th className="px-3 py-3 text-center">भौचर / मिति</th>
                          <th className="no-print px-3 py-3 text-right">कार्य</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredPayrollHistory.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="py-10 text-center text-muted-foreground">
                              कुनै पेरोल इतिहास फेला परेन।
                            </td>
                          </tr>
                        ) : (
                          filteredPayrollHistory.map((row, idx) => (
                            <tr key={row.id || idx} className="hover:bg-muted/15 transition-colors">
                              <td className="px-3 py-2.5 font-mono">{idx + 1}</td>
                              <td className="px-3 py-2.5 font-bold">
                                {MONTHS[row.month] || row.month} {row.year}
                              </td>
                              <td className="px-3 py-2.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEmpLedger(row.employee_id)}
                                  className="font-bold text-foreground hover:text-primary hover:underline text-left flex items-center gap-1"
                                  title="यस कर्मचारीको लेजर हेर्नुहोस्"
                                >
                                  <span>{row.employee_name}</span>
                                  <BookOpen className="size-2.5 text-muted-foreground opacity-70" />
                                </button>
                                <div className="text-[10px] text-muted-foreground">{row.designation}</div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono">{money(row.basic_salary)}</td>
                              <td className="px-3 py-2.5 text-right text-emerald-700 font-mono">
                                {money((row.allowance || 0) + (row.other_allowance || 0))}
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold text-foreground font-mono">
                                {money(row.gross_salary)}
                              </td>
                              <td className="px-3 py-2.5 text-right text-rose-600 font-mono">
                                - {money(row.tax)}
                              </td>
                              <td className="px-3 py-2.5 text-right text-rose-600 font-mono">
                                - {money(row.advance_adjusted)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-foreground">
                                {money(row.net_salary)}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    row.payment_status === "paid"
                                      ? "bg-emerald-500/15 text-emerald-700"
                                      : row.payment_status === "booked" || row.is_booked
                                        ? "bg-amber-500/15 text-amber-700"
                                        : "bg-sky-500/15 text-sky-700"
                                  }`}
                                >
                                  {row.payment_status === "paid"
                                    ? "भुक्तानी सम्पन्न"
                                    : row.payment_status === "booked" || row.is_booked
                                      ? "बुक गरिएको"
                                      : "ड्राफ्ट"}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono text-[11px]">
                                {row.voucher_ref ? (
                                  <div>
                                    <span className="font-bold text-foreground bg-muted px-1.5 py-0.5 rounded border">
                                      {row.voucher_ref}
                                    </span>
                                    {row.payment_date && (
                                      <div className="text-[10px] text-muted-foreground mt-0.5">{row.payment_date}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="no-print px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => setSlipModalRecord(row)}
                                    title="तलब भरपाई स्लिप हेर्नुहोस्"
                                  >
                                    <FileText className="mr-1 size-3 text-muted-foreground" />
                                    <span>स्लिप</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-1.5 text-[11px] text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => handleOpenEmpLedger(row.employee_id)}
                                    title="यस कर्मचारीको लेजर हेर्नुहोस्"
                                  >
                                    <BookOpen className="size-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SUB-TAB 3: Individual Employee Ledger */}
          {/* ───────────────────────────────────────────────────────────── */}
          {payrollSubTab === "ledger" && (
            <div className="space-y-5">
              {/* Employee Selector Bar */}
              <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground font-semibold">कर्मचारी छान्नुहोस् (Select Employee)</Label>
                    <select
                      value={currentLedgerEmp?.id || ""}
                      onChange={(e) => setSelectedLedgerEmpId(e.target.value)}
                      className="mt-1 h-9 rounded-md border bg-background px-3 text-xs font-bold min-w-[220px]"
                    >
                      {empList.map((em) => (
                        <option key={em.id} value={em.id}>
                          {em.name} ({em.designation})
                        </option>
                      ))}
                    </select>
                  </div>
                  {currentLedgerEmp && (
                    <div className="pt-5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          currentLedgerEmp.status === "active"
                            ? "bg-emerald-500/10 text-emerald-700"
                            : currentLedgerEmp.status === "on_leave"
                              ? "bg-amber-500/10 text-amber-700"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {currentLedgerEmp.status === "active"
                          ? "सक्रिय कर्मचारी"
                          : currentLedgerEmp.status === "on_leave"
                            ? "बिदामा"
                            : "निष्कृय"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="text-xs font-semibold"
                  >
                    <Printer className="mr-1.5 size-3.5" />
                    <span>लेजर प्रिन्ट गर्नुहोस्</span>
                  </Button>
                </div>
              </div>

              {currentLedgerEmp ? (
                <>
                  {/* Printable Header for Statement */}
                  <div className="hidden print:block mb-4 text-center">
                    <h2 className="text-xl font-extrabold">हामी युवा क्लब - व्यक्तिगत कर्मचारी खाता / लेजर</h2>
                    <p className="text-xs">वीरेन्द्रनगर, सुर्खेत | फोहोरमैला व्यवस्थापन</p>
                    <p className="text-sm font-bold mt-1">
                      कर्मचारी: {currentLedgerEmp.name} ({currentLedgerEmp.designation}) | जारी मिति: {np(todayBS())}
                    </p>
                  </div>

                  {/* Dr/Cr Ledger */}
                  {(() => {
                    const totalDr = empLedgerRows.reduce((s, r) => s + r.dr, 0);
                    const totalCr = empLedgerRows.reduce((s, r) => s + r.cr, 0);
                    const closing = empLedgerRows[empLedgerRows.length - 1];
                    const lastEntry = [...empLedgerRows]
                      .reverse()
                      .find((r) => r.source !== "opening");
                    return (
                      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
                        <div className="px-4 py-3 border-b bg-muted/40 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold flex items-center gap-2">
                            <BookOpen className="size-3.5 text-primary" />
                            कर्मचारी लेजर (Dr/Cr Ledger) — कर्मचारी खाता क्रेडिट (Credit) मा रहन्छ
                          </span>
                          {lastEntry && (
                            <span className="text-[11px] text-muted-foreground">
                              वर्तमान शेष:{" "}
                              <span
                                className={`font-extrabold ${
                                  lastEntry.runType === "cr" ? "text-blue-700" : "text-rose-600"
                                }`}
                              >
                                {money(lastEntry.running)} {lastEntry.runType.toUpperCase()}
                              </span>
                            </span>
                          )}
                        </div>
                        <table className="w-full text-left text-xs min-w-[720px]">
                          <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2.5">मिति</th>
                              <th className="px-3 py-2.5">विवरण (Particulars)</th>
                              <th className="px-3 py-2.5">सन्दर्भ</th>
                              <th className="px-3 py-2.5 text-right text-rose-600">Dr (नाघ्ने)</th>
                              <th className="px-3 py-2.5 text-right text-blue-700">Cr (चढ्ने)</th>
                              <th className="px-3 py-2.5 text-right">शेष (Balance)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {empLedgerRows.length <= 1 && (
                              <tr>
                                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                                  कुनै लेजर प्रविष्टि छैन — तलब बुक गर्दा वा पेश्की दिँदा यहाँ
                                  देखिन्छ।
                                </td>
                              </tr>
                            )}
                            {empLedgerRows.map((row) => (
                              <tr
                                key={row.id}
                                className={
                                  row.source === "opening"
                                    ? "bg-muted/30 font-semibold"
                                    : row.source === "salary_booked"
                                      ? "hover:bg-blue-500/5"
                                      : "hover:bg-muted/15"
                                }
                              >
                                <td className="px-3 py-2.5 font-mono text-[11px] whitespace-nowrap">
                                  {np(row.date_bs)}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span
                                    className={
                                      row.source === "salary_paid" || row.source === "advance"
                                        ? "text-rose-700"
                                        : row.source === "salary_booked"
                                          ? "text-blue-700 font-semibold"
                                          : "text-foreground"
                                    }
                                  >
                                    {row.particulars}
                                  </span>
                                  {row.source === "opening" && (
                                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                                      ({row.runType.toUpperCase()})
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  {row.ref ? (
                                    <span className="font-mono font-bold text-[10px] bg-muted px-1.5 py-0.5 rounded border">
                                      {row.ref}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono text-rose-600 font-semibold">
                                  {row.dr > 0 ? money(row.dr) : ""}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono text-blue-700 font-semibold">
                                  {row.cr > 0 ? money(row.cr) : ""}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap">
                                  {money(row.running)}{" "}
                                  <span
                                    className={`text-[10px] font-extrabold ${
                                      row.runType === "cr" ? "text-blue-700" : "text-rose-600"
                                    }`}
                                  >
                                    {row.runType.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t-2 bg-muted/60 font-bold text-xs">
                            <tr>
                              <td colSpan={3} className="px-3 py-2.5">
                                जम्मा (Total)
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-rose-600">
                                {money(totalDr)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-blue-700">
                                {money(totalCr)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                                {money(closing?.running ?? 0)}{" "}
                                <span
                                  className={`text-[10px] font-extrabold ${
                                    closing?.runType === "cr" ? "text-blue-700" : "text-rose-600"
                                  }`}
                                >
                                  {(closing?.runType ?? "cr").toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })()}

                  {/* Profile & Salary Configuration Card */}
                  <div className="rounded-xl border bg-card p-4 shadow-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <div className="text-muted-foreground text-[11px]">कर्मचारीको नाम</div>
                        <div className="font-bold text-foreground text-sm">{currentLedgerEmp.name}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[11px]">पद (Designation)</div>
                        <div className="font-semibold">{currentLedgerEmp.designation}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[11px]">फोन / प्यान</div>
                        <div className="font-mono">{currentLedgerEmp.phone || "—"} {currentLedgerEmp.pan ? `| PAN: ${currentLedgerEmp.pan}` : ""}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[11px]">नियुक्ति मिति</div>
                        <div className="font-medium">{np(currentLedgerEmp.joining_date || "—")}</div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-muted/20 -mx-4 -mb-4 p-4 rounded-b-xl">
                      <div>
                        <div className="text-muted-foreground text-[11px]">आधारभूत तलब (Basic)</div>
                        <div className="font-bold text-foreground">{money(currentLedgerEmp.basic_salary)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[11px]">भत्ता आधार तथा दर</div>
                        <div className="font-semibold">
                          {currentLedgerEmp.allowance_type === "day" && `दैनिक रु. ${currentLedgerEmp.allowance_rate}`}
                          {currentLedgerEmp.allowance_type === "trip" && `प्रति ट्रिप रु. ${currentLedgerEmp.allowance_rate}`}
                          {currentLedgerEmp.allowance_type === "fixed" && `मासिक एकमुष्ट रु. ${currentLedgerEmp.allowance_rate}`}
                          {(!currentLedgerEmp.allowance_type || currentLedgerEmp.allowance_type === "none") && "भत्ता छैन"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[11px]">अन्य भत्ता (Other Allowance)</div>
                        <div className="font-bold text-emerald-700">{money(currentLedgerEmp.other_allowance || 0)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[11px]">उमेर / योग्यता</div>
                        <div>{np(currentLedgerEmp.age || "—")} वर्ष {currentLedgerEmp.qualification ? `| ${currentLedgerEmp.qualification}` : ""}</div>
                      </div>
                    </div>
                  </div>

                  {/* Accounting Flow + KPI Cards + Advances + Detail Table */}
                  {(() => {
                    // Advances only — salary-payment vouchers are excluded
                    const empAdvanceTxns = empAdvanceOnlyTxns;
                    const totalAdvanceFromRP = empAdvanceTxns.reduce(
                      (sum, t) => sum + (Number(t.amount) || 0), 0,
                    );
                    const totalAdvanceInPayroll = currentEmpLedgerSummary.totalAdvance;
                    const netPayable = currentEmpLedgerSummary.totalGross - currentEmpLedgerSummary.totalTax;
                    const outstandingAdvance = Math.max(0, totalAdvanceFromRP - totalAdvanceInPayroll);
                    return (
                      <div className="space-y-4">
                        {/* Accounting flow strip */}
                        <div className="rounded-xl border bg-card p-4 shadow-xs overflow-x-auto">
                          <div className="text-[11px] font-bold text-muted-foreground mb-3 uppercase tracking-wide">
                            हिसाबको प्रवाह (Accounting Flow)
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <div className="flex flex-col items-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                              <span className="text-[10px] text-emerald-700 font-semibold">कुल तलब (Gross)</span>
                              <span className="text-base font-extrabold text-emerald-700">{money(currentEmpLedgerSummary.totalGross)}</span>
                              <span className="text-[9px] text-muted-foreground">{currentEmpPayrolls.length} महिना</span>
                            </div>
                            <span className="text-muted-foreground font-bold text-lg">−</span>
                            <div className="flex flex-col items-center rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2">
                              <span className="text-[10px] text-rose-600 font-semibold">TDS / SST कर</span>
                              <span className="text-base font-extrabold text-rose-600">{money(currentEmpLedgerSummary.totalTax)}</span>
                            </div>
                            <span className="text-muted-foreground font-bold text-lg">=</span>
                            <div className="flex flex-col items-center rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2">
                              <span className="text-[10px] text-blue-700 font-semibold">खुद भुक्तान योग्य</span>
                              <span className="text-base font-extrabold text-blue-700">{money(netPayable)}</span>
                            </div>
                            <span className="text-muted-foreground font-bold text-lg">−</span>
                            <div className="flex flex-col items-center rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2">
                              <span className="text-[10px] text-orange-700 font-semibold">पेश्की कट्टी</span>
                              <span className="text-base font-extrabold text-orange-700">{money(totalAdvanceInPayroll)}</span>
                            </div>
                            <span className="text-muted-foreground font-bold text-lg">=</span>
                            <div className="flex flex-col items-center rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
                              <span className="text-[10px] text-primary font-semibold">हातमा पाउने (Net)</span>
                              <span className="text-base font-extrabold text-primary">{money(currentEmpLedgerSummary.totalNetEarned)}</span>
                            </div>
                          </div>
                        </div>

                        {/* KPI cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="rounded-xl border bg-emerald-500/10 border-emerald-500/20 p-3.5 shadow-xs">
                            <div className="text-[11px] text-emerald-700 font-semibold">भुक्तानी भइसकेको (Paid)</div>
                            <div className="text-lg font-extrabold text-emerald-700 mt-1">{money(currentEmpLedgerSummary.totalPaid)}</div>
                            <div className="text-[10px] text-emerald-600 font-bold mt-0.5">भौचर जारी भएको</div>
                          </div>
                          <div className="rounded-xl border bg-amber-500/10 border-amber-500/20 p-3.5 shadow-xs">
                            <div className="text-[11px] text-amber-800 font-semibold">बाँकी भुक्तानी (Pending)</div>
                            <div className="text-lg font-extrabold text-amber-700 mt-1">{money(currentEmpLedgerSummary.totalPending)}</div>
                            <div className="text-[10px] text-amber-700 mt-0.5">
                              {currentEmpPayrolls.filter((r) => r.payment_status !== "paid").length} महिना बाँकी
                            </div>
                          </div>
                          <div className="rounded-xl border bg-orange-500/10 border-orange-500/20 p-3.5 shadow-xs">
                            <div className="text-[11px] text-orange-700 font-semibold">पेश्की दिइएको (Advance Paid)</div>
                            <div className="text-lg font-extrabold text-orange-700 mt-1">{money(totalAdvanceFromRP)}</div>
                            <div className="text-[10px] text-orange-600 mt-0.5">{empAdvanceTxns.length} पटक</div>
                          </div>
                          <div className={`rounded-xl border p-3.5 shadow-xs ${outstandingAdvance > 0 ? "bg-red-500/10 border-red-500/20" : "bg-muted/30 border-muted"}`}>
                            <div className={`text-[11px] font-semibold ${outstandingAdvance > 0 ? "text-red-700" : "text-muted-foreground"}`}>
                              अनसमायोजित पेश्की
                            </div>
                            <div className={`text-lg font-extrabold mt-1 ${outstandingAdvance > 0 ? "text-red-700" : "text-muted-foreground"}`}>
                              {money(outstandingAdvance)}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">तलबबाट काट्न बाँकी</div>
                          </div>
                        </div>

                        {/* Advance payments from RP module */}
                        {empAdvanceTxns.length > 0 && (
                          <div className="rounded-xl border bg-orange-500/5 shadow-xs overflow-hidden">
                            <div className="px-4 py-3 border-b bg-orange-500/10 flex items-center gap-2">
                              <DollarSign className="size-3.5 text-orange-600" />
                              <span className="text-xs font-bold text-orange-800">
                                पेश्की भुक्तानी विवरण — प्राप्ति/भुक्तानी मड्युलबाट (Advance from Receipts & Payments)
                              </span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs min-w-[500px]">
                                <thead className="border-b bg-muted/30">
                                  <tr>
                                    <th className="px-3 py-2 text-left">मिति</th>
                                    <th className="px-3 py-2 text-left">भौचर नं.</th>
                                    <th className="px-3 py-2 text-left">विवरण</th>
                                    <th className="px-3 py-2 text-right text-orange-700 font-bold">पेश्की रकम</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {empAdvanceTxns.map((t, i) => (
                                    <tr key={t.id || i} className="hover:bg-orange-500/5">
                                      <td className="px-3 py-2 font-mono text-[11px]">{t.txn_date}</td>
                                      <td className="px-3 py-2">
                                        <span className="font-mono font-bold text-[11px] text-foreground bg-muted px-1.5 py-0.5 rounded border">{t.ref_no}</span>
                                      </td>
                                      <td className="px-3 py-2 text-muted-foreground">{t.remarks || "पेश्की भुक्तानी"}</td>
                                      <td className="px-3 py-2 text-right font-bold font-mono text-orange-700">{money(t.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="border-t-2 bg-orange-500/10 font-bold">
                                  <tr>
                                    <td colSpan={3} className="px-3 py-2 text-orange-800">जम्मा पेश्की ({empAdvanceTxns.length} पटक)</td>
                                    <td className="px-3 py-2 text-right text-orange-700">{money(totalAdvanceFromRP)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Detailed Payroll Statement */}
                        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
                          <table className="w-full text-left text-xs min-w-[950px]">
                            <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
                              <tr>
                                <th className="px-3 py-3">सि.नं.</th>
                                <th className="px-3 py-3">महिना / साल</th>
                                <th className="px-3 py-3">विवरण</th>
                                <th className="px-3 py-3 text-right">आधारभूत</th>
                                <th className="px-3 py-3 text-right">भत्ताहरू</th>
                                <th className="px-3 py-3 text-right">Gross</th>
                                <th className="px-3 py-3 text-right text-rose-600">− TDS</th>
                                <th className="px-3 py-3 text-right text-blue-700">खुद भुक्तान योग्य</th>
                                <th className="px-3 py-3 text-right text-orange-600">− पेश्की</th>
                                <th className="px-3 py-3 text-right font-extrabold text-primary">हातमा पाउने</th>
                                <th className="px-3 py-3 text-center">स्थिति</th>
                                <th className="px-3 py-3 text-center">भौचर / मिति</th>
                                <th className="no-print px-3 py-3 text-right">स्लिप</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {currentEmpPayrolls.length === 0 ? (
                                <tr>
                                  <td colSpan={13} className="py-10 text-center text-muted-foreground">
                                    यस कर्मचारीको कुनै पेरोल रेकर्ड फेला परेन।
                                  </td>
                                </tr>
                              ) : (
                                currentEmpPayrolls.map((row, idx) => {
                                  const netPayableRow = (row.gross_salary || 0) - (row.tax || 0);
                                  return (
                                    <tr key={row.id || idx} className="hover:bg-muted/15 transition-colors">
                                      <td className="px-3 py-2.5 font-mono">{idx + 1}</td>
                                      <td className="px-3 py-2.5 font-bold">
                                        {MONTHS[row.month] || row.month} {row.year}
                                      </td>
                                      <td className="px-3 py-2.5 text-muted-foreground">
                                        उपस्थित: {row.days_worked}d | ट्रिप: {row.trips}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono">{money(row.basic_salary)}</td>
                                      <td className="px-3 py-2.5 text-right text-emerald-700 font-mono">
                                        {money((row.allowance || 0) + (row.other_allowance || 0))}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-bold text-foreground font-mono">
                                        {money(row.gross_salary)}
                                      </td>
                                      <td className="px-3 py-2.5 text-right text-rose-600 font-mono">
                                        − {money(row.tax || 0)}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-bold text-blue-700 font-mono">
                                        {money(netPayableRow)}
                                      </td>
                                      <td className="px-3 py-2.5 text-right text-orange-600 font-mono">
                                        − {money(row.advance_adjusted || 0)}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono font-extrabold text-primary">
                                        {money(row.net_salary)}
                                      </td>
                                      <td className="px-3 py-2.5 text-center">
                                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                          row.payment_status === "paid"
                                            ? "bg-emerald-500/15 text-emerald-700"
                                            : row.payment_status === "booked" || row.is_booked
                                              ? "bg-amber-500/15 text-amber-700"
                                              : "bg-sky-500/15 text-sky-700"
                                        }`}>
                                          {row.payment_status === "paid" ? "भुक्तानी भयो"
                                            : row.payment_status === "booked" || row.is_booked ? "बुक गरिएको"
                                            : "ड्राफ्ट"}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-center font-mono text-[11px]">
                                        {row.voucher_ref ? (
                                          <div>
                                            <span className="font-bold text-foreground bg-muted px-1.5 py-0.5 rounded border">
                                              {row.voucher_ref}
                                            </span>
                                            {row.payment_date && (
                                              <div className="text-[10px] text-muted-foreground mt-0.5">{row.payment_date}</div>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </td>
                                      <td className="no-print px-3 py-2.5 text-right">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 px-2 text-[11px]"
                                          onClick={() => setSlipModalRecord(row)}
                                        >
                                          <FileText className="mr-1 size-3 text-muted-foreground" />
                                          <span>स्लिप</span>
                                        </Button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                            {currentEmpPayrolls.length > 0 && (
                              <tfoot className="border-t-2 bg-muted/60 font-bold text-xs">
                                <tr>
                                  <td colSpan={3} className="px-3 py-3">कुल ({currentEmpPayrolls.length} महिना)</td>
                                  <td className="px-3 py-3 text-right">
                                    {money(currentEmpPayrolls.reduce((s, r) => s + (r.basic_salary || 0), 0))}
                                  </td>
                                  <td className="px-3 py-3 text-right text-emerald-700">
                                    {money(currentEmpPayrolls.reduce((s, r) => s + (r.allowance || 0) + (r.other_allowance || 0), 0))}
                                  </td>
                                  <td className="px-3 py-3 text-right">{money(currentEmpLedgerSummary.totalGross)}</td>
                                  <td className="px-3 py-3 text-right text-rose-600">− {money(currentEmpLedgerSummary.totalTax)}</td>
                                  <td className="px-3 py-3 text-right text-blue-700">{money(netPayable)}</td>
                                  <td className="px-3 py-3 text-right text-orange-600">− {money(currentEmpLedgerSummary.totalAdvance)}</td>
                                  <td className="px-3 py-3 text-right text-primary text-sm font-extrabold">
                                    {money(currentEmpLedgerSummary.totalNetEarned)}
                                  </td>
                                  <td colSpan={3} className="px-3 py-3 text-center text-muted-foreground text-[11px]">
                                    भुक्तानी: {money(currentEmpLedgerSummary.totalPaid)} | बाँकी: {money(currentEmpLedgerSummary.totalPending)}
                                  </td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Printable Signature Lines */}
                  <div className="hidden print:flex mt-12 justify-between text-xs pt-4 border-t">
                    <div className="text-center">
                      <div className="h-10 border-b border-foreground/40 w-36" />
                      <div className="pt-1">कर्मचारीको दस्तखत</div>
                    </div>
                    <div className="text-center">
                      <div className="h-10 border-b border-foreground/40 w-36" />
                      <div className="pt-1">लेखापाल / प्रबन्धक</div>
                    </div>
                    <div className="text-center">
                      <div className="h-10 border-b border-foreground/40 w-36" />
                      <div className="pt-1">अध्यक्ष / कोषाध्यक्ष</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
                  कुनै कर्मचारी उपलब्ध छैन।
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* MEMBER MODAL (Add / Edit) */}
      {/* ========================================================================= */}
      {memberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-extrabold text-foreground">
                {editingMember ? "सदस्य विवरण सम्पादन" : "नयाँ सदस्य दर्ता"}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setMemberModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveMember} className="mt-4 space-y-3.5 text-xs">
              <div>
                <Label className="text-xs font-semibold">पद (Designation) *</Label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={memberForm.designation}
                    onChange={(e) => setMemberForm({ ...memberForm, designation: e.target.value })}
                    className="h-9 w-full rounded-md border bg-background px-3 text-xs"
                  >
                    <option value="अध्यक्ष">अध्यक्ष (President)</option>
                    <option value="उपाध्यक्ष">उपाध्यक्ष (Vice President)</option>
                    <option value="सचिव">सचिव (Secretary)</option>
                    <option value="सह-सचिव">सह-सचिव (Joint Secretary)</option>
                    <option value="कोषाध्यक्ष">कोषाध्यक्ष (Treasurer)</option>
                    <option value="सदस्य">सदस्य (Member)</option>
                    <option value="आजीवन सदस्य">आजीवन सदस्य (Life Member)</option>
                    <option value="साधारण सदस्य">साधारण सदस्य (General Member)</option>
                    <option value="सल्लाहकार">सल्लाहकार (Advisor)</option>
                    <option value="अन्य">अन्य (Other)</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">पूरा नाम (Full Name) *</Label>
                <Input
                  required
                  placeholder="उदा: नवीन गिरी"
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">पेशा (Occupation)</Label>
                  <Input
                    placeholder="उदा: व्यवसाय / शिक्षण"
                    value={memberForm.occupation || ""}
                    onChange={(e) => setMemberForm({ ...memberForm, occupation: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">जन्म मिति (DOB - BS)</Label>
                  <Input
                    placeholder="२०४५-०५-१४"
                    value={memberForm.dob || ""}
                    onChange={(e) => setMemberForm({ ...memberForm, dob: e.target.value })}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">सदस्यता शुल्क (Fee - रु.)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="1000"
                    value={memberForm.membership_fee ?? 1000}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, membership_fee: Number(e.target.value) || 0 })
                    }
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">सम्पर्क नम्बर (Phone)</Label>
                  <Input
                    placeholder="९८४८..."
                    value={memberForm.phone || ""}
                    onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">ठेगाना (Address)</Label>
                <Input
                  placeholder="वीरेन्द्रनगर-४, सुर्खेत"
                  value={memberForm.address || ""}
                  onChange={(e) => setMemberForm({ ...memberForm, address: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">सदस्य स्थिति (Status)</Label>
                <select
                  value={memberForm.status}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, status: e.target.value as "active" | "inactive" })
                  }
                  className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs"
                >
                  <option value="active">सक्रिय (Active)</option>
                  <option value="inactive">निष्कृय (Inactive / Former)</option>
                </select>
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMemberModalOpen(false)}
                >
                  रद्द गर्नुहोस्
                </Button>
                <Button type="submit" size="sm" className="font-bold">
                  {editingMember ? "सुरक्षित गर्नुहोस्" : "दर्ता गर्नुहोस्"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EMPLOYEE MODAL (Add / Edit) */}
      {/* ========================================================================= */}
      {empModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-extrabold text-foreground">
                {editingEmp ? "कर्मचारी विवरण सम्पादन" : "नयाँ कर्मचारी दर्ता"}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setEmpModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveEmp} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">कर्मचारीको नाम *</Label>
                  <Input
                    required
                    placeholder="दिपक गुरुङ"
                    value={empForm.name}
                    onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">पद (Designation) *</Label>
                  <Input
                    required
                    placeholder="सवारी चालक / संकलक / सुपरभाइजर"
                    value={empForm.designation}
                    onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">उमेर (Age in years) *</Label>
                  <Input
                    type="number"
                    min="16"
                    max="80"
                    placeholder="28"
                    value={empForm.age || ""}
                    onChange={(e) => setEmpForm({ ...empForm, age: Number(e.target.value) || 0 })}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">शैक्षिक योग्यता (Qualification)</Label>
                  <Input
                    placeholder="साक्षर / SEE / +२"
                    value={empForm.qualification || ""}
                    onChange={(e) => setEmpForm({ ...empForm, qualification: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="font-bold text-foreground">पारिश्रमिक तथा भत्ता कन्फिगरेसन</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label className="text-xs font-semibold">आधारभूत तलब (Basic - रु.) *</Label>
                    <Input
                      type="number"
                      required
                      min="0"
                      step="500"
                      placeholder="18000"
                      value={empForm.basic_salary}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, basic_salary: Number(e.target.value) || 0 })
                      }
                      className="mt-1 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">भत्ता आधार (Allowance Basis)</Label>
                    <select
                      value={empForm.allowance_type}
                      onChange={(e) =>
                        setEmpForm({
                          ...empForm,
                          allowance_type: e.target.value as "day" | "trip" | "fixed" | "none",
                        })
                      }
                      className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs"
                    >
                      <option value="day">दैनिक भत्ता (Per Day)</option>
                      <option value="trip">प्रति ट्रिप भत्ता (Per Trip)</option>
                      <option value="fixed">मासिक एकमुष्ट (Fixed Monthly)</option>
                      <option value="none">भत्ता छैन (None)</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">भत्ता दर (Rate - रु.)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="250"
                      value={empForm.allowance_rate || ""}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, allowance_rate: Number(e.target.value) || 0 })
                      }
                      className="mt-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">अन्य भत्ता (Other Allowance - रु.)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={empForm.other_allowance || ""}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, other_allowance: Number(e.target.value) || 0 })
                      }
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">सम्पर्क फोन नम्बर</Label>
                  <Input
                    placeholder="९८४८..."
                    value={empForm.phone || ""}
                    onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">प्यान नम्बर (PAN)</Label>
                  <Input
                    placeholder="६००..."
                    value={empForm.pan || ""}
                    onChange={(e) => setEmpForm({ ...empForm, pan: e.target.value })}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">नियुक्ति मिति (Joining Date BS)</Label>
                  <Input
                    placeholder="२०८०-०४-०१"
                    value={empForm.joining_date || ""}
                    onChange={(e) => setEmpForm({ ...empForm, joining_date: e.target.value })}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">स्थिति (Status)</Label>
                  <select
                    value={empForm.status}
                    onChange={(e) =>
                      setEmpForm({
                        ...empForm,
                        status: e.target.value as "active" | "inactive" | "on_leave",
                      })
                    }
                    className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs"
                  >
                    <option value="active">सक्रिय (Active)</option>
                    <option value="on_leave">बिदामा (On Leave)</option>
                    <option value="inactive">निष्कृय (Inactive / Resigned)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">
                    प्रारम्भिक शेष (Opening Balance - रु.)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={empForm.opening_balance ?? 0}
                    onChange={(e) =>
                      setEmpForm({
                        ...empForm,
                        opening_balance: Number(e.target.value) || 0,
                      })
                    }
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">शेषको प्रकार (Balance Type)</Label>
                  <select
                    value={empForm.balance_type ?? "cr"}
                    onChange={(e) =>
                      setEmpForm({
                        ...empForm,
                        balance_type: e.target.value as "dr" | "cr",
                      })
                    }
                    className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs"
                  >
                    <option value="cr">Cr (दिनु पर्ने / कर्मचारीको खाता)</option>
                    <option value="dr">Dr (पाउनु पर्ने)</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEmpModalOpen(false)}
                >
                  रद्द गर्नुहोस्
                </Button>
                <Button type="submit" size="sm" className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                  {editingEmp ? "सुरक्षित गर्नुहोस्" : "कर्मचारी दर्ता गर्नुहोस्"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAY SLIP PRINT MODAL */}
      {/* ========================================================================= */}
      {slipModalRecord && (
        <PaySlipVoucher
          record={slipModalRecord}
          employee={empList.find((e) => e.id === slipModalRecord.employee_id)}
          onClose={() => setSlipModalRecord(null)}
        />
      )}

      {/* ========================================================================= */}
      {/* PAYMENT VOUCHER CREATION MODAL (Paid One / Paid All) */}
      {/* ========================================================================= */}
      {payModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border bg-card p-5 shadow-2xl text-foreground">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="font-bold text-sm flex items-center gap-2">
                <CreditCard className="size-4 text-emerald-600" />
                <span>
                  {payModal.isAll
                    ? "सबै कर्मचारीहरूको तलब भुक्तानी (Pay All)"
                    : `${payModal.target?.employee_name} - तलब भुक्तानी`}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPayModal((p) => ({ ...p, open: false }))}
                className="size-7"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                <div className="text-muted-foreground text-[11px]">
                  कुल भुक्तानी हुने खुद रकम (Total Net Pay)
                </div>
                <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
                  {money(
                    payModal.isAll
                      ? payrollRows
                          .filter((r) => r.payment_status !== "paid" && r.net_salary > 0)
                          .reduce((sum, r) => sum + r.net_salary, 0)
                      : payModal.target?.net_salary || 0,
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {payModal.isAll
                    ? `बाँकी रहेका ${
                        payrollRows.filter((r) => r.payment_status !== "paid" && r.net_salary > 0)
                          .length
                      } जना कर्मचारीहरूको लागि अलग-अलग भुक्तानी भौचर (P-XXXX) बन्नेछ।`
                    : `${MONTHS[payrollMonth]} ${payrollYear} को तलब भुक्तानी भौचर सिर्जना हुनेछ र रेकर्ड सुरक्षित रूपमा लक हुनेछ।`}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">भुक्तानी गरिने खाता (Cash/Bank Account) *</Label>
                <select
                  value={payModal.account_id}
                  onChange={(e) => setPayModal((p) => ({ ...p, account_id: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs font-semibold"
                >
                  <option value="">खाता छान्नुहोस्…</option>
                  {accountsList.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.account_type === "cash" ? "नगद खाता" : "बैंक खाता"})
                    </option>
                  ))}
                </select>
                {accountsList.length === 0 && (
                  <p className="mt-1 text-[11px] text-rose-600">
                    खाता फेला परेन। कृपया पहिले 'नगद/बैंक' खण्डमा खाता थप्नुहोस्।
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">भुक्तानी मिति (Date BS) *</Label>
                  <Input
                    value={payModal.payment_date}
                    onChange={(e) => setPayModal((p) => ({ ...p, payment_date: e.target.value }))}
                    placeholder="२०८१/०१/०१"
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">भुक्तानी माध्यम (Mode)</Label>
                  <select
                    value={payModal.payment_mode}
                    onChange={(e) =>
                      setPayModal((p) => ({
                        ...p,
                        payment_mode: e.target.value as "cash" | "bank" | "esewa" | "cheque",
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs"
                  >
                    <option value="cash">नगद (Cash)</option>
                    <option value="bank">बैंक ट्रान्सफर (Bank)</option>
                    <option value="esewa">ईसेवा / वालेट</option>
                    <option value="cheque">चेक (Cheque)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPayModal((p) => ({ ...p, open: false }))}
                className="text-xs"
              >
                रद्द गर्नुहोस्
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmPayment}
                disabled={isProcessingPayment || !payModal.account_id}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                {isProcessingPayment ? "भुक्तानी हुँदैछ…" : "भुक्तानी पुष्टि गर्नुहोस्"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
