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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeSelector } from "@/components/theme-selector";
import { fiscalYear, todayBS } from "@/lib/receipt-rules";
import { useAppConfig, saveStoredConfig } from "@/lib/app-config";
import {
  getAppConfiguration,
  getEmployeesData,
  getEmployeePermissions,
} from "@/lib/workspace.functions";
import {
  canViewPage,
  canEditPage,
  getPageAccessLevel,
  type EmployeePermission,
  type AccessLevel,
} from "@/lib/permissions";
import type { Employee } from "@/lib/receipt-rules";
import logo from "@/assets/club-logo.asset.json";
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
      { to: "/masters", label: "People Master", icon: Users },
      { to: "/members", label: "Members & Staff", icon: UserCheck },
      { to: "/plans", label: "Plan Master", icon: Layers },
      { to: "/vendors", label: "Vendor Master", icon: Building2 },
      { to: "/items", label: "Items & Assets", icon: Boxes },
    ],
  },
  {
    title: "",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "COLLECTION & OPERATIONS",
    items: [
      { to: "/", label: "New Receipt", icon: Plus },
      { to: "/collection-map", label: "Collection Map", icon: MapPin },
      { to: "/trip-driver", label: "Trips & Driver", icon: Truck },
      { to: "/receipts", label: "Receipt History", icon: History },
    ],
  },
  {
    title: "FINANCE & ACCOUNTING",
    items: [
      { to: "/receipts-payments", label: "Receipts & Payments", icon: Wallet },
      { to: "/expenses", label: "Expenses", icon: ReceiptText },
      { to: "/assets", label: "Assets", icon: Package },
    ],
  },
  {
    title: "EVENTS & GOVERNANCE",
    items: [
      { to: "/events", label: "Events & Programmes", icon: CalendarDays },
      { to: "/minutes", label: "Meeting Minutes", icon: NotebookPen },
    ],
  },
  {
    title: "ADMINISTRATION & AI",
    items: [
      { to: "/ai-assistant", label: "AI Assistant", icon: Bot },
      { to: "/settings", label: "Settings & Permissions", icon: Settings },
      { to: "/reports", label: "Reports & Analytics", icon: BarChart3 },
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
      setPermissions(permList || []);
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
            <div className="flex items-start justify-between gap-2 border-b border-sidebar-border px-4 py-4">
              <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
                <img
                  src={appConfig.logo_url || logo.url}
                  alt={appConfig.entity_name || "Logo"}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/favicon.png";
                  }}
                  className="size-12 shrink-0 rounded-sm bg-card object-contain"
                />
                <div>
                  <div className="text-base font-extrabold truncate max-w-[150px]">
                    {appConfig.entity_sub_name || "HAMI YUWA CLUB"}
                  </div>
                  <div className="text-sm font-bold truncate max-w-[150px]">
                    {appConfig.entity_name || "हामी युवा क्लब"}
                  </div>
                  <div className="text-xs opacity-70 truncate max-w-[150px]">
                    {appConfig.tagline || "for the society"}
                  </div>
                </div>
              </Link>
              {/* Landing page — right corner, logo only */}
              <Button
                variant="outline"
                size="icon"
                className="hidden border-sidebar-border text-sidebar-foreground lg:inline-flex"
                aria-label="संकुचित गर्नुहोस् (Collapse navigation)"
                title="संकुचित गर्नुहोस् (Collapse navigation)"
                onClick={() => setCollapsed(true)}
              >
                <PanelLeftClose />
              </Button>
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
                            <item.icon />
                            <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
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
          {/* Top bar opposite the navigation: employee context + theme + sign out */}
          <div className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-2 backdrop-blur sm:px-7">
            {/* Employee Access Profile Switcher */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-muted-foreground hidden md:inline flex items-center gap-1">
                <UserCheck className="size-3.5 text-primary" />
                पहुँच प्रोफाइल:
              </span>
              <select
                aria-label="सक्रिय कर्मचारी प्रोफाइल (Active Employee Profile)"
                className="h-8 rounded-md border border-input bg-card px-2 text-xs font-semibold text-foreground shadow-xs focus:ring-1 focus:ring-primary"
                value={activeEmployeeId || ""}
                onChange={(e) => setActiveEmployeeId(e.target.value || null)}
              >
                <option value="">👑 मुख्य व्यवस्थापक / Admin (Full Access)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    👤 {emp.name} ({emp.designation})
                  </option>
                ))}
              </select>
              {activeEmployeeId && (
                <span className="hidden lg:inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-800 animate-pulse">
                  कर्मचारी मोड सक्रिय
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 ml-auto">
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
          </div>
          {children}
          <ScrollNavigationButtons scrollRef={contentRef} />
        </div>
      </div>
    </AppContext.Provider>
  );
}
