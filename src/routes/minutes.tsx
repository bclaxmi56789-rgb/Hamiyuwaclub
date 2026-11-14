import { hamiCacheKey } from "@/lib/hami-cache";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAppState, SignInPanel } from "@/components/app-shell";
import {
  getEventsData,
  getMembersData,
  getMinutesData,
  saveMinutes,
  deleteMinutes,
} from "@/lib/workspace.functions";
import {
  np,
  todayBS,
  type ClubEvent,
  type Employee,
  type Member,
  type EventMinutes,
  type MinutesAgenda,
  type MinutesAttendee,
} from "@/lib/receipt-rules";
import { Button } from "@/components/ui/button";
import { BSDatePicker } from "@/components/bs-date-picker";
import { SearchSelect } from "@/components/search-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAppConfig, buildMinutesFallbackText, draftMinutesWithAI } from "@/lib/app-config";
import { Textarea } from "@/components/ui/textarea";

/** Textarea that grows automatically as text becomes longer */
function AutoTextarea({
  value,
  onValueChange,
  placeholder,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <Textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onValueChange(e.target.value)}
      className="min-h-0 resize-none overflow-hidden px-2.5 py-1.5 text-xs"
    />
  );
}
import {
  NotebookPen,
  Plus,
  Edit2,
  Trash2,
  Users,
  UserCheck,
  Printer,
  X,
  FileText,
  Sparkles,
  CalendarDays,
  Mic,
  MapPin,
  Coins,
  CheckCircle2,
  Clock,
  ListChecks,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { SpeechRecognitionCtor, SpeechRecognitionLike } from "@/lib/receipt-rules";

const money = (n: number) => "रु. " + (n || 0).toLocaleString("en-IN");

export const Route = createFileRoute("/minutes")({
  validateSearch: (search: Record<string, unknown>) => ({
    event_id: (search.event_id as string) || undefined,
    new: (search.new as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Meeting Minutes — Sangstha" },
      {
        name: "description",
        content:
          "Meeting minutes (कार्यविवरण) with attendees, agendas, decisions and AI drafting for Sangstha programmes.",
      },
    ],
  }),
  component: MinutesPage,
});

function MinutesPage() {
  const app = useAppState();
  const config = useAppConfig();
  const queryClient = useQueryClient();
  const fetchEventsFn = useServerFn(getEventsData);
  const fetchMembersFn = useServerFn(getMembersData);
  const fetchMinutesFn = useServerFn(getMinutesData);
  const saveMinutesFn = useServerFn(saveMinutes);
  const deleteMinutesFn = useServerFn(deleteMinutes);
  // Data loads
  const eventsQuery = useQuery({
    queryKey: ["events_data", app.userId],
    queryFn: () => fetchEventsFn(),
    enabled: app.ready && app.signedIn,
  });
  const membersQuery = useQuery({
    queryKey: ["members_data", app.userId],
    queryFn: () => fetchMembersFn(),
    enabled: app.ready && app.signedIn,
  });
  const minutesQuery = useQuery({
    queryKey: ["minutes_data", app.userId],
    queryFn: () => fetchMinutesFn(),
    enabled: app.ready && app.signedIn,
  });

  const events: ClubEvent[] = useMemo(() => eventsQuery.data?.events ?? [], [eventsQuery.data]);
  const members: Member[] = useMemo(
    () =>
      membersQuery.data?.members ??
      (membersQuery.data as unknown as { bodMembers?: Member[] })?.bodMembers ??
      [],
    [membersQuery.data],
  );

  // Minutes log with localStorage fallback
  const [minutesList, setMinutesList] = useState<EventMinutes[]>(() => {
    try {
      const stored = localStorage.getItem(hamiCacheKey("hami_minutes_cache"));
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore cache parse failures
    }
    return [];
  });

  useEffect(() => {
    if (minutesQuery.data?.minutes) {
      setMinutesList(minutesQuery.data.minutes);
      try {
        localStorage.setItem(hamiCacheKey("hami_minutes_cache"), JSON.stringify(minutesQuery.data.minutes));
      } catch {
        // storage unavailable — list stays in memory
      }
    }
  }, [minutesQuery.data]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    event_id: string;
    meeting_date: string;
    attendees: MinutesAttendee[];
    agenda: MinutesAgenda[];
    draft: string;
  }>({ event_id: "", meeting_date: todayBS(), attendees: [], agenda: [], draft: "" });
  const [advisorName, setAdvisorName] = useState("");
  const [repName, setRepName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const [viewing, setViewing] = useState<EventMinutes | null>(null);
  const [search, setSearch] = useState("");
  const [listenId, setListenId] = useState<string | null>(null);
  const [voiceErr, setVoiceErr] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const formRef = useRef(form);
  formRef.current = form;

  /** Nepali (ne-NP) speech-to-text: tap mic to start, speak, tap again to finish */
  const toggleVoice = useCallback((id: string, onChunk: (text: string) => void) => {
    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceErr("यो ब्राउजरमा आवाज सुविधा छैन — Chrome वा Edge मा प्रयोग गर्नुहोस्।");
      return;
    }
    // Second tap on same mic = done
    if (activeIdRef.current === id) {
      activeIdRef.current = null;
      recRef.current?.stop();
      setListenId(null);
      return;
    }
    activeIdRef.current = null;
    recRef.current?.stop();
    const rec = new Ctor();
    let fromIndex = 0;
    rec.lang = "ne-NP";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      for (let i = fromIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          const t = r[0]?.transcript?.trim();
          if (t) onChunk(t);
          fromIndex += 1;
        } else {
          break;
        }
      }
    };
    rec.onerror = () => {
      // transient (no-speech / network); onend restarts while session active
    };
    rec.onend = () => {
      if (activeIdRef.current === id) {
        fromIndex = 0;
        try {
          rec.start();
        } catch {
          activeIdRef.current = null;
          recRef.current = null;
          setListenId((cur) => (cur === id ? null : cur));
        }
      } else {
        setListenId((cur) => (cur === id ? null : cur));
      }
    };
    activeIdRef.current = id;
    recRef.current = rec;
    setVoiceErr("");
    setListenId(id);
    try {
      rec.start();
    } catch {
      activeIdRef.current = null;
      recRef.current = null;
      setListenId(null);
      setVoiceErr("माइक सुरु गर्न सकिएन — फेरि प्रयास गर्नुहोस्।");
    }
  }, []);

  const selectedEvent = useMemo(
    () => events.find((ev) => ev.id === form.event_id),
    [events, form.event_id],
  );

  /** Ids of this event's minutes other than the one being edited */
  const eventHistory = useMemo(
    () => minutesList.filter((m) => m.event_id === form.event_id && m.id !== editingId),
    [minutesList, form.event_id, editingId],
  );

  /** Unfinished agendas auto-carry into the next meeting until completed */
  const carryInAgendas = useMemo(() => {
    const src = [...eventHistory].sort((a, b) =>
      String(b.created_at || b.meeting_date || "").localeCompare(
        String(a.created_at || a.meeting_date || ""),
      ),
    )[0];
    if (!src) return [];
    return (src.agenda || []).filter((a) => !a.done);
  }, [eventHistory]);

  const toggledAttendee = (
    name: string,
    category: MinutesAttendee["category"],
    designation?: string,
  ) => {
    setForm((prev) => {
      const exists = prev.attendees.some((a) => a.name === name && a.category === category);
      return {
        ...prev,
        attendees: exists
          ? prev.attendees.filter((a) => !(a.name === name && a.category === category))
          : [
              ...prev.attendees,
              ...(designation ? [{ name, category, designation }] : [{ name, category }]),
            ],
      };
    });
  };

  const isSelected = (name: string, category: MinutesAttendee["category"]) =>
    form.attendees.some((a) => a.name === name && a.category === category);

  const searchParams = Route.useSearch();

  const openNew = (defaultEventId?: string) => {
    setEditingId(null);
    const evId = defaultEventId || searchParams.event_id || events[0]?.id || "";
    setForm({
      event_id: evId,
      meeting_date: todayBS(),
      attendees: [],
      agenda: [
        {
          id: `ag-${Date.now().toString(36)}-1`,
          text: "",
          decision: "",
          done: false,
        },
      ],
      draft: "",
    });
    setAdvisorName("");
    setRepName("");
    setErr("");
    setAiErr("");
    setEditorOpen(true);
  };

  useEffect(() => {
    if (searchParams.new === "true" && events.length > 0) {
      openNew(searchParams.event_id);
    } else if (searchParams.event_id && events.length > 0) {
      const ev = events.find((e) => e.id === searchParams.event_id);
      if (ev) setSearch(ev.title);
    }
  }, [searchParams.event_id, searchParams.new, events]);

  const openEdit = (m: EventMinutes) => {
    setEditingId(m.id || null);
    setForm({
      event_id: m.event_id,
      meeting_date: m.meeting_date,
      attendees: [...(m.attendees || [])],
      agenda:
        (m.agenda || []).length > 0
          ? (m.agenda || []).map((a) => ({ ...a }))
          : [
              {
                id: `ag-${Date.now().toString(36)}-1`,
                text: "",
                decision: "",
                done: false,
              },
            ],
      draft: m.draft || "",
    });
    setAdvisorName("");
    setRepName("");
    setErr("");
    setAiErr("");
    setEditorOpen(true);
  };

  const addAgendaRow = () => {
    setForm((prev) => ({
      ...prev,
      agenda: [
        ...prev.agenda,
        {
          id: `ag-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
          text: "",
          decision: "",
          done: false,
        },
      ],
    }));
  };

  const updateAgenda = (id: string, patch: Partial<MinutesAgenda>) => {
    setForm((prev) => ({
      ...prev,
      agenda: prev.agenda.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  const removeAgenda = (id: string) => {
    setForm((prev) => ({ ...prev, agenda: prev.agenda.filter((a) => a.id !== id) }));
  };

  const handleGenerateDraft = async () => {
    setAiBusy(true);
    setAiErr("");
    const input = {
      organization_name: config.entity_name || "",
      event_title: selectedEvent?.title || "",
      event_locality: selectedEvent?.locality || "",
      meeting_date: np(form.meeting_date),
      members: form.attendees
        .filter((a) => a.category === "member")
        .map((a) => (a.designation ? `${a.name} (${a.designation})` : a.name)),
      advisors: form.attendees
        .filter((a) => a.category === "advisor")
        .map((a) => (a.designation ? `${a.name} (${a.designation})` : a.name)),
      representatives: form.attendees
        .filter((a) => a.category === "representative")
        .map((a) => (a.designation ? `${a.name} (${a.designation})` : a.name)),
      agendas: form.agenda
        .filter((a) => a.text.trim())
        .map((a) => ({ text: a.text, decision: a.decision || "", done: a.done })),
    };
    try {
      const text = await draftMinutesWithAI(input, config);
      setForm((prev) => ({ ...prev, draft: text.trim() || prev.draft }));
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "AI जडान असफल भयो।";
      setAiErr(`${msg} — AI बिना नै नेपाली ढाँचामा बनाइयो।`);
      setForm((prev) => ({ ...prev, draft: buildMinutesFallbackText(input) }));
    } finally {
      setAiBusy(false);
    }
  };

  const handleSave = async () => {
    const cleanAgenda = form.agenda.filter((a) => a.text.trim());
    if (!form.meeting_date.trim()) {
      setErr("कृपया मिनेटको मिति राख्नुहोस्।");
      return;
    }
    if (cleanAgenda.length === 0) {
      setErr("कम्तिमा एक एजेन्डा लेख्नुहोस्।");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await saveMinutesFn({
        data: {
          id: editingId || undefined,
          event_id: form.event_id,
          meeting_date: form.meeting_date,
          attendees: form.attendees,
          agenda: cleanAgenda,
          draft: form.draft,
        },
      });
      const updated = editingId
        ? minutesList.map((m) => (m.id === editingId ? res : m))
        : [res, ...minutesList];
      setMinutesList(updated);
      try {
        localStorage.setItem(hamiCacheKey("hami_minutes_cache"), JSON.stringify(updated));
      } catch {
        // storage unavailable — list stays in memory
      }
      void queryClient.invalidateQueries({ queryKey: ["minutes_data"] });
      activeIdRef.current = null;
      recRef.current?.stop();
      setEditorOpen(false);
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "मिनेट सुरक्षित गर्न सकिएन।");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id || !confirm("यो मिनेट हटाउने निश्चित हुनुहुन्छ?")) return;
    try {
      await deleteMinutesFn({ data: { id } });
    } catch {
      // server may not have table yet; still reflect deletion locally
    }
    const updated = minutesList.filter((m) => m.id !== id);
    setMinutesList(updated);
    try {
      localStorage.setItem(hamiCacheKey("hami_minutes_cache"), JSON.stringify(updated));
    } catch {
      // storage unavailable — list stays in memory
    }
  };

  if (!app.ready) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
        <p role="status">Opening minutes module…</p>
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

  const q = search.trim().toLowerCase();
  const shown = q
    ? minutesList.filter((m) => {
        const ev = events.find((e2) => e2.id === m.event_id);
        const hay = [
          m.meeting_date,
          ev?.title || "",
          ev?.locality || "",
          ...(m.agenda || []).map((a) => a.text),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
    : minutesList;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <NotebookPen className="size-6 text-primary" />
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              मिनेट तथा कार्यविवरण (Meeting Minutes)
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            उपस्थिति, एजेन्डा तथा निर्णय दर्ता — AI ले औपचारिक मिनेट ड्राफ्ट गर्छ; अपूरा एजेन्डा
            अर्को सभामा स्वतः आउँछ।
          </p>
        </div>

        <Button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-primary font-bold text-primary-foreground shadow-xs"
        >
          <Plus className="size-4" />
          <span>नयाँ मिनेट तयार गर्नुहोस्</span>
        </Button>
      </div>

      {/* Log search */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Input
            placeholder="मिति, कार्यक्रम वा एजेन्डा खोज्नुहोस्…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground" role="status">
          कुल मिनेट: {minutesList.length}
        </span>
      </div>

      {/* ── LOG TABLE ── */}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-3">सि.नं.</th>
              <th className="px-4 py-3">मिति</th>
              <th className="px-4 py-3">कार्यक्रम / निकाय</th>
              <th className="px-4 py-3">उपस्थिति</th>
              <th className="px-4 py-3">एजेन्डा</th>
              <th className="px-4 py-3">अवस्था</th>
              <th className="px-4 py-3 text-right">कार्य</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                  कुनै मिनेट छैन। माथि "नयाँ मिनेट तयार गर्नुहोस्" थिचेर सुरु गर्नुहोस्।
                </td>
              </tr>
            ) : (
              shown.map((m, idx) => {
                const ev = events.find((e2) => e2.id === m.event_id);
                const total = (m.agenda || []).length;
                const pending = (m.agenda || []).filter((a) => !a.done).length;
                return (
                  <tr key={m.id || idx} className="transition-colors hover:bg-muted/15">
                    <td className="px-4 py-3 font-mono">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono">{np(m.meeting_date)}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-foreground">{ev?.title || "—"}</div>
                      {ev?.locality && (
                        <div className="max-w-xs truncate text-[10px] text-muted-foreground">
                          {ev.locality}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                        {(m.attendees || []).length} जना
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {total} मध्ये {total - pending} पूरा
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold " +
                          (pending === 0
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400")
                        }
                      >
                        {pending === 0 ? "सबै एजेन्डा पूरा" : `${pending} जारी`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="हेर्नुहोस् / प्रिन्ट"
                          onClick={() => setViewing(m)}
                        >
                          <FileText className="size-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="सम्पादन गर्नुहोस्"
                          onClick={() => openEdit(m)}
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:bg-destructive/10"
                          title="हटाउनुहोस्"
                          onClick={() => void handleDelete(m.id)}
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

      {/* ════════ EDITOR MODAL ════════ */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border bg-card shadow-2xl">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <NotebookPen className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground tracking-tight">
                    {editingId ? "मिनेट सम्पादन (Edit Minutes)" : "नयाँ मिनेट दर्ता (New Meeting Minutes)"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    कार्यक्रम वा साधारण सभाको कार्यविवरण, उपस्थिति, एजेन्डा र निर्णयहरू
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg text-muted-foreground hover:bg-muted"
                onClick={() => {
                  activeIdRef.current = null;
                  recRef.current?.stop();
                  setEditorOpen(false);
                }}
              >
                <X className="size-4" />
              </Button>
            </div>

            {err && (
              <div className="mx-6 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                {err}
              </div>
            )}

            {/* Scrollable Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm">
              {/* Event Selector & Meeting Date */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-extrabold text-foreground">
                    सम्बन्धित कार्यक्रम / निकाय (Linked Programme)
                  </Label>
                  <SearchSelect
                    value={form.event_id}
                    onChange={(v) => setForm((prev) => ({ ...prev, event_id: v }))}
                    options={events.map((ev) => ({
                      value: ev.id || "",
                      label: `${ev.title} ${ev.locality ? `(${ev.locality})` : ""}`,
                    }))}
                    placeholder="— सम्बन्ध नराख्ने (सामान्य सभा / कार्यसमिति बैठक) —"
                    emptyLabel="— सम्बन्ध नराख्ने (सामान्य सभा / कार्यसमिति बैठक) —"
                    allowClear
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-xs font-extrabold text-foreground">
                    मिनेट मिति (Meeting Date - BS) *
                  </Label>
                  <div className="mt-1.5">
                    <BSDatePicker
                      value={form.meeting_date}
                      onChange={(v) => setForm((prev) => ({ ...prev, meeting_date: v }))}
                    />
                  </div>
                </div>
              </div>

              {/* ─── AVAILABLE DETAILS FROM LINKED PROGRAMME ─── */}
              {selectedEvent ? (
                <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3.5 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                        <CalendarDays className="size-4" />
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-foreground">
                          {selectedEvent.title}
                        </h4>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <span>सुरु मिति: <strong className="font-mono text-foreground">{np(selectedEvent.commencing_date)}</strong></span>
                          {selectedEvent.end_date && (
                            <span>| सम्पन्न: <strong className="font-mono text-foreground">{np(selectedEvent.end_date)}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          "text-xs font-bold px-2.5 py-0.5 " +
                          (selectedEvent.status === "completed"
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                            : selectedEvent.status === "ongoing"
                              ? "bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300"
                              : "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300")
                        }
                      >
                        {selectedEvent.status === "completed"
                          ? "✓ सम्पन्न"
                          : selectedEvent.status === "ongoing"
                            ? "▶ सञ्चालनमा"
                            : selectedEvent.status === "postponed"
                              ? "स्थगित"
                              : "योजना चरण"}
                      </Badge>
                    </div>
                  </div>

                  {/* Locality, Budget & Info Grid */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
                    <div className="flex items-center gap-2 rounded-lg bg-background/80 p-2 border">
                      <MapPin className="size-4 shrink-0 text-primary" />
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold">कार्यक्रम स्थान (Venue):</span>
                        <div className="font-bold text-foreground">{selectedEvent.locality || "—"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg bg-background/80 p-2 border">
                      <Coins className="size-4 shrink-0 text-emerald-600" />
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold">आवश्यक तथा विनियोजित बजेट:</span>
                        <div className="font-bold text-foreground">
                          आवश्यक {money(selectedEvent.budget_required)}
                          {selectedEvent.budget_allocated ? ` (विनियोजित ${money(selectedEvent.budget_allocated)})` : ""}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Authorized persons / Coordinators */}
                  {selectedEvent.authorized_persons && selectedEvent.authorized_persons.length > 0 && (
                    <div className="rounded-lg bg-background/80 p-2.5 border">
                      <div className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center justify-between">
                        <span>कार्यक्रम संयोजक तथा अधिकृत टोली:</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10"
                          onClick={() => {
                            (selectedEvent.authorized_persons || []).forEach((ap) => {
                              toggledAttendee(ap.name, "representative", ap.role || ap.designation);
                            });
                          }}
                        >
                          + सबैलाई उपस्थितिमा थप्नुहोस्
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedEvent.authorized_persons.map((ap, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground border"
                          >
                            <UserCheck className="size-3 text-primary" />
                            <span>{ap.name}</span>
                            {ap.role && <span className="text-[10px] text-muted-foreground font-normal">({ap.role})</span>}
                            {ap.phone && <span className="text-[10px] text-muted-foreground font-mono">· 📞 {ap.phone}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Remarks / Objectives */}
                  {selectedEvent.remarks && (
                    <div className="rounded-lg bg-background/80 p-2.5 border text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">उद्देश्य तथा टिप्पणी: </span>
                      {selectedEvent.remarks}
                    </div>
                  )}

                  {/* Auto-suggest Agenda Button */}
                  {form.agenda.length === 1 && !form.agenda[0].text.trim() && (
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => {
                          updateAgenda(form.agenda[0].id, {
                            text: `${selectedEvent.title} कार्यक्रम तयारी, बजेट तथा व्यवस्थापन सम्बन्धी छलफल।`,
                            decision: `${selectedEvent.locality || "तोकिएको स्थान"} मा कार्यक्रम प्रभावकारी रूपमा सम्पन्न गर्न जिम्मेवारी बाँडफाँड गरियो।`,
                          });
                        }}
                      >
                        <Sparkles className="size-3 mr-1" />
                        कार्यक्रम शीर्षकबाट पहिलो एजेन्डा स्वतः भर्नुहोस्
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground bg-muted/20">
                  💡 माथि कुनै कार्यक्रम छान्नुभएमा त्यसको स्थान, बजेट, मिति र संयोजक विवरण यहाँ स्वतः देखिनेछ र सिधै मिनेटमा प्रयोग गर्न सकिनेछ।
                </div>
              )}

              {/* ─── ATTENDEES (सदस्य, सल्लाहकार, प्रतिनिधि) ─── */}
              <div className="space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  उपस्थिति विवरण (Attendees)
                </div>

                {/* 1. Members */}
                <div className="rounded-xl border bg-card p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Users className="size-4 text-primary" />
                      सदस्यहरू (Members)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      छानिएको: {form.attendees.filter((a) => a.category === "member").length} जना
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {members.map((mem) => {
                      const selected = isSelected(mem.name, "member");
                      return (
                        <button
                          key={mem.id}
                          type="button"
                          onClick={() => toggledAttendee(mem.name, "member", mem.designation)}
                          className={
                            "rounded-lg border px-3 py-1 text-xs font-bold transition-all " +
                            (selected
                              ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                              : "bg-background text-foreground hover:border-primary/40 hover:bg-muted/40")
                          }
                        >
                          {mem.name}
                          {mem.designation ? ` · ${mem.designation}` : ""}
                        </button>
                      );
                    })}
                    {members.length === 0 && (
                      <span className="text-xs italic text-muted-foreground">
                        क्लब सदस्य फेला परेन।
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Advisors */}
                <div className="rounded-xl border bg-card p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <UserCheck className="size-4 text-primary" />
                      सल्लाहकारहरू (Advisors)
                    </span>
                    <SearchSelect
                      aria-label="Add advisor from members"
                      value=""
                      onChange={(v) => {
                        const mem = members.find((m2) => m2.id === v);
                        if (mem) toggledAttendee(mem.name, "advisor", mem.designation);
                      }}
                      options={members
                        .filter((mem) => !isSelected(mem.name, "advisor"))
                        .map((mem) => ({
                          value: mem.id || "",
                          label: `${mem.name} ${mem.designation ? `(${mem.designation})` : ""}`,
                        }))}
                      placeholder="सदस्यबाट सल्लाहकार छान्नुहोस्…"
                      emptyLabel="सदस्यबाट सल्लाहकार छान्नुहोस्…"
                      className="max-w-[240px]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {form.attendees
                      .filter((a) => a.category === "advisor")
                      .map((a) => (
                        <span
                          key={`adv-${a.name}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"
                        >
                          <span>{a.name}</span>
                          <button
                            type="button"
                            onClick={() => toggledAttendee(a.name, "advisor", a.designation)}
                            className="text-primary hover:text-destructive"
                            aria-label={`${a.name} हटाउनुहोस्`}
                          >
                            <X className="size-3.5" />
                          </button>
                        </span>
                      ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      placeholder="अन्य सल्लाहकारको नाम टाइप गर्नुहोस्…"
                      value={advisorName}
                      onChange={(e) => setAdvisorName(e.target.value)}
                      className="h-9 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 px-3 text-xs font-bold"
                      onClick={() => {
                        if (!advisorName.trim()) return;
                        toggledAttendee(advisorName.trim(), "advisor");
                        setAdvisorName("");
                      }}
                    >
                      थप्नुहोस्
                    </Button>
                  </div>
                </div>

                {/* 3. Representatives */}
                <div className="rounded-xl border bg-card p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <UserCheck className="size-4 text-primary" />
                      प्रतिनिधिहरू (Representatives)
                    </span>
                    <select
                      aria-label="Add representative"
                      value=""
                      onChange={(e) => {
                        const [type, id] = e.target.value.split(":");
                        if (type === "auth") {
                          const ap = (selectedEvent?.authorized_persons || [])[Number(id)];
                          if (ap)
                            toggledAttendee(ap.name, "representative", ap.role || ap.designation);
                        } else if (type === "mem") {
                          const mem = members.find((m2) => m2.id === id);
                          if (mem) toggledAttendee(mem.name, "representative", mem.designation);
                        }
                        e.target.value = "";
                      }}
                      className="h-8 max-w-[240px] rounded-lg border bg-background px-2 text-xs font-medium"
                    >
                      <option value="">प्रतिनिधि छान्नुहोस्…</option>
                      {(selectedEvent?.authorized_persons || []).map((ap, i) => (
                        <option key={`auth-${i}`} value={`auth:${i}`}>
                          {ap.name} {ap.role ? `(${ap.role})` : ""}
                        </option>
                      ))}
                      {members.map((mem) => (
                        <option key={`mem-${mem.id}`} value={`mem:${mem.id}`}>
                          {mem.name} {mem.designation ? `(${mem.designation})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {form.attendees
                      .filter((a) => a.category === "representative")
                      .map((a) => (
                        <span
                          key={`rep-${a.name}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"
                        >
                          <span>{a.name}</span>
                          <button
                            type="button"
                            onClick={() => toggledAttendee(a.name, "representative", a.designation)}
                            className="text-primary hover:text-destructive"
                            aria-label={`${a.name} हटाउनुहोस्`}
                          >
                            <X className="size-3.5" />
                          </button>
                        </span>
                      ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      placeholder="अन्य प्रतिनिधिको नाम टाइप गर्नुहोस्…"
                      value={repName}
                      onChange={(e) => setRepName(e.target.value)}
                      className="h-9 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 px-3 text-xs font-bold"
                      onClick={() => {
                        if (!repName.trim()) return;
                        toggledAttendee(repName.trim(), "representative");
                        setRepName("");
                      }}
                    >
                      थप्नुहोस्
                    </Button>
                  </div>
                </div>
              </div>

              {/* ─── SPACIOUS AGENDA & DECISION BUILDER ─── */}
              <div className="rounded-2xl border bg-muted/20 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                      <ListChecks className="size-4.5 text-primary" />
                      एजेन्डा तथा निर्णयहरू (Agenda & Decisions) *
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      छलफल भएको विषय र पारित निर्णय अलग-अलग र स्पष्टसँग दर्ता गर्नुहोस्
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1.5 font-bold"
                    onClick={addAgendaRow}
                  >
                    <Plus className="size-3.5" /> थप एजेन्डा थप्नुहोस्
                  </Button>
                </div>

                {carryInAgendas.length > 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-50/70 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    💡 <strong>{carryInAgendas.length} वटा अपूरा एजेन्डा</strong> अघिल्लो बैठकबाट स्वतः समेटिएका छन्। निर्णय पूरा नभएसम्म आगामी बैठकहरूमा पनि स्वतः निरन्तरता पाउनेछन्।
                  </div>
                )}

                {voiceErr && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs font-semibold text-destructive">
                    {voiceErr}
                  </div>
                )}

                {/* Agenda Cards */}
                <div className="space-y-4">
                  {form.agenda.map((a, idx) => (
                    <div
                      key={a.id}
                      className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs space-y-3.5 transition-all hover:border-primary/40"
                    >
                      {/* Top Bar: Number + Status Badge + Done Toggle + Delete */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6.5 items-center justify-center rounded-full bg-primary/15 text-primary font-mono text-xs font-black">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-black text-foreground">
                            एजेन्डा नं. {np(String(idx + 1))}
                          </span>
                          {a.done ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold"
                            >
                              ✓ निर्णय कार्यान्वयन पूरा
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold"
                            >
                              ⏳ छलफल / कार्यान्वयन जारी
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs font-bold text-foreground cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={a.done}
                              onChange={(e) => updateAgenda(a.id, { done: e.target.checked })}
                              className="size-4 rounded accent-emerald-600 cursor-pointer"
                            />
                            <span
                              className={
                                a.done
                                  ? "text-emerald-700 dark:text-emerald-400 font-extrabold"
                                  : "text-muted-foreground"
                              }
                            >
                              पूरा भयो (Mark Complete)
                            </span>
                          </label>
                          {form.agenda.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              title="यो एजेन्डा हटाउनुहोस्"
                              onClick={() => removeAgenda(a.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* 1. Discussion Topic / Agenda */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-1.5 text-xs font-extrabold text-foreground">
                            <FileText className="size-3.5 text-primary" />
                            <span>छलफलको विषय / एजेन्डा (Agenda Topic) *</span>
                          </Label>
                          <Button
                            type="button"
                            variant={listenId === `ag-${a.id}-text` ? "default" : "outline"}
                            size="sm"
                            className={`h-7 px-2.5 text-[11px] font-semibold gap-1.5 ${
                              listenId === `ag-${a.id}-text`
                                ? "animate-pulse bg-destructive text-destructive-foreground font-black"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            title="नेपाली आवाजबाट बोल्नुहोस् (Nepali Voice Input)"
                            onClick={() =>
                              toggleVoice(`ag-${a.id}-text`, (t) => {
                                const cur =
                                  formRef.current.agenda.find((x) => x.id === a.id)?.text || "";
                                updateAgenda(a.id, { text: cur ? `${cur} ${t}` : t });
                              })
                            }
                          >
                            <Mic className="size-3.5" />
                            <span>
                              {listenId === `ag-${a.id}-text` ? "सुन्दैछ… (बोल्नुहोस्)" : "आवाजबाट लेख्नुहोस्"}
                            </span>
                          </Button>
                        </div>
                        <Textarea
                          rows={2}
                          value={a.text}
                          onChange={(e) => updateAgenda(a.id, { text: e.target.value })}
                          placeholder="बैठकमा छलफल गरिने मूल विषय वा प्रस्ताव यहाँ लेख्नुहोस् (वा आवाजबाट बोल्नुहोस्)…"
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm leading-relaxed focus-visible:ring-1 focus-visible:ring-primary font-medium"
                        />
                      </div>

                      {/* 2. Decision / Resolution */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-1.5 text-xs font-extrabold text-foreground">
                            <CheckCircle2 className="size-3.5 text-emerald-600" />
                            <span>भएको निर्णय तथा निष्कर्ष (Decision / Resolution)</span>
                          </Label>
                          <Button
                            type="button"
                            variant={listenId === `ag-${a.id}-dec` ? "default" : "outline"}
                            size="sm"
                            className={`h-7 px-2.5 text-[11px] font-semibold gap-1.5 ${
                              listenId === `ag-${a.id}-dec`
                                ? "animate-pulse bg-destructive text-destructive-foreground font-black"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            title="नेपाली आवाजबाट निर्णय बोल्नुहोस्"
                            onClick={() =>
                              toggleVoice(`ag-${a.id}-dec`, (t) => {
                                const cur =
                                  formRef.current.agenda.find((x) => x.id === a.id)?.decision || "";
                                updateAgenda(a.id, { decision: cur ? `${cur} ${t}` : t });
                              })
                            }
                          >
                            <Mic className="size-3.5" />
                            <span>
                              {listenId === `ag-${a.id}-dec` ? "सुन्दैछ… (बोल्नुहोस्)" : "आवाजबाट निर्णय"}
                            </span>
                          </Button>
                        </div>
                        <Textarea
                          rows={2}
                          value={a.decision || ""}
                          onChange={(e) => updateAgenda(a.id, { decision: e.target.value })}
                          placeholder="उक्त एजेन्डामा बैठकले के निर्णय गर्यो, जिम्मेवारी कसलाई दिइयो र समयसीमा के तोकियो लेख्नुहोस्…"
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm leading-relaxed focus-visible:ring-1 focus-visible:ring-primary font-medium"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-9 border-dashed border-2 font-bold text-xs gap-1.5 hover:border-primary hover:text-primary"
                  onClick={addAgendaRow}
                >
                  <Plus className="size-4" /> थप अर्को एजेन्डा थप्नुहोस् (Add Another Agenda)
                </Button>
              </div>

              {/* ─── AI DRAFT MINUTES ─── */}
              <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Sparkles className="size-4" />
                    </span>
                    <div>
                      <h4 className="text-sm font-black text-foreground">
                        AI द्वारा औपचारिक मिनेट ड्राफ्ट (AI Draft Minutes)
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        एजेन्डा र निर्णयलाई औपचारिक नेपाली माइन्युट भाषामा स्वतः बदल्छ
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={aiBusy}
                    className="font-bold text-xs shadow-xs"
                    onClick={() => void handleGenerateDraft()}
                  >
                    {aiBusy ? "मिनेट तयार हुँदैछ…" : "✨ मिनेट ड्राफ्ट बनाउनुहोस्"}
                  </Button>
                </div>

                {aiErr && (
                  <p className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-xs text-amber-700 dark:text-amber-300">
                    {aiErr}
                  </p>
                )}

                <Textarea
                  rows={8}
                  placeholder="'मिनेट ड्राफ्ट बनाउनुहोस्' बटन थिच्दा यहाँ पूर्ण औपचारिक कार्यविवरण स्वतः भरिनेछ — आफैंले पनि सम्पादन गर्न सकिन्छ।"
                  value={form.draft}
                  onChange={(e) => setForm((prev) => ({ ...prev, draft: e.target.value }))}
                  className="w-full rounded-xl border bg-background p-3 text-sm leading-relaxed font-sans"
                />
              </div>
            </div>

            {/* Modal Fixed Footer */}
            <div className="flex shrink-0 items-center justify-end gap-2.5 border-t px-6 py-3.5 bg-card rounded-b-2xl">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  activeIdRef.current = null;
                  recRef.current?.stop();
                  setEditorOpen(false);
                }}
              >
                रद्द गर्नुहोस्
              </Button>
              <Button
                size="sm"
                className="font-bold text-xs px-5 shadow-xs"
                disabled={busy}
                onClick={() => void handleSave()}
              >
                {busy ? "सुरक्षित हुँदैछ…" : "मिनेट सेभ गर्नुहोस् (Save Minutes)"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ VIEW / PRINT MODAL ════════ */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-xl border-2 border-foreground/30 bg-card p-6 shadow-2xl text-foreground">
            <div className="no-print mb-4 flex items-center justify-between border-b pb-3">
              <div className="text-sm font-semibold text-muted-foreground">
                कार्यविवरण (Meeting Minutes)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="सम्पादन गर्नुहोस्"
                  onClick={() => {
                    const m = viewing;
                    setViewing(null);
                    if (m) openEdit(m);
                  }}
                >
                  <Edit2 className="size-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="size-4" /> प्रिन्ट गर्नुहोस्
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setViewing(null)}>
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            <div className="printable-slip">
              {/* Org header */}
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
                    <div className="text-xs">
                      {config.address || ""}
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="inline-block rounded-md bg-primary/10 px-2.5 py-1 font-bold text-primary">
                    कार्यविवरण / मिनेट
                  </div>
                  <div className="mt-1 font-medium">मिति: {np(viewing.meeting_date)}</div>
                </div>
              </div>

              {/* Event info */}
              <div className="mt-4 space-y-1.5 rounded-lg border bg-muted/20 p-4 text-xs">
                <div>
                  <span className="text-muted-foreground">कार्यक्रम / निकाय: </span>
                  <span className="text-sm font-extrabold">
                    {events.find((e2) => e2.id === viewing.event_id)?.title || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">स्थान: </span>
                  <span className="font-bold">
                    {events.find((e2) => e2.id === viewing.event_id)?.locality || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">मिति: </span>
                  <span className="font-bold font-mono">{np(viewing.meeting_date)}</span>
                </div>
              </div>

              {/* Attendance */}
              <div className="mt-4 text-xs">
                <div className="border-b pb-1.5 font-bold">उपस्थिति (Attendance):</div>
                {(["member", "advisor", "representative"] as const).map((cat) => {
                  const list = (viewing.attendees || []).filter((a) => a.category === cat);
                  if (list.length === 0) return null;
                  const catLabel =
                    cat === "member"
                      ? "सदस्यहरू"
                      : cat === "advisor"
                        ? "सल्लाहकारहरू"
                        : "प्रतिनिधिहरू";
                  return (
                    <p key={cat} className="mt-1.5 text-foreground">
                      <span className="font-semibold">{catLabel}: </span>
                      {list.map((a) => a.name).join(", ")}
                    </p>
                  );
                })}
                {(viewing.attendees || []).length === 0 && (
                  <p className="mt-1 italic text-muted-foreground">उपस्थिति दर्ता छैन।</p>
                )}
              </div>

              {/* Agenda & decisions */}
              <div className="mt-4 text-xs">
                <div className="border-b pb-1.5 font-bold">
                  एजेन्डा तथा निर्णयहरू (Agenda & Decisions):
                </div>
                <ol className="mt-2 space-y-2">
                  {(viewing.agenda || []).map((a, i) => (
                    <li key={a.id} className="leading-relaxed">
                      <span className="font-semibold">
                        {i + 1}. {a.text}
                      </span>
                      {a.decision && (
                        <div className="text-muted-foreground">
                          निर्णय: <span className="font-medium text-foreground">{a.decision}</span>
                        </div>
                      )}
                      <div
                        className={
                          "text-[10px] font-bold " +
                          (a.done ? "text-emerald-600" : "text-amber-600")
                        }
                      >
                        {a.done ? "✓ कार्यान्वयन पूरा" : "○ अर्को सभामा जारी"}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* AI drafted minutes */}
              {viewing.draft && (
                <div className="mt-4 whitespace-pre-wrap border-t pt-3 text-xs leading-relaxed">
                  {viewing.draft}
                </div>
              )}

              {/* Signatures */}
              <div className="mt-10 flex justify-between pt-4 text-xs">
                <div className="text-center">
                  <div className="h-10 w-36 border-b border-foreground/40" />
                  <div className="pt-1 font-medium">सचिवको सही</div>
                </div>
                <div className="text-center">
                  <div className="h-10 w-36 border-b border-foreground/40" />
                  <div className="pt-1 font-medium">अध्यक्षको सही</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
