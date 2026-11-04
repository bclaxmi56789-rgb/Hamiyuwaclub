import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { Link, useNavigate, useRouter, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Users,
  ReceiptText,
  LogOut,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  MapPin,
  Truck,
  UserCheck,
  CalendarDays,
  Building2,
  Settings,
  NotebookPen,
  Boxes,
  Wallet,
  Menu,
  X,
  History,
  RefreshCw,
  Bot,
  BarChart3,
  ChevronDown,
  Package,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  Fingerprint,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeSelector } from "@/components/theme-selector";
import { fiscalYear, todayBS } from "@/lib/receipt-rules";
import { useAppConfig, saveStoredConfig } from "@/lib/app-config";
import {
  getAppConfiguration,
  getEmployeesData,
  getEmployeePermissions,
  verifyEmployeePin,
  verifyAdminPin,
} from "@/lib/workspace.functions";
import {
  canViewPage,
  canEditPage,
  getPageAccessLevel,
  type EmployeePermission,
  type AccessLevel,
} from "@/lib/permissions";
import type { Employee } from "@/lib/receipt-rules";
import { SignInPanel } from "@/components/email-sign-in";
import { ScrollNavigationButtons } from "@/components/scroll-nav-buttons";
export { SignInPanel };

type AppState = {
  ward: string;
  setWard: (ward: string) => void;
  signedIn: boolean;
  userId: string | null;
  ready: boolean;
  year: number;
  setYear: (year: number) => void;
  signOut: () => Promise<void>;
  // RBAC Access Control
  activeEmployeeId: string | null;
  setActiveEmployeeId: (id: string | null) => void;
  employees: Employee[];
  permissions: EmployeePermission[];
  hasPageAccess: (path: string) => boolean;
  isPageReadOnly: (path: string) => boolean;
  canEditOnPage: (path: string) => boolean;
  refreshPermissions: () => Promise<void>;
};
const AppContext = createContext<AppState | null>(null);
export function useAppState() {
  const state = useContext(AppContext);
  if (!state) throw new Error("App state unavailable");
  return state;
}
const menuGroups = [
  {
    title: "MASTER SETUP",
    items: [
      { to: "/masters", label: "People Master", nplabel: "ग्राहक तथा व्यक्ति दर्ता", icon: Users },
      { to: "/members", label: "Members & Staff", nplabel: "सदस्य तथा कर्मचारी", icon: UserCheck },
      { to: "/plans", label: "Plan Master", nplabel: "योजना तथा दर रेट", icon: Layers },
      { to: "/vendors", label: "Vendor Master", nplabel: "सप्लायर्स तथा भेन्डर", icon: Building2 },
      { to: "/items", label: "Items & Assets", nplabel: "जिन्सी तथा सम्पत्ति", icon: Boxes },
    ],
  },
  {
    title: "",
    items: [{ to: "/dashboard", label: "Dashboard", nplabel: "ड्यासबोर्ड", icon: LayoutDashboard }],
  },
  {
    title: "COLLECTION & OPERATIONS",
    items: [
      { to: "/", label: "New Receipt", nplabel: "नयाँ रसिद काट्ने", icon: Plus },
      {
        to: "/collection-map",
        label: "Collection Map",
        nplabel: "संकलन नक्सा (GPS)",
        icon: MapPin,
      },
      { to: "/trip-driver", label: "Trips & Driver", nplabel: "ट्रिप तथा चालक", icon: Truck },
      { to: "/receipts", label: "Receipt History", nplabel: "रसिद इतिहास", icon: History },
    ],
  },
  {
    title: "FINANCE & ACCOUNTING",
    items: [
      {
        to: "/receipts-payments",
        label: "Receipts & Payments",
        nplabel: "रसिद तथा भुक्तानी",
        icon: Wallet,
      },
      { to: "/expenses", label: "Expenses", nplabel: "खर्च प्रविष्टि", icon: ReceiptText },
      { to: "/assets", label: "Assets", nplabel: "थेली स्टक तथा लेजर", icon: Package },
    ],
  },
  {
    title: "EVENTS & GOVERNANCE",
    items: [
      {
        to: "/events",
        label: "Events & Programmes",
        nplabel: "कार्यक्रम तथा उत्सव",
        icon: CalendarDays,
      },
      {
        to: "/minutes",
        label: "Meeting Minutes",
        nplabel: "बैठक निर्णय (माइन्युट)",
        icon: NotebookPen,
      },
    ],
  },
  {
    title: "ADMINISTRATION & AI",
    items: [
      { to: "/ai-assistant", label: "AI Assistant", nplabel: "एआई सहायक", icon: Bot },
      {
        to: "/settings",
        label: "Settings & Permissions",
        nplabel: "सेटिङ तथा अनुमति",
        icon: Settings,
      },
      {
        to: "/reports",
        label: "Reports & Analytics",
        nplabel: "रिपोर्ट तथा प्रतिवेदन",
        icon: BarChart3,
      },
    ],
  },
] as const;

