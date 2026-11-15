import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useWorkspace, WorkspacePage, money, EmptyRows } from "@/components/workspace";
import { useAppConfig } from "@/lib/app-config";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  getMembersData,
  getEventsData,
  getTheliData,
  getTheliStockData,
  getExpensesData,
} from "@/lib/workspace.functions";
import {
  np,
  en,
  fiscalLabel,
  fiscalYearRange,
  dateInFiscalYear,
  todayBS,
  MONTHS,
  MODES,
  indexPaidReceiptsByCustomer,
  remainingDuesForPerson,
  getCustomerTotalRate,
  type Person,
  type Receipt,
  type Member,
  type Employee,
  type ClubEvent,
  type TheliLog,
  type TheliStockItem,
} from "@/lib/receipt-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Users,
  Calendar,
  Receipt as ReceiptIcon,
  FileText,
  Printer,
  Download,
  Search,
  Filter,
  Wallet,
  TrendingUp,
  Award,
  Layers,
  Phone,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Truck,
  UserCheck,
  Building,
} from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "वडा तथा पालिका आधिकारिक प्रतिवेदन — Institutional & Municipal Reporting" },
      {
        name: "description",
        content:
          "वडा कार्यालय, नगरपालिका तथा सरोकारवालाहरूका लागि आर्थिक वर्ष अनुसार संस्थागत प्रगति, राजस्व असुली र बक्यौता प्रतिवेदन।",
      },
      { property: "og:title", content: "वडा तथा पालिका आधिकारिक प्रतिवेदन" },
    ],
  }),
  component: InstitutionalReportsPage,
});

