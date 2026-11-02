import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef, useEffect } from "react";
import { useWorkspace, WorkspacePage, EmptyRows } from "@/components/workspace";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  saveCustomer,
  deleteCustomer,
  savePlan,
  uploadLocalityPhoto,
  deleteLocalityPhoto,
  getLocalityPhoto,
} from "@/lib/workspace.functions";
import { BUSINESS_NATURES, natureEmoji } from "@/lib/nature";
import { Button } from "@/components/ui/button";
import {
  Search,
  Plus,
  Trash2,
  X,
  MapPin,
  Edit2,
  ExternalLink,
  Calendar as CalendarIcon,
  Layers,
  Users,
  Check,
  Minus,
  CreditCard,
  AlertTriangle,
  Camera,
  ImagePlus,
} from "lucide-react";
import { LocationMap } from "@/components/location-map";
import { BSDatePicker } from "@/components/bs-date-picker";
import {
  todayBS,
  np,
  DEFAULT_PLANS,
  matchPlan,
  getCustomerTotalRate,
  getDueMonths,
  mergeOpeningDues,
  remainingDuesForPerson,
  MONTHS,
  FISCAL_YEARS,
  fiscalLabel,
  type Person,
  type PlanItem,
  type CustomerPlanSubscription,
  type DueMonth,
  type OpeningDue,
} from "@/lib/receipt-rules";
import { DigitalCard } from "@/components/digital-card";

