import { hamiCacheKey } from "@/lib/hami-cache";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAppState, SignInPanel } from "@/components/app-shell";
import {
  getEventsData,
  saveEvent,
  deleteEvent,
  getMembersData,
  getMinutesData,
  getExpensesData,
} from "@/lib/workspace.functions";
import {
  np,
  todayBS,
  type ClubEvent,
  type AuthorizedPerson,
  type Employee,
  type Member,
  type EventMinutes,
  type ExpenseRecord,
  type EventBudgetItem,
} from "@/lib/receipt-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAppConfig } from "@/lib/app-config";
import {
  CalendarDays,
  Plus,
  Edit2,
  Trash2,
  Search,
  MapPin,
  Coins,
  Calendar,
  Users,
  UserCheck,
  CheckCircle2,
  Clock,
  Printer,
  X,
  FileText,
  BadgeAlert,
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
  Tag,
  Phone,
  NotebookPen,
  ListChecks,
  ExternalLink,
  Eye,
  TrendingUp,
  AlertTriangle,
  Receipt,
  Layers,
  ArrowRight,
  Info,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events & Programmes — Sangstha" },
      {
        name: "description",
        content:
          "Manage community sanitation programmes, detailed budget breakdowns, expense tracking, and authorized personnel.",
      },
    ],
  }),
  component: EventsPage,
});

const money = (n: number) => "रु. " + (n || 0).toLocaleString("en-IN");

/** Common budget implementation presets for community clubs & sanitation campaigns */
const BUDGET_PRESETS: {
  name: string;
  icon: string;
  items: Omit<EventBudgetItem, "id">[];
}[] = [
  {
    name: "सरसफाइ अभियान",
    icon: "🧹",
    items: [
      {
        category: "सुरक्षा तथा व्यक्तिगत सामग्री",
        description: "मास्क, पञ्जा, एप्रोन र गमबुट खरिद",
        estimated_amount: 15000,
        allocated_amount: 15000,
      },
      {
        category: "ढुवानी तथा इन्धन",
        description: "फोहोर संकलन टिपर/ट्र्याक्टर इन्धन तथा चालक ज्याला",
        estimated_amount: 12000,
        allocated_amount: 12000,
      },
      {
        category: "खाजा तथा पानी",
        description: "अभियानमा खटिने स्वयंसेवक तथा कर्मचारी खाजा",
        estimated_amount: 10000,
        allocated_amount: 10000,
      },
      {
        category: "डस्टबिन तथा संकलन उपकरण",
        description: "टोलमा वितरण गरिने डस्टबिन, बेल्चा तथा कुचो",
        estimated_amount: 18000,
        allocated_amount: 18000,
      },
      {
        category: "प्रचारप्रसार तथा ब्यानर",
        description: "फ्लेक्स ब्यानर, माइकिङ तथा सूचना पर्चा",
        estimated_amount: 5000,
        allocated_amount: 5000,
      },
    ],
  },
  {
    name: "खेलकुद तथा सांस्कृतिक उत्सव",
    icon: "🏆",
    items: [
      {
        category: "मैदान तथा हल व्यवस्थापन",
        description: "खेल मैदान तयारी, सरसफाइ र रेखांकन",
        estimated_amount: 20000,
        allocated_amount: 20000,
      },
      {
        category: "पुरस्कार, मेडल तथा ट्रफी",
        description: "प्रथम, दोस्रो, तेस्रो पुरस्कार, ट्रफी र प्रमाणपत्र",
        estimated_amount: 25000,
        allocated_amount: 25000,
      },
      {
        category: "ध्वनि तथा मञ्च व्यवस्थापन",
        description: "साउन्ड सिस्टम, माइक, मञ्च र टेन्ट भाडा",
        estimated_amount: 15000,
        allocated_amount: 15000,
      },
      {
        category: "खाजा तथा स्वयंसेवक भत्ता",
        description: "रेफ्री, निर्णायक र स्वयंसेवकहरूको खाजा भत्ता",
        estimated_amount: 15000,
        allocated_amount: 15000,
      },
      {
        category: "ब्यानर तथा प्रचारप्रसार",
        description: "उत्सव ब्यानर, प्रचार र आमन्त्रण पत्र",
        estimated_amount: 5000,
        allocated_amount: 5000,
      },
    ],
  },
  {
    name: "तालिम, गोष्ठी तथा सचेतना",
    icon: "🎓",
    items: [
      {
        category: "प्रशिक्षक / स्रोत व्यक्ति भत्ता",
        description: "विज्ञ सहजकर्ता तथा प्रशिक्षक पारिश्रमिक",
        estimated_amount: 15000,
        allocated_amount: 15000,
      },
      {
        category: "हल भाडा तथा अडियो-भिडियो",
        description: "प्रोजेक्टर, अडियो र तालिम हल भाडा",
        estimated_amount: 10000,
        allocated_amount: 10000,
      },
      {
        category: "खाजा तथा चियापान",
        description: "सहभागी, अतिथि तथा सहजकर्ता खाजा खर्च",
        estimated_amount: 12000,
        allocated_amount: 12000,
      },
      {
        category: "स्टेशनरी तथा तालिम सामग्री",
        description: "डायरी, कलम, फाइल फोल्डर र म्यानुअल प्रिन्ट",
        estimated_amount: 8000,
        allocated_amount: 8000,
      },
      {
        category: "प्रमाणपत्र तथा ब्यानर",
        description: "सहभागिता प्रमाणपत्र र मञ्च ब्यानर",
        estimated_amount: 5000,
        allocated_amount: 5000,
      },
    ],
  },
];

const emptyEvent = (): ClubEvent => ({
  title: "",
  locality: "",
  budget_required: 60000,
  budget_allocated: 60000,
  budget_breakdown: [],
  commencing_date: todayBS(),
  end_date: "",
  status: "planned",
  authorized_persons: [],
  remarks: "",
});

