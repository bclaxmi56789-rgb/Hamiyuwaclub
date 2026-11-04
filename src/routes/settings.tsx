import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Bot,
  Upload,
  CheckCircle2,
  XCircle,
  Save,
  Eye,
  EyeOff,
  Sparkles,
  FileCheck,
  ExternalLink,
  RefreshCw,
  Lock,
  ShieldCheck,
  Key,
  AlertTriangle,
  UserCheck,
  ShieldAlert,
  Check,
} from "lucide-react";
import {
  useAppConfig,
  getStoredConfig,
  saveStoredConfig,
  getAIVault,
  saveAIVault,
  maskApiKey,
  testAIConnection,
  fileToBase64,
  fetchAvailableGeminiModels,
  fetchAvailableOpenRouterModels,
  OPENROUTER_FREE_VISION_MODELS,
  DEFAULT_CONFIG,
  type AppConfig,
  type AIVaultData,
} from "@/lib/app-config";
import {
  getAppConfiguration,
  saveAppConfiguration,
  getEmployeesData,
  getEmployeePermissions,
  saveEmployeePermissionBatch,
  getEmployeeCredentialsList,
  saveEmployeeCredentials,
  deleteEmployeeCredentials,
  saveAdminPin,
} from "@/lib/workspace.functions";
import {
  APP_NAV_PAGES,
  type AccessLevel,
  type EmployeePermission,
  type EmployeeCredentials,
} from "@/lib/permissions";
import type { Employee } from "@/lib/receipt-rules";
import { BSDatePicker } from "@/components/bs-date-picker";
import { fiscalYear, fiscalYearRange, fiscalLabel, todayBS } from "@/lib/receipt-rules";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const globalConfig = useAppConfig();
  const getAppConfigFn = useServerFn(getAppConfiguration);
  const saveAppConfigFn = useServerFn(saveAppConfiguration);
  const getEmployeesFn = useServerFn(getEmployeesData);
  const getPermissionsFn = useServerFn(getEmployeePermissions);
  const savePermissionsFn = useServerFn(saveEmployeePermissionBatch);
  const getCredentialsFn = useServerFn(getEmployeeCredentialsList);
  const saveCredentialsFn = useServerFn(saveEmployeeCredentials);
  const deleteCredentialsFn = useServerFn(deleteEmployeeCredentials);
  const saveAdminPinFn = useServerFn(saveAdminPin);

  const [form, setForm] = useState<AppConfig>(() => ensureFiscalYearDefaults({ ...globalConfig }));
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [fetchingGeminiModels, setFetchingGeminiModels] = useState(false);
  const [discoveredGeminiModels, setDiscoveredGeminiModels] = useState<string[]>([]);
  const [fetchingOpenRouterModels, setFetchingOpenRouterModels] = useState(false);
  const [discoveredOpenRouterModels, setDiscoveredOpenRouterModels] = useState<string[]>([]);
  const [aiTestResult, setAiTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [vault, setVault] = useState<AIVaultData>(() => getAIVault());
  const [vaultSavedMessage, setVaultSavedMessage] = useState<string | null>(null);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);

  // ─── ADMIN PIN VAULT STATE ───
  const [adminPinInput, setAdminPinInput] = useState(() => globalConfig.admin_pin || "");
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [savingAdminPin, setSavingAdminPin] = useState(false);
  const [adminPinSuccess, setAdminPinSuccess] = useState<string | null>(null);
  const [adminPinError, setAdminPinError] = useState("");

  // ─── PERMISSION & VAULT STATE ───
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [allPermissions, setAllPermissions] = useState<EmployeePermission[]>([]);
  const [empPermMap, setEmpPermMap] = useState<Record<string, AccessLevel>>({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permSuccessMessage, setPermSuccessMessage] = useState<string | null>(null);
  const [accessLoadError, setAccessLoadError] = useState<string>("");
  const [credLoadError, setCredLoadError] = useState<string>("");
  const [accessSaveError, setAccessSaveError] = useState<string>("");

  // ─── EMPLOYEE ID & PASSWORD VAULT STATE ───
  const [credentialsList, setCredentialsList] = useState<EmployeeCredentials[]>([]);
  const [empLoginId, setEmpLoginId] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [empPin, setEmpPin] = useState("");
  const [empNotes, setEmpNotes] = useState("");
  const [showEmpPassword, setShowEmpPassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credSuccessMessage, setCredSuccessMessage] = useState<string | null>(null);
  const [credError, setCredError] = useState<string>("");

  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadServerConfig();
    loadEmployeesAndPermissions();
  }, []);

  async function loadEmployeesAndPermissions() {
    setLoadingEmployees(true);
    try {
      const empList = await getEmployeesFn().catch(() => [] as Employee[]);
      setEmployees(empList || []);
      if (empList && empList.length > 0 && !selectedEmpId) {
        setSelectedEmpId(empList[0]?.id ?? "");
      }
      // Permission + credential load errors are surfaced, never silently reset
      // to empty — otherwise saved access looks like it wasn't saved at all.
      const [permResult, credResult] = await Promise.allSettled([
        getPermissionsFn(),
        getCredentialsFn(),
      ]);
      if (permResult.status === "fulfilled") {
        setAllPermissions((permResult.value as unknown as EmployeePermission[]) || []);
      } else {
        setAccessLoadError(
          String((permResult.reason as Error)?.message || permResult.reason || "अज्ञात त्रुटि"),
        );
      }
      if (credResult.status === "fulfilled") {
        setCredentialsList((credResult.value as unknown as EmployeeCredentials[]) || []);
      } else {
        setCredLoadError(
          String((credResult.reason as Error)?.message || credResult.reason || "अज्ञात त्रुटि"),
        );
      }
    } finally {
      setLoadingEmployees(false);
    }
  }

  // Update empPermMap and Credentials inputs when selected employee changes
  useEffect(() => {
    if (!selectedEmpId) return;
    const currentEmpPerms = allPermissions.filter((p) => p.employee_id === selectedEmpId);
    const map: Record<string, AccessLevel> = {};
    for (const page of APP_NAV_PAGES) {
      const match = currentEmpPerms.find((p) => p.page_path === page.path);
      map[page.path] = match ? match.access_level : "full_access";
    }
    setEmpPermMap(map);

    // Sync vault credentials fields for this employee
    const matchedCred = credentialsList.find((c) => c.employee_id === selectedEmpId);
    if (matchedCred) {
      setEmpLoginId(matchedCred.login_id);
      setEmpPassword(matchedCred.login_password);
      setEmpPin(matchedCred.login_pin || "");
      setEmpNotes(matchedCred.notes || "");
    } else {
      // Default suggested login ID
      const emp = employees.find((e) => e.id === selectedEmpId);
      const suggestedId = emp ? emp.name.toLowerCase().replace(/\s+/g, "_") : "";
      setEmpLoginId(suggestedId);
      setEmpPassword("");
      setEmpPin("");
      setEmpNotes("");
    }
  }, [selectedEmpId, allPermissions, credentialsList, employees]);

  async function handleSaveCredentials() {
    if (!selectedEmpId) return;
    if (!empLoginId.trim()) {
      alert("लगइन आईडी भर्नुहोस्।");
      return;
    }
    if (!empPassword.trim()) {
      alert("पासवर्ड भर्नुहोस्।");
      return;
    }
    if (!/^\d{4}$/.test(empPin.trim())) {
      alert("PIN चार अंकको हुनुपर्छ (उदा. 1234)। सङ्केत: यो PIN ले कर्मचारीको पहुँच खोल्छ।");
      return;
    }
    const emp = employees.find((e) => e.id === selectedEmpId);
    setSavingCredentials(true);
    setCredSuccessMessage(null);
    setCredError("");
    try {
      const payload = {
        employee_id: selectedEmpId,
        employee_name: emp?.name || "",
        login_id: empLoginId.trim(),
        login_password: empPassword.trim(),
        login_pin: empPin.trim(),
        is_active: true,
        notes: empNotes.trim(),
      };
      const result = await saveCredentialsFn({ data: payload });
      if (result && result.success === false) {
        setCredError(
          `सुरक्षित गर्न सकिएन (database)। ${result.error || ""} — संकेत: supabase/apply-employee-credentials.sql र supabase/apply-employee-login-pin.sql चलाउनुपर्ने हुनसक्छ।`,
        );
        return;
      }
      // Reload straight from the server so the UI only ever shows what the
      // database actually contains — no optimistic guesses, no local copies.
      const fresh = await getCredentialsFn();
      setCredentialsList((fresh as unknown as EmployeeCredentials[]) || []);
      setCredSuccessMessage(
        `${emp?.name || "कर्मचारी"}को ID, पासवर्ड र PIN भण्डार (Vault) मा सुरक्षित भयो र पुष्टि गरियो ✓`,
      );
      setTimeout(() => setCredSuccessMessage(null), 4000);
    } catch (err) {
      setCredError(
        `सुरक्षित गर्न सकिएन: ${(err as Error)?.message || "अज्ञात त्रुटि"} — संकेत: supabase/apply-employee-credentials.sql चलाउनुहोस्।`,
      );
    } finally {
      setSavingCredentials(false);
    }
  }

  async function handleSaveAdminPin() {
    if (!/^\d{4}$/.test(adminPinInput.trim())) {
      setAdminPinError("Admin PIN चार अंकको हुनुपर्छ (४ वटा नम्बर)।");
      return;
    }
    setSavingAdminPin(true);
    setAdminPinError("");
    setAdminPinSuccess(null);
    try {
      const res = await saveAdminPinFn({ data: { admin_pin: adminPinInput.trim() } });
      if (res && res.ok === false) {
        setAdminPinError(`सुरक्षित गर्न सकिएन: ${res.error || "अज्ञात त्रुटि"}`);
        return;
      }
      setAdminPinSuccess("Admin PIN सफलतापूर्वक भण्डार (Vault) मा सुरक्षित भयो ✓");
      setTimeout(() => setAdminPinSuccess(null), 4000);
    } catch (err: any) {
      setAdminPinError(`त्रुटि: ${err?.message || "सुरक्षित गर्न सकिएन"}`);
    } finally {
      setSavingAdminPin(false);
    }
  }

  function handlePermissionChange(path: string, level: AccessLevel) {
    setEmpPermMap((prev) => ({
      ...prev,
      [path]: level,
    }));
  }

  function handleSetAllPermissions(level: AccessLevel) {
    const nextMap: Record<string, AccessLevel> = {};
    for (const page of APP_NAV_PAGES) {
      nextMap[page.path] = level;
    }
    setEmpPermMap(nextMap);
  }

  async function handleSavePermissions() {
    if (!selectedEmpId) return;
    const emp = employees.find((e) => e.id === selectedEmpId);
    setSavingPermissions(true);
    setPermSuccessMessage(null);
    try {
      const payload = {
        employee_id: selectedEmpId,
        employee_name: emp?.name || "",
        permissions: Object.entries(empPermMap).map(([page_path, access_level]) => ({
          page_path,
          access_level,
        })),
      };
      const result = await savePermissionsFn({ data: payload });
      if (result && result.success === false) {
        setAccessSaveError(
          `अनुमति सुरक्षित गर्न सकिएन (database)। ${result.error || ""} — संकेत: supabase/apply-employee-permissions.sql चलाउनुहोस्।`,
        );
        return;
      }
      // Reload straight from the server to confirm what was actually saved.
      const freshPerms = await getPermissionsFn();
      setAllPermissions((freshPerms as unknown as EmployeePermission[]) || []);

      setPermSuccessMessage(
        `${emp?.name || "कर्मचारी"}को पेज अनुमति सुरक्षित भयो र पुष्टि गरियो ✓`,
      );
      setTimeout(() => setPermSuccessMessage(null), 4000);
    } catch (e: any) {
      setAccessSaveError(
        `अनुमति सुरक्षित गर्दा त्रुटि भयो: ${e?.message || "अज्ञात त्रुटि"} — संकेत: supabase/apply-employee-permissions.sql चलाउनुहोस्।`,
      );
    } finally {
      setSavingPermissions(false);
    }
  }

  function handleSaveVaultKey(provider: "openrouter" | "gemini" | "openai") {
    const updates: Partial<AIVaultData> = {};
    if (provider === "openrouter") {
      updates.openrouter_api_key = form.openrouter_api_key;
      updates.openrouter_model = form.openrouter_model;
    } else if (provider === "gemini") {
      updates.gemini_api_key = form.gemini_api_key;
      updates.gemini_model = form.gemini_model;
    } else if (provider === "openai") {
      updates.openai_api_key = form.openai_api_key;
      updates.openai_model = form.openai_model;
    }
    const updatedVault = saveAIVault(updates);
    setVault(updatedVault);
    saveStoredConfig(form);
    void saveAppConfigFn({
      data: {
        ...form,
        ...updates,
      },
    }).catch(() => {});
    setVaultSavedMessage(
      `${provider === "openrouter" ? "OpenRouter" : provider === "gemini" ? "Google Gemini" : "OpenAI"} API Key भण्डारमा सुरक्षित गरियो!`,
    );
    setTimeout(() => setVaultSavedMessage(null), 3500);
  }

  async function handleSaveAllVaultKeys() {
    setSaving(true);
    setSavedSuccess(false);
    try {
      const allUpdates: Partial<AIVaultData> = {
        openrouter_api_key: form.openrouter_api_key,
        openrouter_model: form.openrouter_model,
        gemini_api_key: form.gemini_api_key,
        gemini_model: form.gemini_model,
        openai_api_key: form.openai_api_key,
        openai_model: form.openai_model,
      };
      const updatedVault = saveAIVault(allUpdates);
      setVault(updatedVault);
      saveStoredConfig(form);
      await saveAppConfigFn({ data: { ...form, ...allUpdates } });
      setVaultSavedMessage("सबै AI Keys र मोडलहरू भण्डारमा सुरक्षित गरियो ✓");
      setTimeout(() => setVaultSavedMessage(null), 4000);
    } catch (err) {
      alert("AI Vault सेभ गर्न सकिएन: " + ((err as Error)?.message || "अज्ञात त्रुटि"));
    } finally {
      setSaving(false);
    }
  }

  async function handleFetchGeminiModels() {
    if (!form.gemini_api_key.trim()) {
      alert("पहिले Gemini API Key प्रविष्ट गर्नुहोस्।");
      return;
    }
    setFetchingGeminiModels(true);
    try {
      const models = await fetchAvailableGeminiModels(form.gemini_api_key);
      if (models.length > 0) {
        setDiscoveredGeminiModels(models);
        if (models.includes("gemini-3.8-flash")) {
          setForm((p) => ({ ...p, gemini_model: "gemini-3.8-flash" }));
        } else if (models[0]) {
          setForm((p) => ({ ...p, gemini_model: models[0] }));
        }
      } else {
        alert("कुनै नयाँ मोडल फेला परेन। कृपया API Key सही छ भनी जाँच गर्नुहोस्।");
      }
    } finally {
      setFetchingGeminiModels(false);
    }
  }

  async function handleFetchOpenRouterModels() {
    setFetchingOpenRouterModels(true);
    try {
      const models = await fetchAvailableOpenRouterModels();
      if (models.length > 0) {
        setDiscoveredOpenRouterModels(models);
        if (models.includes("google/gemma-4-31b-it:free")) {
          setForm((p) => ({ ...p, openrouter_model: "google/gemma-4-31b-it:free" }));
        } else if (models[0]) {
          setForm((p) => ({ ...p, openrouter_model: models[0] }));
        }
      } else {
        alert("कुनै मोडल फेला परेन। कृपया इन्टरनेट जडान जाँच गर्नुहोस्।");
      }
    } finally {
      setFetchingOpenRouterModels(false);
    }
  }

  async function loadServerConfig() {
    try {
      const serverConfig = await getAppConfigFn();
      if (serverConfig) {
        const merged = saveStoredConfig(serverConfig as Partial<AppConfig>);
        setForm(ensureFiscalYearDefaults(merged));
      }
    } catch {
      // Local fallback already in form
    }
  }

  // Default the FY box to the current BS fiscal year (Shrawan 1 → Asar end) when unset.
  function ensureFiscalYearDefaults(cfg: AppConfig): AppConfig {
    if (cfg.fiscal_year_start && cfg.fiscal_year_end) return cfg;
    const range = fiscalYearRange(fiscalYear(todayBS()) ?? 2082);
    if (!range) return cfg;
    return {
      ...cfg,
      fiscal_year_start: cfg.fiscal_year_start || range.start,
      fiscal_year_end: cfg.fiscal_year_end || range.end,
    };
  }

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      const mime = file.type || "image/png";
      const dataUrl = `data:${mime};base64,${base64}`;
      setForm((prev) => ({ ...prev, logo_url: dataUrl }));
    } catch (err: unknown) {
      alert("लोगो लोड गर्न असफल: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function handleSaveSection(fields: Partial<AppConfig>) {
    if (fields.fiscal_year_start !== undefined) {
      const fyErr = validateFiscalYearForm();
      if (fyErr) {
        alert(fyErr);
        return;
      }
    }
    setSaving(true);
    setSavedSuccess(false);
    try {
      // 1. Save locally for instant UI reactivity
      saveStoredConfig(fields);

      // 2. Persist to server/DB — failures must be visible, never silently discarded
      await saveAppConfigFn({ data: fields });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err: unknown) {
      alert(
        "कन्फिगरेसन सुरक्षित गर्न सकिएन: " + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setSaving(false);
    }
  }

  // Financial year (BS): सुरू मिति र समाप्ति मिति एउटै आर्थिक वर्षमा हुनुपर्छ।
  function validateFiscalYearForm(): string {
    const start = (form.fiscal_year_start ?? "").trim();
    const end = (form.fiscal_year_end ?? "").trim();
    if (!start) return "आर्थिक वर्ष सुरू मिति भर्नुहोस् (जस्तै २०८२/०४/०१)।";
    if (fiscalYear(start) === null) return "आर्थिक वर्ष सुरू मिति सम्पूर्ण BS मिति भर्नुहोस्।";
    if (!end) return "आर्थिक वर्ष समाप्ति मिति भर्नुहोस्।";
    if (fiscalYear(end) !== fiscalYear(start))
      return "सुरू तथा समाप्ति मिति एउटै आर्थिक वर्ष (श्रावण १ – असार मसान्त) भित्र हुनुपर्छ।";
    if (end < start) return "आर्थिक वर्ष समाप्ति मिति सुरू मिति पछि हुनुपर्छ।";
    return "";
  }

  const PROFILE_FIELDS: Partial<AppConfig> = {
    entity_name: form.entity_name,
    entity_sub_name: form.entity_sub_name,
    tagline: form.tagline,
    address: form.address,
    pan_vat: form.pan_vat,
    phone: form.phone,
    email: form.email,
    logo_url: form.logo_url,
    fiscal_year_start: form.fiscal_year_start ?? "",
    fiscal_year_end: form.fiscal_year_end ?? "",
  };

  const AI_FIELDS: Partial<AppConfig> = {
    ai_provider: form.ai_provider,
    gemini_api_key: form.gemini_api_key,
    gemini_model: form.gemini_model,
    openrouter_api_key: form.openrouter_api_key,
    openrouter_model: form.openrouter_model,
    openai_api_key: form.openai_api_key,
    openai_model: form.openai_model,
    custom_ai_endpoint: form.custom_ai_endpoint,
    custom_ai_key: form.custom_ai_key,
    custom_ai_model: form.custom_ai_model,
  };

  async function handleSaveProfile() {
    const fyErr = validateFiscalYearForm();
    if (fyErr) {
      alert(fyErr);
      return;
    }
    setSaving(true);
    setProfileSuccessMessage(null);
    try {
      saveStoredConfig(PROFILE_FIELDS);
      await saveAppConfigFn({ data: PROFILE_FIELDS });
      setProfileSuccessMessage("संस्था तथा लोगो प्रोफाइल सफलतापूर्वक सुरक्षित गरियो ✓");
      setTimeout(() => setProfileSuccessMessage(null), 4000);
    } catch (err: unknown) {
      alert("कन्फिगरेसन सुरक्षित गर्न सकिएन: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAI() {
    setSaving(true);
    setAiSuccessMessage(null);
    try {
      saveStoredConfig(AI_FIELDS);
      await saveAppConfigFn({ data: AI_FIELDS });
      setAiSuccessMessage("Agentic AI सेटिङ सफलतापूर्वक सुरक्षित गरियो ✓");
      setTimeout(() => setAiSuccessMessage(null), 4000);
    } catch (err: unknown) {
      alert("AI सेटिङ सुरक्षित गर्न सकिएन: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    const fyErr = validateFiscalYearForm();
    if (fyErr) {
      alert(fyErr);
      return;
    }
    setSaving(true);
    setSavedSuccess(false);
    try {
      saveStoredConfig({ ...form });
      await saveAppConfigFn({
        data: {
          entity_name: form.entity_name,
          entity_sub_name: form.entity_sub_name,
          tagline: form.tagline,
          address: form.address,
          pan_vat: form.pan_vat,
          phone: form.phone,
          email: form.email,
          logo_url: form.logo_url,
          fiscal_year_start: form.fiscal_year_start ?? "",
          fiscal_year_end: form.fiscal_year_end ?? "",
          ai_provider: form.ai_provider,
          gemini_api_key: form.gemini_api_key,
          gemini_model: form.gemini_model,
          openrouter_api_key: form.openrouter_api_key,
          openrouter_model: form.openrouter_model,
          openai_api_key: form.openai_api_key,
          openai_model: form.openai_model,
          custom_ai_endpoint: form.custom_ai_endpoint,
          custom_ai_key: form.custom_ai_key,
          custom_ai_model: form.custom_ai_model,
        },
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err: unknown) {
      alert(
        "कन्फिगरेसन सुरक्षित गर्न सकिएन: " + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleTestAI() {
    setTestingAI(true);
    setAiTestResult(null);
    try {
      const res = await testAIConnection(form);
      setAiTestResult(res);
      // Sync back any auto-adjusted working model
      const latest = getStoredConfig();
      if (
        latest.openrouter_model !== form.openrouter_model ||
        latest.gemini_model !== form.gemini_model
      ) {
        setForm((p) => ({
          ...p,
          openrouter_model: latest.openrouter_model,
          gemini_model: latest.gemini_model,
        }));
      }
    } catch (err: unknown) {
      setAiTestResult({
        success: false,
        message: err instanceof Error ? err.message || "परीक्षण असफल" : "परीक्षण असफल",
      });
    } finally {
      setTestingAI(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            संस्था तथा एजेन्टिक AI कन्फिगरेसन (Settings)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            संस्थाको प्रोफाइल, लोगो, तथा रसिद/बिल स्क्यानका लागि Gemini / OpenAI मोडल सेटिङ
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-green-700 dark:text-green-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            कन्फिगरेसन सफलतापूर्वक सुरक्षित गरियो! लोगो र संस्था विवरण सबै कागजातहरूमा अद्यावधिक
            भयो।
          </span>
        </div>
      )}

      {vaultSavedMessage && (
        <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-3.5 text-green-700 dark:text-green-300 text-sm flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          <span className="font-semibold">{vaultSavedMessage}</span>
        </div>
      )}

      <Tabs defaultValue="permissions" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-auto p-1.5 bg-muted/70 rounded-xl gap-1">
          <TabsTrigger value="permissions" className="gap-2 py-2.5 font-bold text-xs sm:text-sm">
            <UserCheck className="h-4 w-4 shrink-0" />
            <span>कर्मचारी अनुमति (Permissions)</span>
          </TabsTrigger>
          <TabsTrigger value="vault" className="gap-2 py-2.5 font-bold text-xs sm:text-sm">
            <Lock className="h-4 w-4 shrink-0" />
            <span>AI कुञ्जी भण्डार (AI Vault)</span>
          </TabsTrigger>
          <TabsTrigger value="entity" className="gap-2 py-2.5 font-bold text-xs sm:text-sm">
            <Building2 className="h-4 w-4 shrink-0" />
            <span>संस्था र लोगो (Entity)</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2 py-2.5 font-bold text-xs sm:text-sm">
            <Bot className="h-4 w-4 shrink-0" />
            <span>Agentic AI कन्फिग</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 0: EMPLOYEE PAGE PERMISSIONS ───────────────────────────── */}
        <TabsContent value="permissions" className="mt-6 space-y-6">
          {/* Admin Vault Box for Admin PIN */}
          <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/30">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    <span>मुख्य व्यवस्थापक PIN भण्डार (Admin PIN Vault)</span>
                    <Badge className="bg-amber-500 text-white text-[10px]">गोप्य / Secure</Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    लगइन गर्दा मुख्य व्यवस्थापक (Admin Full Access) को लागि प्रयोग हुने ४ अंकको गोप्य PIN।
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Admin PIN (४ अंक)
                </Label>
                <div className="relative">
                  <Input
                    type={showAdminPin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={4}
                    value={adminPinInput}
                    onChange={(e) =>
                      setAdminPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="••••"
                    disabled={savingAdminPin}
                    className="h-10 text-center font-mono tracking-[0.4em] text-base bg-card pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPin(!showAdminPin)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    aria-label={showAdminPin ? "PIN लुकाउनुहोस्" : "PIN देखाउनुहोस्"}
                  >
                    {showAdminPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Button
                  type="button"
                  onClick={handleSaveAdminPin}
                  disabled={savingAdminPin || adminPinInput.length !== 4}
                  className="w-full h-10 font-bold gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {savingAdminPin ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>Admin PIN सुरक्षित गर्नुहोस्</span>
                </Button>
              </div>
            </div>

            {adminPinError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{adminPinError}</span>
              </div>
            )}

            {adminPinSuccess && (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-300 text-xs font-medium flex items-start gap-2">
                <Check className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{adminPinSuccess}</span>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">
                    कर्मचारी अनुसार पेज पहुँच तथा अनुमति (Employee Page Access & Permissions)
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  कर्मचारी चयन गरी प्रत्येक पेजको लागि पूर्ण पहुँच (Full Access/Create/Edit), हेर्न
                  मात्र मिल्ने (Read-only), वा पहुँच निषेध (No Access) सेट गर्नुहोस्।
                </p>
              </div>
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/30 text-xs px-3 py-1 font-mono shrink-0"
              >
                🛡️ RBAC सक्रिय
              </Badge>
            </div>

            {permSuccessMessage && (
              <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-3.5 text-green-700 dark:text-green-300 text-sm flex items-center gap-2 shadow-xs">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                <span className="font-semibold">{permSuccessMessage}</span>
              </div>
            )}

            {accessLoadError && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  अनुमति लोड हुन सकेन — देखाइएको स्थिति saved data होइन। {accessLoadError}
                </span>
              </div>
            )}

            {credLoadError && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>लगइन/PIN भण्डार लोड हुन सकेन। {credLoadError}</span>
              </div>
            )}

            {accessSaveError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3.5 text-destructive text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{accessSaveError}</span>
              </div>
            )}

            {/* Employee Selector Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  १. अनुमति तोकिने कर्मचारी छान्नुहोस् (Select Employee):
                </Label>
                {loadingEmployees ? (
                  <p className="text-xs text-muted-foreground">कर्मचारी लोड हुँदैछ...</p>
                ) : employees.length === 0 ? (
                  <p className="text-xs text-rose-600 font-semibold">
                    हाल कुनै कर्मचारी फेला परेन। पहिले 'Members & Staff' पृष्ठमा कर्मचारी दर्ता
                    गर्नुहोस्।
                  </p>
                ) : (
                  <Select value={selectedEmpId} onValueChange={(val) => setSelectedEmpId(val)}>
                    <SelectTrigger className="w-full bg-card">
                      <SelectValue placeholder="कर्मचारी चयन गर्नुहोस्" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees
                        .filter((emp): emp is Employee & { id: string } => Boolean(emp.id))
                        .map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name} ({emp.designation})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Quick Batch Actions */}
              <div className="space-y-1.5 flex flex-col justify-end">
                <Label className="text-xs font-bold text-muted-foreground">
                  छिटो चयन (Quick Presets for this Employee):
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    onClick={() => handleSetAllPermissions("full_access")}
                  >
                    सबै पूर्ण पहुँच (All Edit)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold text-blue-700 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    onClick={() => handleSetAllPermissions("read_only")}
                  >
                    सबै पढ्न मात्र (All Read-only)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold text-rose-700 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    onClick={() => handleSetAllPermissions("no_access")}
                  >
                    सबै बन्द (All No Access)
                  </Button>
                </div>
              </div>
            </div>

            {/* ─── SECTION 2: Authentication & Credentials (same box) ─── */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-bold text-foreground">
                    २. लगइन तथा PIN (Authentication &amp; Credentials)
                  </h4>
                </div>
                {selectedEmpId &&
                  (credentialsList.some((c) => c.employee_id === selectedEmpId) ? (
                    <Badge className="bg-green-600 text-white text-[10px]">
                      ✓ भण्डारमा सुरक्षित (Saved)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      ✓ खाली (Not saved)
                    </Badge>
                  ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                यो खाताको इमेल + पासवर्ड लगइन भएपछि कर्मचारीले आफ्नो नाम छानेर यही ४ अंकको PIN
                प्रविष्ट गरेमात्र तोकिएको पहुँच खुल्छ। यो PIN बाहेक अन्य कुनै विधिले भित्र जान
                मिल्दैन। Admin (मुख्य खाता आफैं) लाई PIN छाड्न सकिन्छ — पूर्ण पहुँचका लागि।
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">लगइन आईडी (Login ID)</Label>
                  <Input
                    value={empLoginId}
                    onChange={(e) => setEmpLoginId(e.target.value)}
                    disabled={!selectedEmpId || savingCredentials}
                    placeholder="उदा. anusha_oli"
                    className="h-9 text-sm bg-card"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">पासवर्ड (Password)</Label>
                  <div className="relative">
                    <Input
                      type={showEmpPassword ? "text" : "password"}
                      value={empPassword}
                      onChange={(e) => setEmpPassword(e.target.value)}
                      disabled={!selectedEmpId || savingCredentials}
                      placeholder="••••••••"
                      className="h-9 pr-10 text-sm bg-card"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmpPassword(!showEmpPassword)}
                      className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                      aria-label={showEmpPassword ? "पासवर्ड लुकाउनुहोस्" : "पासवर्ड देखाउनुहोस्"}
                    >
                      {showEmpPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">
                    अनलक PIN (४ अंक) <span className="text-primary">— पहुँच खोल्ने कोड</span>
                  </Label>
                  <Input
                    inputMode="numeric"
                    maxLength={4}
                    value={empPin}
                    onChange={(e) => setEmpPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    disabled={!selectedEmpId || savingCredentials}
                    placeholder="उदा. 1234"
                    className="h-9 text-sm tracking-[0.4em] font-mono text-center bg-card"
                  />
                </div>
              </div>

              {credError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{credError}</span>
                </div>
              )}

              {credSuccessMessage && (
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-300 text-xs font-medium flex items-start gap-2">
                  <Check className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{credSuccessMessage} — सर्भरबाट पुन: पढेर पुष्टि गरिएको।</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-3">
                <div className="text-xs text-muted-foreground">
                  {credentialsList.length > 0
                    ? `${credentialsList.length} जना कर्मचारीको लगइन/PIN भण्डार (database) मा सुरक्षित छ।`
                    : "अझै कुनै कर्मचारीको PIN सेट गरिएको छैन।"}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {credentialsList.some((c) => c.employee_id === selectedEmpId) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                      disabled={!selectedEmpId || savingCredentials}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            "यो कर्मचारीको लगइन/PIN मेट्ने? मेटिएपछि कर्मचारी भित्र जान सक्दैन।",
                          )
                        )
                          return;
                        setCredError("");
                        setCredSuccessMessage(null);
                        try {
                          const res = await deleteCredentialsFn({
                            data: { employee_id: selectedEmpId },
                          });
                          if (res && res.success === false) {
                            setCredError(`मेट्न सकिएन: ${res.error || ""}`);
                            return;
                          }
                          const fresh = await getCredentialsFn();
                          setCredentialsList((fresh as unknown as EmployeeCredentials[]) || []);
                          setEmpLoginId("");
                          setEmpPassword("");
                          setEmpPin("");
                          setEmpNotes("");
                        } catch (err) {
                          setCredError(
                            `मेट्न सकिएन: ${(err as Error)?.message || "अज्ञात त्रुटि"}`,
                          );
                        }
                      }}
                    >
                      मेट्नुहोस्
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleSaveCredentials}
                    disabled={savingCredentials || !selectedEmpId}
                    className="gap-2 bg-primary font-bold text-primary-foreground shadow-sm"
                  >
                    <Save className="h-4 w-4" />
                    {savingCredentials ? "सुरक्षित हुँदैछ..." : "लगइन र PIN सुरक्षित गर्नुहोस्"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Permission Table / Matrix */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground">
                  ३. पेज अनुमति (Access Matrix) — PIN खोलिएपछि के देख्न/गर्न पाउँछ?
                </h4>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/60 text-muted-foreground font-bold">
                    <tr>
                      <th className="px-3.5 py-3 w-12 text-center">क्र.सं.</th>
                      <th className="px-3.5 py-3">पेजको नाम र कार्य</th>
                      <th className="px-3.5 py-3 w-40">श्रेणी (Category)</th>
                      <th className="px-3.5 py-3 text-center w-80">अनुमति स्तर (Access Level)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {APP_NAV_PAGES.map((page, idx) => {
                      const currentLevel = empPermMap[page.path] || "full_access";
                      return (
                        <tr key={page.path} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3.5 py-2.5 text-center font-mono text-muted-foreground font-semibold">
                            {idx + 1}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                              <span>{page.nepaliLabel}</span>
                              <span className="text-muted-foreground text-xs font-mono font-normal">
                                ({page.label})
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {page.description} •{" "}
                              <span className="font-mono text-primary/80">{page.path}</span>
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <Badge variant="outline" className="text-[10px] font-semibold">
                              {page.category}
                            </Badge>
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            <div className="inline-flex rounded-lg border p-1 bg-background shadow-xs gap-1">
                              <button
                                type="button"
                                onClick={() => handlePermissionChange(page.path, "full_access")}
                                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1 ${
                                  currentLevel === "full_access"
                                    ? "bg-emerald-600 text-white shadow-xs font-bold"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                }`}
                              >
                                {currentLevel === "full_access" && <Check className="size-3" />}
                                पूर्ण पहुँच (Edit)
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePermissionChange(page.path, "read_only")}
                                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1 ${
                                  currentLevel === "read_only"
                                    ? "bg-blue-600 text-white shadow-xs font-bold"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                }`}
                              >
                                {currentLevel === "read_only" && <Check className="size-3" />}
                                हेर्न मात्र (Read)
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePermissionChange(page.path, "no_access")}
                                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1 ${
                                  currentLevel === "no_access"
                                    ? "bg-rose-600 text-white shadow-xs font-bold"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                }`}
                              >
                                {currentLevel === "no_access" && <Check className="size-3" />}
                                निषेध (None)
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Save Action */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4">
                <div className="text-xs text-muted-foreground">
                  कर्मचारीले लगइन गर्दा तोकिएका पृष्ठहरू मात्र खुल्नेछन् वा हेर्न मात्र मिल्नेछ।
                </div>
                <Button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={savingPermissions || !selectedEmpId}
                  className="gap-2 bg-primary font-bold text-primary-foreground shrink-0 shadow-sm"
                >
                  <Save className="h-4 w-4" />
                  {savingPermissions ? "सुरक्षित हुँदैछ..." : "कर्मचारी अनुमति सुरक्षित गर्नुहोस्"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── TAB 0: SEPARATE AI VAULT ───────────────────────────────────── */}
        <TabsContent value="vault" className="mt-6 space-y-6">
          {/* Vault Overview Card */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">
                    समर्पित AI कुञ्जी भण्डार (Dedicated AI Key & Model Vault)
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  यहाँ तपाईंका OpenRouter, Google Gemini, र OpenAI का गोप्य API Keys छुट्टै सुरक्षित
                  भण्डारमा सधैंका लागि बस्छन्।
                </p>
              </div>
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/30 text-xs px-3 py-1 font-mono shrink-0"
              >
                🔐 भण्डार सक्रिय
              </Badge>
            </div>

            {/* Diagnostic Alert: Why error happened */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs space-y-1.5 text-foreground">
              <div className="font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>पहिले किन "कुनै पनि बचत गरिएको AI API बाट बिल स्क्यान हुन सकेन" भन्यो?</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                पहिले ब्राउजरको लोकल स्टोरेज खाली हुँदा कुञ्जीहरू स्वतः हट्ने समस्या थियो। अब नयाँ{" "}
                <b>समर्पित AI Vault</b> प्रणाली लागु गरिएको छ। तल हेर्नुहोस्—तपाईंको कुञ्जी सुरक्षित
                छ कि छैन स्पष्ट देखिन्छ र कुनै पनि बेला नष्ट हुँदैन।
              </p>
            </div>

            {/* Priority Fallback Chain Display */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <div className="text-xs font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>स्वचालित प्रदायक प्राथमिकता क्रम (Automatic Fallback Chain):</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card shadow-2xs">
                  <span className="size-2 rounded-full bg-purple-500" />
                  <span>
                    १. OpenRouter (
                    {form.openrouter_model?.split("/").pop() || "gemma-4-31b-it:free"})
                  </span>
                  {form.openrouter_api_key ? (
                    <span className="text-green-600 text-[10px]">✓ सक्रिय</span>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">खाली</span>
                  )}
                </div>
                <span className="text-muted-foreground font-mono">➔</span>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card shadow-2xs">
                  <span className="size-2 rounded-full bg-blue-500" />
                  <span>२. Google Gemini ({form.gemini_model || "gemini-3.8-flash"})</span>
                  {form.gemini_api_key ? (
                    <span className="text-green-600 text-[10px]">✓ सक्रिय</span>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">खाली</span>
                  )}
                </div>
                <span className="text-muted-foreground font-mono">➔</span>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card shadow-2xs">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>३. OpenAI ({form.openai_model || "gpt-4o-mini"})</span>
                  {form.openai_api_key ? (
                    <span className="text-green-600 text-[10px]">✓ सक्रिय</span>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">खाली</span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                *यदि कुनै एउटा API को कोटा सकिएमा वा दर सीमा (rate-limit) लागेमा अर्को बचत गरिएको
                API मा तुरुन्तै स्वतः सर्नेछ।
              </p>
            </div>
          </div>

          {/* 1. OpenRouter Vault Box */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-purple-600/10 text-purple-600 font-black text-xs flex items-center justify-center">
                  OR
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">OpenRouter AI Vault</h4>
                  <p className="text-[11px] text-muted-foreground">
                    निःशुल्क भिजुअल OCR तथा भाषा मोडलहरू
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={`text-xs px-2.5 py-0.5 font-semibold ${
                  form.openrouter_api_key
                    ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {form.openrouter_api_key ? "✓ भण्डारमा सुरक्षित (Saved)" : "कुञ्जी खाली"}
              </Badge>
            </div>

            <div className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  भण्डार गरिएको कुञ्जी (Vault Stored Key)
                </Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showOpenRouterKey ? "text" : "password"}
                      value={form.openrouter_api_key}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, openrouter_api_key: e.target.value }))
                      }
                      placeholder="sk-or-v1-..."
                      className="font-mono text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showOpenRouterKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSaveVaultKey("openrouter")}
                    disabled={saving}
                    className="gap-1.5 shrink-0 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>भण्डारमा सेभ</span>
                  </Button>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  हालको कुञ्जी: {maskApiKey(form.openrouter_api_key)}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">सक्रिय मोडल (Active Model)</Label>
                  <Select
                    value={form.openrouter_model}
                    onValueChange={(val) => setForm((p) => ({ ...p, openrouter_model: val }))}
                  >
                    <SelectTrigger className="text-xs font-mono">
                      <SelectValue placeholder="मोडल छान्नुहोस्" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google/gemma-4-31b-it:free">
                        google/gemma-4-31b-it:free (सिफारिस गरिएको / द्रुत)
                      </SelectItem>
                      <SelectItem value="google/gemma-4-26b-a4b-it:free">
                        google/gemma-4-26b-a4b-it:free (भिजुअल OCR)
                      </SelectItem>
                      <SelectItem value="dots-studio/dots-3-note-preview:free">
                        dots-studio/dots-3-note-preview:free
                      </SelectItem>
                      {discoveredOpenRouterModels
                        .filter(
                          (m) =>
                            ![
                              "google/gemma-4-31b-it:free",
                              "google/gemma-4-26b-a4b-it:free",
                              "dots-studio/dots-3-note-preview:free",
                            ].includes(m),
                        )
                        .map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFetchOpenRouterModels}
                    disabled={fetchingOpenRouterModels}
                    className="text-xs gap-1.5 w-full"
                  >
                    {fetchingOpenRouterModels ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    <span>नयाँ मोडलहरू खोज्नुहोस्</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Google Gemini Vault Box */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-blue-600/10 text-blue-600 font-black text-xs flex items-center justify-center">
                  G
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">Google Gemini AI Vault</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Google AI Studio आधिकारिक निःशुल्क कोटा
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={`text-xs px-2.5 py-0.5 font-semibold ${
                  form.gemini_api_key
                    ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {form.gemini_api_key ? "✓ भण्डारमा सुरक्षित (Saved)" : "कुञ्जी खाली"}
              </Badge>
            </div>

            <div className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Gemini API Key</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showGeminiKey ? "text" : "password"}
                      value={form.gemini_api_key}
                      onChange={(e) => setForm((p) => ({ ...p, gemini_api_key: e.target.value }))}
                      placeholder="AIzaSy..."
                      className="font-mono text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSaveVaultKey("gemini")}
                    disabled={saving}
                    className="gap-1.5 shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>भण्डारमा सेभ</span>
                  </Button>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  हालको कुञ्जी: {maskApiKey(form.gemini_api_key)}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Gemini मोडल (Active Model)</Label>
                  <Select
                    value={form.gemini_model}
                    onValueChange={(val) => setForm((p) => ({ ...p, gemini_model: val }))}
                  >
                    <SelectTrigger className="text-xs font-mono">
                      <SelectValue placeholder="मोडल छान्नुहोस्" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-3.8-flash">
                        gemini-3.8-flash (नयाँ / सिफारिस गरिएको)
                      </SelectItem>
                      <SelectItem value="gemini-1.5-flash">gemini-1.5-flash</SelectItem>
                      <SelectItem value="gemini-2.5-flash">gemini-2.5-flash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* 3. OpenAI Vault Box */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-emerald-600/10 text-emerald-600 font-black text-xs flex items-center justify-center">
                  OA
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">OpenAI Vault</h4>
                  <p className="text-[11px] text-muted-foreground">
                    ChatGPT / GPT-4o OCR तथा ब्याकअप मोडल
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={`text-xs px-2.5 py-0.5 font-semibold ${
                  form.openai_api_key
                    ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {form.openai_api_key ? "✓ भण्डारमा सुरक्षित (Saved)" : "कुञ्जी खाली"}
              </Badge>
            </div>

            <div className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">OpenAI API Key</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showOpenAIKey ? "text" : "password"}
                      value={form.openai_api_key}
                      onChange={(e) => setForm((p) => ({ ...p, openai_api_key: e.target.value }))}
                      placeholder="sk-proj-..."
                      className="font-mono text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSaveVaultKey("openai")}
                    disabled={saving}
                    className="gap-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>भण्डारमा सेभ</span>
                  </Button>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  हालको कुञ्जी: {maskApiKey(form.openai_api_key)}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">OpenAI मोडल (Active Model)</Label>
                  <Select
                    value={form.openai_model || "gpt-4o-mini"}
                    onValueChange={(val) => setForm((p) => ({ ...p, openai_model: val }))}
                  >
                    <SelectTrigger className="text-xs font-mono">
                      <SelectValue placeholder="मोडल छान्नुहोस्" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">
                        gpt-4o-mini (तीव्र, किफायती, भिजन OCR)
                      </SelectItem>
                      <SelectItem value="gpt-4o">gpt-4o (पूर्ण फ्ल्यागशिप)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Test AI Connection Bar */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="font-bold text-sm text-foreground flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span>AI जडान र भण्डार प्रमाणीकरण (Test Connection)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                कुञ्जीले काम गरिरहेको छ वा छैन तुरुन्तै परीक्षण गर्नुहोस्।
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleTestAI}
              disabled={testingAI}
              className="gap-2 font-bold shrink-0 border-primary/40 hover:bg-primary/10"
            >
              {testingAI ? (
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Sparkles className="h-4 w-4 text-amber-500" />
              )}
              <span>AI जडान परीक्षण गर्नुहोस्</span>
            </Button>
          </div>

          {aiTestResult && (
            <div
              className={`rounded-xl border p-4 text-xs font-medium flex items-start gap-2.5 ${
                aiTestResult.success
                  ? "bg-green-500/10 border-green-500/30 text-green-800 dark:text-green-300"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              {aiTestResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold">
                  {aiTestResult.success ? "जडान सफल भयो!" : "जडान असफल"}
                </div>
                <div>{aiTestResult.message}</div>
              </div>
            </div>
          )}

          {/* ─── Vault Tab Save Button ─── */}
          {vaultSavedMessage && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-3.5 text-green-700 dark:text-green-300 text-sm flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              <span className="font-semibold">{vaultSavedMessage}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              यहाँ प्रविष्ट गरिएका सबै API Keys सुरक्षित भण्डार (AI Vault) मा सधैंका लागि सेभ गर्न
              यो बटन थिच्नुहोस्।
            </p>
            <Button
              type="button"
              onClick={() => void handleSaveAllVaultKeys()}
              disabled={saving}
              className="gap-2 font-bold shrink-0 bg-primary"
            >
              <Save className="h-4 w-4" />
              {saving ? "सुरक्षित हुँदैछ..." : "AI Vault सेभ गर्नुहोस्"}
            </Button>
          </div>
        </TabsContent>

        {/* ─── TAB 1: ENTITY & LOGO ────────────────────────────────────────── */}
        <TabsContent value="entity" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Logo Preview and Upload */}
            <div className="flex flex-col items-center justify-center p-6 rounded-xl border bg-card text-center space-y-4">
              <Label className="text-base font-semibold">आधिकारिक लोगो (Official Logo)</Label>
              <div className="relative size-32 rounded-xl border-2 border-dashed border-primary/40 bg-muted/30 flex items-center justify-center overflow-hidden p-2 group shadow-inner">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="size-full object-contain" />
                ) : (
                  <Building2 className="size-12 text-muted-foreground" />
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoSelect}
              />
              <div className="flex flex-col gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  className="gap-2 w-full"
                >
                  <Upload className="h-4 w-4" />
                  लोगो परिवर्तन गर्नुहोस्
                </Button>
                {form.logo_url && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setForm((p) => ({ ...p, logo_url: "" }))}
                    className="text-muted-foreground text-xs"
                  >
                    लोगो हटाउनुस्
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                यो लोगो रसिद, पे-स्लिप, कार्यक्रम पत्र, र खर्च भौचरमा स्वतः छापिन्छ।
              </p>
            </div>

            {/* Entity Information Form */}
            <div className="md:col-span-2 space-y-4 rounded-xl border p-6 bg-card">
              <h3 className="text-base font-semibold border-b pb-2">संस्थाको सामान्य विवरण</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-1.5 md:col-span-2">
                  <Label>संस्थाको आधिकारिक नाम (नेपालीमा) *</Label>
                  <Input
                    value={form.entity_name}
                    onChange={(e) => setForm((p) => ({ ...p, entity_name: e.target.value }))}
                    placeholder="उदा. हामी युवा क्लब"
                  />
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                  <Label>संस्थाको नाम (अंग्रेजीमा / Subtitle)</Label>
                  <Input
                    value={form.entity_sub_name}
                    onChange={(e) => setForm((p) => ({ ...p, entity_sub_name: e.target.value }))}
                    placeholder="उदा. HAMI YUWA CLUB"
                  />
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                  <Label>उद्देश्य / नारा (Tagline)</Label>
                  <Input
                    value={form.tagline}
                    onChange={(e) => setForm((p) => ({ ...p, tagline: e.target.value }))}
                    placeholder="उदा. फोहोरमैला व्यवस्थापन तथा सामाजिक सेवा"
                  />
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                  <Label>ठेगाना (Address) *</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    placeholder="उदा. वीरेन्द्रनगर, सुर्खेत, कर्णाली प्रदेश"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>प्यान / भ्याट नं. (PAN / VAT)</Label>
                  <Input
                    value={form.pan_vat}
                    onChange={(e) => setForm((p) => ({ ...p, pan_vat: e.target.value }))}
                    placeholder="PAN / VAT Number"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>सम्पर्क फोन / मोबाइल (Phone)</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="उदा. ९८XXXXXXXX"
                  />
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                  <Label>आधिकारिक ईमेल (Email)</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="उदा. contact@hamiyuwaclub.org"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Financial Year (BS) box */}
          <div className="rounded-xl border p-5 bg-card space-y-3">
            <div>
              <h3 className="text-base font-semibold border-b pb-2">
                आर्थिक वर्ष (Financial Year in BS)
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5">
                नेपाली आर्थिक वर्ष साउन/श्रावण १ देखि असार मसान्तसम्म चल्छ। यही दायरा भरेपछि सबै
                रसिद, थेली र खर्चका मिति यही आर्थिक वर्ष भित्र मात्र स्वीकार्ने रूल लागू हुन्छ। रसिद
                नम्बर वडा र आर्थिक वर्ष अनुसार फरक-फरक गनिने क्रममा चल्छ (W1-2082-000001…)।
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>आर्थिक वर्ष सुरू मिति (Start — Shrawan 1)</Label>
                <BSDatePicker
                  value={form.fiscal_year_start ?? ""}
                  onChange={(d) => {
                    const fyNum = fiscalYear(d);
                    const range = fyNum ? fiscalYearRange(fyNum) : null;
                    setForm((p) => ({
                      ...p,
                      fiscal_year_start: d,
                      fiscal_year_end: range ? range.end : (p.fiscal_year_end ?? ""),
                    }));
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>आर्थिक वर्ष समाप्ति मिति (End — Asar मसान्त)</Label>
                <BSDatePicker
                  value={form.fiscal_year_end ?? ""}
                  onChange={(d) => setForm((p) => ({ ...p, fiscal_year_end: d }))}
                />
              </div>
            </div>
            {(() => {
              const start = (form.fiscal_year_start ?? "").trim();
              const fyNum = start ? fiscalYear(start) : null;
              return fyNum !== null ? (
                <div className="rounded-lg bg-primary/10 border border-primary/30 px-3 py-2 text-sm font-bold text-primary">
                  आर्थिक वर्ष चयनित: {fiscalLabel(fyNum)} ({fyNum} साउन १ – {fyNum + 1} असार मसान्त)
                </div>
              ) : (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  सुरू मिति खाली/अमान्य छ — पूर्ण BS मिति छान्नुहोस्।
                </div>
              );
            })()}
          </div>

          {/* Live Document Header Preview */}
          <div className="rounded-xl border p-5 bg-muted/20 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileCheck className="h-4 w-4 text-primary" />
              कागजात हेडर पूर्वावलोकन (Live Document Header Preview)
            </div>
            <div className="rounded-lg border bg-card p-6 shadow-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {form.logo_url && (
                  <img
                    src={form.logo_url}
                    alt="Logo"
                    className="size-16 object-contain rounded-md"
                  />
                )}
                <div>
                  <h2 className="text-xl font-extrabold text-foreground">
                    {form.entity_name || "संस्थाको नाम"}
                  </h2>
                  {form.entity_sub_name && (
                    <div className="text-xs font-semibold text-muted-foreground tracking-wide">
                      {form.entity_sub_name}
                    </div>
                  )}
                  <div className="text-xs text-foreground/80 mt-0.5">
                    {form.address || "ठेगाना"}
                  </div>
                  {form.tagline && (
                    <div className="text-[11px] text-muted-foreground italic mt-0.5">
                      {form.tagline}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground space-y-0.5 hidden sm:block font-mono">
                {form.pan_vat && <div>PAN: {form.pan_vat}</div>}
                {form.phone && <div>Tel: {form.phone}</div>}
                {form.email && <div>{form.email}</div>}
              </div>
            </div>
          </div>

          {profileSuccessMessage && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-3.5 text-green-700 dark:text-green-300 text-sm flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              <span className="font-semibold">{profileSuccessMessage}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              संस्थाको नाम, लोगो, सम्पर्क विवरण, तथा आर्थिक वर्षको मिति सेभ गर्न यो बटन थिच्नुहोस्।
            </p>
            <Button
              type="button"
              onClick={handleSaveProfile}
              disabled={saving}
              className="gap-2 font-bold shrink-0 bg-primary"
            >
              <Save className="h-4 w-4" />
              {saving ? "सुरक्षित हुँदैछ..." : "संस्था प्रोफाइल सेभ गर्नुहोस्"}
            </Button>
          </div>
        </TabsContent>

        {/* ─── TAB 2: AGENTIC AI & FREE MODEL CONFIG ────────────────────────── */}
        <TabsContent value="ai" className="mt-6 space-y-6">
          <div className="rounded-xl border p-6 bg-card space-y-5">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                एजेन्टिक AI र मोडल कन्फिगरेसन (AI OCR Scanner)
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                बिल स्क्यान (OCR), मिटिङ मिनेट, र ड्यासबोर्ड AI च्याटबोटमा OpenRouter, Gemini, वा
                OpenAI मध्ये बचत गरिएको कुनै पनि सक्रिय API स्वतः प्रयोग हुन्छ।
              </p>
            </div>

            {/* Provider Selection */}
            <div className="grid gap-2">
              <Label className="text-sm font-semibold">AI प्रदायक छान्नुहोस् (AI Provider)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  onClick={() => setForm((p) => ({ ...p, ai_provider: "gemini" }))}
                  className={`cursor-pointer rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                    form.ai_provider === "gemini"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 font-bold text-base">
                      G
                    </div>
                    <Badge className="bg-green-600 hover:bg-green-600 text-[10px] py-0">
                      निःशुल्क
                    </Badge>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Google Gemini</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Gemini 2.0 Flash (अत्यधिक तीव्र, आधिकारिक Google AI Studio निःशुल्क कोटा)
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setForm((p) => ({ ...p, ai_provider: "openrouter" }))}
                  className={`cursor-pointer rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                    form.ai_provider === "openrouter"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600 font-bold text-base">
                      OR
                    </div>
                    <Badge className="bg-purple-600 hover:bg-purple-600 text-[10px] py-0">
                      धेरै निःशुल्क मोडल
                    </Badge>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">OpenRouter</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Gemini 2.0, Qwen 2.5 VL, Llama 3.2 Vision का सबै निःशुल्क (:free) मोडलहरू
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setForm((p) => ({ ...p, ai_provider: "openai" }))}
                  className={`cursor-pointer rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                    form.ai_provider === "openai"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 font-bold text-base">
                      O
                    </div>
                    <Badge variant="secondary" className="text-[10px] py-0">
                      किफायती
                    </Badge>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">OpenAI</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      GPT-4o-mini (तीव्र र सस्तो, बहु-भाषा भिजन मोडल)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Gemini Settings */}
            {form.ai_provider === "gemini" && (
              <div className="rounded-xl border p-5 bg-muted/20 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="font-semibold text-sm">
                    Google Gemini सेटिङ (Latest Free Models)
                  </div>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    निःशुल्क Gemini Key लिनुहोस् <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="grid gap-1.5">
                  <Label>Gemini API Key *</Label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={form.gemini_api_key}
                      onChange={(e) => setForm((p) => ({ ...p, gemini_api_key: e.target.value }))}
                      placeholder="AIzaSy..."
                      className="pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Google AI Studio मा प्रति मिनेट १५ अनुरोधसम्म निःशुल्क प्रयोग गर्न सकिन्छ।
                  </p>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Gemini मोडल (Latest Free Models)</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={handleFetchGeminiModels}
                      disabled={fetchingGeminiModels || !form.gemini_api_key}
                      className="text-xs text-primary h-7 gap-1"
                      title="गुगलको API बाट हाल उपलब्ध सबै मोडलहरू सिधै लोड गर्नुहोस्"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${fetchingGeminiModels ? "animate-spin" : ""}`}
                      />
                      <span>
                        {fetchingGeminiModels ? "खोज्दैछ..." : "गुगलबाट मोडल सूची लोड गर्नुहोस्"}
                      </span>
                    </Button>
                  </div>

                  <Select
                    value={form.gemini_model || "gemini-3.8-flash"}
                    onValueChange={(v) => setForm((p) => ({ ...p, gemini_model: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-3.8-flash">
                        gemini-3.8-flash (पछिल्लो नयाँ मोडल - सिफारिस गरिएको)
                      </SelectItem>
                      <SelectItem value="gemini-2.5-flash">
                        gemini-2.5-flash (तीव्र र स्थिर)
                      </SelectItem>
                      <SelectItem value="gemini-2.0-flash">gemini-2.0-flash</SelectItem>
                      <SelectItem value="gemini-1.5-flash">
                        gemini-1.5-flash (उच्च क्षमता स्थिर निःशुल्क)
                      </SelectItem>
                      <SelectItem value="gemini-1.5-flash-8b">
                        gemini-1.5-flash-8b (छिटो, हलुका मोडल)
                      </SelectItem>
                      {discoveredGeminiModels
                        .filter(
                          (m) =>
                            ![
                              "gemini-3.8-flash",
                              "gemini-2.5-flash",
                              "gemini-2.0-flash",
                              "gemini-1.5-flash",
                              "gemini-1.5-flash-8b",
                            ].includes(m),
                        )
                        .map((m) => (
                          <SelectItem key={m} value={m}>
                            {m} (Google बाट पत्ता लागेको)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <div className="grid gap-1 pt-1">
                    <Label className="text-xs text-muted-foreground">
                      वा नयाँ मोडल नाम सिधै लेख्नुहोस् (Future-Proof Model ID):
                    </Label>
                    <Input
                      value={form.gemini_model}
                      onChange={(e) => setForm((p) => ({ ...p, gemini_model: e.target.value }))}
                      placeholder="उदा. gemini-3.8-flash"
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      भोलि Google ले कुनै पनि नयाँ मोडल (जस्तै gemini-4-flash) निकालेमा तपाईंले सिधै
                      नाम यहाँ लेखेर सेभ गर्न सक्नुहुन्छ, कोड परिवर्तन गर्नुपर्दैन।
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* OpenRouter Settings */}
            {form.ai_provider === "openrouter" && (
              <div className="rounded-xl border p-5 bg-muted/20 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="font-semibold text-sm">
                    OpenRouter सेटिङ (Latest Free Multimodal Models)
                  </div>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    OpenRouter Key लिनुहोस् <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="grid gap-1.5">
                  <Label>OpenRouter API Key *</Label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={form.openrouter_api_key}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, openrouter_api_key: e.target.value }))
                      }
                      placeholder="sk-or-v1-..."
                      className="pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    OpenRouter ले विभिन्न प्रदायकका पछिल्ला निःशुल्क (:free) मोडलहरू एकै ठाउँमा
                    उपलब्ध गराउँछ।
                  </p>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>OpenRouter निःशुल्क मोडल (Free Multimodal Models)</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={handleFetchOpenRouterModels}
                      disabled={fetchingOpenRouterModels}
                      className="text-xs text-primary h-7 gap-1"
                      title="OpenRouter बाट हाल उपलब्ध सबै निःशुल्क मोडलहरू सिधै लोड गर्नुहोस्"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${fetchingOpenRouterModels ? "animate-spin" : ""}`}
                      />
                      <span>
                        {fetchingOpenRouterModels
                          ? "खोज्दैछ..."
                          : "OpenRouter बाट निःशुल्क मोडलहरू लोड गर्नुहोस्"}
                      </span>
                    </Button>
                  </div>

                  <Select
                    value={form.openrouter_model || "qwen/qwen-2.5-vl-72b-instruct:free"}
                    onValueChange={(v) => setForm((p) => ({ ...p, openrouter_model: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qwen/qwen-2.5-vl-72b-instruct:free">
                        qwen/qwen-2.5-vl-72b-instruct:free (Qwen 2.5 Vision 72B - सिफारिस गरिएको
                        OCR)
                      </SelectItem>
                      <SelectItem value="meta-llama/llama-3.2-11b-vision-instruct:free">
                        meta-llama/llama-3.2-11b-vision-instruct:free (Llama 3.2 11B Vision -
                        निःशुल्क)
                      </SelectItem>
                      <SelectItem value="meta-llama/llama-3.2-90b-vision-instruct:free">
                        meta-llama/llama-3.2-90b-vision-instruct:free (Llama 3.2 90B Vision -
                        निःशुल्क)
                      </SelectItem>
                      <SelectItem value="google/gemini-flash-1.5:free">
                        google/gemini-flash-1.5:free (Gemini 1.5 Flash - निःशुल्क)
                      </SelectItem>
                      <SelectItem value="google/gemini-2.0-flash-exp:free">
                        google/gemini-2.0-flash-exp:free (Gemini 2.0 Flash)
                      </SelectItem>
                      <SelectItem value="google/gemini-2.0-flash-thinking-exp:free">
                        google/gemini-2.0-flash-thinking-exp:free (Gemini 2.0 Thinking)
                      </SelectItem>
                      <SelectItem value="mistralai/mistral-small-24b-instruct-2501:free">
                        mistralai/mistral-small-24b-instruct-2501:free (Mistral Small)
                      </SelectItem>
                      {discoveredOpenRouterModels
                        .filter(
                          (m) =>
                            ![
                              "qwen/qwen-2.5-vl-72b-instruct:free",
                              "meta-llama/llama-3.2-11b-vision-instruct:free",
                              "meta-llama/llama-3.2-90b-vision-instruct:free",
                              "google/gemini-flash-1.5:free",
                              "google/gemini-2.0-flash-exp:free",
                              "google/gemini-2.0-flash-thinking-exp:free",
                              "mistralai/mistral-small-24b-instruct-2501:free",
                            ].includes(m),
                        )
                        .map((m) => (
                          <SelectItem key={m} value={m}>
                            {m} (OpenRouter बाट पत्ता लागेको)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1 pt-1">
                  <Label className="text-xs text-muted-foreground">
                    वा अन्य OpenRouter मोडल आइडी सिधै लेख्नुहोस् (Future-Proof Model ID):
                  </Label>
                  <Input
                    value={form.openrouter_model}
                    onChange={(e) => setForm((p) => ({ ...p, openrouter_model: e.target.value }))}
                    placeholder="उदा. qwen/qwen-2.5-vl-72b-instruct:free"
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    भविष्यमा OpenRouter ले नयाँ निःशुल्क मोडल निकालेमा वा पुरानो हटेमा सिस्टमले आफैं
                    उपयुक्त मोडलमा Fallback गर्छ, वा तपाईंले सिधै नाम यहाँ लेख्न सक्नुहुन्छ।
                  </p>
                </div>
              </div>
            )}

            {/* OpenAI Settings */}
            {form.ai_provider === "openai" && (
              <div className="rounded-xl border p-5 bg-muted/20 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="font-semibold text-sm">OpenAI सेटिङ</div>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    OpenAI API Key लिनुहोस् <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="grid gap-1.5">
                  <Label>OpenAI API Key *</Label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={form.openai_api_key}
                      onChange={(e) => setForm((p) => ({ ...p, openai_api_key: e.target.value }))}
                      placeholder="sk-proj-..."
                      className="pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label>OpenAI मोडल (Model)</Label>
                  <Select
                    value={form.openai_model || "gpt-4o-mini"}
                    onValueChange={(v) => setForm((p) => ({ ...p, openai_model: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">
                        gpt-4o-mini (तीव्र, किफायती, भिजन OCR - सिफारिस गरिएको)
                      </SelectItem>
                      <SelectItem value="gpt-4o">gpt-4o (पूर्ण फ्ल्यागशिप मोडल)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Test Connection Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleTestAI}
                disabled={testingAI}
                className="gap-2"
              >
                <Bot className="h-4 w-4 text-primary" />
                {testingAI ? "परीक्षण हुँदैछ..." : "AI जडान परीक्षण (Test Connection)"}
              </Button>

              {aiTestResult && (
                <div
                  className={`text-sm px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
                    aiTestResult.success
                      ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300"
                      : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
                  }`}
                >
                  {aiTestResult.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{aiTestResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {aiSuccessMessage && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-3.5 text-green-700 dark:text-green-300 text-sm flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              <span className="font-semibold">{aiSuccessMessage}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              बिल स्क्यान (OCR) तथा एआई सहायकका लागि मोडल तथा प्रदायक सेटिङ सेभ गर्नुहोस्।
            </p>
            <Button
              type="button"
              onClick={handleSaveAI}
              disabled={saving}
              className="gap-2 font-bold shrink-0 bg-primary"
            >
              <Save className="h-4 w-4" />
              {saving ? "सुरक्षित हुँदैछ..." : "AI सेटिङ सेभ गर्नुहोस्"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}