export const Route = createFileRoute("/masters")({
  head: () => ({
    meta: [
      { title: "People Master — Hami Yuwa Club" },
      {
        name: "description",
        content:
          "Saved people’s names, wards, toles, card numbers, plans, joining date, PAN and GPS locations.",
      },
      { property: "og:title", content: "Hami Yuwa Club People Master" },
      {
        property: "og:description",
        content:
          "Customer records with plan, joining date, PAN, detailed address and live GPS mapping.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Masters,
});

const getEmptyForm = (defaultWard = "1"): Person => {
  return {
    district: "सुर्खेत",
    municipality: "वीरेन्द्रनगर",
    ward: defaultWard || "1",
    card: "",
    name: "",
    plan: "",
    plan_id: "",
    plans: [],
    joining_date: todayBS() >= "2083/04/01" ? todayBS() : "2083/04/01", // Registration 2083-04-01 onwards
    tole: "",
    phone: "",
    email: "",
    pan: "",
    full_address: "",
    latitude: null,
    longitude: null,
    gps_accuracy: null,
    opening_dues: [],
    locality_photo: "",
    nature: "",
  };
};

// Resolves locality photo values: `locality:{ward}:{card}` refs are fetched from the
// owner-scoped locality_photos table; anything else (legacy Storage URL, data URL,
// empty string) is passed through directly.
function useLocalityPhotoSrc(value: string): string {
  const fetchPhotoFn = useServerFn(getLocalityPhoto);
  const isRef = value.startsWith("locality:");
  const [direct, setDirect] = useState(isRef ? "" : value);
  const [fetched, setFetched] = useState("");

  useEffect(() => {
    if (!value || !isRef) {
      setDirect(value);
      setFetched("");
      return;
    }
    setDirect("");
    const [, ward, card] = value.split(":");
    if (!ward || !card) return;
    let alive = true;
    fetchPhotoFn({ data: { ward, card } })
      .then((url: string) => {
        if (alive) setFetched(url || "");
      })
      .catch(() => {
        if (alive) setFetched("");
      });
    return () => {
      alive = false;
    };
  }, [value, isRef, fetchPhotoFn]);

  return direct || fetched;
}

function Masters() {
  const { query, ward, signedIn } = useWorkspace();
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [viewingMapPerson, setViewingMapPerson] = useState<Person | null>(null);
  const [viewingCardPerson, setViewingCardPerson] = useState<Person | null>(null);
  const plans: PlanItem[] =
    query.data?.plans && query.data.plans.length > 0 ? query.data.plans : DEFAULT_PLANS;
  const [form, setForm] = useState<Person>(getEmptyForm(ward ?? "1"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const queryClient = useQueryClient();
  const saveRecord = useServerFn(saveCustomer);
  const deleteRecord = useServerFn(deleteCustomer);
  const savePlanRecord = useServerFn(savePlan);
  const uploadPhotoFn = useServerFn(uploadLocalityPhoto);
  const deletePhotoFn = useServerFn(deleteLocalityPhoto);

  // Locality photo state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const [camOpen, setCamOpen] = useState(false);
  const [camErr, setCamErr] = useState("");
  const formPhotoSrc = useLocalityPhotoSrc(form.locality_photo);
  const viewerPhotoSrc = useLocalityPhotoSrc(viewingMapPerson?.locality_photo || "");

  const openCamera = async () => {
    setCamErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setCamErr(
        "क्यामेरा खोल्न सकिएन। फोन/कम्प्युटरको क्यामेरा अनुमति दिनुहोस् वा ग्यालरीबाट छान्नुहोस्।",
      );
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOpen(false);
  };

  const resizeToJpeg = (source: Blob, maxDim = 1280, quality = 0.78): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(source);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("क्यानभासमा फोटो बनाउन सकिएन।"))),
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("फोटो फाइल पढ्न सकिएन।"));
      };
      img.src = url;
    });

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("फोटो फाइल पढ्न सकिएन।"));
      reader.readAsDataURL(blob);
    });

  const uploadPhoto = async (blob: Blob) => {
    setPhotoBusy(true);
    setPhotoErr("");
    try {
      const small = await resizeToJpeg(blob);
      const dataUrl = await blobToDataUrl(small);
      const res = await uploadPhotoFn({
        data: { ward: form.ward || "1", card: form.card || "", dataUrl },
      });
      setForm((prev) => ({ ...prev, locality_photo: res.ref }));
    } catch (e) {
      setPhotoErr(
        e instanceof Error && e.message
          ? e.message
          : "फोटो अपलोड गर्न सकिएन। पुनः प्रयास गर्नुहोस्।",
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const handlePhotoFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setPhotoErr("कृपया फोटो (image) फाइल छान्नुहोस्।");
      return;
    }
    await uploadPhoto(file);
  };

  const captureCamera = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setCamErr("क्यामेरा तयार भइरहेको छ, एकछिन पर्खनुहोस्।");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        stopCamera();
        if (blob) void uploadPhoto(blob);
      },
      "image/jpeg",
      0.85,
    );
  };

  const removePhoto = () => {
    const existing = form.locality_photo;
    setForm((prev) => ({ ...prev, locality_photo: "" }));
    if (existing) {
      // Best-effort delete through the authenticated server function; failures are ignored.
      void deletePhotoFn({ data: { ref: existing } }).catch(() => undefined);
    }
  };

  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [newPlanForm, setNewPlanForm] = useState({
    name: "",
    uom: "महिना (Month)",
    rate: 0,
    trips: 1,
    no_of_trips: 1,
    amount: 0,
    incentive: 0,
    chargeable_amount: 0,
    description: "",
  });
  const [savingPlan, setSavingPlan] = useState(false);

  // Opening dues state (for the modal form UI)
  const [openingDueFY, setOpeningDueFY] = useState<number>(2082);
  const [openingDueMonth, setOpeningDueMonth] = useState<number>(3); // Shrawan = index 3
  const [openingDueAmount, setOpeningDueAmount] = useState<string>("");

  // Dues calculation for the active customer form (auto-updates when receipts are billed)
  const allReceipts = useMemo(() => query.data?.receipts ?? [], [query.data?.receipts]);
  const formPaidSet = useMemo(() => {
    if (!form.card) return new Set<string>();
    return new Set(
      allReceipts
        .filter((r) => r.ward === form.ward && r.card.toLowerCase() === form.card.toLowerCase())
        .flatMap((r) => r.months.map((m) => `${m.year ?? r.year}:${m.m}`)),
    );
  }, [allReceipts, form.ward, form.card]);

  const formDueMonths: DueMonth[] = useMemo(() => {
    const auto = form.joining_date ? getDueMonths(form.joining_date, formPaidSet, todayBS()) : [];
    return mergeOpeningDues(auto, form.opening_dues, formPaidSet);
  }, [form.joining_date, form.opening_dues, formPaidSet]);

  const formMonthlyFee = useMemo(() => {
    return (form.plans || []).reduce(
      (acc, sp) => acc + sp.chargeable_amount * (sp.quantity || 1),
      0,
    );
  }, [form.plans]);

  const formDueByFY = useMemo(() => {
    const map = new Map<number, DueMonth[]>();
    formDueMonths.forEach((dm) => {
      if (!map.has(dm.fy)) map.set(dm.fy, []);
      map.get(dm.fy)!.push(dm);
    });
    return map;
  }, [formDueMonths]);

  const formTotalDueAmount = formDueMonths.reduce((s, dm) => s + (dm.amount ?? formMonthlyFee), 0);
  const formOverdueCount = formDueMonths.filter((d) => d.isOverdue).length;

  const people =
    query.data?.people.filter((p) => {
      if (ward && p.ward !== ward) return false;
      const term = search.toLowerCase();
      const planNames = p.plans?.map((x) => x.name).join(" ") || "";
      const text =
        `${p.name} ${p.card} ${p.district ?? ""} ${p.municipality ?? ""} ${p.tole} ${p.ward} ${p.phone} ${p.email ?? ""} ${p.pan ?? ""} ${p.full_address ?? ""} ${p.plan ?? ""} ${planNames} ${p.joining_date ?? ""} ${p.nature ?? ""}`.toLowerCase();
      return text.includes(term);
    }) ?? [];

  // Remaining dues per customer (receipt months already paid are removed)
  const peopleDues = useMemo(() => {
    const today = todayBS();
    const map = new Map<string, { months: DueMonth[]; total: number }>();
    (query.data?.people ?? []).forEach((p) => {
      map.set(
        `${p.ward}-${p.card}`,
        remainingDuesForPerson(
          p.joining_date,
          p.opening_dues,
          allReceipts,
          p.ward,
          p.card,
          getCustomerTotalRate(p, plans),
          today,
        ),
      );
    });
    return map;
  }, [query.data?.people, allReceipts, plans]);

  const handleOpenAdd = () => {
    setForm(getEmptyForm(ward ?? "1"));
    setIsCreatingPlan(false);
    setNewPlanForm({
      name: "",
      uom: "महिना (Month)",
      rate: 0,
      trips: 1,
      no_of_trips: 1,
      amount: 0,
      incentive: 0,
      chargeable_amount: 0,
      description: "",
    });
    setEditingCard(null);
    setErr("");
    setOpenModal(true);
  };

  const handleOpenEdit = (p: Person) => {
    let initialPlans: CustomerPlanSubscription[] = [];
    if (p.plans && Array.isArray(p.plans) && p.plans.length > 0) {
      initialPlans = p.plans.map((sp) => {
        const matched = plans.find((x) => x.id === sp.plan_id);
        return {
          plan_id: sp.plan_id,
          name: sp.name,
          amount: Number(sp.amount) || 0,
          incentive: Number(sp.incentive) || 0,
          chargeable_amount: Number(sp.chargeable_amount) || 0,
          uom: sp.uom || matched?.uom || "महिना (Month)",
          quantity: Math.max(1, Number(sp.quantity) || 1),
          trips:
            Number(sp.trips ?? sp.no_of_trips ?? matched?.trips ?? matched?.no_of_trips ?? 1) || 1,
          no_of_trips:
            Number(sp.no_of_trips ?? sp.trips ?? matched?.no_of_trips ?? matched?.trips ?? 1) || 1,
        };
      });
    } else {
      // No stored plan subscriptions — leave empty so the customer's plan must be
      // selected explicitly (no automatic plan assignment).
      const matchedPlan = matchPlan(plans, p.plan_id, p.plan);
      initialPlans = matchedPlan
        ? [
            {
              plan_id: matchedPlan.id,
              name: matchedPlan.name,
              amount: matchedPlan.amount,
              incentive: matchedPlan.incentive,
              chargeable_amount: matchedPlan.chargeable_amount,
              uom: matchedPlan.uom || "महिना (Month)",
              quantity: 1,
              trips: matchedPlan.trips || matchedPlan.no_of_trips || 1,
              no_of_trips: matchedPlan.trips || matchedPlan.no_of_trips || 1,
            },
          ]
        : [];
    }

    setForm({
      card: p.card,
      name: p.name,
      district: p.district || "सुर्खेत",
      municipality: p.municipality || "वीरेन्द्रनगर",
      ward: p.ward,
      tole: p.tole,
      phone: p.phone || "",
      email: p.email || "",
      pan: p.pan || "",
      full_address: p.full_address || "",
      plans: initialPlans,
      plan: initialPlans.map((ip) => ip.name).join(", "),
      plan_id: initialPlans[0]?.plan_id || plans[0]?.id || "",
      joining_date: p.joining_date || todayBS(),
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      gps_accuracy: p.gps_accuracy ?? null,
      opening_dues: Array.isArray(p.opening_dues) ? p.opening_dues : [],
      locality_photo: p.locality_photo || "",
      nature: p.nature || "",
    });
    setIsCreatingPlan(false);
    setNewPlanForm({
      name: "",
      uom: "महिना (Month)",
      rate: 0,
      trips: 1,
      no_of_trips: 1,
      amount: 0,
      incentive: 0,
      chargeable_amount: 0,
      description: "",
    });
    setEditingCard(p.card);
    setErr("");
    setOpenModal(true);
  };

  const addPlanToCustomer = (planItem: PlanItem) => {
    setForm((prev) => {
      const existing = prev.plans || [];
      const foundIdx = existing.findIndex((x) => x.plan_id === planItem.id);
      let updated: CustomerPlanSubscription[];
      if (foundIdx >= 0) {
        updated = existing.map((sp, idx) =>
          idx === foundIdx ? { ...sp, quantity: (sp.quantity || 1) + 1 } : sp,
        );
      } else {
        updated = [
          ...existing,
          {
            plan_id: planItem.id,
            name: planItem.name,
            amount: planItem.amount,
            incentive: planItem.incentive,
            chargeable_amount: planItem.chargeable_amount,
            uom: planItem.uom || "महिना (Month)",
            quantity: 1,
            trips: planItem.trips || planItem.no_of_trips || 1,
            no_of_trips: planItem.trips || planItem.no_of_trips || 1,
          },
        ];
      }
      return {
        ...prev,
        plans: updated,
        plan: updated.map((sp) => sp.name).join(", "),
        plan_id: updated[0]?.plan_id || prev.plan_id,
      };
    });
  };

  const updatePlanTrips = (planId: string, trips: number) => {
    const t = Math.max(1, trips);
    setForm((prev) => {
      const updated = (prev.plans || []).map((sp) =>
        sp.plan_id === planId ? { ...sp, trips: t, no_of_trips: t } : sp,
      );
      return {
        ...prev,
        plans: updated,
      };
    });
  };

  const removePlanFromCustomer = (planId: string) => {
    setForm((prev) => {
      const existing = prev.plans || [];
      if (existing.length <= 1) {
        return prev; // keep at least 1 plan
      }
      const updated = existing.filter((x) => x.plan_id !== planId);
      return {
        ...prev,
        plans: updated,
        plan: updated.map((sp) => sp.name).join(", "),
        plan_id: updated[0]?.plan_id || "",
      };
    });
  };

  const updatePlanQuantity = (planId: string, quantity: number) => {
    const q = Math.max(1, quantity);
    setForm((prev) => {
      const updated = (prev.plans || []).map((sp) =>
        sp.plan_id === planId ? { ...sp, quantity: q } : sp,
      );
      return {
        ...prev,
        plans: updated,
      };
    });
  };

  async function handleQuickSavePlan() {
    if (!newPlanForm.name.trim()) {
      setErr("कृपया योजनाको नाम प्रविष्ट गर्नुहोस् (Please enter plan name).");
      return;
    }
    if (newPlanForm.amount <= 0) {
      setErr("कृपया मान्य दर वा रकम प्रविष्ट गर्नुहोस् (Please enter valid amount/rate).");
      return;
    }
    setSavingPlan(true);
    setErr("");
    try {
      const net = Math.max(0, Number(newPlanForm.amount) - (Number(newPlanForm.incentive) || 0));
      const tripsVal = Number(newPlanForm.trips ?? newPlanForm.no_of_trips ?? 1) || 1;
      const saved = await savePlanRecord({
        data: {
          name: newPlanForm.name.trim(),
          uom: newPlanForm.uom.trim() || "महिना (Month)",
          rate: Number(newPlanForm.rate) || Number(newPlanForm.amount),
          trips: tripsVal,
          no_of_trips: tripsVal,
          amount: Number(newPlanForm.amount),
          incentive: Number(newPlanForm.incentive) || 0,
          chargeable_amount: net,
          description: newPlanForm.description.trim(),
          is_active: true,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });

      const newSub: CustomerPlanSubscription = {
        plan_id: saved.id,
        name: saved.name,
        amount: saved.amount,
        incentive: saved.incentive,
        chargeable_amount: saved.chargeable_amount,
        uom: saved.uom || "महिना (Month)",
        quantity: 1,
        trips: saved.trips || saved.no_of_trips || tripsVal,
        no_of_trips: saved.trips || saved.no_of_trips || tripsVal,
      };

      setForm((prev) => {
        const nextPlans = [...(prev.plans || []), newSub];
        return {
          ...prev,
          plans: nextPlans,
          plan: nextPlans.map((sp) => sp.name).join(", "),
          plan_id: nextPlans[0]?.plan_id || saved.id,
        };
      });
      setIsCreatingPlan(false);
      setNewPlanForm({
        name: "",
        uom: "महिना (Month)",
        rate: 0,
        trips: 1,
        no_of_trips: 1,
        amount: 0,
        incentive: 0,
        chargeable_amount: 0,
        description: "",
      });
    } catch (err) {
      setErr(
        err instanceof Error ? err.message : "योजना सुरक्षित गर्न सकिएन (Could not save plan).",
      );
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.tole.trim() || !form.ward) {
      setErr("वडा नं., नाम र टोल अनिवार्य छन् (Ward, name and tole are required).");
      return;
    }
    if (form.phone.trim() && !/^9\d{9}$/.test(form.phone.trim())) {
      setErr(
        "सम्पर्क नं. ९ बाट सुरु हुने १० अंकको हुनुपर्दछ (Phone must be 10 digits starting with 9).",
      );
      return;
    }
    if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setErr("इमेल ठेगाना अमान्य छ (Invalid email address format).");
      return;
    }
    if (!form.plans || form.plans.length === 0) {
      setErr("कम्तिमा एउटा सेवा योजना छनोट गर्नुहोस् (Please select at least one plan).");
      return;
    }

    setBusy(true);
    setErr("");
    try {
      if (isCreatingPlan && newPlanForm.name.trim()) {
        if (newPlanForm.amount <= 0) {
          setErr("नयाँ योजनाको लागि मान्य मासिक रकम प्रविष्ट गर्नुहोस्।");
          setBusy(false);
          return;
        }
        const net = Math.max(0, Number(newPlanForm.amount) - (Number(newPlanForm.incentive) || 0));
        const tripsVal = Number(newPlanForm.trips ?? newPlanForm.no_of_trips ?? 1) || 1;
        const savedPlan = await savePlanRecord({
          data: {
            name: newPlanForm.name.trim(),
            uom: newPlanForm.uom.trim() || "महिना (Month)",
            rate: Number(newPlanForm.rate) || Number(newPlanForm.amount),
            trips: tripsVal,
            no_of_trips: tripsVal,
            amount: Number(newPlanForm.amount),
            incentive: Number(newPlanForm.incentive) || 0,
            chargeable_amount: net,
            description: newPlanForm.description.trim(),
            is_active: true,
          },
        });
        const createdSub: CustomerPlanSubscription = {
          plan_id: savedPlan.id,
          name: savedPlan.name,
          amount: savedPlan.amount,
          incentive: savedPlan.incentive,
          chargeable_amount: savedPlan.chargeable_amount,
          uom: savedPlan.uom || "महिना (Month)",
          quantity: 1,
          trips: savedPlan.trips || savedPlan.no_of_trips || tripsVal,
          no_of_trips: savedPlan.trips || savedPlan.no_of_trips || tripsVal,
        };
        form.plans = [...(form.plans || []), createdSub];
      }

      form.plan = form.plans
        .map((sp) =>
          sp.quantity && sp.quantity > 1 ? `${sp.name} (${sp.quantity} ${sp.uom || ""})` : sp.name,
        )
        .join(", ");
      form.plan_id = form.plans[0]?.plan_id || "";

      await saveRecord({ data: form });
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
      setOpenModal(false);
      setForm(getEmptyForm(ward ?? "1"));
      setIsCreatingPlan(false);
      setEditingCard(null);
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "ग्राहक सुरक्षित गर्न सकिएन (Could not save customer).",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(person: Person) {
    if (
      !window.confirm(
        `Are you sure you want to delete customer ${person.name} (Card: ${person.card})?`,
      )
    )
      return;
    try {
      await deleteRecord({ data: { ward: person.ward, card: person.card } });
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete customer.");
    }
  }

  return (
    <WorkspacePage title="People Master">
      {/* Top Header & Navigation Tabs */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" className="gap-1.5 text-xs font-semibold">
            <Users className="size-4" />
            People Master (ग्राहक सूची)
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
            <Link to="/plans">
              <Layers className="size-4 text-muted-foreground" />
              Plan Master (योजना दर)
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Search people"
              className="w-full rounded-md border bg-card py-2 pl-9 pr-3 text-sm"
              placeholder="खोज्नुहोस्: नाम, कार्ड नं., योजना, इमेल, जिल्ला, न.पा., टोल वा सम्पर्क"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-sm text-muted-foreground">{people.length} people</span>
        </div>
        <Button onClick={handleOpenAdd} disabled={!signedIn}>
          <Plus className="mr-1 size-4" /> नयाँ ग्राहक थप्नुहोस् (Add Person)
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-accent/70 font-semibold text-foreground">
            <tr>
              <th className="px-3 py-3">कार्ड नं. (Card)</th>
              <th className="px-3 py-3">नाम (Name)</th>
              <th className="px-3 py-3">योजना (Plan)</th>
              <th className="px-3 py-3">दर्ता मिति (Joined)</th>
              <th className="px-3 py-3">जिल्ला / न.पा.</th>
              <th className="px-3 py-3">वडा</th>
              <th className="px-3 py-3">टोल र विस्तृत ठेगाना (Address)</th>
              <th className="px-3 py-3">प्यान (PAN)</th>
              <th className="px-3 py-3">सम्पर्क / इमेल (Contact)</th>
              <th className="px-3 py-3 text-center">GPS नक्सा</th>
              <th className="px-3 py-3 text-center">परिचय पत्र</th>
              <th className="px-3 py-3 text-right">कार्य</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const hasGps = typeof p.latitude === "number" && typeof p.longitude === "number";
              return (
                <tr
                  key={`${p.ward}-${p.card}`}
                  className="border-b transition-colors hover:bg-accent/40"
                >
                  <td className="p-3 font-semibold text-primary">{p.card}</td>
                  <td className="p-3">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      {p.name}
                      {natureEmoji(p.nature) && (
                        <span
                          className="text-base leading-none"
                          title={p.nature}
                          aria-label={p.nature}
                        >
                          {natureEmoji(p.nature)}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="p-3">
                    {p.plans && p.plans.length > 0 ? (
                      <div className="flex flex-col gap-1 items-start max-w-[240px]">
                        {p.plans.map((sp, idx) => {
                          const qty = sp.quantity || 1;
                          const totalAmt = (sp.chargeable_amount || 0) * qty;
                          return (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                              title={`${sp.name}: रु. ${sp.chargeable_amount}/${sp.uom || "महिना"}`}
                            >
                              <span>{sp.name}</span>
                              <span
                                className="rounded bg-primary/20 px-1 py-0.2 text-[10px] font-bold"
                                title="ट्रिप संख्या"
                              >
                                {sp.trips ?? sp.no_of_trips ?? 1} ट्रिप
                              </span>
                              {qty > 1 && (
                                <span className="rounded bg-primary/20 px-1 py-0.2 text-[10px] font-bold">
                                  {qty}x
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground font-mono">
                                (रु. {totalAmt.toLocaleString("en-IN")})
                              </span>
                            </span>
                          );
                        })}
                        {p.plans.length > 1 && (
                          <span className="text-[11px] font-bold text-foreground">
                            कुल: रु. {getCustomerTotalRate(p, plans).toLocaleString("en-IN")}/महिना
                          </span>
                        )}
                      </div>
                    ) : p.plan ? (
                      <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {p.plan}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {p.joining_date ? (
                      <div>
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-foreground">
                          <CalendarIcon className="size-3 text-muted-foreground" />
                          {np(p.joining_date)}
                        </span>
                        {(() => {
                          const remain = peopleDues.get(`${p.ward}-${p.card}`);
                          if (!remain) return null;
                          return remain.months.length > 0 ? (
                            <div className="mt-0.5">
                              <span className="inline-block rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                बाँकी: रु. {remain.total.toLocaleString("en-IN")} (
                                {remain.months.length} महिना)
                              </span>
                            </div>
                          ) : (
                            <div className="mt-0.5">
                              <span className="inline-block rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                चुक्ता
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{p.municipality || "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.district || "—"}</div>
                  </td>
                  <td className="p-3 font-semibold">{p.ward}</td>
                  <td className="p-3">
                    <div className="font-medium">{p.tole}</div>
                    {p.full_address && (
                      <div className="text-xs text-muted-foreground">{p.full_address}</div>
                    )}
                  </td>
                  <td className="p-3">
                    {p.pan ? (
                      <span className="inline-block rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                        {p.pan}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="font-mono text-xs">{p.phone || "—"}</div>
                    {p.email && (
                      <div
                        className="text-[11px] text-muted-foreground truncate max-w-[150px]"
                        title={p.email}
                      >
                        {p.email}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {hasGps ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 border-emerald-500/40 bg-emerald-50 px-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                        title="नक्सामा हेर्नुहोस् (View on map)"
                        onClick={() => setViewingMapPerson(p)}
                      >
                        <MapPin className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        नक्सा
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 border-blue-400/40 bg-blue-50 px-2 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                      title="डिजिटल परिचय पत्र (Digital Card)"
                      onClick={() => setViewingCardPerson(p)}
                    >
                      <CreditCard className="size-3.5" />
                      कार्ड
                    </Button>
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-primary"
                        title="सम्पादन गर्नुहोस् (Edit customer)"
                        onClick={() => handleOpenEdit(p)}
                      >
                        <Edit2 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        title="हटाउनुहोस् (Delete customer)"
                        onClick={() => handleDelete(p)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!people.length && (
              <EmptyRows
                columns={12}
                text={
                  search
                    ? "कुनै ग्राहक फेला परेन (No matching people)."
                    : "कुनै ग्राहक भेटिएन। 'Add Person' थिची नयाँ ग्राहक दर्ता गर्नुहोस्।"
                }
              />
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Customer Modal */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6 backdrop-blur-xs">
          <div className="relative flex w-full max-w-2xl max-h-[92vh] flex-col rounded-xl border bg-card shadow-2xl overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b px-6 py-4 bg-card">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {editingCard
                    ? `ग्राहक विवरण सम्पादन (Edit Card: ${editingCard})`
                    : "नयाँ ग्राहक दर्ता (Add Person)"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  जिल्ला, नगरपालिका, वडा, योजना, दर्ता मिति, बक्यौता, प्यान, ठेगाना र GPS लोकेसन।
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Row 1: District and Municipality */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      जिल्ला (District)
                    </label>
                    <input
                      aria-label="District"
                      className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground"
                      placeholder="उदा: सुर्खेत"
                      value={form.district ?? ""}
                      maxLength={80}
                      onChange={(e) => setForm({ ...form, district: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      नगरपालिका / गाउँपालिका (Municipality)
                    </label>
                    <input
                      aria-label="Municipality"
                      className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground"
                      placeholder="उदा: वीरेन्द्रनगर"
                      value={form.municipality ?? ""}
                      maxLength={80}
                      onChange={(e) => setForm({ ...form, municipality: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 1b: Business Nature */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    व्यवसायको प्रकृति (Business Nature)
                  </label>
                  <select
                    aria-label="Business Nature"
                    className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground"
                    value={form.nature ?? ""}
                    onChange={(e) => setForm({ ...form, nature: e.target.value })}
                  >
                    <option value="">— छान्नुहोस् (Select nature) —</option>
                    {BUSINESS_NATURES.map((n) => (
                      <option key={n.label} value={n.label}>
                        {n.emoji} {n.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Row 2: Ward and Card */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      वडा नं. (Ward) *
                    </label>
                    <select
                      aria-label="Ward"
                      className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground"
                      value={form.ward}
                      onChange={(e) => setForm({ ...form, ward: e.target.value })}
                    >
                      {Array.from({ length: 16 }, (_, i) => String(i + 1)).map((w) => (
                        <option key={w} value={w}>
                          Ward {w}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      कार्ड नं. (Card Number)
                    </label>
                    <input
                      aria-label="Card number"
                      className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground"
                      placeholder="स्वतः (खाली छोडे स्वतः बस्नेछ)"
                      value={form.card}
                      disabled={Boolean(editingCard)}
                      onChange={(e) => setForm({ ...form, card: e.target.value })}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {editingCard
                        ? "कार्ड नं. परिवर्तन गर्न मिल्दैन।"
                        : "खाली राखे क्रमैसँग ०००१, ०००२ स्वतः बस्नेछ।"}
                    </span>
                  </div>
                </div>

                {/* Row 3: Customer Name */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    फर्म/व्यक्ति श्री (Customer Name) *
                  </label>
                  <input
                    aria-label="Name"
                    className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground"
                    placeholder="उदा: राम बहादुर श्रेष्ठ वा हिमालयन ट्रेडर्स"
                    value={form.name}
                    maxLength={100}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                {/* Row 4: Plan and Joining Date */}
                <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                    <div>
                      <label className="block text-xs font-bold text-foreground">
                        सेवा योजनाहरू (Subscribed Plans) *
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        ग्राहकले आफैं योजना छान्नैपर्छ; १ वा सोभन्दा बढी योजना लिन सकिन्छ (Multiple
                        plans supported)।
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingPlan(!isCreatingPlan)}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        <Plus className="size-3.5" />{" "}
                        {isCreatingPlan
                          ? "रद्द (फिर्ता हुनुहोस्)"
                          : "Plan Master मा नयाँ योजना थप्ने"}
                      </button>
                      <Link
                        to="/plans"
                        target="_blank"
                        className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                        title="Plan Master पृष्ठ"
                      >
                        <Layers className="size-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Subscribed Plans List */}
                  <div className="space-y-2">
                    {(form.plans || []).map((sp, idx) => {
                      const qty = sp.quantity || 1;
                      const subtotal = (sp.chargeable_amount || 0) * qty;
                      return (
                        <div
                          key={`${sp.plan_id}-${idx}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card p-2 text-xs shadow-xs"
                        >
                          <div className="min-w-[150px] flex-1">
                            <div className="font-bold text-foreground">{sp.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              दर: रु. {sp.chargeable_amount.toLocaleString("en-IN")} /{" "}
                              {sp.uom || "महिना"}
                              {sp.incentive > 0 && ` (छूट: रु. ${sp.incentive})`}
                            </div>
                          </div>

                          {/* Trips Counter */}
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-muted-foreground">ट्रिप:</span>
                            <input
                              type="number"
                              min={1}
                              value={sp.trips ?? sp.no_of_trips ?? 1}
                              onChange={(e) =>
                                updatePlanTrips(
                                  sp.plan_id,
                                  Math.max(1, Number(e.target.value) || 1),
                                )
                              }
                              className="w-12 rounded border bg-background px-1 py-0.5 text-center font-mono font-semibold"
                              title="ट्रिप संख्या (No. of Trips)"
                            />
                          </div>

                          {/* Quantity Counter */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground">इकाई/संख्या:</span>
                            <button
                              type="button"
                              disabled={qty <= 1}
                              onClick={() => updatePlanQuantity(sp.plan_id, qty - 1)}
                              className="size-6 rounded border bg-muted flex items-center justify-center hover:bg-accent disabled:opacity-40"
                            >
                              <Minus className="size-3" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={qty}
                              onChange={(e) =>
                                updatePlanQuantity(
                                  sp.plan_id,
                                  Math.max(1, Number(e.target.value) || 1),
                                )
                              }
                              className="w-12 rounded border bg-background px-1 py-0.5 text-center font-mono font-semibold"
                            />
                            <button
                              type="button"
                              onClick={() => updatePlanQuantity(sp.plan_id, qty + 1)}
                              className="size-6 rounded border bg-muted flex items-center justify-center hover:bg-accent"
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>

                          {/* Subtotal */}
                          <div className="text-right min-w-[90px]">
                            <span className="block text-[10px] text-muted-foreground">
                              जम्मा शुल्क
                            </span>
                            <span className="font-mono font-bold text-primary">
                              रु. {subtotal.toLocaleString("en-IN")}
                            </span>
                          </div>

                          {/* Remove Action */}
                          {(form.plans?.length || 0) > 1 && (
                            <button
                              type="button"
                              onClick={() => removePlanFromCustomer(sp.plan_id)}
                              className="text-muted-foreground hover:text-destructive p-1"
                              title="योजना हटाउनुहोस्"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Another Plan Dropdown */}
                  {!isCreatingPlan && (
                    <div className="flex items-center gap-2 pt-1">
                      <select
                        aria-label="Add additional plan"
                        className={
                          "flex-1 rounded border px-2.5 py-1.5 text-xs " +
                          ((form.plans?.length || 0) === 0
                            ? "border-amber-400 bg-amber-50/60 font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/20 dark:text-amber-300"
                            : "bg-card text-foreground")
                        }
                        value=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          if (val === "__add_new__") {
                            setIsCreatingPlan(true);
                          } else {
                            const matched = plans.find((p) => p.id === val);
                            if (matched) addPlanToCustomer(matched);
                          }
                        }}
                      >
                        <option value="">
                          {(form.plans?.length || 0) === 0
                            ? "कृपया योजना छान्नुहोस् (Please Select a Plan)…"
                            : "+ अर्को योजना थप्नुहोस् (Add Another Plan from Master)..."}
                        </option>
                        {plans
                          .filter((p) => p.is_active !== false)
                          .map((sp) => (
                            <option key={sp.id} value={sp.id}>
                              + {sp.name} — रु. {sp.chargeable_amount.toLocaleString("en-IN")} /{" "}
                              {sp.uom || "महिना"} ({sp.trips ?? sp.no_of_trips ?? 1} ट्रिप)
                            </option>
                          ))}
                        <option value="__add_new__">
                          + नयाँ योजना दर्ता गर्ने (Add New Plan in Master)...
                        </option>
                      </select>
                    </div>
                  )}

                  {/* Inline New Plan Creator */}
                  {isCreatingPlan && (
                    <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary flex items-center gap-1">
                          <Layers className="size-3.5" /> Plan Master मा नयाँ योजना दर्ता
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsCreatingPlan(false)}
                          className="text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          रद्द
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-foreground">
                            योजनाको नाम (Plan Name) *
                          </label>
                          <input
                            className="mt-1 w-full rounded border bg-background px-2.5 py-1.5 text-xs text-foreground"
                            placeholder="उदा: पसल / ग्यारेज / वर्कशप"
                            value={newPlanForm.name}
                            onChange={(e) =>
                              setNewPlanForm({ ...newPlanForm, name: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-foreground">
                            मापन इकाई (UOM) *
                          </label>
                          <select
                            className="mt-1 w-full rounded border bg-background px-2.5 py-1.5 text-xs text-foreground"
                            value={newPlanForm.uom}
                            onChange={(e) =>
                              setNewPlanForm({ ...newPlanForm, uom: e.target.value })
                            }
                          >
                            <option value="महिना (Month)">महिना (Month)</option>
                            <option value="ट्रिप (Trip)">ट्रिप (Trip)</option>
                            <option value="घर/युनिट (House/Unit)">घर/युनिट (House/Unit)</option>
                            <option value="कोठा/फ्ल्याट (Room/Flat)">
                              कोठा/फ्ल्याट (Room/Flat)
                            </option>
                            <option value="के.जी./टन (Kg/Ton)">के.जी./टन (Kg/Ton)</option>
                            <option value="संख्या (Pcs)">संख्या (Pcs)</option>
                            <option value="वार्षिक (Annual)">वार्षिक (Annual)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-foreground">
                            ट्रिप संख्या (Trips) *
                          </label>
                          <input
                            type="number"
                            min={1}
                            className="mt-1 w-full rounded border bg-background px-2.5 py-1.5 text-xs text-foreground font-mono"
                            value={newPlanForm.trips ?? 1}
                            onChange={(e) => {
                              const t = Math.max(1, Number(e.target.value) || 1);
                              setNewPlanForm({ ...newPlanForm, trips: t, no_of_trips: t });
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground">
                            प्रति इकाई दर / रकम *
                          </label>
                          <input
                            type="number"
                            min={0}
                            className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs text-foreground"
                            placeholder="700"
                            value={newPlanForm.amount || ""}
                            onChange={(e) => {
                              const amt = Number(e.target.value) || 0;
                              setNewPlanForm({
                                ...newPlanForm,
                                amount: amt,
                                rate: amt,
                                chargeable_amount: Math.max(0, amt - (newPlanForm.incentive || 0)),
                              });
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground">
                            छूट (Incentive)
                          </label>
                          <input
                            type="number"
                            min={0}
                            className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs text-foreground"
                            placeholder="0"
                            value={newPlanForm.incentive || ""}
                            onChange={(e) => {
                              const inc = Number(e.target.value) || 0;
                              setNewPlanForm({
                                ...newPlanForm,
                                incentive: inc,
                                chargeable_amount: Math.max(0, (newPlanForm.amount || 0) - inc),
                              });
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-primary">
                            लागू शुल्क (Net)
                          </label>
                          <div className="mt-0.5 rounded border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                            रु.{" "}
                            {Math.max(0, (newPlanForm.amount || 0) - (newPlanForm.incentive || 0))}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs font-semibold gap-1"
                          disabled={
                            savingPlan || !newPlanForm.name.trim() || newPlanForm.amount <= 0
                          }
                          onClick={handleQuickSavePlan}
                        >
                          {savingPlan
                            ? "सुरक्षित हुँदैछ..."
                            : "Plan Master मा थप्नुहोस् र ग्राहकमा जोड्नुहोस्"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Total Rate & Joining Date */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t">
                    <div className="rounded-md border border-primary/30 bg-primary/10 p-2.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-primary">
                        ग्राहकको कुल मासिक शुल्क (Total Monthly Fee)
                      </span>
                      <div className="text-base font-extrabold text-foreground">
                        रु.{" "}
                        {(form.plans || [])
                          .reduce((acc, sp) => acc + sp.chargeable_amount * (sp.quantity || 1), 0)
                          .toLocaleString("en-IN")}{" "}
                        / महिना
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        रसिद काट्दा यही कुल दर स्वतः लागू हुनेछ।
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground">
                        दर्ता मिति (Joining Date) *
                      </label>
                      <div className="mt-1">
                        <BSDatePicker
                          value={form.joining_date || todayBS()}
                          onChange={(d) => setForm({ ...form, joining_date: d })}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        प्रणालीको नियमित मासिक गणना २०८३-०४-०१ वा सोपछिको मितिबाट सुरु हुन्छ।
                      </span>
                    </div>
                  </div>
                </div>

                {/* ══════ Row 4.5: OPENING DUES + AUTO DUE BOX ══════ */}
                {/* Opening Dues — for pre-2083-04-01 customers */}
                <div className="rounded-xl border-2 border-amber-400/30 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-amber-600" />
                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          पुरानो/शुरुवाती बक्यौता (Opening Balance Dues)
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          प्रणाली सुरु मिति (२०८३-०४-०१) भन्दा अघिको बाँकी शुल्क यहाँ दर्ता
                          गर्नुहोस्।
                        </span>
                      </div>
                    </div>
                    {(form.opening_dues ?? []).length > 0 && (
                      <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                        {(form.opening_dues ?? []).length} महिना ▸ रु.{" "}
                        {(form.opening_dues ?? [])
                          .reduce((s, d) => s + d.amount, 0)
                          .toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>

                  {/* Existing opening dues list */}
                  {(form.opening_dues ?? []).length > 0 && (
                    <div className="space-y-1.5">
                      {(form.opening_dues ?? []).map((od, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-md border border-amber-300/40 bg-card px-3 py-1.5 text-xs"
                        >
                          <span className="font-semibold text-foreground">
                            आ.व. {fiscalLabel(od.fy)} — {MONTHS[od.month]}
                          </span>
                          <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                            रु. {od.amount.toLocaleString("en-IN")}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                opening_dues: (prev.opening_dues ?? []).filter((_, i) => i !== idx),
                              }))
                            }
                            className="ml-2 text-muted-foreground hover:text-destructive"
                            title="हटाउनुहोस्"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add opening due row */}
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[90px]">
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">
                        आर्थिक वर्ष (FY)
                      </label>
                      <select
                        aria-label="Opening due fiscal year"
                        className="w-full rounded border bg-background px-2 py-1.5 text-xs text-foreground"
                        value={openingDueFY}
                        onChange={(e) => setOpeningDueFY(Number(e.target.value))}
                      >
                        {FISCAL_YEARS.filter((y) => y <= 2082).map((y) => (
                          <option key={y} value={y}>
                            {fiscalLabel(y)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[90px]">
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">
                        महिना (Month)
                      </label>
                      <select
                        aria-label="Opening due month"
                        className="w-full rounded border bg-background px-2 py-1.5 text-xs text-foreground"
                        value={openingDueMonth}
                        onChange={(e) => setOpeningDueMonth(Number(e.target.value))}
                      >
                        {[3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2].map((m) => (
                          <option key={m} value={m}>
                            {MONTHS[m]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[80px]">
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">
                        रकम (Amount रु.)
                      </label>
                      <input
                        type="number"
                        min={0}
                        aria-label="Opening due amount"
                        className="w-full rounded border bg-background px-2 py-1.5 text-xs text-foreground"
                        placeholder="500"
                        value={openingDueAmount}
                        onChange={(e) => setOpeningDueAmount(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const amt = Number(openingDueAmount);
                        if (!amt || amt <= 0) return;
                        const already = (form.opening_dues ?? []).some(
                          (d) => d.fy === openingDueFY && d.month === openingDueMonth,
                        );
                        if (already) return;
                        setForm((prev) => ({
                          ...prev,
                          opening_dues: [
                            ...(prev.opening_dues ?? []),
                            { fy: openingDueFY, month: openingDueMonth, amount: amt },
                          ],
                        }));
                        setOpeningDueAmount("");
                      }}
                      className="rounded-md bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold shrink-0"
                    >
                      + थप्नुहोस्
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    💡 प्रणाली सुरु (२०८३ साउन १) भन्दा अघिको प्रत्येक बाँकी महिनाको शुल्क
                    छुट्टाछुट्टै थप्नुहोस्।
                  </p>
                </div>

                {/* ══════ Auto-calculated dues (only for 2083-04-01 onwards) ══════ */}
                <div className="rounded-xl border-2 border-primary/25 bg-primary/5 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/10 pb-2.5">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-primary" />
                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          स्वतः गणना बक्यौता (Auto-calculated Dues)
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          दर्ता मिति ({np(form.joining_date || todayBS())}) देखिको बाँकी बक्यौता
                        </span>
                      </div>
                    </div>
                    <div>
                      {formDueMonths.length > 0 ? (
                        <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                          कुल बाँकी: रु. {formTotalDueAmount.toLocaleString("en-IN")} (
                          {formDueMonths.length} महिना)
                        </span>
                      ) : (
                        <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <Check className="size-3.5" /> कुनै बाँकी छैन (All Paid)
                        </span>
                      )}
                    </div>
                  </div>

                  {formDueMonths.length === 0 ? (
                    <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                      <Check className="size-4 shrink-0 text-emerald-600" />
                      <div>
                        <p className="font-semibold">सबै महिना चुक्ता भइसकेको छ!</p>
                        <p className="text-[11px] opacity-80">
                          दर्ता मिति ({np(form.joining_date || todayBS())}) देखि हालसम्म कुनै पनि
                          महिनाको शुल्क बाँकी छैन।
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {Array.from(formDueByFY.entries()).map(([fy, months]) => {
                        const fyDueAmount = months.reduce(
                          (s, dm) => s + (dm.amount ?? formMonthlyFee),
                          0,
                        );
                        return (
                          <div key={fy} className="rounded-lg border bg-card p-3 text-xs shadow-xs">
                            <div className="flex flex-wrap items-center justify-between gap-1 border-b pb-1.5 mb-2">
                              <span className="text-xs font-bold text-primary">
                                आर्थिक वर्ष: {fiscalLabel(fy)}
                              </span>
                              <span className="font-mono text-xs font-extrabold text-ink bg-muted/70 px-2 py-0.5 rounded">
                                बाँकी रकम: रु. {fyDueAmount.toLocaleString("en-IN")}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                                बाँकी महिना ({months.length}):
                              </span>
                              {months.map((dm) => (
                                <span
                                  key={`${dm.fy}-${dm.month}`}
                                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                                    dm.isOverdue
                                      ? "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30"
                                      : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                                  }`}
                                >
                                  {MONTHS[dm.month]}
                                  {dm.amount !== undefined
                                    ? ` (रु. ${dm.amount.toLocaleString("en-IN")})`
                                    : ""}
                                  {dm.isOverdue ? " (Overdue)" : " (चालु)"}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1.5 border-t border-primary/10">
                    <span>
                      💡 रसिद काट्दा (New Receipt मा भुक्तानी गर्दा) यो बक्यौता विवरण स्वतः अपडेट
                      हुनेछ।
                    </span>
                    {formOverdueCount > 0 && (
                      <span className="text-red-600 dark:text-red-400 font-semibold">
                        ⚠ {formOverdueCount} महिना Overdue बाँकी
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 5: Tole and Phone */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      टोल (Tole) *
                    </label>
                    <input
                      aria-label="Tole"
                      className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground"
                      placeholder="उदा: वीरेन्द्र चोक"
                      value={form.tole}
                      maxLength={80}
                      onChange={(e) => setForm({ ...form, tole: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      सम्पर्क नं. (Phone Number)
                    </label>
                    <input
                      aria-label="Phone"
                      className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground"
                      placeholder="९८xxxxxxxx (१० अंक)"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })
                      }
                    />
                  </div>
                </div>

                {/* Row 6: PAN and Email */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      प्यान नं. (PAN Number){" "}
                      <span className="font-normal text-muted-foreground">
                        (वैकल्पिक / Optional)
                      </span>
                    </label>
                    <input
                      aria-label="PAN Number"
                      className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono text-foreground"
                      placeholder="उदा: 601234567"
                      maxLength={20}
                      value={form.pan ?? ""}
                      onChange={(e) => setForm({ ...form, pan: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      इमेल ठेगाना (Email Address){" "}
                      <span className="font-normal text-muted-foreground">
                        (वैकल्पिक / Optional)
                      </span>
                    </label>
                    <input
                      aria-label="Email"
                      type="email"
                      className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground"
                      placeholder="उदा: user@example.com"
                      maxLength={120}
                      value={form.email ?? ""}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 7: Full Address */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    विस्तृत ठेगाना (Full Address){" "}
                    <span className="font-normal text-muted-foreground">(वैकल्पिक / Optional)</span>
                  </label>
                  <input
                    aria-label="Full Address"
                    className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground"
                    placeholder="उदा: खोर्के लाइन, घर नं. १२"
                    maxLength={200}
                    value={form.full_address ?? ""}
                    onChange={(e) => setForm({ ...form, full_address: e.target.value })}
                  />
                </div>

                {/* Locality Photo Section */}
                <div className="rounded-lg border bg-accent/20 p-3">
                  <div className="mb-2">
                    <label className="block text-xs font-bold text-foreground">
                      🏘️ टोल/घरको फोटो (Locality Photo){" "}
                      <span className="font-normal text-muted-foreground">(वैकल्पिक)</span>
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      क्यामेराबाट फोटो क्लिक गर्नुहोस् वा ग्यालरी बाट छान्नुहोस्। ग्राहक नक्सा
                      हेराइमा देखाइनेछ।
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={openCamera}
                      disabled={photoBusy}
                    >
                      <Camera className="size-3.5" /> फोटो क्लिक गर्नुहोस्
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={photoBusy}
                    >
                      <ImagePlus className="size-3.5" /> ग्यालरीबाट छान्नुहोस्
                    </Button>
                    {form.locality_photo && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-destructive hover:text-destructive"
                        onClick={removePhoto}
                        disabled={photoBusy}
                      >
                        <Trash2 className="size-3.5" /> फोटो हटाउनुहोस्
                      </Button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      aria-label="Locality photo upload"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void handlePhotoFile(file);
                      }}
                    />
                  </div>
                  {photoBusy && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400" role="status">
                      फोटो अपलोड हुँदैछ…
                    </p>
                  )}
                  {photoErr && (
                    <p className="mt-2 text-xs text-destructive" role="alert">
                      {photoErr}
                    </p>
                  )}
                  {form.locality_photo && (
                    <div className="mt-2">
                      <img
                        src={formPhotoSrc}
                        alt="टोल/घरको फोटो"
                        className="max-h-44 w-full max-w-md rounded-lg border object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Live GPS & Map Section */}
                <div className="rounded-lg border bg-accent/20 p-3">
                  <div className="mb-2">
                    <label className="block text-xs font-bold text-foreground">
                      📍 GPS लोकेसन र अन्तरक्रियात्मक नक्सा (Live GPS & Auto-Fill Address)
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      नक्सामा क्लिक गर्दा वा "लाइभ GPS" लिँदा जिल्ला, नगरपालिका, वडा, टोल र ठेगाना
                      स्वतः भरिनेछ (पछि सच्याउन पनि मिल्छ)।
                    </p>
                  </div>
                  <LocationMap
                    latitude={form.latitude}
                    longitude={form.longitude}
                    accuracy={form.gps_accuracy}
                    customerName={form.name}
                    nature={form.nature}
                    addressInfo={
                      form.tole
                        ? `${form.district ? form.district + ", " : ""}${form.municipality ? form.municipality + ", " : ""}Ward ${form.ward}, ${form.tole}`
                        : ""
                    }
                    height="220px"
                    onChange={({ latitude, longitude, accuracy, address }) => {
                      setForm((prev) => {
                        const next = {
                          ...prev,
                          latitude,
                          longitude,
                          gps_accuracy: accuracy !== undefined ? accuracy : prev.gps_accuracy,
                        };
                        if (address) {
                          if (address.district) next.district = address.district;
                          if (address.municipality) next.municipality = address.municipality;
                          if (address.ward) next.ward = address.ward;
                          if (address.tole) next.tole = address.tole;
                          if (address.full_address) next.full_address = address.full_address;
                        }
                        return next;
                      });
                    }}
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-3.5 bg-muted/30">
                <div className="min-w-0 flex-1">
                  {err && <p className="text-xs font-semibold text-destructive truncate">{err}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpenModal(false)}
                    disabled={busy}
                  >
                    रद्द (Cancel)
                  </Button>
                  <Button type="submit" disabled={busy}>
                    {busy ? "सेभ हुँदैछ…" : "सेभ गर्नुहोस् (Save Customer)"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Locality Photo Camera Overlay */}
      {camOpen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/90 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="टोल/घरको फोटो क्लिक गर्नुहोस्"
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="min-h-0 w-full flex-1 rounded-xl bg-black object-contain"
          />
          <div className="mt-3 flex items-center justify-center gap-3">
            <Button onClick={captureCamera} size="sm" className="gap-1.5">
              <Camera className="size-4" />
              क्लिक गर्नुहोस्
            </Button>
            <Button variant="outline" size="sm" onClick={stopCamera}>
              बन्द गर्नुहोस्
            </Button>
          </div>
          {camErr && (
            <p className="mt-2 text-center text-xs text-destructive" role="alert">
              {camErr}
            </p>
          )}
        </div>
      )}

      {/* Map Preview Modal */}
      {viewingMapPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">{viewingMapPerson.name}</h3>
                {viewingMapPerson.locality_photo && (
                  <img
                    src={viewerPhotoSrc}
                    alt={`${viewingMapPerson.name} को टोल/घरको फोटो`}
                    loading="lazy"
                    className="mt-2 max-h-40 w-full max-w-xs rounded-lg border object-cover"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  कार्ड: <span className="font-semibold text-primary">{viewingMapPerson.card}</span>{" "}
                  • {viewingMapPerson.municipality ? `${viewingMapPerson.municipality}, ` : ""}वडा{" "}
                  {viewingMapPerson.ward}, {viewingMapPerson.tole}
                  {viewingMapPerson.full_address && ` • ${viewingMapPerson.full_address}`}
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {viewingMapPerson.plan && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
                      योजना: {viewingMapPerson.plan}
                    </span>
                  )}
                  {viewingMapPerson.joining_date && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground font-mono">
                      दर्ता: {np(viewingMapPerson.joining_date)}
                    </span>
                  )}
                  {viewingMapPerson.pan && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-foreground font-mono font-semibold">
                      PAN: {viewingMapPerson.pan}
                    </span>
                  )}
                  {viewingMapPerson.email && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground font-mono">
                      इमेल: {viewingMapPerson.email}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingMapPerson(null)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <LocationMap
              readOnly
              latitude={viewingMapPerson.latitude}
              longitude={viewingMapPerson.longitude}
              accuracy={viewingMapPerson.gps_accuracy}
              customerName={viewingMapPerson.name}
              nature={viewingMapPerson.nature}
              addressInfo={`${viewingMapPerson.district ? viewingMapPerson.district + ", " : ""}${viewingMapPerson.municipality ? viewingMapPerson.municipality + ", " : ""}वडा ${viewingMapPerson.ward}, ${viewingMapPerson.tole} ${viewingMapPerson.full_address ? "• " + viewingMapPerson.full_address : ""}`}
              height="300px"
            />

            <div className="mt-4 flex items-center justify-between border-t pt-3">
              {viewingMapPerson.latitude && viewingMapPerson.longitude && (
                <a
                  href={`https://www.google.com/maps?q=${viewingMapPerson.latitude},${viewingMapPerson.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  Google Maps मा दिशा हेर्नुहोस् (Get Directions)
                </a>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingMapPerson(null)}
              >
                बन्द गर्नुहोस् (Close)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Digital Card Modal */}
      {viewingCardPerson && (
        <DigitalCard
          person={viewingCardPerson}
          receipts={query.data?.receipts ?? []}
          onClose={() => setViewingCardPerson(null)}
        />
      )}
    </WorkspacePage>
  );
}
