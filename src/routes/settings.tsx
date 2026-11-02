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
import { getAppConfiguration, saveAppConfiguration } from "@/lib/workspace.functions";
import { BSDatePicker } from "@/components/bs-date-picker";
import { fiscalYear, fiscalYearRange, fiscalLabel, todayBS } from "@/lib/receipt-rules";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const globalConfig = useAppConfig();
  const getAppConfigFn = useServerFn(getAppConfiguration);
  const saveAppConfigFn = useServerFn(saveAppConfiguration);

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
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadServerConfig();
  }, []);

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

  const handleSaveProfile = () => void handleSaveSection(PROFILE_FIELDS);
  const handleSaveAI = () => void handleSaveSection(AI_FIELDS);

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
        <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
          <Save className="h-4 w-4" />
          {saving ? "सुरक्षित हुँदैछ..." : "कन्फिगरेसन सेभ गर्नुहोस्"}
        </Button>
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

      <Tabs defaultValue="vault">
        <TabsList className="grid grid-cols-3 max-w-xl">
          <TabsTrigger value="vault" className="gap-2 font-bold">
            <Lock className="h-4 w-4 text-primary" />
            AI कुञ्जी भण्डार (AI Vault)
          </TabsTrigger>
          <TabsTrigger value="entity" className="gap-2">
            <Building2 className="h-4 w-4" />
            संस्था र लोगो (Entity)
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Bot className="h-4 w-4" />
            Agentic AI कन्फिग
          </TabsTrigger>
        </TabsList>

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
                {form.logo_url !== DEFAULT_CONFIG.logo_url && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setForm((p) => ({ ...p, logo_url: DEFAULT_CONFIG.logo_url }))}
                    className="text-muted-foreground text-xs"
                  >
                    डिफल्ट लोगोमा फर्काउनुस्
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

          <div className="flex justify-end border-t pt-4">
            <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
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

          <div className="flex justify-end border-t pt-4">
            <Button onClick={handleSaveAI} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "सुरक्षित हुँदैछ..." : "AI सेटिङ सेभ गर्नुहोस्"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer Save */}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "सुरक्षित हुँदैछ..." : "कन्फिगरेसन सेभ गर्नुहोस्"}
        </Button>
      </div>
    </div>
  );
}
