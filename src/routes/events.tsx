import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAppState, SignInPanel } from "@/components/app-shell";
import { getEventsData, saveEvent, deleteEvent, getMembersData } from "@/lib/workspace.functions";
import {
  np,
  todayBS,
  type ClubEvent,
  type AuthorizedPerson,
  type Employee,
  type Member,
} from "@/lib/receipt-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppConfig } from "@/lib/app-config";
import logo from "@/assets/club-logo.asset.json";
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
} from "lucide-react";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events & Programmes — Hami Yuwa Club" },
      {
        name: "description",
        content:
          "Manage community sanitation programmes, budget requirements, commencing days, and authorized personnel.",
      },
    ],
  }),
  component: EventsPage,
});

const money = (n: number) => "रु. " + (n || 0).toLocaleString("en-IN");

const SEED_EVENTS: ClubEvent[] = [
  {
    id: "evt-seed-1",
    title: "वडा नं. ४ बृहत् सरसफाइ तथा डस्टबिन वितरण अभियान",
    locality: "वीरेन्द्रनगर-४, भैरवस्थान तथा पिपलबोट टोल",
    budget_required: 85000,
    budget_allocated: 85000,
    commencing_date: "२०८१-०८-१५",
    end_date: "२०८१-०८-१६",
    status: "ongoing",
    authorized_persons: [
      {
        name: "अनिल चौधरी",
        designation: "क्षेत्र सुपरभाइजर",
        role: "कार्यक्रम संयोजक",
        phone: "९८५८०१२३४५",
        type: "employee",
      },
      {
        name: "दिपक गुरुङ",
        designation: "सवारी चालक",
        role: "यातायात तथा ढुवानी",
        phone: "९८४८१२३४५६",
        type: "employee",
      },
      {
        name: "नवीन गिरी",
        designation: "अध्यक्ष",
        role: "प्रमुख अनुगमनकर्ता",
        phone: "९८५८०१११११",
        type: "member",
      },
      {
        name: "टेक बहादुर बुढा",
        designation: "टोल विकास समिति अध्यक्ष",
        role: "स्थानिय समन्वयकर्ता",
        phone: "९८४८००००००",
        type: "other",
      },
    ],
    remarks:
      "स्थानिय घरधुरीहरूलाई सुक्खा र भिजेको फोहोर वर्गीकरणका लागि २ रङका डस्टबिन वितरण तथा सडक सरसफाइ गर्ने।",
  },
  {
    id: "evt-seed-2",
    title: "प्लास्टिक न्यूनीकरण तथा जनचेतना घरदैलो कार्यक्रम",
    locality: "वीरेन्द्रनगर-६, मुख्य बजार तथा बुद्धचोक क्षेत्र",
    budget_required: 45000,
    budget_allocated: 40000,
    commencing_date: "२०८१-०९-०१",
    end_date: "२०८१-०९-०३",
    status: "planned",
    authorized_persons: [
      {
        name: "प्रकाश परियार",
        designation: "फोहोर संकलक",
        role: "फिल्ड परिचालन",
        phone: "९८१२३४५६७८",
        type: "employee",
      },
      {
        name: "रमेश अधिकारी",
        designation: "सचिव",
        role: "प्रशिक्षक तथा वक्ता",
        phone: "९८४८०३३३३३",
        type: "member",
      },
      {
        name: "सुनिता वि.क.",
        designation: "महिला समूह प्रतिनिधि",
        role: "घरदैलो टोली प्रमुख",
        phone: "९८१२३०००००",
        type: "other",
      },
    ],
    remarks:
      "एकल प्रयोग प्लास्टिक प्रतिबन्ध सम्बन्धी माइकिङ, पम्प्लेटिङ तथा कपडाको झोला वितरण गर्ने।",
  },
  {
    id: "evt-seed-3",
    title: "सामुदायिक वृक्षारोपण तथा डम्पिङ क्षेत्र सौन्दर्यीकरण",
    locality: "वीरेन्द्रनगर-११, फोहोर प्रशोधन केन्द्र परिसर",
    budget_required: 120000,
    budget_allocated: 120000,
    commencing_date: "२०८१-०४-२५",
    end_date: "२०८१-०४-२६",
    status: "completed",
    authorized_persons: [
      {
        name: "कमल बहादुर शाही",
        designation: "उपाध्यक्ष",
        role: "कार्यक्रम संयोजक",
        phone: "९८५८०२२२२२",
        type: "member",
      },
      {
        name: "सन्तोष श्रेष्ठ",
        designation: "संकलक तथा लोडर",
        role: "बिरुवा रोपण व्यवस्थापन",
        phone: "९८०१२३४५६७",
        type: "employee",
      },
    ],
    remarks: "वातावरण संरक्षणका लागि ५०० वटा नीम, कपुर र अशोकका बिरुवा रोपण सम्पन्न भयो।",
  },
];