/** Expand/collapse state per nav group, remembered across sessions (icon-only mode always open). */
const useNavGroups = () => {
  const initial = useMemo(
    () => Object.fromEntries(menuGroups.map((g) => [g.title, false])) as Record<string, boolean>,
    [],
  );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initial);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    setHydrated(true);
    try {
      const saved = window.localStorage.getItem("hamiyuwa_nav_groups");
      if (saved) setOpenGroups({ ...initial, ...JSON.parse(saved) });
    } catch {
      // no localStorage available: defaults stay
    }
  }, [hydrated, initial]);
  const toggleGroup = (title: string) =>
    setOpenGroups((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        window.localStorage.setItem("hamiyuwa_nav_groups", JSON.stringify(next));
      } catch {
        // private mode: session-only memory is fine
      }
      return next;
    });
  return { openGroups, toggleGroup };
};
export function AppShell({ children }: { children: ReactNode }) {
  const appConfig = useAppConfig();
  const getAppConfigFn = useServerFn(getAppConfiguration);
  const getEmployeesFn = useServerFn(getEmployeesData);
  const getPermissionsFn = useServerFn(getEmployeePermissions);

  const [ward, setWard] = useState("");
  const [year, setYear] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [authError, setAuthError] = useState("");
  const [ready, setReady] = useState(false);

  // ─── RBAC: Active Employee & Permissions State ───
  const [activeEmployeeId, setActiveEmployeeIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem("hami_active_employee_id") || null;
    } catch {
      return null;
    }
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [permissions, setPermissions] = useState<EmployeePermission[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("hami_employee_permissions") || "[]");
    } catch {
      return [];
    }
  });

  // ─── PIN Unlock Gate (memory-only: relock on fresh sign-in) ───
  const verifyPinFn = useServerFn(verifyEmployeePin);
  const verifyAdminPinFn = useServerFn(verifyAdminPin);
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [gateRole, setGateRole] = useState<"admin" | "employee">("admin");
  const [gateEmpId, setGateEmpId] = useState("");
  const [gatePin, setGatePin] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState("");
  const [gateVisible, setGateVisible] = useState(false);

  async function unlockWithPin() {
    if (gateRole === "admin") {
      if (!/^\d{4}$/.test(gatePin)) {
        setGateError("Admin PIN चार अंकको हुनुपर्छ।");
        return;
      }
      setGateBusy(true);
      setGateError("");
      try {
        const result = await verifyAdminPinFn({ data: { pin: gatePin } });
        if (result.ok) {
          setActiveEmployeeId(null);
          try {
            localStorage.removeItem("hami_active_employee_id");
          } catch {}
          setPinUnlocked(true);
          setGatePin("");
        } else if (result.code === "wrong_pin") {
          setGateError("Admin PIN मिलेन। कृपया सही पिन प्रविष्ट गर्नुहोस्।");
        } else {
          setGateError("प्रमाणिकरण हुन सकेन। पुनः प्रयास गर्नुहोस्।");
        }
      } catch {
        setGateError("अनुरोध पूरा हुन सकेन। पुनः प्रयास गर्नुहोस्।");
      } finally {
        setGateBusy(false);
      }
      return;
    }

    if (!gateEmpId) {
      setGateError("कृपया आफ्नो कर्मचारी नाम छान्नुहोस्।");
      return;
    }
    if (!/^\d{4}$/.test(gatePin)) {
      setGateError("PIN चार अंकको हुनुपर्छ।");
      return;
    }
    setGateBusy(true);
    setGateError("");
    try {
      const result = await verifyPinFn({ data: { employee_id: gateEmpId, pin: gatePin } });
      if (result.ok) {
        setActiveEmployeeId(gateEmpId);
        setPinUnlocked(true);
        setGatePin("");
      } else if (result.code === "pin_not_set") {
        setGateError("यो कर्मचारीको PIN सेट गरिएको छैन। Admin ले Settings मा PIN राख्नुपर्छ।");
      } else if (result.code === "wrong_pin" || result.code === "not_found") {
        setGateError("PIN मिलेन। पुनः प्रयास गर्नुहोस्।");
      } else {
        setGateError("पुष्टि गर्न सकिएन। पुनः प्रयास गर्नुहोस्।");
      }
    } catch {
      setGateError("अनुरोध पूरा हुन सकेन। पुनः प्रयास गर्नुहोस्।");
    } finally {
      setGateBusy(false);
    }
  }

  const setActiveEmployeeId = (id: string | null) => {
    setActiveEmployeeIdState(id);
    try {
      if (id) {
        localStorage.setItem("hami_active_employee_id", id);
      } else {
        localStorage.removeItem("hami_active_employee_id");
      }
    } catch {}
  };

  const refreshPermissions = async () => {
    if (!signedIn || !userId) return;
    try {
      const [empList, permList] = await Promise.all([
        getEmployeesFn().catch(() => [] as Employee[]),
        getPermissionsFn().catch(() => [] as EmployeePermission[]),
      ]);
      setEmployees(empList || []);
      setPermissions((permList as EmployeePermission[]) || []);
      try {
        localStorage.setItem("hami_employee_permissions", JSON.stringify(permList || []));
      } catch {}
    } catch {}
  };

  // Helper checks based on active employee & permissions
  const hasPageAccess = (path: string): boolean => {
    if (!activeEmployeeId) return true; // Owner/Admin has full access to all pages
    if (path === "/settings") return false; // Non-admin employee cannot edit settings
    return canViewPage(permissions, activeEmployeeId, path);
  };

  const isPageReadOnly = (path: string): boolean => {
    if (!activeEmployeeId) return false; // Owner/Admin has edit rights
    const level = getPageAccessLevel(permissions, activeEmployeeId, path);
    return level === "read_only";
  };

  const canEditOnPage = (path: string): boolean => {
    if (!activeEmployeeId) return true;
    return canEditPage(permissions, activeEmployeeId, path);
  };

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const navGroups = useNavGroups();
  useEffect(() => {
    if (new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery")
      sessionStorage.setItem("password-recovery", "true");
    setYear(fiscalYear(todayBS()) ?? 0);
    let active = true;
    let transition = false;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      transition = true;
      setSignedIn(Boolean(session));
      setUserId(session?.user.id ?? null);
      setReady(true);
      if (event === "SIGNED_OUT") {
        void queryClient.cancelQueries();
        queryClient.clear();
        setPinUnlocked(false);
        setGateEmpId("");
        setGatePin("");
        setGateError("");
        setGateVisible(false);
      }
      // Defer asynchronous auth-dependent work until the auth callback releases its lock.
      queueMicrotask(() => {
        if (!active) return;
        void router.invalidate();
        if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
      });
    });
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (active && !transition) {
          setSignedIn(!error && Boolean(data.user));
          setUserId(error ? null : (data.user?.id ?? null));
          setReady(true);
        }
      })
      .catch(() => {
        if (active && !transition) {
          setReady(true);
          setAuthError("Could not verify sign-in. Please try again.");
        }
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient, router]);
  // Hydrate the private configuration (including API keys) from the Cloud box once per session;
  // keys live in the database and session memory only — never in browser storage.
  useEffect(() => {
    if (!ready || !signedIn || !userId) return;
    void getAppConfigFn()
      .then((row) => {
        if (row) {
          saveStoredConfig(row as any);
          // The configured BS financial year drives the selected fiscal year everywhere.
          const configRow = row as { fiscal_year_start?: string };
          const fyStart = configRow.fiscal_year_start
            ? fiscalYear(configRow.fiscal_year_start)
            : null;
          if (fyStart !== null) setYear(fyStart);
        }
      })
      .catch(() => {
        // Session keeps defaults
      });

    void refreshPermissions();
  }, [ready, signedIn, userId, getAppConfigFn]);
  async function signOut() {
    setAuthError("");
    await queryClient.cancelQueries();
    queryClient.clear();
    // Drop API keys from session memory so nothing private survives sign-out
    saveStoredConfig({
      gemini_api_key: "",
      openrouter_api_key: "",
      openai_api_key: "",
      custom_ai_key: "",
    });
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError("Sign-out failed. Please try again.");
      return;
    }
    setSignedIn(false);
    setUserId(null);
    setPinUnlocked(false);
    setGateEmpId("");
    setGatePin("");
    setGateError("");
    setGateVisible(false);
    await navigate({ to: "/", replace: true });
  }

  const location = useLocation();
  const isLanding = location.pathname === "/landing";

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Hide the navigation sidebar and workspace header when viewing the Landing Page
  if (isLanding) {
    return (
      <AppContext.Provider
        value={{
          ward,
          setWard,
          year,
          setYear,
          signedIn,
          userId,
          ready,
          signOut,
          activeEmployeeId,
          setActiveEmployeeId,
          employees,
          permissions,
          hasPageAccess,
          isPageReadOnly,
          canEditOnPage,
          refreshPermissions,
        }}
      >
        <div className="min-h-screen bg-background text-foreground">
          {children}
          <ScrollNavigationButtons />
        </div>
      </AppContext.Provider>
    );
  }

  // Credentials verification spinner
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground animate-pulse">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span>प्रणाली खुल्दैछ (Checking credentials)…</span>
        </div>
      </div>
    );
  }

  // When signed out (and not on landing page), show the shared sign-in panel without sidebar
  if (!signedIn) {
    return (
      <AppContext.Provider
        value={{
          ward,
          setWard,
          year,
          setYear,
          signedIn,
          userId,
          ready,
          signOut,
          activeEmployeeId,
          setActiveEmployeeId,
          employees,
          permissions,
          hasPageAccess,
          isPageReadOnly,
          canEditOnPage,
          refreshPermissions,
        }}
      >
        <div className="min-h-screen bg-background text-foreground">
          <SignInPanel />
          <ScrollNavigationButtons />
        </div>
      </AppContext.Provider>
    );
  }

  // ─── PIN Unlock Gate: main auth passed, now the user opens their access ───
  if (!pinUnlocked) {
    const gateEmp = employees.find((e) => e.id === gateEmpId);
    return (
      <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 selection:bg-primary/20 relative">
        <div className="absolute -z-10 w-96 h-96 bg-primary/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="w-full max-w-md rounded-3xl border bg-card/95 backdrop-blur-2xl p-7 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.22)] border-t-white/30 relative transition-all duration-300">
          <div className="flex items-center justify-between pb-6 border-b mb-6">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Fingerprint className="h-4 w-4 text-primary" />
              <span>पहुँच अनलक (Unlock Access)</span>
            </div>
            <ThemeSelector />
          </div>

          <div className="text-center space-y-2 mb-6">
            <div className="mx-auto size-14 rounded-2xl bg-primary/10 border border-primary/20 p-2 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              स्वागत छ! आफ्नो पहुँच खोल्नुहोस्
            </h1>
            <p className="text-xs text-muted-foreground">
              {gateRole === "admin"
                ? "मुख्य व्यवस्थापक (Admin) पहुँचको लागि ४ अंकको Admin PIN प्रविष्ट गर्नुहोस्।"
                : "आफ्नो कर्मचारी नाम छानेर ४ अंकको PIN प्रविष्ट गर्नुहोस्।"}
            </p>
          </div>

          {/* Role selector tab */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-muted/60 mb-5 border text-xs font-bold">
            <button
              type="button"
              disabled={gateBusy}
              onClick={() => {
                setGateRole("admin");
                setGateError("");
                setGatePin("");
              }}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                gateRole === "admin"
                  ? "bg-card text-foreground shadow-2xs font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
              <span>👑 Admin (व्यवस्थापक)</span>
            </button>
            <button
              type="button"
              disabled={gateBusy}
              onClick={() => {
                setGateRole("employee");
                setGateError("");
                setGatePin("");
              }}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                gateRole === "employee"
                  ? "bg-card text-foreground shadow-2xs font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-3.5 w-3.5 text-primary" />
              <span>कर्मचारी (Staff)</span>
            </button>
          </div>

          <div className="space-y-4">
            {gateRole === "employee" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  कर्मचारी छान्नुहोस् (Select Employee)
                </Label>
                {employees.length === 0 ? (
                  <div className="flex items-center justify-center gap-3 py-4 text-xs text-muted-foreground animate-pulse border rounded-xl">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>कर्मचारी सूची लोड हुँदैछ…</span>
                  </div>
                ) : (
                  <Select
                    value={gateEmpId}
                    onValueChange={(v) => {
                      setGateEmpId(v);
                      setGateError("");
                    }}
                    disabled={gateBusy}
                  >
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="— कर्मचारी छान्नुहोस् —" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees
                        .filter((emp): emp is Employee & { id: string } => Boolean(emp.id))
                        .map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}
                            {emp.designation ? ` (${emp.designation})` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                {gateRole === "admin" ? "Admin PIN (४ अंक)" : "कर्मचारी PIN (४ अंक)"}
              </Label>
              <Input
                inputMode="numeric"
                type={gateVisible ? "text" : "password"}
                maxLength={4}
                autoComplete="off"
                value={gatePin}
                onChange={(e) => setGatePin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !gateBusy) void unlockWithPin();
                }}
                disabled={gateBusy}
                placeholder="••••"
                className="h-11 text-center font-mono tracking-[0.5em] text-lg"
              />
              <button
                type="button"
                onClick={() => setGateVisible(!gateVisible)}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                {gateVisible ? "PIN लुकाउनुहोस्" : "PIN देखाउनुहोस्"}
              </button>
            </div>

            {gateError && (
              <div
                className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                  gateError.includes("सेट गरिएको छैन")
                    ? "bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400"
                    : "bg-destructive/10 border border-destructive/20 text-destructive"
                }`}
              >
                <RefreshCw
                  className={`h-4 w-4 shrink-0 mt-0.5 ${gateBusy ? "animate-spin" : ""}`}
                />
                <span>{gateError}</span>
              </div>
            )}

            <Button
              type="button"
              disabled={
                gateBusy ||
                gatePin.length !== 4 ||
                (gateRole === "employee" && !gateEmpId)
              }
              onClick={() => void unlockWithPin()}
              className="w-full h-10 font-bold gap-2 shadow-sm"
            >
              {gateBusy ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Fingerprint className="h-4 w-4" />
              )}
              <span>
                {gateBusy
                  ? "जाँच हुँदैछ…"
                  : gateRole === "admin"
                    ? "👑 Admin पहुँच खोल्नुहोस्"
                    : "पहुँच खोल्नुहोस् (Unlock)"}
              </span>
            </Button>

            {gateRole === "employee" && gateEmp && (
              <p className="text-center text-[11px] text-muted-foreground pt-1">
                छानिएको: <span className="font-semibold text-foreground">{gateEmp.name}</span>
              </p>
            )}
          </div>

          <div className="mt-7 pt-4 border-t flex items-center justify-center gap-3">
            <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted">
              मुख्य लगइन: सफल ✓
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        ward,
        setWard,
        year,
        setYear,
        signedIn,
        userId,
        ready,
        signOut,
        activeEmployeeId,
        setActiveEmployeeId,
        employees,
        permissions,
        hasPageAccess,
        isPageReadOnly,
        canEditOnPage,
        refreshPermissions,
      }}
    >
      <div
        className={`min-h-screen lg:grid lg:h-screen lg:overflow-hidden ${collapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]"}`}
      >
        {/* Mobile drawer: taps outside (backdrop) or a menu item close it */}
        {drawerOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            className="no-print fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <aside
          className={`no-print fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out lg:relative lg:inset-auto lg:z-auto lg:h-screen lg:w-auto lg:max-w-none lg:translate-x-0 lg:border-r lg:border-sidebar-border lg:shadow-none ${
            drawerOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          {collapsed ? (
            <div className="flex justify-center border-b border-sidebar-border py-2">
              <Button
                variant="outline"
                size="icon"
                className="border-sidebar-border text-sidebar-foreground"
                aria-label="Expand navigation (विस्तार गर्नुहोस्)"
                title="विस्तार गर्नुहोस् (Expand navigation)"
                onClick={() => setCollapsed(false)}
              >
                <PanelLeftOpen />
              </Button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-1 border-b border-sidebar-border px-3 py-4">
              <Link to="/dashboard" className="flex min-w-0 flex-1 items-center gap-3">
                <img
                  src={appConfig.logo_url || ""}
                  alt={appConfig.entity_name || "Logo"}
                  onError={(e) => {
                    (e.target as HTMLImageElement).removeAttribute("src");
                  }}
                  className="size-11 shrink-0 rounded-sm bg-card object-contain"
                />
                <div className="min-w-0">
                  <div className="text-base font-extrabold truncate">
                    {appConfig.entity_sub_name || ""}
                  </div>
                  <div className="text-sm font-bold truncate">
                    {appConfig.entity_name || ""}
                  </div>
                  <div className="text-xs opacity-70 truncate">
                    {appConfig.tagline || "for the society"}
                  </div>
                </div>
              </Link>
              {/* Collapse — subtle ghost icon, never overlaps the club name */}
              <button
                type="button"
                className="mt-1 hidden size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:inline-flex"
                aria-label="संकुचित गर्नुहोस् (Collapse navigation)"
                title="संकुचित गर्नुहोस् (Collapse navigation)"
                onClick={() => setCollapsed(true)}
              >
                <PanelLeftClose className="size-4" />
              </button>
            </div>
          )}
          <nav
            aria-label="App menu"
            className="app-nav flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3"
          >
            {menuGroups.map((group) => {
              const title = group.title as string;
              const navOpen = !title || collapsed || Boolean(navGroups.openGroups[title]);
              return (
                <div
                  key={title || group.items.map((i) => i.to).join("")}
                  className="mt-3 first:mt-0"
                >
                  {title && !collapsed ? (
                    <button
                      type="button"
                      aria-expanded={navOpen}
                      onClick={() => navGroups.toggleGroup(title)}
                      className="flex w-full items-center justify-between rounded-md px-2 pb-1 pt-1 text-[10px] font-extrabold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground"
                    >
                      <span>{title}</span>
                      <ChevronDown
                        className={`size-3 transition-transform ${navOpen ? "" : "-rotate-90"}`}
                      />
                    </button>
                  ) : null}
                  {navOpen &&
                    group.items.map((item) => {
                      const allowed = hasPageAccess(item.to);
                      const isReadOnly = isPageReadOnly(item.to);
                      if (!allowed) return null; // Hide page from menu if no_access
                      return (
                        <Button
                          key={item.to + item.label}
                          asChild
                          variant="ghost"
                          className="shrink-0 justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        >
                          <Link
                            title={item.label}
                            to={item.to}
                            activeOptions={{ exact: true }}
                            onClick={() => setDrawerOpen(false)}
                          >
                            <item.icon className="shrink-0" />
                            <span
                              className={`min-w-0 leading-tight ${collapsed ? "lg:hidden" : ""}`}
                            >
                              <span className="block truncate font-semibold">{item.nplabel}</span>
                              <span className="block truncate text-[10px] font-medium text-sidebar-foreground/60">
                                ({item.label})
                              </span>
                            </span>
                            {isReadOnly && (
                              <span
                                className={`ml-auto rounded bg-blue-500/20 px-1 py-0.2 text-[8px] font-bold text-blue-700 ${collapsed ? "lg:hidden" : ""}`}
                              >
                                Read
                              </span>
                            )}
                          </Link>
                        </Button>
                      );
                    })}
                </div>
              );
            })}
          </nav>
          <div className="mt-auto shrink-0 border-t border-sidebar-border bg-sidebar px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {/* Close (drawer) — pinned at the very bottom */}
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-sidebar-border text-sidebar-foreground shadow-sm lg:hidden"
              aria-label="बन्द गर्नुहोस् (Close navigation)"
              title="बन्द गर्नुहोस् (Close navigation)"
              onClick={() => setDrawerOpen(false)}
            >
              <X />
              <span>बन्द गर्नुहोस् (Close)</span>
            </Button>
          </div>
        </aside>
        <div ref={contentRef} className="min-w-0 lg:h-full lg:overflow-y-auto">
          {/* Floating open button — the top strip is gone */}
          <Button
            variant="outline"
            size="icon"
            className="no-print fixed left-3 top-3 z-30 bg-card/90 shadow-md lg:hidden"
            aria-label="Open navigation"
            title="Open navigation"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu />
          </Button>
          {authError && (
            <p role="alert" className="px-5 py-3 text-destructive">
              {authError}
            </p>
          )}
          {/* Top bar opposite the navigation: access profile + theme + sign out */}
          <div className="no-print sticky top-0 z-20 flex items-center justify-end gap-3 border-b border-border bg-background/90 px-4 py-2 backdrop-blur sm:px-7">
            {/* ─── Access Profile Indicator ─── */}
            <div className="flex items-center gap-2 mr-auto ml-12 lg:ml-0">
              <span className="text-[11px] font-semibold text-muted-foreground hidden sm:inline shrink-0">
                पहुँच प्रोफाइल:
              </span>
              <Select
                value={activeEmployeeId ?? "__admin__"}
                onValueChange={(val) => {
                  if (val === "__admin__") {
                    // Switch to admin: requires re-lock so admin can re-enter PIN
                    if (window.confirm("Admin पहुँचमा फर्कन PIN पुनः प्रविष्ट गर्नुपर्छ। जारी राख्ने?")) {
                      setPinUnlocked(false);
                      setActiveEmployeeId(null);
                      setGateRole("admin");
                      setGatePin("");
                      setGateError("");
                    }
                  } else {
                    // Switch to employee: requires re-lock
                    if (window.confirm(`कर्मचारी पहुँचमा स्विच गर्न PIN पुनः प्रविष्ट गर्नुपर्छ। जारी राख्ने?`)) {
                      setPinUnlocked(false);
                      setGateRole("employee");
                      setGateEmpId(val);
                      setGatePin("");
                      setGateError("");
                    }
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs font-semibold w-[220px] sm:w-[260px] border-primary/30 bg-primary/5 text-foreground focus:ring-primary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__admin__">
                    🔥 मुख्य व्यवस्थापक / Admin (Full Access)
                  </SelectItem>
                  {employees
                    .filter((emp): emp is Employee & { id: string } => Boolean(emp.id))
                    .map((emp) => {
                      const empPerms = permissions.filter((p) => p.employee_id === emp.id);
                      const hasFullAll = empPerms.every((p) => p.access_level === "full_access");
                      const hasReadAll = empPerms.every((p) => p.access_level === "read_only");
                      const badge = hasFullAll ? "✏️ Edit" : hasReadAll ? "👁 Read" : "🔒 Mixed";
                      return (
                        <SelectItem key={emp.id} value={emp.id}>
                          👤 {emp.name}
                          {emp.designation ? ` (${emp.designation})` : ""} — {badge}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground hidden sm:inline">रङ / Theme</span>
              <ThemeSelector />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              aria-label="साइन आउट (Sign out)"
              onClick={signOut}
            >
              <LogOut />
              <span className="hidden sm:inline">साइन आउट</span>
            </Button>
          </div>
          {/* Read-only mode banner — shown when active employee has read_only on current page */}
          {activeEmployeeId && isPageReadOnly(location.pathname) && (
            <div className="no-print flex items-center gap-2 bg-blue-500/10 border-b border-blue-500/30 px-5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              <span>
                👁 हेर्न मात्र पहुँच (Read-only Mode) —{" "}
                {employees.find((e) => e.id === activeEmployeeId)?.name ?? "कर्मचारी"}लाई
                यस पृष्ठमा सम्पादन (Edit/Create/Delete) अनुमति छैन।
              </span>
            </div>
          )}
          {children}
          <ScrollNavigationButtons scrollRef={contentRef} />
        </div>
      </div>
    </AppContext.Provider>
  );
}