function EventsPage() {
  const app = useAppState();
  const config = useAppConfig();
  const queryClient = useQueryClient();
  const fetchEventsFn = useServerFn(getEventsData);
  const saveEventFn = useServerFn(saveEvent);
  const deleteEventFn = useServerFn(deleteEvent);
  const fetchMembersFn = useServerFn(getMembersData);
  const fetchMinutesFn = useServerFn(getMinutesData);
  const fetchExpensesFn = useServerFn(getExpensesData);

  // Load events
  const query = useQuery({
    queryKey: ["events_data", app.userId],
    queryFn: () => fetchEventsFn(),
    enabled: app.ready && app.signedIn,
  });

  // Load minutes to show related meeting minutes and agenda stage
  const minutesQuery = useQuery({
    queryKey: ["minutes_data", app.userId],
    queryFn: () => fetchMinutesFn(),
    enabled: app.ready && app.signedIn,
  });

  const minutesList: EventMinutes[] = useMemo(
    () => minutesQuery.data?.minutes ?? [],
    [minutesQuery.data],
  );

  // Load expenses to track actual spent against event budgets
  const expensesQuery = useQuery({
    queryKey: ["expenses_data", app.userId],
    queryFn: () => fetchExpensesFn(),
    enabled: app.ready && app.signedIn,
  });

  const expensesList: ExpenseRecord[] = useMemo(
    () => expensesQuery.data ?? [],
    [expensesQuery.data],
  );

  // Helper for computing event's minutes, completed agendas and stage
  const getEventMinutesSummary = (eventId?: string) => {
    if (!eventId) return null;
    const evMinutes = minutesList.filter((m) => m.event_id === eventId);
    if (evMinutes.length === 0) return null;
    const allAgendas = evMinutes.flatMap((m) => m.agenda || []);
    const totalAgendas = allAgendas.length;
    const completedAgendas = allAgendas.filter((a) => a.done).length;
    const pendingAgendas = totalAgendas - completedAgendas;
    const latest = [...evMinutes].sort((a, b) =>
      (b.meeting_date || "").localeCompare(a.meeting_date || ""),
    )[0];
    const stage =
      totalAgendas === 0
        ? "मिनेट दर्ता"
        : completedAgendas === totalAgendas
          ? "सबै निर्णय पूरा"
          : `${pendingAgendas} एजेन्डा कार्यान्वयन जारी`;
    const isAllDone = totalAgendas > 0 && completedAgendas === totalAgendas;
    return {
      count: evMinutes.length,
      totalAgendas,
      completedAgendas,
      pendingAgendas,
      latestDate: latest?.meeting_date,
      stage,
      isAllDone,
      evMinutes,
    };
  };

  // Helper for computing event budget, linked expenses and burn rate
  const getEventBudgetAndExpenseStats = (ev: ClubEvent) => {
    const linkedExpenses = expensesList.filter((e) => e.linked_event_id === ev.id);
    const actualSpent = linkedExpenses.reduce(
      (sum, e) => sum + (Number(e.final_amount) || 0),
      0,
    );
    const budgetTotal = Number(ev.budget_allocated || ev.budget_required) || 0;
    const remainingBudget = budgetTotal - actualSpent;
    const burnPercent =
      budgetTotal > 0
        ? Math.min(Math.round((actualSpent / budgetTotal) * 100), 100)
        : 0;
    const isOverspent = actualSpent > budgetTotal && budgetTotal > 0;
    return {
      linkedExpenses,
      actualSpent,
      budgetTotal,
      remainingBudget,
      burnPercent,
      isOverspent,
    };
  };

  // State for previewing an event's minutes
  const [viewingMinutesEvent, setViewingMinutesEvent] = useState<ClubEvent | null>(null);

  // State for viewing full programme details and linked expenses
  const [viewingDetailEvent, setViewingDetailEvent] = useState<ClubEvent | null>(null);

  // Load employees and members for coordinator picker
  const membersQuery = useQuery({
    queryKey: ["members_data", app.userId],
    queryFn: () => fetchMembersFn(),
    enabled: app.ready && app.signedIn,
  });

  const employees: Employee[] = membersQuery.data?.employees ?? [];
  const members: Member[] =
    membersQuery.data?.members ??
    (membersQuery.data as unknown as { bodMembers?: Member[] })?.bodMembers ??
    [];

  // Local state with seed fallback
  const [eventsList, setEventsList] = useState<ClubEvent[]>(() => {
    try {
      const stored = localStorage.getItem(hamiCacheKey("hami_events_cache"));
      if (stored) return JSON.parse(stored);
    } catch {
      // cache unavailable — fall back to seed data
    }
    return [];
  });

  useEffect(() => {
    if (query.data?.events && query.data.events.length > 0) {
      setEventsList(query.data.events);
      try {
        localStorage.setItem(
          hamiCacheKey("hami_events_cache"),
          JSON.stringify(query.data.events),
        );
      } catch {
        // storage unavailable
      }
    }
  }, [query.data]);

  // View & Filter states
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ClubEvent | null>(null);
  const [form, setForm] = useState<ClubEvent>(emptyEvent());

  // Authorized person builder inside modal
  const [authPersonName, setAuthPersonName] = useState("");
  const [authPersonRole, setAuthPersonRole] = useState("संयोजक (Coordinator)");
  const [authPersonPhone, setAuthPersonPhone] = useState("");
  const [authPersonType, setAuthPersonType] = useState<"employee" | "member" | "other">("employee");

  // Print voucher preview
  const [printPreviewEvent, setPrintPreviewEvent] = useState<ClubEvent | null>(null);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return eventsList.filter((ev) => {
      const matchesSearch =
        !q ||
        ev.title.toLowerCase().includes(q) ||
        ev.locality.toLowerCase().includes(q) ||
        (ev.remarks && ev.remarks.toLowerCase().includes(q)) ||
        ev.authorized_persons?.some((p) => p.name.toLowerCase().includes(q));

      const matchesStatus = statusFilter === "all" || ev.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [eventsList, searchTerm, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = eventsList.length;
    const ongoing = eventsList.filter((e) => e.status === "ongoing").length;
    const planned = eventsList.filter((e) => e.status === "planned").length;
    const completed = eventsList.filter((e) => e.status === "completed").length;
    const totalBudget = eventsList.reduce(
      (acc, e) => acc + (Number(e.budget_allocated || e.budget_required) || 0),
      0,
    );
    const totalSpent = eventsList.reduce((acc, e) => {
      const spent = expensesList
        .filter((x) => x.linked_event_id === e.id)
        .reduce((s, x) => s + (Number(x.final_amount) || 0), 0);
      return acc + spent;
    }, 0);
    return { total, ongoing, planned, completed, totalBudget, totalSpent };
  }, [eventsList, expensesList]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingEvent(null);
    setForm(emptyEvent());
    setModalOpen(true);
  };

  const handleOpenEdit = (ev: ClubEvent) => {
    setEditingEvent(ev);
    setForm({
      ...ev,
      authorized_persons: ev.authorized_persons ? [...ev.authorized_persons] : [],
      budget_breakdown: ev.budget_breakdown ? [...ev.budget_breakdown] : [],
    });
    setModalOpen(true);
  };

  // Budget Breakdown row helpers
  const handleAddBudgetItem = () => {
    const newItem: EventBudgetItem = {
      id: `bi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: "",
      description: "",
      estimated_amount: 0,
      allocated_amount: 0,
    };
    setForm((prev) => ({
      ...prev,
      budget_breakdown: [...(prev.budget_breakdown || []), newItem],
    }));
  };

  const handleRemoveBudgetItem = (idx: number) => {
    setForm((prev) => {
      const updated = (prev.budget_breakdown || []).filter((_, i) => i !== idx);
      const estSum = updated.reduce((s, it) => s + (Number(it.estimated_amount) || 0), 0);
      const allocSum = updated.reduce(
        (s, it) => s + (Number(it.allocated_amount ?? it.estimated_amount) || 0),
        0,
      );
      return {
        ...prev,
        budget_breakdown: updated,
        budget_required: updated.length > 0 ? estSum : prev.budget_required,
        budget_allocated: updated.length > 0 ? allocSum : prev.budget_allocated,
      };
    });
  };

  const handleUpdateBudgetItem = (
    idx: number,
    field: keyof EventBudgetItem,
    val: string | number,
  ) => {
    setForm((prev) => {
      const updated = [...(prev.budget_breakdown || [])];
      if (!updated[idx]) return prev;
      updated[idx] = { ...updated[idx], [field]: val };

      // Auto-sync totals when estimated/allocated changes
      let req = prev.budget_required;
      let alloc = prev.budget_allocated;
      if (field === "estimated_amount" || field === "allocated_amount") {
        req = updated.reduce((s, it) => s + (Number(it.estimated_amount) || 0), 0);
        alloc = updated.reduce(
          (s, it) => s + (Number(it.allocated_amount ?? it.estimated_amount) || 0),
          0,
        );
      }

      return {
        ...prev,
        budget_breakdown: updated,
        budget_required: req,
        budget_allocated: alloc,
      };
    });
  };

  const handleApplyBudgetPreset = (presetIndex: number) => {
    const preset = BUDGET_PRESETS[presetIndex];
    if (!preset) return;
    const newItems: EventBudgetItem[] = preset.items.map((it, i) => ({
      ...it,
      id: `bi-preset-${Date.now()}-${i}`,
    }));
    const estSum = newItems.reduce((s, it) => s + it.estimated_amount, 0);
    const allocSum = newItems.reduce((s, it) => s + (it.allocated_amount || it.estimated_amount), 0);

    setForm((prev) => ({
      ...prev,
      budget_breakdown: newItems,
      budget_required: estSum,
      budget_allocated: allocSum,
    }));
  };

  const handleAddAuthorizedPerson = () => {
    if (!authPersonName.trim()) return;
    const newPerson: AuthorizedPerson = {
      name: authPersonName.trim(),
      role: authPersonRole.trim() || "सदस्य / प्रतिनिधि",
      phone: authPersonPhone.trim(),
      type: authPersonType,
    };

    setForm((prev) => ({
      ...prev,
      authorized_persons: [...(prev.authorized_persons || []), newPerson],
    }));

    setAuthPersonName("");
    setAuthPersonPhone("");
  };

  const handleSelectFromPreset = (val: string) => {
    if (!val) return;
    const [type, id] = val.split(":");
    if (type === "emp") {
      const emp = employees.find((e) => e.id === id);
      if (emp) {
        setAuthPersonName(emp.name);
        setAuthPersonPhone(emp.phone || "");
        setAuthPersonType("employee");
        setAuthPersonRole(`${emp.designation} (सहभागी)`);
      }
    } else if (type === "mem") {
      const mem = members.find((m) => m.id === id);
      if (mem) {
        setAuthPersonName(mem.name);
        setAuthPersonPhone(mem.phone || "");
        setAuthPersonType("member");
        setAuthPersonRole(`${mem.designation} (संयोजक)`);
      }
    }
  };

  const handleRemoveAuthorizedPerson = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      authorized_persons: prev.authorized_persons.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.locality.trim()) return;

    try {
      const res = await saveEventFn({
        data: {
          id: editingEvent?.id,
          title: form.title,
          locality: form.locality,
          budget_required: Number(form.budget_required) || 0,
          budget_allocated: Number(form.budget_allocated) || 0,
          budget_breakdown: form.budget_breakdown || [],
          commencing_date: form.commencing_date,
          end_date: form.end_date,
          status: form.status,
          authorized_persons: form.authorized_persons || [],
          remarks: form.remarks || "",
        },
      });

      const updated = editingEvent
        ? eventsList.map((e) => (e.id === editingEvent.id ? res : e))
        : [res, ...eventsList];
      setEventsList(updated);
      try {
        localStorage.setItem(
          hamiCacheKey("hami_events_cache"),
          JSON.stringify(updated),
        );
      } catch {
        // storage unavailable
      }
      void queryClient.invalidateQueries({ queryKey: ["events_data"] });
    } catch {
      // Local fallback
      const localItem: ClubEvent = {
        ...form,
        id: editingEvent?.id || `local-evt-${Date.now()}`,
      };
      const updated = editingEvent
        ? eventsList.map((e) => (e.id === editingEvent.id ? localItem : e))
        : [localItem, ...eventsList];
      setEventsList(updated);
      try {
        localStorage.setItem(
          hamiCacheKey("hami_events_cache"),
          JSON.stringify(updated),
        );
      } catch {
        // storage unavailable
      }
    }
    setModalOpen(false);
  };

  const handleDelete = async (id?: string) => {
    if (!id || !confirm("के तपाईं यो कार्यक्रम हटाउन निश्चित हुनुहुन्छ?")) return;
    try {
      await deleteEventFn({ data: { id } });
    } catch {
      // server delete may fail if migration pending; reflect locally regardless
    }
    const updated = eventsList.filter((e) => e.id !== id);
    setEventsList(updated);
    try {
      localStorage.setItem(
        hamiCacheKey("hami_events_cache"),
        JSON.stringify(updated),
      );
    } catch {
      // storage unavailable
    }
  };

  if (!app.ready) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
        <p role="status">Opening events module…</p>
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

  const statusBadge = (st: string) => {
    switch (st) {
      case "ongoing":
        return {
          label: "जारी (Ongoing)",
          bg: "bg-blue-500/15 text-blue-700 border-blue-500/30",
        };
      case "completed":
        return {
          label: "सम्पन्न (Completed)",
          bg: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
        };
      case "postponed":
        return {
          label: "स्थगित (Postponed)",
          bg: "bg-destructive/15 text-destructive border-destructive/30",
        };
      default:
        return {
          label: "योजना गरिएको (Planned)",
          bg: "bg-amber-500/15 text-amber-700 border-amber-500/30",
        };
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <CalendarDays className="size-6 text-primary" />
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              कार्यक्रम तथा उत्सवहरू (Events & Programmes)
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            विस्तृत कार्ययोजना, बजेट शीर्षक विनियोजन तथा सम्बन्धित खर्च ट्र्याकिङ
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 font-bold shadow-xs bg-primary text-primary-foreground"
        >
          <Plus className="size-4" />
          <span>नयाँ कार्यक्रम तथा बजेट दर्ता</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs text-muted-foreground font-medium">कुल कार्यक्रमहरू</div>
          <div className="mt-1 text-2xl font-extrabold text-foreground">{stats.total}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            जारी: <strong className="text-blue-600">{stats.ongoing}</strong> | योजना: {stats.planned}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs text-muted-foreground font-medium">सम्पन्न कार्यक्रमहरू</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-600">
            {stats.completed}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            सफलतापूर्वक सम्पन्न
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs text-muted-foreground font-medium">कुल स्वीकृत बजेट</div>
          <div className="mt-1 text-xl font-extrabold text-primary">
            {money(stats.totalBudget)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            सबै कार्यक्रमका लागि
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs text-muted-foreground font-medium">वास्तविक खर्च (Actual Spent)</div>
          <div className="mt-1 text-xl font-extrabold text-purple-600 dark:text-purple-400">
            {money(stats.totalSpent)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            खर्च प्रविष्टिबाट ट्र्याक
          </div>
        </div>
      </div>

      {/* Action / Search / Filter Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="कार्यक्रम, स्थान वा संयोजक खोज्नुहोस्…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-xs"
          >
            <option value="all">सबै अवस्था (All Status)</option>
            <option value="planned">योजना गरिएको (Planned)</option>
            <option value="ongoing">जारी (Ongoing)</option>
            <option value="completed">सम्पन्न (Completed)</option>
            <option value="postponed">स्थगित (Postponed)</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center rounded-lg border bg-muted/30 p-1">
          <Button
            variant={viewMode === "cards" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("cards")}
            className="h-7 px-2.5 text-xs font-semibold"
          >
            <LayoutGrid className="mr-1 size-3.5" />
            <span>कार्ड (Cards)</span>
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("table")}
            className="h-7 px-2.5 text-xs font-semibold"
          >
            <TableIcon className="mr-1 size-3.5" />
            <span>तालिका (Table)</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CARDS VIEW */}
      {/* ========================================================================= */}
      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.length === 0 ? (
            <div className="col-span-full py-14 text-center text-muted-foreground rounded-xl border bg-card p-6">
              कुनै कार्यक्रम फेला परेन। माथि 'नयाँ कार्यक्रम तथा बजेट दर्ता' बटनबाट कार्यक्रम थप्न
              सक्नुहुन्छ।
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const badge = statusBadge(ev.status);
              const bStats = getEventBudgetAndExpenseStats(ev);
              const minSummary = getEventMinutesSummary(ev.id);
              const breakdownCount = ev.budget_breakdown?.length || 0;

              return (
                <div
                  key={ev.id}
                  className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md"
                >
                  <div>
                    {/* Top Status & Date */}
                    <div className="flex items-center justify-between gap-2 border-b pb-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badge.bg}`}
                      >
                        {badge.label}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                        <Calendar className="size-3.5" />
                        <span>सुरु: {np(ev.commencing_date)}</span>
                      </div>
                    </div>

                    {/* Title & Locality */}
                    <h3 className="mt-3 text-base font-extrabold text-foreground leading-snug line-clamp-2">
                      {ev.title}
                    </h3>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0 text-primary" />
                      <span className="font-medium truncate">{ev.locality}</span>
                    </div>

                    {/* Budget & Expense Tracking Box */}
                    <div className="mt-3.5 rounded-xl border bg-muted/20 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">बजेट तथा खर्च स्थिति:</span>
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                          {breakdownCount > 0 ? `${breakdownCount} शीर्षक` : "एकमुष्ट बजेट"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">स्वीकृत बजेट:</span>
                        <span className="font-extrabold text-foreground">
                          {money(bStats.budgetTotal)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">वास्तविक खर्च:</span>
                        <span
                          className={`font-black ${
                            bStats.isOverspent ? "text-destructive" : "text-purple-600 dark:text-purple-400"
                          }`}
                        >
                          {money(bStats.actualSpent)}
                        </span>
                      </div>

                      {/* Burn Progress Bar */}
                      <div className="space-y-1 pt-0.5">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full transition-all ${
                              bStats.isOverspent
                                ? "bg-destructive"
                                : bStats.burnPercent > 80
                                  ? "bg-amber-500"
                                  : "bg-primary"
                            }`}
                            style={{ width: `${Math.min(bStats.burnPercent, 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span
                            className={
                              bStats.isOverspent
                                ? "font-bold text-destructive"
                                : "text-muted-foreground"
                            }
                          >
                            {bStats.isOverspent
                              ? `बजेट नाघेको: ${money(Math.abs(bStats.remainingBudget))}`
                              : `बाँकी: ${money(bStats.remainingBudget)}`}
                          </span>
                          <span className="font-mono font-bold text-muted-foreground">
                            {bStats.burnPercent}% उपयोग
                          </span>
                        </div>
                      </div>

                      {/* Linked bills info */}
                      <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Receipt className="size-3 text-primary" />
                          <span>{bStats.linkedExpenses.length} खर्च बिल संलग्न</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setViewingDetailEvent(ev)}
                          className="font-bold text-primary hover:underline"
                        >
                          खर्च हेर्नुहोस् →
                        </button>
                      </div>
                    </div>

                    {/* Authorized Persons / Coordinators */}
                    <div className="mt-3.5">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                        अधिकृत व्यक्ति तथा टोली:
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {ev.authorized_persons && ev.authorized_persons.length > 0 ? (
                          ev.authorized_persons.map((ap, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground"
                              title={`${ap.name} (${ap.role || ""}) - ${ap.phone || ""}`}
                            >
                              <UserCheck className="size-3 text-primary" />
                              <span>{ap.name}</span>
                              {ap.role && (
                                <span className="text-[9px] text-muted-foreground">
                                  ({ap.role})
                                </span>
                              )}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            कुनै तोकिएको छैन
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Meeting Minutes & Progress Section ── */}
                    {(() => {
                      if (minSummary) {
                        return (
                          <div className="mt-3.5 rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="flex items-center gap-1.5 text-xs font-black text-foreground">
                                <NotebookPen className="size-3.5 text-primary" />
                                <span>{minSummary.count} वटा बैठक मिनेट</span>
                              </span>
                              <Badge
                                variant="outline"
                                className={
                                  "text-[10px] font-bold px-2 py-0.2 " +
                                  (minSummary.isAllDone
                                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                                    : minSummary.pendingAgendas > 0
                                      ? "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300"
                                      : "bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300")
                                }
                              >
                                {minSummary.stage}
                              </Badge>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>
                                एजेन्डा प्रगति:{" "}
                                <strong className="text-foreground">
                                  {minSummary.completedAgendas}/{minSummary.totalAgendas} पूरा
                                </strong>
                              </span>
                              {minSummary.latestDate && (
                                <span className="font-mono">
                                  अन्तिम: {np(minSummary.latestDate)}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] font-bold flex-1 bg-background hover:bg-muted"
                                onClick={() => setViewingMinutesEvent(ev)}
                              >
                                <FileText className="size-3 mr-1 text-primary" />
                                मिनेट हेर्नुहोस्
                              </Button>
                              <Button
                                size="sm"
                                asChild
                                variant="ghost"
                                className="h-7 px-2 text-[11px] font-bold text-primary hover:bg-primary/10"
                              >
                                <Link to="/minutes" search={{ event_id: ev.id, new: "true" }}>
                                  <Plus className="size-3 mr-0.5" /> थप बैठक
                                </Link>
                              </Button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="mt-3.5 flex items-center justify-between rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-xs">
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <NotebookPen className="size-3 text-muted-foreground" />
                            मिनेट दर्ता छैन
                          </span>
                          <Button
                            size="sm"
                            asChild
                            variant="outline"
                            className="h-6 px-2 text-[10px] font-bold text-primary border-primary/30 hover:bg-primary/10"
                          >
                            <Link to="/minutes" search={{ event_id: ev.id, new: "true" }}>
                              <Plus className="size-2.5 mr-0.5" /> मिनेट तयार गर्नुहोस्
                            </Link>
                          </Button>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-5 flex items-center justify-between border-t pt-3 gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 text-xs font-bold flex items-center gap-1 bg-primary text-primary-foreground"
                      onClick={() => setViewingDetailEvent(ev)}
                    >
                      <Eye className="size-3.5" />
                      <span>विस्तृत हेर्नुहोस् (View)</span>
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        title="अख्तियारी पत्र प्रिन्ट"
                        onClick={() => setPrintPreviewEvent(ev)}
                      >
                        <FileText className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="सम्पादन गर्नुहोस्"
                        onClick={() => handleOpenEdit(ev)}
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:bg-destructive/10"
                        title="हटाउनुहोस्"
                        onClick={() => handleDelete(ev.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* TABLE VIEW */
        /* ========================================================================= */
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">सि.नं.</th>
                <th className="px-4 py-3">कार्यक्रमको नाम (Programme Name)</th>
                <th className="px-4 py-3">स्थान (Locality)</th>
                <th className="px-4 py-3 text-right">बजेट तथा खर्च (Budget & Spent)</th>
                <th className="px-4 py-3">सुरु हुने मिति</th>
                <th className="px-4 py-3">अधिकृत व्यक्तिहरू</th>
                <th className="px-4 py-3">बैठक मिनेट</th>
                <th className="px-4 py-3">अवस्था</th>
                <th className="no-print px-4 py-3 text-right">कार्य</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    कुनै कार्यक्रम फेला परेन।
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev, idx) => {
                  const badge = statusBadge(ev.status);
                  const bStats = getEventBudgetAndExpenseStats(ev);
                  const minSummary = getEventMinutesSummary(ev.id);

                  return (
                    <tr key={ev.id || idx} className="hover:bg-muted/15 transition-colors">
                      <td className="px-4 py-3 font-mono">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setViewingDetailEvent(ev)}
                          className="font-bold text-foreground text-left hover:text-primary transition-colors"
                        >
                          {ev.title}
                        </button>
                        {ev.remarks && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-xs">
                            {ev.remarks}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="size-3 text-primary" />
                          <span>{ev.locality}</span>
                        </div>
                      </td>
                      {/* Budget and Spent column */}
                      <td className="px-4 py-3 text-right">
                        <div className="font-extrabold text-foreground">
                          {money(bStats.budgetTotal)}
                        </div>
                        <div className="flex items-center justify-end gap-1 text-[11px]">
                          <span className="text-muted-foreground">खर्च:</span>
                          <span
                            className={`font-black ${
                              bStats.isOverspent ? "text-destructive" : "text-purple-600 dark:text-purple-400"
                            }`}
                          >
                            {money(bStats.actualSpent)}
                          </span>
                        </div>
                        {bStats.isOverspent && (
                          <div className="text-[10px] font-bold text-destructive">
                            बजेट नाघेको!
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono">{np(ev.commencing_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {ev.authorized_persons?.map((p, i) => (
                            <span
                              key={i}
                              className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium"
                            >
                              {p.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      {/* Minutes & Stage */}
                      <td className="px-4 py-3">
                        {minSummary ? (
                          <div className="flex flex-col gap-1 items-start">
                            <button
                              type="button"
                              onClick={() => setViewingMinutesEvent(ev)}
                              className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/25 px-2 py-0.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
                            >
                              <NotebookPen className="size-3" />
                              <span>
                                {minSummary.count} मिनेट ({minSummary.completedAgendas}/
                                {minSummary.totalAgendas})
                              </span>
                            </button>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              {minSummary.stage}
                            </span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            asChild
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px] font-bold text-muted-foreground hover:text-primary"
                          >
                            <Link to="/minutes" search={{ event_id: ev.id, new: "true" }}>
                              + मिनेट थप्नुहोस्
                            </Link>
                          </Button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="no-print px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="default"
                            size="icon"
                            className="size-7 bg-primary text-primary-foreground"
                            title="विस्तृत विवरण हेर्नुहोस् (View)"
                            onClick={() => setViewingDetailEvent(ev)}
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="अख्तियारी पत्र प्रिन्ट"
                            onClick={() => setPrintPreviewEvent(ev)}
                          >
                            <FileText className="size-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="सम्पादन गर्नुहोस्"
                            onClick={() => handleOpenEdit(ev)}
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:bg-destructive/10"
                            title="हटाउनुहोस्"
                            onClick={() => handleDelete(ev.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. VIEW PROGRAMME DETAILS & BUDGET EXPENSE TRACKING MODAL */}
      {/* ========================================================================= */}
      {viewingDetailEvent && (() => {
        const ev = viewingDetailEvent;
        const bStats = getEventBudgetAndExpenseStats(ev);
        const minSummary = getEventMinutesSummary(ev.id);
        const badge = statusBadge(ev.status);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
            <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border bg-card p-6 shadow-2xl">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${badge.bg}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      सुरु: {np(ev.commencing_date)}
                      {ev.end_date && ` — सम्पन्न: ${np(ev.end_date)}`}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-foreground tracking-tight">
                    {ev.title}
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 text-primary" />
                    <span>स्थान / टोल: <strong>{ev.locality}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-bold flex items-center gap-1"
                    onClick={() => {
                      setPrintPreviewEvent(ev);
                    }}
                  >
                    <Printer className="size-3.5" />
                    <span>अख्तियारी पत्र</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-bold flex items-center gap-1"
                    onClick={() => {
                      handleOpenEdit(ev);
                      setViewingDetailEvent(null);
                    }}
                  >
                    <Edit2 className="size-3.5" />
                    <span>सम्पादन</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg"
                    onClick={() => setViewingDetailEvent(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-6 text-xs">
                {/* 4 Top KPI Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <div className="text-[11px] text-muted-foreground font-medium">अनुमानित आवश्यक बजेट</div>
                    <div className="mt-1 text-lg font-extrabold text-foreground">
                      {money(ev.budget_required)}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-primary/5 border-primary/20 p-3">
                    <div className="text-[11px] text-primary font-bold">स्वीकृत विनियोजित बजेट</div>
                    <div className="mt-1 text-lg font-black text-primary">
                      {money(bStats.budgetTotal)}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-purple-500/10 border-purple-500/20 p-3">
                    <div className="text-[11px] text-purple-700 dark:text-purple-300 font-bold">
                      वास्तविक भएको खर्च (Spent)
                    </div>
                    <div className="mt-1 text-lg font-black text-purple-700 dark:text-purple-300">
                      {money(bStats.actualSpent)}
                    </div>
                  </div>
                  <div
                    className={`rounded-xl border p-3 ${
                      bStats.isOverspent
                        ? "bg-destructive/10 border-destructive/30"
                        : "bg-emerald-500/10 border-emerald-500/20"
                    }`}
                  >
                    <div
                      className={`text-[11px] font-bold ${
                        bStats.isOverspent ? "text-destructive" : "text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {bStats.isOverspent ? "बजेट नाघेको (Overspent)" : "बाँकी बजेट बचत"}
                    </div>
                    <div
                      className={`mt-1 text-lg font-black ${
                        bStats.isOverspent ? "text-destructive" : "text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {money(Math.abs(bStats.remainingBudget))}
                    </div>
                  </div>
                </div>

                {/* Live Burn Progress Bar */}
                <div className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <TrendingUp className="size-4 text-primary" />
                      <span>बजेट उपयोग दर (Budget Burn Rate)</span>
                    </span>
                    <span
                      className={`font-mono ${
                        bStats.isOverspent ? "text-destructive" : "text-primary"
                      }`}
                    >
                      {bStats.burnPercent}% उपयोग भएको
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all ${
                        bStats.isOverspent
                          ? "bg-destructive"
                          : bStats.burnPercent > 80
                            ? "bg-amber-500"
                            : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(bStats.burnPercent, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>खर्च गरिएको: <strong>{money(bStats.actualSpent)}</strong></span>
                    <span>कुल बजेट सिमा: <strong>{money(bStats.budgetTotal)}</strong></span>
                  </div>
                </div>

                {/* Section 1: Itemized Implementation & Budget Plan */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-1.5">
                      <Layers className="size-4 text-primary" />
                      <h3 className="text-sm font-extrabold text-foreground">
                        विस्तृत कार्ययोजना तथा बजेट शीर्षकहरू (Itemized Budget Plan)
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {(ev.budget_breakdown || []).length} शीर्षकहरू
                    </span>
                  </div>

                  {ev.budget_breakdown && ev.budget_breakdown.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border">
                        <thead className="bg-muted font-semibold">
                          <tr>
                            <th className="p-2 border">सि.नं.</th>
                            <th className="p-2 border">बजेट शीर्षक (Category)</th>
                            <th className="p-2 border">विवरण तथा कार्यान्वयन योजना</th>
                            <th className="p-2 border text-right">अनुमानित रकम (रु.)</th>
                            <th className="p-2 border text-right">विनियोजित बजेट (रु.)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {ev.budget_breakdown.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-muted/20">
                              <td className="p-2 border font-mono text-center">{idx + 1}</td>
                              <td className="p-2 border font-bold text-foreground">
                                {item.category}
                              </td>
                              <td className="p-2 border text-muted-foreground">
                                {item.description || "—"}
                              </td>
                              <td className="p-2 border text-right font-mono font-medium">
                                {money(item.estimated_amount)}
                              </td>
                              <td className="p-2 border text-right font-mono font-bold text-primary">
                                {money(item.allocated_amount ?? item.estimated_amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/40 font-extrabold border-t">
                          <tr>
                            <td colSpan={3} className="p-2 border text-right">
                              कुल जम्मा (Total):
                            </td>
                            <td className="p-2 border text-right font-mono text-foreground">
                              {money(
                                ev.budget_breakdown.reduce(
                                  (s, it) => s + (Number(it.estimated_amount) || 0),
                                  0,
                                ),
                              )}
                            </td>
                            <td className="p-2 border text-right font-mono text-primary text-sm">
                              {money(
                                ev.budget_breakdown.reduce(
                                  (s, it) =>
                                    s + (Number(it.allocated_amount ?? it.estimated_amount) || 0),
                                  0,
                                ),
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground space-y-1">
                      <p>यस कार्यक्रममा कुनै विस्तृत शीर्षक विभाजन गरिएको छैन (एकमुष्ट बजेट प्रविष्टि गरिएको छ)।</p>
                      <button
                        type="button"
                        onClick={() => {
                          handleOpenEdit(ev);
                          setViewingDetailEvent(null);
                        }}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        + सम्पादन गरी विस्तृत बजेट शीर्षकहरू थप्नुहोस्
                      </button>
                    </div>
                  )}
                </div>

                {/* Section 2: Linked Expenses Tracking */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                    <div className="flex items-center gap-1.5">
                      <Receipt className="size-4 text-primary" />
                      <h3 className="text-sm font-extrabold text-foreground">
                        सम्बन्धित खर्चहरूको विवरण (Linked Expenses Tracking)
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        कुल खर्च: <strong className="text-purple-600 dark:text-purple-400">{money(bStats.actualSpent)}</strong>
                      </span>
                      <Button
                        size="sm"
                        asChild
                        variant="outline"
                        className="h-7 px-2 text-[11px] font-bold text-primary border-primary/30 hover:bg-primary/10"
                      >
                        <Link to="/expenses" search={{ event_id: ev.id, new: "true" }}>
                          <Plus className="size-3 mr-0.5" /> नयाँ खर्च प्रविष्टि
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {bStats.linkedExpenses.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border">
                        <thead className="bg-muted font-semibold">
                          <tr>
                            <th className="p-2 border">सि.नं.</th>
                            <th className="p-2 border">मिति (BS)</th>
                            <th className="p-2 border">बिल नं.</th>
                            <th className="p-2 border">खर्च प्रकार</th>
                            <th className="p-2 border">भेन्डर / भुक्तानी पाउने</th>
                            <th className="p-2 border text-right">रकम (रु.)</th>
                            <th className="p-2 border">कैफियत</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {bStats.linkedExpenses.map((exp, idx) => (
                            <tr key={exp.id || idx} className="hover:bg-muted/20">
                              <td className="p-2 border font-mono text-center">{idx + 1}</td>
                              <td className="p-2 border font-mono">{np(exp.date_bs)}</td>
                              <td className="p-2 border font-mono font-medium">
                                {exp.bill_number || "—"}
                              </td>
                              <td className="p-2 border">
                                <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-semibold">
                                  {exp.expense_type === "fixed_asset"
                                    ? "स्थिर सम्पत्ति"
                                    : exp.expense_type === "item"
                                      ? "जिन्सी सामान"
                                      : "सञ्चालन खर्च"}
                                </span>
                              </td>
                              <td className="p-2 border font-medium">
                                {exp.vendor_name || "—"}
                              </td>
                              <td className="p-2 border text-right font-mono font-black text-purple-700 dark:text-purple-300">
                                {money(exp.final_amount)}
                              </td>
                              <td className="p-2 border text-muted-foreground truncate max-w-xs">
                                {exp.remarks || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/40 font-extrabold border-t">
                          <tr>
                            <td colSpan={5} className="p-2 border text-right">
                              कुल खर्च रकम (Total Spent):
                            </td>
                            <td className="p-2 border text-right font-mono text-purple-700 dark:text-purple-300 text-sm">
                              {money(bStats.actualSpent)}
                            </td>
                            <td className="p-2 border"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground space-y-1">
                      <p>यस कार्यक्रमसँग हालसम्म कुनै खर्च बिल संलग्न गरिएको छैन।</p>
                      <p className="text-[11px]">
                        नयाँ खर्च प्रविष्टि गर्दा 'कार्यक्रम' फिल्डमा यो कार्यक्रम छनोट गर्नुहोस्।
                      </p>
                      <Button
                        size="sm"
                        asChild
                        className="mt-2 h-7 px-3 text-xs font-bold"
                      >
                        <Link to="/expenses" search={{ event_id: ev.id, new: "true" }}>
                          + यस कार्यक्रममा पहिलो खर्च थप्नुहोस्
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Section 3: Meeting Minutes & Decisions */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-1.5">
                      <NotebookPen className="size-4 text-primary" />
                      <h3 className="text-sm font-extrabold text-foreground">
                        सम्बन्धित बैठक तथा मिनेटहरू (Meeting Minutes & Decisions)
                      </h3>
                    </div>
                    {minSummary && (
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {minSummary.count} वटा बैठक | {minSummary.completedAgendas}/{minSummary.totalAgendas} एजेन्डा पूरा
                      </span>
                    )}
                  </div>

                  {minSummary ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg bg-primary/5 p-3">
                        <div>
                          <div className="font-bold text-foreground">
                            अवस्था: {minSummary.stage}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            अन्तिम बैठक मिति: {np(minSummary.latestDate || "—")}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-bold"
                          onClick={() => {
                            setViewingMinutesEvent(ev);
                          }}
                        >
                          सबै मिनेट हेर्नुहोस्
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-3 text-center text-muted-foreground text-xs">
                      कुनै बैठक मिनेट दर्ता छैन।{" "}
                      <Link
                        to="/minutes"
                        search={{ event_id: ev.id, new: "true" }}
                        className="font-bold text-primary hover:underline ml-1"
                      >
                        + नयाँ बैठक मिनेट थप्नुहोस्
                      </Link>
                    </div>
                  )}
                </div>

                {/* Section 4: Authorized Team */}
                <div className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="font-extrabold text-xs text-foreground uppercase tracking-wide">
                    तोकिएका अधिकृत कर्मचारी तथा टोली (Authorized Personnel):
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {ev.authorized_persons && ev.authorized_persons.length > 0 ? (
                      ev.authorized_persons.map((ap, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-xs"
                        >
                          <UserCheck className="size-4 text-primary" />
                          <div>
                            <div className="font-bold text-foreground">{ap.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {ap.role || "प्रतिनिधि"} {ap.phone && `• ${ap.phone}`}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        कुनै अधिकृत व्यक्ति तोकिएको छैन।
                      </span>
                    )}
                  </div>
                </div>

                {/* Section 5: Remarks / Objectives */}
                {ev.remarks && (
                  <div className="rounded-xl border bg-muted/20 p-3 space-y-1">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase">
                      उद्देश्य तथा संक्षिप्त विवरण:
                    </div>
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                      {ev.remarks}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingDetailEvent(null)}
                >
                  बन्द गर्नुहोस्
                </Button>

                <Button
                  size="sm"
                  onClick={() => {
                    setPrintPreviewEvent(ev);
                  }}
                  className="font-bold flex items-center gap-1.5"
                >
                  <Printer className="size-4" />
                  <span>अख्तियारी पत्र प्रिन्ट</span>
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 2. ADD / EDIT PROGRAMME WITH DETAILED BUDGET BREAKDOWN MODAL */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border bg-card p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-extrabold text-foreground">
                  {editingEvent
                    ? "कार्यक्रम सम्पादन तथा बजेट परिमार्जन"
                    : "नयाँ कार्यक्रम तथा विस्तृत बजेट योजना दर्ता"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  कार्यक्रमको आधारभूत विवरण, कार्ययोजना, बजेट शीर्षक र अधिकृत टोली प्रविष्टि गर्नुहोस्
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Modal Scrollable Form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto py-4 space-y-5 text-xs">
              {/* ── खण्ड १: सामान्य तथा आधारभूत विवरण ── */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="font-extrabold text-xs text-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-primary" />
                  <span>१. कार्यक्रमको आधारभूत विवरण (General Details)</span>
                </div>

                <div>
                  <Label className="text-xs font-semibold">कार्यक्रमको नाम (Programme Name) *</Label>
                  <Input
                    required
                    placeholder="उदा: वीरेन्द्रनगर वडा सरसफाइ, वृक्षारोपण तथा डस्टबिन वितरण अभियान"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-semibold">स्थान / टोल / वडा (Locality) *</Label>
                    <Input
                      required
                      placeholder="उदा: वीरेन्द्रनगर-४, भैरवस्थान तथा मुख्य बजार क्षेत्र"
                      value={form.locality}
                      onChange={(e) => setForm({ ...form, locality: e.target.value })}
                      className="mt-1 text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">कार्यक्रम अवस्था (Status)</Label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          status: e.target.value as "planned" | "ongoing" | "completed" | "postponed",
                        })
                      }
                      className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs font-semibold"
                    >
                      <option value="planned">योजना गरिएको (Planned)</option>
                      <option value="ongoing">सञ्चालन भइरहेको (Ongoing)</option>
                      <option value="completed">सम्पन्न (Completed)</option>
                      <option value="postponed">स्थगित (Postponed)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-semibold">
                      सुरु हुने मिति (Commencing Date - BS) *
                    </Label>
                    <Input
                      required
                      placeholder="२०८१-०८-१५"
                      value={form.commencing_date}
                      onChange={(e) => setForm({ ...form, commencing_date: e.target.value })}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">सम्पन्न हुने मिति (End Date - BS)</Label>
                    <Input
                      placeholder="२०८१-०८-१६"
                      value={form.end_date || ""}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* ── खण्ड २: विस्तृत बजेट कार्ययोजना ── */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                  <div>
                    <div className="font-extrabold text-xs text-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Coins className="size-4 text-primary" />
                      <span>२. विस्तृत बजेट कार्ययोजना (Detailed Budget Plan)</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      शीर्षकअनुसार अनुमानित र विनियोजित बजेट प्रविष्टि गर्नुहोस् (यसबाट खर्च ट्र्याकिङ हुनेछ)
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddBudgetItem}
                      className="h-7 text-xs font-bold text-primary border-primary/30 hover:bg-primary/10"
                    >
                      <Plus className="size-3 mr-1" />
                      शीर्षक थप्नुहोस्
                    </Button>
                  </div>
                </div>

                {/* Preset Templates */}
                <div className="rounded-lg bg-card border p-2.5">
                  <div className="text-[11px] font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Sparkles className="size-3 text-amber-500" />
                    <span>छिटो भर्न टेम्प्लेट छान्नुहोस्:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BUDGET_PRESETS.map((preset, idx) => (
                      <Button
                        key={idx}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleApplyBudgetPreset(idx)}
                        className="h-6 px-2 text-[10px] font-bold"
                      >
                        <span className="mr-1">{preset.icon}</span>
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Budget items table */}
                <div className="space-y-2 pt-1">
                  {(form.budget_breakdown || []).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border rounded-lg overflow-hidden bg-card">
                        <thead className="bg-muted font-semibold text-muted-foreground">
                          <tr>
                            <th className="p-2 border">बजेट शीर्षक (Category) *</th>
                            <th className="p-2 border">विवरण तथा कार्ययोजना</th>
                            <th className="p-2 border text-right w-28">अनुमानित (रु.)</th>
                            <th className="p-2 border text-right w-28">विनियोजित (रु.)</th>
                            <th className="p-2 border text-center w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(form.budget_breakdown || []).map((item, idx) => (
                            <tr key={item.id || idx}>
                              <td className="p-1.5 border">
                                <Input
                                  required
                                  placeholder="उदा: खाजा, सामग्री, ढुवानी"
                                  value={item.category}
                                  onChange={(e) =>
                                    handleUpdateBudgetItem(idx, "category", e.target.value)
                                  }
                                  className="h-7 text-xs"
                                />
                              </td>
                              <td className="p-1.5 border">
                                <Input
                                  placeholder="विवरण वा योजना"
                                  value={item.description || ""}
                                  onChange={(e) =>
                                    handleUpdateBudgetItem(idx, "description", e.target.value)
                                  }
                                  className="h-7 text-xs"
                                />
                              </td>
                              <td className="p-1.5 border">
                                <Input
                                  type="number"
                                  min="0"
                                  value={item.estimated_amount || ""}
                                  onChange={(e) =>
                                    handleUpdateBudgetItem(
                                      idx,
                                      "estimated_amount",
                                      Number(e.target.value) || 0,
                                    )
                                  }
                                  className="h-7 text-xs font-mono text-right font-medium"
                                />
                              </td>
                              <td className="p-1.5 border">
                                <Input
                                  type="number"
                                  min="0"
                                  value={
                                    item.allocated_amount !== undefined
                                      ? item.allocated_amount
                                      : item.estimated_amount || ""
                                  }
                                  onChange={(e) =>
                                    handleUpdateBudgetItem(
                                      idx,
                                      "allocated_amount",
                                      Number(e.target.value) || 0,
                                    )
                                  }
                                  className="h-7 text-xs font-mono text-right font-bold text-primary"
                                />
                              </td>
                              <td className="p-1.5 border text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-6 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRemoveBudgetItem(idx)}
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-3 text-center text-muted-foreground text-[11px]">
                      अहिलेसम्म कुनै विस्तृत बजेट शीर्षक थपिएको छैन। माथिको टेम्प्लेट छान्नुहोस् वा '+ शीर्षक थप्नुहोस्' थिच्नुहोस्।
                    </div>
                  )}
                </div>

                {/* Total Budget Summary Row */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t">
                  <div>
                    <Label className="text-xs font-semibold">
                      कुल अनुमानित आवश्यक बजेट (Expected Total - रु.) *
                    </Label>
                    <Input
                      type="number"
                      required
                      min="0"
                      value={form.budget_required}
                      onChange={(e) =>
                        setForm({ ...form, budget_required: Number(e.target.value) || 0 })
                      }
                      className="mt-1 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">
                      स्वीकृत विनियोजित बजेट (Approved Allocated - रु.) *
                    </Label>
                    <Input
                      type="number"
                      required
                      min="0"
                      value={form.budget_allocated || form.budget_required}
                      onChange={(e) =>
                        setForm({ ...form, budget_allocated: Number(e.target.value) || 0 })
                      }
                      className="mt-1 text-xs font-mono font-bold text-primary"
                    />
                  </div>
                </div>
              </div>

              {/* ── खण्ड ३: अधिकृत व्यक्तिहरू तथा टोली ── */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <div className="font-extrabold text-xs text-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <UserCheck className="size-4 text-primary" />
                    <span>३. अधिकृत व्यक्तिहरू तथा टोली (Authorized Personnel)</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    संयोजक तथा टोली सदस्य
                  </span>
                </div>

                {/* Quick Picker from Employees or Members */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      कर्मचारी वा सदस्यबाट छिटो छान्नुहोस्:
                    </Label>
                    <select
                      onChange={(e) => {
                        handleSelectFromPreset(e.target.value);
                        e.target.value = "";
                      }}
                      className="mt-1 h-8 w-full rounded border bg-background px-2 text-[11px]"
                    >
                      <option value="">-- छान्नुहोस् --</option>
                      <optgroup label="कर्मचारीहरू (Employees)">
                        {employees.map((emp) => (
                          <option key={emp.id} value={`emp:${emp.id}`}>
                            {emp.name} ({emp.designation})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="क्लब सदस्यहरू (Members)">
                        {members.map((mem) => (
                          <option key={mem.id} value={`mem:${mem.id}`}>
                            {mem.name} ({mem.designation})
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">प्रकार (Category):</Label>
                    <select
                      value={authPersonType}
                      onChange={(e) =>
                        setAuthPersonType(e.target.value as "employee" | "member" | "other")
                      }
                      className="mt-1 h-8 w-full rounded border bg-background px-2 text-[11px]"
                    >
                      <option value="employee">कर्मचारी (Employee)</option>
                      <option value="member">क्लब सदस्य (Member)</option>
                      <option value="other">अन्य / स्वयंसेवक (Other / Guest)</option>
                    </select>
                  </div>
                </div>

                {/* Manual input */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 items-end">
                  <div className="sm:col-span-2">
                    <Label className="text-[11px] text-muted-foreground">व्यक्तिको नाम:</Label>
                    <Input
                      placeholder="नाम टाइप गर्नुहोस्"
                      value={authPersonName}
                      onChange={(e) => setAuthPersonName(e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">जिम्मेवारी (Role):</Label>
                    <Input
                      placeholder="संयोजक / फिल्ड"
                      value={authPersonRole}
                      onChange={(e) => setAuthPersonRole(e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddAuthorizedPerson}
                    size="sm"
                    className="h-8 text-xs font-bold"
                  >
                    <Plus className="mr-1 size-3" />
                    थप्नुहोस्
                  </Button>
                </div>

                {/* Display List of added persons */}
                <div className="space-y-1.5 pt-1">
                  {form.authorized_persons && form.authorized_persons.length > 0 ? (
                    form.authorized_persons.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border bg-card px-2.5 py-1 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                              p.type === "employee"
                                ? "bg-blue-500/10 text-blue-700"
                                : p.type === "member"
                                  ? "bg-purple-500/10 text-purple-700"
                                  : "bg-amber-500/10 text-amber-700"
                            }`}
                          >
                            {p.type === "employee"
                              ? "कर्मचारी"
                              : p.type === "member"
                                ? "सदस्य"
                                : "अन्य"}
                          </span>
                          <span className="font-bold text-foreground">{p.name}</span>
                          <span className="text-muted-foreground text-[11px]">
                            — {p.role || "प्रतिनिधि"}
                          </span>
                          {p.phone && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({p.phone})
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveAuthorizedPerson(idx)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic py-1">
                      अहिलेसम्म कुनै अधिकृत व्यक्ति थपिएको छैन।
                    </div>
                  )}
                </div>
              </div>

              {/* ── खण्ड ४: उद्देश्य तथा कैफियत ── */}
              <div>
                <Label className="text-xs font-semibold">कैफियत / मुख्य उद्देश्य (Remarks)</Label>
                <textarea
                  rows={2}
                  placeholder="कार्यक्रमको मुख्य लक्ष्य, सहभागी हुने टोल विकास संस्था वा अन्य विवरण…"
                  value={form.remarks || ""}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  className="mt-1 w-full rounded-md border bg-background p-2 text-xs"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                >
                  रद्द गर्नुहोस्
                </Button>
                <Button type="submit" size="sm" className="font-bold bg-primary text-primary-foreground">
                  {editingEvent ? "परिवर्तन सुरक्षित गर्नुहोस्" : "कार्यक्रम सेभ गर्नुहोस्"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PROGRAMME AUTHORIZATION SHEET / PRINT MODAL */}
      {/* ========================================================================= */}
      {printPreviewEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-xl border-2 border-foreground/30 bg-card p-6 shadow-2xl text-foreground">
            {/* Top Toolbar */}
            <div className="no-print mb-4 flex items-center justify-between border-b pb-3">
              <div className="text-sm font-semibold text-muted-foreground">
                कार्यक्रम विवरण तथा अख्तियारी पत्र (Official Event Document)
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPrintPreviewEvent(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Printable Content */}
            <div className="printable-slip">
              {/* Organization Header */}
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={config.logo_url || ""}
                    alt={config.entity_name || "Logo"}
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
                      <div className="text-[11px] text-muted-foreground">
                        {config.tagline}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="inline-block rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                    कार्यक्रम कार्यान्वयन अख्तियारी
                  </div>
                  <div className="mt-1 font-medium">मिति: {np(todayBS())}</div>
                </div>
              </div>

              {/* Programme Details */}
              <div className="mt-4 rounded-lg border bg-muted/20 p-4 space-y-2.5 text-xs">
                <div>
                  <span className="text-muted-foreground">कार्यक्रमको नाम: </span>
                  <span className="text-base font-extrabold text-foreground">
                    {printPreviewEvent.title}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-muted-foreground">कार्यक्षेत्र / स्थान: </span>
                    <span className="font-bold">{printPreviewEvent.locality}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">सुरु हुने मिति: </span>
                    <span className="font-bold font-mono">
                      {np(printPreviewEvent.commencing_date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">स्वीकृत विनियोजित बजेट: </span>
                    <span className="font-extrabold text-primary text-sm">
                      {money(
                        printPreviewEvent.budget_allocated ||
                          printPreviewEvent.budget_required,
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">कार्यक्रम स्थिति: </span>
                    <span className="font-bold capitalize">{printPreviewEvent.status}</span>
                  </div>
                </div>
                {printPreviewEvent.remarks && (
                  <div className="border-t pt-2 mt-2">
                    <span className="text-muted-foreground font-semibold">
                      उद्देश्य तथा संक्षिप्त विवरण:
                    </span>
                    <p className="mt-0.5 text-foreground leading-relaxed">
                      {printPreviewEvent.remarks}
                    </p>
                  </div>
                )}
              </div>

              {/* Detailed Budget Breakdown Table if present */}
              {printPreviewEvent.budget_breakdown &&
                printPreviewEvent.budget_breakdown.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-bold text-foreground border-b pb-1.5">
                      स्वीकृत विस्तृत बजेट शीर्षकहरू (Itemized Budget Breakdown):
                    </div>
                    <table className="mt-2 w-full text-left text-xs border">
                      <thead className="bg-muted font-semibold">
                        <tr>
                          <th className="p-2 border">सि.नं.</th>
                          <th className="p-2 border">बजेट शीर्षक</th>
                          <th className="p-2 border">विवरण</th>
                          <th className="p-2 border text-right">रकम (रु.)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printPreviewEvent.budget_breakdown.map((item, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2 border font-mono text-center">{i + 1}</td>
                            <td className="p-2 border font-bold">{item.category}</td>
                            <td className="p-2 border text-muted-foreground">
                              {item.description || "—"}
                            </td>
                            <td className="p-2 border text-right font-mono font-bold">
                              {money(item.allocated_amount ?? item.estimated_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              {/* Authorized Personnel Table */}
              <div className="mt-4">
                <div className="text-xs font-bold text-foreground border-b pb-1.5">
                  तोकिएका अधिकृत कर्मचारी तथा टोली प्रतिनिधिहरू (Authorized Team):
                </div>
                <table className="mt-2 w-full text-left text-xs border">
                  <thead className="bg-muted font-semibold">
                    <tr>
                      <th className="p-2 border">सि.नं.</th>
                      <th className="p-2 border">नाम (Name)</th>
                      <th className="p-2 border">वर्ग (Category)</th>
                      <th className="p-2 border">जिम्मेवारी (Assigned Role)</th>
                      <th className="p-2 border">सम्पर्क फोन</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printPreviewEvent.authorized_persons &&
                    printPreviewEvent.authorized_persons.length > 0 ? (
                      printPreviewEvent.authorized_persons.map((p, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2 border font-mono text-center">{i + 1}</td>
                          <td className="p-2 border font-bold">{p.name}</td>
                          <td className="p-2 border">
                            {p.type === "employee"
                              ? "कर्मचारी"
                              : p.type === "member"
                                ? "क्लब सदस्य"
                                : "अन्य / स्वयंसेवक"}
                          </td>
                          <td className="p-2 border font-semibold">{p.role || "प्रतिनिधि"}</td>
                          <td className="p-2 border font-mono">{p.phone || "—"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-muted-foreground">
                          कुनै अधिकृत व्यक्ति तोकिएको छैन।
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="mt-12 flex justify-between text-xs pt-4">
                <div className="text-center">
                  <div className="h-10 border-b border-foreground/40 w-36" />
                  <div className="pt-1 font-medium">कार्यक्रम संयोजकको सही</div>
                </div>
                <div className="text-center">
                  <div className="h-10 border-b border-foreground/40 w-36" />
                  <div className="pt-1 font-medium">सचिव / सुपरभाइजर</div>
                </div>
                <div className="text-center">
                  <div className="h-10 border-b border-foreground/40 w-36" />
                  <div className="pt-1 font-medium">स्वीकृत गर्ने (क्लब अध्यक्ष)</div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="no-print mt-6 flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setPrintPreviewEvent(null)}>
                बन्द गर्नुहोस्
              </Button>
              <Button onClick={() => window.print()} className="font-bold">
                <Printer className="mr-1.5 size-4" />
                प्रिन्ट गर्नुहोस्
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. EVENT MINUTES PREVIEW MODAL */}
      {/* ========================================================================= */}
      {viewingMinutesEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <NotebookPen className="size-5 text-primary" />
                <div>
                  <h3 className="text-base font-extrabold text-foreground">
                    {viewingMinutesEvent.title} — बैठक तथा मिनेटहरू
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    स्थान: {viewingMinutesEvent.locality || "—"} | सुरु:{" "}
                    {np(viewingMinutesEvent.commencing_date)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg"
                onClick={() => setViewingMinutesEvent(null)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              {(() => {
                const evMinutes = minutesList.filter(
                  (m) => m.event_id === viewingMinutesEvent.id,
                );
                if (evMinutes.length === 0) {
                  return (
                    <div className="py-10 text-center text-muted-foreground">
                      यस कार्यक्रमका लागि कुनै बैठक मिनेट दर्ता भएको छैन।
                    </div>
                  );
                }
                return evMinutes.map((m, mIdx) => (
                  <div
                    key={m.id || mIdx}
                    className="rounded-xl border bg-muted/20 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black bg-primary/10 text-primary px-2 py-0.5 rounded">
                          बैठक #{mIdx + 1}
                        </span>
                        <span className="font-bold text-sm text-foreground">
                          मिति: {np(m.meeting_date)}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        उपस्थिति: {(m.attendees || []).length} जना
                      </span>
                    </div>

                    {/* Agendas */}
                    <div className="space-y-2">
                      <div className="font-extrabold text-xs text-foreground uppercase tracking-wide">
                        एजेन्डा तथा पारित निर्णयहरू:
                      </div>
                      {(m.agenda || []).map((a, aIdx) => (
                        <div
                          key={a.id || aIdx}
                          className="rounded-lg border bg-background p-3 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-foreground">
                              {aIdx + 1}. {a.text}
                            </span>
                            {a.done ? (
                              <Badge
                                variant="outline"
                                className="text-[9px] font-bold bg-emerald-500/15 border-emerald-500/30 text-emerald-700"
                              >
                                ✓ पूरा भयो
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[9px] font-bold bg-amber-500/15 border-amber-500/30 text-amber-700"
                              >
                                ⏳ जारी
                              </Badge>
                            )}
                          </div>
                          {a.decision && (
                            <div className="text-[11px] text-muted-foreground pl-3 border-l-2 border-primary/40 mt-1">
                              <strong>निर्णय:</strong> {a.decision}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {m.draft && (
                      <div className="rounded-lg bg-card border p-3 text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        <div className="font-bold text-foreground mb-1">
                          औपचारिक मिनेट ड्राफ्ट:
                        </div>
                        {m.draft}
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingMinutesEvent(null)}
              >
                बन्द गर्नुहोस्
              </Button>
              <Button size="sm" asChild className="font-bold text-xs">
                <Link
                  to="/minutes"
                  search={{ event_id: viewingMinutesEvent.id, new: "true" }}
                >
                  <Plus className="size-3.5 mr-1" /> यस कार्यक्रमको नयाँ मिनेट थप्नुहोस्
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