const emptyEvent = (): ClubEvent => ({
  title: "",
  locality: "",
  budget_required: 50000,
  budget_allocated: 50000,
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

  // Load events
  const query = useQuery({
    queryKey: ["events_data", app.userId],
    queryFn: () => fetchEventsFn(),
    enabled: app.ready && app.signedIn,
  });

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
      const stored = localStorage.getItem("hami_events_cache");
      if (stored) return JSON.parse(stored);
    } catch {
      // cache unavailable — fall back to seed data
    }
    return SEED_EVENTS;
  });

  useEffect(() => {
    if (query.data?.events && query.data.events.length > 0) {
      setEventsList(query.data.events);
      try {
        localStorage.setItem("hami_events_cache", JSON.stringify(query.data.events));
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
    const totalBudget = eventsList.reduce((acc, e) => acc + (e.budget_required || 0), 0);
    return { total, ongoing, planned, completed, totalBudget };
  }, [eventsList]);

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
    });
    setModalOpen(true);
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
        localStorage.setItem("hami_events_cache", JSON.stringify(updated));
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
        localStorage.setItem("hami_events_cache", JSON.stringify(updated));
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
      localStorage.setItem("hami_events_cache", JSON.stringify(updated));
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
              कार्यक्रम तथा योजनाहरू (Events & Programmes)
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            हामी युवा क्लब - सरसफाइ अभियान, बजेट, स्थान तथा अधिकृत कर्मचारी र टोली व्यवस्थापन
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 font-bold shadow-xs bg-primary text-primary-foreground"
        >
          <Plus className="size-4" />
          <span>नयाँ कार्यक्रम थप्नुहोस्</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs text-muted-foreground font-medium">कुल कार्यक्रमहरू</div>
          <div className="mt-1 text-2xl font-extrabold text-foreground">{stats.total}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs text-muted-foreground font-medium">सञ्चालित तथा आगामी</div>
          <div className="mt-1 text-2xl font-extrabold text-blue-600">
            {stats.ongoing + stats.planned}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs text-muted-foreground font-medium">सम्पन्न कार्यक्रमहरू</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-600">{stats.completed}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs text-muted-foreground font-medium">कुल आवश्यक बजेट</div>
          <div className="mt-1 text-xl font-extrabold text-primary">{money(stats.totalBudget)}</div>
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
              कुनै कार्यक्रम फेला परेन। माथि 'नयाँ कार्यक्रम थप्नुहोस्' बटनबाट कार्यक्रम थप्न
              सक्नुहुन्छ।
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const badge = statusBadge(ev.status);
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
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0 text-primary" />
                      <span className="font-medium truncate">{ev.locality}</span>
                    </div>

                    {/* Budget */}
                    <div className="mt-3.5 flex items-center justify-between rounded-lg bg-primary/5 p-2.5">
                      <div className="text-[11px] font-medium text-muted-foreground">
                        आवश्यक बजेट:
                      </div>
                      <div className="text-base font-extrabold text-primary">
                        {money(ev.budget_required)}
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

                    {/* Remarks */}
                    {ev.remarks && (
                      <p className="mt-3 text-xs text-muted-foreground line-clamp-2 border-t pt-2">
                        {ev.remarks}
                      </p>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-5 flex items-center justify-between border-t pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs flex items-center gap-1"
                      onClick={() => setPrintPreviewEvent(ev)}
                    >
                      <FileText className="size-3.5" />
                      <span>अख्तियारी पत्र</span>
                    </Button>
                    <div className="flex items-center gap-1">
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
                <th className="px-4 py-3 text-right">अनुमानित बजेट</th>
                <th className="px-4 py-3">सुरु हुने मिति</th>
                <th className="px-4 py-3">अधिकृत व्यक्तिहरू (Authorized)</th>
                <th className="px-4 py-3">अवस्था</th>
                <th className="no-print px-4 py-3 text-right">कार्य</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    कुनै कार्यक्रम फेला परेन।
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev, idx) => {
                  const badge = statusBadge(ev.status);
                  return (
                    <tr key={ev.id || idx} className="hover:bg-muted/15 transition-colors">
                      <td className="px-4 py-3 font-mono">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground">{ev.title}</div>
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
                      <td className="px-4 py-3 text-right font-extrabold text-foreground">
                        {money(ev.budget_required)}
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
      {/* ADD / EDIT MODAL */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-xl rounded-xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-extrabold text-foreground">
                {editingEvent ? "कार्यक्रम सम्पादन" : "नयाँ कार्यक्रम तथा योजना दर्ता"}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
              <div>
                <Label className="text-xs font-semibold">कार्यक्रमको नाम (Programme Name) *</Label>
                <Input
                  required
                  placeholder="उदा: वडा सरसफाइ तथा डस्टबिन वितरण अभियान"
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
                    placeholder="उदा: वीरेन्द्रनगर-४, भैरवस्थान"
                    value={form.locality}
                    onChange={(e) => setForm({ ...form, locality: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">
                    अनुमानित आवश्यक बजेट (Expected Budget - रु.) *
                  </Label>
                  <Input
                    type="number"
                    required
                    min="0"
                    placeholder="75000"
                    value={form.budget_required}
                    onChange={(e) =>
                      setForm({ ...form, budget_required: Number(e.target.value) || 0 })
                    }
                    className="mt-1 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

              {/* ========================================================================= */}
              {/* Authorized Persons Section */}
              {/* ========================================================================= */}
              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <UserCheck className="size-4 text-primary" />
                    <span>अधिकृत व्यक्तिहरू तथा टोली (Authorized Personnel)</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    कर्मचारी, सदस्य वा अन्य थप्नुहोस्
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

                {/* Manual input inputs */}
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

              <div className="mt-5 flex justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                >
                  रद्द गर्नुहोस्
                </Button>
                <Button type="submit" size="sm" className="font-bold">
                  {editingEvent ? "परिवर्तन सुरक्षित गर्नुहोस्" : "कार्यक्रम सेभ गर्नुहोस्"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PROGRAMME AUTHORIZATION SHEET / PRINT MODAL */}
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
                <Button variant="ghost" size="icon" onClick={() => setPrintPreviewEvent(null)}>
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
                    src={config.logo_url || logo.url}
                    alt={config.entity_name || "Logo"}
                    className="size-14 rounded-sm object-contain"
                  />
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight">
                      {config.entity_name || "हामी युवा क्लब"}
                    </h2>
                    {config.entity_sub_name && (
                      <div className="text-xs font-semibold text-muted-foreground">
                        {config.entity_sub_name}
                      </div>
                    )}
                    <div className="text-xs">
                      {config.address || "वीरेन्द्रनगर, सुर्खेत, कर्णाली प्रदेश"}
                    </div>
                    {config.tagline && (
                      <div className="text-[11px] text-muted-foreground">{config.tagline}</div>
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
                    <span className="text-muted-foreground">अनुमानित आवश्यक बजेट: </span>
                    <span className="font-extrabold text-primary text-sm">
                      {money(printPreviewEvent.budget_required)}
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
                          <td className="p-2 border font-mono">{i + 1}</td>
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
    </main>
  );
}