function InstitutionalReportsPage() {
  const { query, ward, year: workspaceYear, userId, signedIn } = useWorkspace();
  const globalConfig = useAppConfig();

  // Organization identity
  const orgName = globalConfig.entity_name?.trim() || "हामी युवा क्लब (Hamiyuwa Club)";
  const orgSubName =
    globalConfig.entity_sub_name?.trim() || "फोहोरमैला व्यवस्थापन तथा वातावरण संरक्षण समिति";
  const orgAddress = globalConfig.address?.trim() || "वीरेन्द्रनगर, सुर्खेत, कर्णाली प्रदेश";
  const orgPan = globalConfig.pan_vat?.trim() || "";
  const orgPhone = globalConfig.phone?.trim() || "";
  const orgEmail = globalConfig.email?.trim() || "";

  // Active filters
  const [selectedYear, setSelectedYear] = useState<number>(() => workspaceYear || 2081);
  const [selectedWard, setSelectedWard] = useState<string>(() => ward || "");
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerStatusFilter, setCustomerStatusFilter] = useState<"all" | "due" | "clear">("all");
  const [activeTab, setActiveTab] = useState("executive");

  // Server queries
  const fetchMembersFn = useServerFn(getMembersData);
  const membersQuery = useQuery({
    queryKey: ["reports_members", userId],
    queryFn: () => fetchMembersFn(),
    enabled: Boolean(signedIn && userId),
  });

  const fetchEventsFn = useServerFn(getEventsData);
  const eventsQuery = useQuery({
    queryKey: ["reports_events", userId],
    queryFn: () => fetchEventsFn(),
    enabled: Boolean(signedIn && userId),
  });

  const fetchTheliFn = useServerFn(getTheliData);
  const theliQuery = useQuery({
    queryKey: ["reports_theli", userId],
    queryFn: () => fetchTheliFn(),
    enabled: Boolean(signedIn && userId),
  });

  const fetchTheliStockFn = useServerFn(getTheliStockData);
  const theliStockQuery = useQuery({
    queryKey: ["reports_theli_stock", userId],
    queryFn: () => fetchTheliStockFn(),
    enabled: Boolean(signedIn && userId),
  });

  const fetchExpensesFn = useServerFn(getExpensesData);
  const expensesQuery = useQuery({
    queryKey: ["reports_expenses", userId],
    queryFn: () => fetchExpensesFn({ data: {} }),
    enabled: Boolean(signedIn && userId),
  });

  // Base raw data
  const allPeople: Person[] = useMemo(() => query.data?.people || [], [query.data?.people]);
  const allReceipts: Receipt[] = useMemo(() => query.data?.receipts || [], [query.data?.receipts]);
  const allPlans = useMemo(() => query.data?.plans || [], [query.data?.plans]);
  const membersList: Member[] = useMemo(
    () => membersQuery.data?.members || membersQuery.data?.bodMembers || [],
    [membersQuery.data],
  );
  const eventsList: ClubEvent[] = useMemo(
    () => eventsQuery.data?.events || [],
    [eventsQuery.data],
  );
  const theliLogs: TheliLog[] = useMemo(() => theliQuery.data?.logs || [], [theliQuery.data]);
  const theliStockItems: TheliStockItem[] = useMemo(
    () => theliStockQuery.data?.items || [],
    [theliStockQuery.data],
  );
  const employeesList: Employee[] = useMemo(
    () => membersQuery.data?.employees || theliQuery.data?.employees || [],
    [membersQuery.data, theliQuery.data],
  );

  // Available wards and municipalities
  const availableWards = useMemo(() => {
    const set = new Set<string>();
    allPeople.forEach((p) => {
      if (p.ward) set.add(p.ward);
    });
    allReceipts.forEach((r) => {
      if (r.ward) set.add(r.ward);
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [allPeople, allReceipts]);

  const availableMunicipalities = useMemo(() => {
    const set = new Set<string>();
    allPeople.forEach((p) => {
      if (p.municipality?.trim()) set.add(p.municipality.trim());
    });
    return Array.from(set).sort();
  }, [allPeople]);

  // Current BS date and Pre-indexed paid months
  const currentBS = useMemo(() => todayBS(), []);
  const paidIndex = useMemo(() => indexPaidReceiptsByCustomer(allReceipts), [allReceipts]);

  // Fiscal Year receipts (filtered by selected year, ward, and municipality)
  const fyReceipts = useMemo(() => {
    return allReceipts.filter((r) => {
      const isYearMatch =
        Number(r.year) === selectedYear || dateInFiscalYear(r.date, selectedYear);
      if (!isYearMatch) return false;
      if (selectedWard && r.ward !== selectedWard) return false;
      if (selectedMunicipality && r.municipality && r.municipality !== selectedMunicipality)
        return false;
      return true;
    });
  }, [allReceipts, selectedYear, selectedWard, selectedMunicipality]);

  // Cancelled vouchers count & calculation
  // Sources: theli_logs for this fiscal year, plus theliStockItems cancelled_count
  const fyTheliLogs = useMemo(() => {
    return theliLogs.filter((l) => {
      if (!l.log_date) return false;
      const isFy = dateInFiscalYear(l.log_date, selectedYear);
      if (!isFy) return false;
      if (selectedWard && l.ward && l.ward !== selectedWard) return false;
      return true;
    });
  }, [theliLogs, selectedYear, selectedWard]);

  const fyTheliStock = useMemo(() => {
    return theliStockItems.filter((s) => {
      if (s.fiscal_year && Number(s.fiscal_year) !== selectedYear) return false;
      return true;
    });
  }, [theliStockItems, selectedYear]);

  // Total cancelled rasids count
  const totalCancelledCount = useMemo(() => {
    const fromLogs = fyTheliLogs.reduce((sum, l) => sum + (Number(l.cancelled_count) || 0), 0);
    const fromStock = fyTheliStock.reduce((sum, s) => sum + (Number(s.cancelled_count) || 0), 0);
    return Math.max(fromLogs, fromStock);
  }, [fyTheliLogs, fyTheliStock]);

  // Revenue totals
  const totalIssuedReceiptsCount = fyReceipts.length;
  const totalCollectedAmount = fyReceipts.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

  // Average ticket price to estimate cancelled receipt nominal value
  const avgReceiptValue = useMemo(() => {
    if (totalIssuedReceiptsCount === 0) return 500;
    return Math.round(totalCollectedAmount / totalIssuedReceiptsCount);
  }, [totalIssuedReceiptsCount, totalCollectedAmount]);

  const totalCancelledEstAmount = totalCancelledCount * avgReceiptValue;

  // Filtered people in scope
  const scopedPeople = useMemo(() => {
    return allPeople.filter((p) => {
      if (selectedWard && p.ward !== selectedWard) return false;
      if (selectedMunicipality && p.municipality && p.municipality !== selectedMunicipality)
        return false;
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchesName = (p.name || "").toLowerCase().includes(q);
        const matchesCard = (p.card || "").toLowerCase().includes(q);
        const matchesPhone = (p.phone || "").toLowerCase().includes(q);
        const matchesTole = (p.tole || "").toLowerCase().includes(q);
        const matchesGhardhani = (p.ghardhani_name || "").toLowerCase().includes(q);
        if (!matchesName && !matchesCard && !matchesPhone && !matchesTole && !matchesGhardhani) {
          return false;
        }
      }
      return true;
    });
  }, [allPeople, selectedWard, selectedMunicipality, searchTerm]);

  // Detailed Customer Register rows
  // Calculates: total service months in FY, collected amount, and due amount
  const customerServiceRegister = useMemo(() => {
    const fyRange = fiscalYearRange(selectedYear);
    const fyStart = fyRange ? fyRange.start : `${selectedYear}/04/01`;
    const fyEnd = fyRange ? fyRange.end : `${selectedYear + 1}/03/32`;

    return scopedPeople.map((p, idx) => {
      const monthlyRate = getCustomerTotalRate(p, allPlans);

      // Customer's receipts in this fiscal year
      const custReceipts = fyReceipts.filter(
        (r) => r.ward === p.ward && (r.card || "").toLowerCase() === (p.card || "").toLowerCase(),
      );
      const custReceiptsCount = custReceipts.length;
      const custCollected = custReceipts.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

      // Remaining dues
      const { months: dueMonths, total: dueTotal } = remainingDuesForPerson(
        p.joining_date,
        p.opening_dues,
        allReceipts,
        p.ward,
        p.card,
        monthlyRate,
        currentBS,
        paidIndex,
      );

      // Due months strictly within this fiscal year
      const fyDueMonths = dueMonths.filter((m) => m.fy === selectedYear);
      const fyDueAmount = fyDueMonths.reduce((sum, dm) => sum + (dm.amount ?? monthlyRate), 0);

      // Total service months in this fiscal year
      // A customer receives service from max(joining_date, fyStart) up to min(today, fyEnd)
      let serviceMonthsCount = 12;
      if (p.joining_date) {
        const joinNorm = en(p.joining_date).replace(/[^0-9/]/g, "");
        if (joinNorm > fyEnd) {
          serviceMonthsCount = 0;
        } else if (joinNorm > fyStart) {
          const parts = joinNorm.split("/").map(Number);
          const joinYear = parts[0] || selectedYear;
          const joinMonth = (parts[1] || 1) - 1; // 0-indexed (0=Baisakh, 3=Shrawan)
          // Fiscal month index (Shrawan=0, Asar=11)
          const fiscalMonthIdx = joinMonth >= 3 ? joinMonth - 3 : joinMonth + 9;
          serviceMonthsCount = Math.max(1, 12 - fiscalMonthIdx);
        }
      }

      // Has dues from cancelled receipts: if receipts were cancelled,
      // customer has unpaid due months in this FY while receiving service
      const hasDues = fyDueAmount > 0 || dueTotal > 0;

      return {
        sn: idx + 1,
        id: p.id || `${p.ward}-${p.card}`,
        card: p.card || "—",
        name: p.name,
        ghardhani: p.ghardhani_name || "—",
        ward: p.ward,
        tole: p.tole,
        phone: p.phone || "—",
        plan: p.plan || (p.plans && p.plans[0]?.name) || "घरायसी",
        monthlyRate,
        serviceMonthsCount,
        issuedReceiptsCount: custReceiptsCount,
        collectedAmount: custCollected,
        fyDueAmount,
        totalDueAmount: dueTotal,
        dueMonthsCount: fyDueMonths.length,
        hasDues,
      };
    });
  }, [scopedPeople, fyReceipts, allReceipts, allPlans, selectedYear, currentBS, paidIndex]);

  // Filtered customer register by clear/due status
  const filteredCustomerRegister = useMemo(() => {
    if (customerStatusFilter === "all") return customerServiceRegister;
    if (customerStatusFilter === "due") return customerServiceRegister.filter((c) => c.hasDues);
    return customerServiceRegister.filter((c) => !c.hasDues);
  }, [customerServiceRegister, customerStatusFilter]);

  // Aggregated Total Customer Dues in Scope
  const totalCustomerDuesInScope = useMemo(() => {
    return customerServiceRegister.reduce((sum, c) => sum + c.totalDueAmount, 0);
  }, [customerServiceRegister]);

  const fyCustomerDuesInScope = useMemo(() => {
    return customerServiceRegister.reduce((sum, c) => sum + c.fyDueAmount, 0);
  }, [customerServiceRegister]);

  // Ward-wise Aggregation
  const wardBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        ward: string;
        municipality: string;
        totalPeople: number;
        receiptsCount: number;
        collectedAmount: number;
        dueAmount: number;
      }
    >();

    customerServiceRegister.forEach((c) => {
      const key = c.ward || "Unknown";
      const existing = map.get(key) || {
        ward: key,
        municipality: selectedMunicipality || orgAddress.split(",")[0] || "वीरेन्द्रनगर",
        totalPeople: 0,
        receiptsCount: 0,
        collectedAmount: 0,
        dueAmount: 0,
      };
      existing.totalPeople += 1;
      existing.receiptsCount += c.issuedReceiptsCount;
      existing.collectedAmount += c.collectedAmount;
      existing.dueAmount += c.fyDueAmount;
      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) => Number(a.ward) - Number(b.ward));
  }, [customerServiceRegister, selectedMunicipality, orgAddress]);

  // Collector-wise Breakdown
  const collectorBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        phone: string;
        sessionsCount: number;
        cancelledCount: number;
        collectedAmount: number;
        clearedAmount: number;
        balance: number;
      }
    >();

    // From theli logs
    fyTheliLogs.forEach((l) => {
      const key = l.employee_id || l.employee_name || "unknown";
      const existing = map.get(key) || {
        id: key,
        name: l.employee_name || "सङ्कलक",
        phone: "—",
        sessionsCount: 0,
        cancelledCount: 0,
        collectedAmount: 0,
        clearedAmount: 0,
        balance: 0,
      };
      existing.sessionsCount += 1;
      existing.cancelledCount += Number(l.cancelled_count) || 0;
      existing.collectedAmount += Number(l.amount) || 0;
      existing.clearedAmount += Number(l.cleared_amount) || 0;
      existing.balance += (Number(l.amount) || 0) - (Number(l.cleared_amount) || 0);
      map.set(key, existing);
    });

    // Match employee phone numbers
    employeesList.forEach((emp) => {
      const key = emp.id;
      if (map.has(key)) {
        const item = map.get(key)!;
        item.phone = emp.phone || item.phone;
        item.name = emp.name || item.name;
      }
    });

    return Array.from(map.values());
  }, [fyTheliLogs, employeesList]);

  // Payment modes distribution
  const paymentModeBreakdown = useMemo(() => {
    const map = new Map<string, { mode: string; count: number; total: number }>();
    MODES.forEach((m) => map.set(m, { mode: m, count: 0, total: 0 }));

    fyReceipts.forEach((r) => {
      const m = r.mode || "नगद";
      const item = map.get(m) || { mode: m, count: 0, total: 0 };
      item.count += 1;
      item.total += Number(r.total) || 0;
      map.set(m, item);
    });

    return Array.from(map.values()).filter((item) => item.count > 0 || item.total > 0);
  }, [fyReceipts]);

  // Programmes / Events conducted in this Fiscal Year
  const fyEvents = useMemo(() => {
    return eventsList.filter((e) => {
      if (!e.commencing_date) return false;
      return dateInFiscalYear(e.commencing_date, selectedYear);
    });
  }, [eventsList, selectedYear]);

  // Total programme budget and spend
  const totalEventsBudget = useMemo(() => {
    return fyEvents.reduce(
      (sum, e) => sum + (Number(e.budget_allocated ?? e.budget_required) || 0),
      0,
    );
  }, [fyEvents]);

  // Export to CSV Functionality
  const handleExportCSV = () => {
    const headers = [
      "सि.नं. (S.N.)",
      "ग्राहक नं. (Card No)",
      "ग्राहकको नाम (Customer Name)",
      "घरधनी (Ghardhani / Landlord)",
      "वडा नं. (Ward)",
      "टोल (Tole)",
      "सम्पर्क नं. (Phone)",
      "योजना (Plan)",
      "मासिक दर (Monthly Rate)",
      "सेवा महिना संख्या (Service Months)",
      "जारी रसिद (Issued Receipts)",
      "असुली रकम (Collected Rs)",
      "चालू आ.व. बक्यौता (FY Dues Rs)",
      "कुल बक्यौता (Total Dues Rs)",
      "स्थिति (Status)",
    ];

    const rows = customerServiceRegister.map((c) => [
      c.sn,
      c.card,
      c.name,
      c.ghardhani,
      c.ward,
      c.tole,
      c.phone,
      c.plan,
      c.monthlyRate,
      c.serviceMonthsCount,
      c.issuedReceiptsCount,
      c.collectedAmount,
      c.fyDueAmount,
      c.totalDueAmount,
      c.hasDues ? "बक्यौता बाँकी (Due)" : "चुक्ता (Clear)",
    ]);

    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Municipal_Report_FY${selectedYear}_Ward${selectedWard || "All"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <WorkspacePage title="आधिकारिक प्रतिवेदन (Institutional & Municipal Reports)">
      <div className="space-y-6 print:space-y-4">
        {/* TOP FILTER & ACTION TOOLBAR (Hidden during print) */}
        <div className="rounded-xl border bg-card p-4 shadow-sm print:hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Fiscal Year Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">आर्थिक वर्ष:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {[2083, 2082, 2081, 2080, 2079].map((y) => (
                    <option key={y} value={y}>
                      आ.व. {fiscalLabel(y)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ward Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">वडा:</span>
                <select
                  value={selectedWard}
                  onChange={(e) => setSelectedWard(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">सबै वडाहरू (All Wards)</option>
                  {availableWards.map((w) => (
                    <option key={w} value={w}>
                      वडा नं. {np(w)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Municipality Filter */}
              {availableMunicipalities.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">पालिका:</span>
                  <select
                    value={selectedMunicipality}
                    onChange={(e) => setSelectedMunicipality(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">सबै पालिका (All Municipalities)</option>
                    {availableMunicipalities.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search input */}
              <div className="relative">
                <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="ग्राहकको नाम, घरधनी, फोन वा टोल..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 w-64 pl-8 text-xs"
                />
              </div>

              {(selectedWard || selectedMunicipality || searchTerm) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedWard("");
                    setSelectedMunicipality("");
                    setSearchTerm("");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="mr-1 size-3.5" />
                  फिल्टर हटाउनुहोस्
                </Button>
              )}
            </div>

            {/* Print and Export Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="gap-1.5 text-xs font-medium"
              >
                <Download className="size-4 text-primary" />
                Excel / CSV निर्यात
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 bg-primary text-xs font-semibold text-primary-foreground shadow"
              >
                <Printer className="size-4" />
                आधिकारिक प्रतिवेदन प्रिन्ट (Print)
              </Button>
            </div>
          </div>
        </div>

        {/* OFFICIAL INSTITUTIONAL LETTERHEAD HEADER (Always visible in UI and Print) */}
        <div className="rounded-xl border bg-card p-6 shadow-sm print:rounded-none print:border-none print:p-0 print:shadow-none">
          <div className="border-b pb-5 text-center print:border-b-2 print:border-foreground">
            {globalConfig.logo_url && (
              <img
                src={globalConfig.logo_url}
                alt="Logo"
                className="mx-auto mb-2 max-h-16 object-contain print:max-h-14"
              />
            )}
            <h1 className="text-2xl font-black text-foreground print:text-xl">{orgName}</h1>
            <p className="text-sm font-semibold text-primary">{orgSubName}</p>
            <p className="mt-1 text-xs text-muted-foreground print:text-foreground">
              {orgAddress}
              {orgPan && ` • पान/भ्याट नं.: ${np(orgPan)}`}
              {orgPhone && ` • फोन: ${np(orgPhone)}`}
              {orgEmail && ` • ईमेल: ${orgEmail}`}
            </p>
            <div className="mt-3 inline-block rounded-full bg-primary/10 px-4 py-1 text-xs font-bold text-primary print:bg-transparent print:border print:border-foreground print:text-foreground">
              आर्थिक वर्ष {fiscalLabel(selectedYear)} को वडा तथा नगरपालिका वार्षिक प्रगति, राजस्व असुली र बक्यौता प्रतिवेदन
            </div>
            {selectedWard && (
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                [ विशेष कार्यक्षेत्र: वडा नं. {np(selectedWard)} ]
              </p>
            )}
          </div>

          {/* KEY FINANCIAL STRIP (Revenue, Issued, Cancelled, Dues) */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 print:mt-4 print:gap-2">
            {/* 1. Total New Issued Receipts */}
            <div className="rounded-lg border bg-background p-4 print:border-gray-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">जारी रसिद (Issued)</span>
                <ReceiptIcon className="size-4 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-black text-foreground print:text-lg">
                {np(totalIssuedReceiptsCount)} <span className="text-xs font-normal">थान</span>
              </p>
              <p className="text-xs text-muted-foreground">असुली: {money(totalCollectedAmount)}</p>
            </div>

            {/* 2. Cancelled Receipts */}
            <div className="rounded-lg border bg-background p-4 print:border-gray-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-destructive">रद्द रसिद (Cancelled)</span>
                <AlertTriangle className="size-4 text-destructive" />
              </div>
              <p className="mt-2 text-2xl font-black text-destructive print:text-lg">
                {np(totalCancelledCount)} <span className="text-xs font-normal">थान</span>
              </p>
              <p className="text-xs text-muted-foreground">अनुमानित रकम: {money(totalCancelledEstAmount)}</p>
            </div>

            {/* 3. Total Collected Amount */}
            <div className="rounded-lg border bg-background p-4 print:border-gray-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-success">खुद असुली (Collected)</span>
                <TrendingUp className="size-4 text-success" />
              </div>
              <p className="mt-2 text-2xl font-black text-success print:text-lg">
                {money(totalCollectedAmount)}
              </p>
              <p className="text-xs text-muted-foreground">आ.व. {fiscalLabel(selectedYear)} को आम्दानी</p>
            </div>

            {/* 4. Total Outstanding Dues */}
            <div className="rounded-lg border bg-background p-4 print:border-gray-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-600">बाँकी बक्यौता (Dues)</span>
                <Wallet className="size-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-amber-600 print:text-lg">
                {money(fyCustomerDuesInScope)}
              </p>
              <p className="text-xs text-muted-foreground">
                कुल सञ्चित: {money(totalCustomerDuesInScope)}
              </p>
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION (Hidden during print - all printable sections show in print) */}
        <div className="print:hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid h-10 w-full grid-cols-2 md:grid-cols-4">
              <TabsTrigger value="executive" className="text-xs font-semibold">
                🏛️ कार्यपालिका प्रतिवेदन
              </TabsTrigger>
              <TabsTrigger value="wards" className="text-xs font-semibold">
                🏢 वडा तथा पालिका संकलन
              </TabsTrigger>
              <TabsTrigger value="collectors" className="text-xs font-semibold">
                🚚 सङ्कलक अनुसार असुली
              </TabsTrigger>
              <TabsTrigger value="customers" className="text-xs font-semibold">
                📋 ग्राहक सेवा तथा बक्यौता दर्ता
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: EXECUTIVE MUNICIPAL REPORT (संस्था, कार्यक्रम, राजस्व) */}
            <TabsContent value="executive" className="mt-6 space-y-6">
              {/* 1. Executive Board Members */}
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="size-5 text-primary" />
                    <h3 className="font-bold text-foreground">
                      १. संस्थाका पदाधिकारी तथा कार्यसमिति (Executive Board & Members)
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    कुल सदस्य संख्या: {np(membersList.length)}
                  </Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50 font-bold text-foreground">
                      <tr>
                        <th className="px-3 py-2">सि.नं.</th>
                        <th className="px-3 py-2">पद (Designation)</th>
                        <th className="px-3 py-2">पूरा नाम (Full Name)</th>
                        <th className="px-3 py-2">सम्पर्क नम्बर</th>
                        <th className="px-3 py-2">पेशा / विवरण</th>
                        <th className="px-3 py-2">स्थिति</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {membersList.slice(0, 15).map((m, idx) => (
                        <tr key={m.id || idx} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono">{np(idx + 1)}</td>
                          <td className="px-3 py-2 font-bold text-primary">{m.designation || "सदस्य"}</td>
                          <td className="px-3 py-2 font-semibold text-foreground">{m.name}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">{m.phone || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{m.occupation || "—"}</td>
                          <td className="px-3 py-2">
                            <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">
                              {m.status || "सक्रिय"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!membersList.length && (
                        <EmptyRows columns={6} text="सदस्य तथा पदाधिकारी विवरण उपलब्ध छैन।" />
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Programmes & Achievements in this FY */}
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="size-5 text-primary" />
                    <h3 className="font-bold text-foreground">
                      २. सञ्चालित कार्यक्रम तथा मुख्य उपलब्धिहरू (Programmes & Achievements)
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    बजेट विनियोजन: {money(totalEventsBudget)}
                  </Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50 font-bold text-foreground">
                      <tr>
                        <th className="px-3 py-2">सि.नं.</th>
                        <th className="px-3 py-2">कार्यक्रमको नाम</th>
                        <th className="px-3 py-2">सञ्चालन मिति</th>
                        <th className="px-3 py-2">स्थान / वडा</th>
                        <th className="px-3 py-2">बजेट (रु.)</th>
                        <th className="px-3 py-2">स्थिति</th>
                        <th className="px-3 py-2">मुख्य उपलब्धि तथा प्रभाव</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {fyEvents.map((ev, idx) => (
                        <tr key={ev.id || idx} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono">{np(idx + 1)}</td>
                          <td className="px-3 py-2 font-bold text-foreground">{ev.title}</td>
                          <td className="px-3 py-2 font-mono">{np(ev.commencing_date)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{ev.locality || "—"}</td>
                          <td className="px-3 py-2 font-bold">{money(ev.budget_allocated ?? ev.budget_required)}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                ev.status === "completed"
                                  ? "bg-success/15 text-success"
                                  : ev.status === "ongoing"
                                    ? "bg-info/15 text-info"
                                    : "bg-warning/15 text-warning"
                              }`}
                            >
                              {ev.status === "completed"
                                ? "सम्पन्न"
                                : ev.status === "ongoing"
                                  ? "जारी"
                                  : "योजनामा"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{ev.remarks || "—"}</td>
                        </tr>
                      ))}
                      {!fyEvents.length && (
                        <EmptyRows
                          columns={7}
                          text={`आर्थिक वर्ष ${fiscalLabel(selectedYear)} मा कुनै कार्यक्रम दर्ता भएको छैन।`}
                        />
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Payment Mode & Revenue Source */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 border-b pb-2">
                    <Wallet className="size-4 text-primary" />
                    <h3 className="font-bold text-sm text-foreground">
                      ३. भुक्तानी माध्यम अनुसार असुली (Payment Modes)
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {paymentModeBreakdown.map((pm) => (
                      <div
                        key={pm.mode}
                        className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-xs"
                      >
                        <span className="font-semibold">{pm.mode}</span>
                        <div className="text-right">
                          <span className="font-black text-foreground">{money(pm.total)}</span>
                          <span className="ml-2 text-muted-foreground font-mono">
                            ({np(pm.count)} रसिद)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="size-4 text-destructive" />
                    <h3 className="font-bold text-sm text-foreground">
                      ४. रसिद रद्द तथा बक्यौता अडिट (Cancelled Receipts Audit)
                    </h3>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <p className="font-semibold text-destructive">
                        रद्द भएका रसिद संख्या: {np(totalCancelledCount)} थान
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        रसिद रद्द भएका कारण सेवाग्राहीको खातामा सम्बन्धित महिनाहरूको बक्यौता यथावत् (पुनः बक्यौतामा परिणत) भएको छ।
                      </p>
                    </div>
                    <div className="flex justify-between border-b py-1">
                      <span className="text-muted-foreground">कुल जारी गरिएका नयाँ रसिद:</span>
                      <span className="font-bold font-mono">{np(totalIssuedReceiptsCount)} थान</span>
                    </div>
                    <div className="flex justify-between border-b py-1">
                      <span className="text-muted-foreground">चालू आ.व. को कुल असुली:</span>
                      <span className="font-bold text-success font-mono">{money(totalCollectedAmount)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">उठ्न बाँकी खुद बक्यौता:</span>
                      <span className="font-bold text-amber-600 font-mono">{money(fyCustomerDuesInScope)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: WARDS & MUNICIPALITY BREAKDOWN */}
            <TabsContent value="wards" className="mt-6">
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <Building className="size-5 text-primary" />
                    <h3 className="font-bold text-foreground">
                      वडा तथा नगरपालिका अनुसार समेकित संकलन प्रतिवेदन (Ward-wise Summary)
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    कुल वडा: {np(wardBreakdown.length)}
                  </Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50 font-bold text-foreground">
                      <tr>
                        <th className="px-3 py-2.5">वडा नं. (Ward)</th>
                        <th className="px-3 py-2.5">नगरपालिका (Municipality)</th>
                        <th className="px-3 py-2.5 text-right">दर्ता ग्राहक संख्या</th>
                        <th className="px-3 py-2.5 text-right">जारी रसिद (थान)</th>
                        <th className="px-3 py-2.5 text-right">असुली रकम (रु.)</th>
                        <th className="px-3 py-2.5 text-right">बाँकी बक्यौता (रु.)</th>
                        <th className="px-3 py-2.5 text-right">असुली दर (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {wardBreakdown.map((wb) => {
                        const totalReceivable = wb.collectedAmount + wb.dueAmount;
                        const rate =
                          totalReceivable > 0
                            ? Math.round((wb.collectedAmount / totalReceivable) * 100)
                            : 0;
                        return (
                          <tr key={wb.ward} className="hover:bg-muted/30">
                            <td className="px-3 py-2.5 font-bold text-primary">वडा नं. {np(wb.ward)}</td>
                            <td className="px-3 py-2.5 font-semibold text-foreground">{wb.municipality}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold">
                              {np(wb.totalPeople)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono">{np(wb.receiptsCount)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-success">
                              {money(wb.collectedAmount)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-600">
                              {money(wb.dueAmount)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] ${
                                  rate >= 80
                                    ? "bg-success/15 text-success"
                                    : rate >= 50
                                      ? "bg-warning/15 text-warning"
                                      : "bg-destructive/15 text-destructive"
                                }`}
                              >
                                {np(rate)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {!wardBreakdown.length && (
                        <EmptyRows columns={7} text="कुनै वडाको तथ्याङ्क फेला परेन।" />
                      )}
                    </tbody>
                    <tfoot className="border-t-2 bg-muted/30 font-bold">
                      <tr>
                        <td className="px-3 py-2.5">जम्मा (Total)</td>
                        <td className="px-3 py-2.5">—</td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {np(customerServiceRegister.length)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {np(totalIssuedReceiptsCount)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-success">
                          {money(totalCollectedAmount)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-amber-600">
                          {money(fyCustomerDuesInScope)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: COLLECTORS BREAKDOWN */}
            <TabsContent value="collectors" className="mt-6">
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="size-5 text-primary" />
                    <h3 className="font-bold text-foreground">
                      सङ्कलक तथा कर्मचारी अनुसार असुली प्रतिवेदन (Collector-wise Collection)
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    कुल सङ्कलक: {np(collectorBreakdown.length)}
                  </Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50 font-bold text-foreground">
                      <tr>
                        <th className="px-3 py-2.5">सि.नं.</th>
                        <th className="px-3 py-2.5">सङ्कलकको नाम (Collector)</th>
                        <th className="px-3 py-2.5">सम्पर्क नम्बर</th>
                        <th className="px-3 py-2.5 text-right">सङ्कलन दिन/थेली सत्र</th>
                        <th className="px-3 py-2.5 text-right text-destructive">रद्द रसिद (थान)</th>
                        <th className="px-3 py-2.5 text-right">कुल संकलन (रु.)</th>
                        <th className="px-3 py-2.5 text-right">संस्थामा बुझाएको (रु.)</th>
                        <th className="px-3 py-2.5 text-right text-amber-600">बाँकी अन्तर (रु.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {collectorBreakdown.map((cb, idx) => (
                        <tr key={cb.id || idx} className="hover:bg-muted/30">
                          <td className="px-3 py-2.5 font-mono">{np(idx + 1)}</td>
                          <td className="px-3 py-2.5 font-bold text-foreground">{cb.name}</td>
                          <td className="px-3 py-2.5 font-mono text-muted-foreground">{cb.phone}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{np(cb.sessionsCount)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-destructive">
                            {np(cb.cancelledCount)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-success">
                            {money(cb.collectedAmount)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold">
                            {money(cb.clearedAmount)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-600">
                            {money(cb.balance)}
                          </td>
                        </tr>
                      ))}
                      {!collectorBreakdown.length && (
                        <EmptyRows
                          columns={8}
                          text="चालू आर्थिक वर्षको थेली वा सङ्कलक लग उपलब्ध छैन।"
                        />
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* TAB 4: DETAILED HOUSEHOLD SERVICE & DUES REGISTER */}
            <TabsContent value="customers" className="mt-6">
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-foreground">
                      विस्तृत ग्राहकगत सेवा तथा बक्यौता दर्ता (Customer Service & Dues Register)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      वडा, टोल, घरधनी, चालू आ.व. मा लिएको सेवा महिना, काटिएको रसिद र बाँकी बक्यौताको पूर्ण अडिट सूची।
                    </p>
                  </div>

                  {/* Status filter toggle */}
                  <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
                    <button
                      type="button"
                      onClick={() => setCustomerStatusFilter("all")}
                      className={`rounded px-2.5 py-1 text-xs font-semibold ${
                        customerStatusFilter === "all"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      सबै ({np(customerServiceRegister.length)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerStatusFilter("due")}
                      className={`rounded px-2.5 py-1 text-xs font-semibold ${
                        customerStatusFilter === "due"
                          ? "bg-background text-destructive shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      बक्यौता बाँकी ({np(customerServiceRegister.filter((c) => c.hasDues).length)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerStatusFilter("clear")}
                      className={`rounded px-2.5 py-1 text-xs font-semibold ${
                        customerStatusFilter === "clear"
                          ? "bg-background text-success shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      चुक्ता ({np(customerServiceRegister.filter((c) => !c.hasDues).length)})
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50 font-bold text-foreground">
                      <tr>
                        <th className="px-3 py-2">सि.नं.</th>
                        <th className="px-3 py-2">ग्राहक नं.</th>
                        <th className="px-3 py-2">ग्राहकको नाम (Customer)</th>
                        <th className="px-3 py-2">घरधनी (Ghardhani)</th>
                        <th className="px-3 py-2">वडा र टोल</th>
                        <th className="px-3 py-2">योजना (दर)</th>
                        <th className="px-3 py-2 text-center">सेवा महिना</th>
                        <th className="px-3 py-2 text-center">रसिद (थान)</th>
                        <th className="px-3 py-2 text-right">असुली (रु.)</th>
                        <th className="px-3 py-2 text-right">आ.व. बक्यौता</th>
                        <th className="px-3 py-2 text-right">कुल बक्यौता</th>
                        <th className="px-3 py-2 text-center">स्थिति</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredCustomerRegister.slice(0, 100).map((c) => (
                        <tr key={c.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono text-muted-foreground">{np(c.sn)}</td>
                          <td className="px-3 py-2 font-mono font-bold text-primary">{c.card}</td>
                          <td className="px-3 py-2 font-semibold text-foreground">{c.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.ghardhani}</td>
                          <td className="px-3 py-2">
                            वडा {np(c.ward)}, {c.tole}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {c.plan} ({money(c.monthlyRate)})
                          </td>
                          <td className="px-3 py-2 text-center font-mono font-bold">
                            {np(c.serviceMonthsCount)}
                          </td>
                          <td className="px-3 py-2 text-center font-mono font-bold">
                            {np(c.issuedReceiptsCount)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-success">
                            {money(c.collectedAmount)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-amber-600">
                            {money(c.fyDueAmount)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-destructive">
                            {money(c.totalDueAmount)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {c.hasDues ? (
                              <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                                बक्यौता
                              </span>
                            ) : (
                              <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">
                                चुक्ता
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!filteredCustomerRegister.length && (
                        <EmptyRows columns={12} text="कुनै ग्राहकको तथ्याङ्क फेला परेन।" />
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredCustomerRegister.length > 100 && (
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    पहिलो १०० ग्राहकहरू देखाइएको छ। सम्पूर्ण {np(filteredCustomerRegister.length)} ग्राहकको विवरण हेर्न माथिको{" "}
                    <strong>Excel / CSV निर्यात</strong> बटन थिच्नुहोस्।
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* PRINT-ONLY COMPREHENSIVE VIEW (Automatically rendered when printing) */}
        <div className="hidden print:block print:space-y-6">
          {/* Print Section 1: Executive Committee */}
          <div className="border p-4">
            <h3 className="border-b pb-2 text-sm font-bold">
              १. संस्थाका पदाधिकारी तथा कार्यसमिति विवरण
            </h3>
            <table className="mt-2 w-full text-left text-[11px]">
              <thead className="border-b bg-gray-100 font-bold">
                <tr>
                  <th className="p-1.5">सि.नं.</th>
                  <th className="p-1.5">पद</th>
                  <th className="p-1.5">पूरा नाम</th>
                  <th className="p-1.5">सम्पर्क नम्बर</th>
                  <th className="p-1.5">पेशा</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {membersList.map((m, idx) => (
                  <tr key={m.id || idx}>
                    <td className="p-1.5 font-mono">{np(idx + 1)}</td>
                    <td className="p-1.5 font-bold">{m.designation || "सदस्य"}</td>
                    <td className="p-1.5 font-semibold">{m.name}</td>
                    <td className="p-1.5 font-mono">{m.phone || "—"}</td>
                    <td className="p-1.5">{m.occupation || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Print Section 2: Programmes & Achievements */}
          {fyEvents.length > 0 && (
            <div className="border p-4">
              <h3 className="border-b pb-2 text-sm font-bold">
                २. सञ्चालित कार्यक्रम तथा मुख्य उपलब्धिहरू
              </h3>
              <table className="mt-2 w-full text-left text-[11px]">
                <thead className="border-b bg-gray-100 font-bold">
                  <tr>
                    <th className="p-1.5">सि.नं.</th>
                    <th className="p-1.5">कार्यक्रमको नाम</th>
                    <th className="p-1.5">मिति</th>
                    <th className="p-1.5">स्थान</th>
                    <th className="p-1.5">बजेट (रु.)</th>
                    <th className="p-1.5">उपलब्धि तथा विवरण</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fyEvents.map((ev, idx) => (
                    <tr key={ev.id || idx}>
                      <td className="p-1.5 font-mono">{np(idx + 1)}</td>
                      <td className="p-1.5 font-bold">{ev.title}</td>
                      <td className="p-1.5 font-mono">{np(ev.commencing_date)}</td>
                      <td className="p-1.5">{ev.locality || "—"}</td>
                      <td className="p-1.5 font-bold">
                        {money(ev.budget_allocated ?? ev.budget_required)}
                      </td>
                      <td className="p-1.5">{ev.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Print Section 3: Ward Summaries */}
          <div className="border p-4">
            <h3 className="border-b pb-2 text-sm font-bold">
              ३. वडा तथा पालिका अनुसार राजस्व असुली सारांश
            </h3>
            <table className="mt-2 w-full text-left text-[11px]">
              <thead className="border-b bg-gray-100 font-bold">
                <tr>
                  <th className="p-1.5">वडा नं.</th>
                  <th className="p-1.5">नगरपालिका</th>
                  <th className="p-1.5 text-right">दर्ता ग्राहक</th>
                  <th className="p-1.5 text-right">जारी रसिद (थान)</th>
                  <th className="p-1.5 text-right">असुली रकम (रु.)</th>
                  <th className="p-1.5 text-right">बाँकी बक्यौता (रु.)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {wardBreakdown.map((wb) => (
                  <tr key={wb.ward}>
                    <td className="p-1.5 font-bold">वडा नं. {np(wb.ward)}</td>
                    <td className="p-1.5">{wb.municipality}</td>
                    <td className="p-1.5 text-right font-mono">{np(wb.totalPeople)}</td>
                    <td className="p-1.5 text-right font-mono">{np(wb.receiptsCount)}</td>
                    <td className="p-1.5 text-right font-mono font-bold">
                      {money(wb.collectedAmount)}
                    </td>
                    <td className="p-1.5 text-right font-mono font-bold text-amber-700">
                      {money(wb.dueAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 font-bold">
                <tr>
                  <td className="p-1.5">जम्मा</td>
                  <td className="p-1.5">—</td>
                  <td className="p-1.5 text-right font-mono">
                    {np(customerServiceRegister.length)}
                  </td>
                  <td className="p-1.5 text-right font-mono">
                    {np(totalIssuedReceiptsCount)}
                  </td>
                  <td className="p-1.5 text-right font-mono">{money(totalCollectedAmount)}</td>
                  <td className="p-1.5 text-right font-mono text-amber-700">
                    {money(fyCustomerDuesInScope)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Print Section 4: Collector Summary */}
          {collectorBreakdown.length > 0 && (
            <div className="border p-4">
              <h3 className="border-b pb-2 text-sm font-bold">
                ४. सङ्कलक अनुसार असुली तथा बुझारथ विवरण
              </h3>
              <table className="mt-2 w-full text-left text-[11px]">
                <thead className="border-b bg-gray-100 font-bold">
                  <tr>
                    <th className="p-1.5">सि.नं.</th>
                    <th className="p-1.5">सङ्कलकको नाम</th>
                    <th className="p-1.5 text-right">सत्र সংখ্যা</th>
                    <th className="p-1.5 text-right">रद्द रसिद</th>
                    <th className="p-1.5 text-right">संकलित रकम (रु.)</th>
                    <th className="p-1.5 text-right">बुझाएको रकम (रु.)</th>
                    <th className="p-1.5 text-right">बाँकी अन्तर (रु.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {collectorBreakdown.map((cb, idx) => (
                    <tr key={cb.id || idx}>
                      <td className="p-1.5 font-mono">{np(idx + 1)}</td>
                      <td className="p-1.5 font-bold">{cb.name}</td>
                      <td className="p-1.5 text-right font-mono">{np(cb.sessionsCount)}</td>
                      <td className="p-1.5 text-right font-mono">{np(cb.cancelledCount)}</td>
                      <td className="p-1.5 text-right font-mono">{money(cb.collectedAmount)}</td>
                      <td className="p-1.5 text-right font-mono">{money(cb.clearedAmount)}</td>
                      <td className="p-1.5 text-right font-mono font-bold text-amber-700">
                        {money(cb.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* OFFICIAL SIGNATURES & VERIFICATION BLOCK (Visible in both UI and Print) */}
        <div className="rounded-xl border bg-card p-6 shadow-sm print:rounded-none print:border print:p-4">
          <h4 className="mb-6 font-bold text-xs uppercase tracking-wider text-muted-foreground print:text-foreground">
            आधिकारिक प्रमाणीकरण तथा हस्ताक्षर खण्ड (Official Verification & Signatures)
          </h4>

          <div className="grid grid-cols-2 gap-8 text-center sm:grid-cols-4 print:grid-cols-4 print:gap-4">
            {/* Prepared By */}
            <div className="flex flex-col items-center justify-end">
              <div className="h-12 w-full border-b border-dashed border-muted-foreground/60 print:border-foreground" />
              <p className="mt-2 text-xs font-bold text-foreground">तयार गर्ने (Prepared by)</p>
              <p className="text-[10px] text-muted-foreground print:text-foreground">लेखापाल / अपरेटर</p>
            </div>

            {/* Verified By */}
            <div className="flex flex-col items-center justify-end">
              <div className="h-12 w-full border-b border-dashed border-muted-foreground/60 print:border-foreground" />
              <p className="mt-2 text-xs font-bold text-foreground">जाँच गर्ने (Verified by)</p>
              <p className="text-[10px] text-muted-foreground print:text-foreground">कोषाध्यक्ष (Treasurer)</p>
            </div>

            {/* Approved By */}
            <div className="flex flex-col items-center justify-end">
              <div className="h-12 w-full border-b border-dashed border-muted-foreground/60 print:border-foreground" />
              <p className="mt-2 text-xs font-bold text-foreground">स्वीकृत गर्ने (Approved by)</p>
              <p className="text-[10px] text-muted-foreground print:text-foreground">अध्यक्ष / सचिव (President)</p>
            </div>

            {/* Ward / Municipality Stamp */}
            <div className="flex flex-col items-center justify-end">
              <div className="flex h-12 w-full items-center justify-center rounded border border-dashed border-muted-foreground/60 text-[10px] text-muted-foreground print:border-foreground print:text-foreground">
                कार्यालय दर्ता छाप
              </div>
              <p className="mt-2 text-xs font-bold text-foreground">बुझाएको वडा / पालिका</p>
              <p className="text-[10px] text-muted-foreground print:text-foreground">दर्ता मिति तथा अधिकृत हस्ताक्षर</p>
            </div>
          </div>
        </div>
      </div>
    </WorkspacePage>
  );
}
