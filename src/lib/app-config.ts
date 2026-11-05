import { useState, useEffect } from "react";


export interface AppConfig {
  entity_name: string;
  entity_sub_name: string;
  tagline: string;
  address: string;
  pan_vat: string;
  phone: string;
  email: string;
  logo_url: string;

  // Financial year in BS (Shrawan 1 → Asar end); all entry dates must fall inside it.
  fiscal_year_start?: string;
  fiscal_year_end?: string;

  // AI Agentic Configuration
  ai_provider: "gemini" | "openrouter" | "openai" | "custom";
  gemini_api_key: string;
  gemini_model: string;
  openrouter_api_key: string;
  openrouter_model: string;
  openai_api_key: string;
  openai_model: string;
  custom_ai_endpoint: string;
  custom_ai_key: string;
  custom_ai_model: string;

  // Security Admin PIN (4 digits)
  admin_pin?: string;
}

export const USER_OPENROUTER_KEY = "";

const DEAD_OPENROUTER_MODELS = [
  "qwen/qwen-2.5-vl-72b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "meta-llama/llama-3.2-11b-vision-instruct:free",
  "meta-llama/llama-3.2-90b-vision-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-flash-1.5:free",
  "mistralai/mistral-small-24b-instruct-2501:free",
];

const RATE_LIMIT_HINT =
  "\nनोट: निःशुल्क (free) खातामा एक-छिन भागधार भ्याइनभ्याइ (rate limit) हुन सक्छ — केही सेकेन्द/मिनेटपछि फेरि प्रयास गर्नुहोस्, वा Settings मा तपाईंकै आफ्नै API Key राख्नुहोस्।";

export const OPENROUTER_FREE_VISION_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "dots-studio/dots-3-note-preview:free",
];

export const OPENROUTER_FREE_TEXT_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
  "xingchen-agi/xing4.0-29b-a4b:free",
];

export const DEFAULT_CONFIG: AppConfig = {
  entity_name: "",
  entity_sub_name: "",
  tagline: "",
  address: "",
  pan_vat: "",
  phone: "",
  email: "",
  logo_url: "",

  fiscal_year_start: "",
  fiscal_year_end: "",

  ai_provider: "openrouter",
  gemini_api_key: "",
  gemini_model: "",

  openrouter_api_key: USER_OPENROUTER_KEY,
  openrouter_model: "",

  openai_api_key: "",
  openai_model: "",

  custom_ai_endpoint: "",
  custom_ai_key: "",
  custom_ai_model: "",
  admin_pin: "",
};

const STORAGE_KEY = "hami_app_configuration";
const EVENT_NAME = "hami_app_config_changed";
export const AI_VAULT_STORAGE_KEY = "hami_ai_secure_vault_v1";

export interface AIVaultData {
  openrouter_api_key: string;
  openrouter_model: string;
  gemini_api_key: string;
  gemini_model: string;
  openai_api_key: string;
  openai_model: string;
  custom_ai_endpoint: string;
  custom_ai_key: string;
  custom_ai_model: string;
  saved_at: string;
}

export const DEFAULT_AI_VAULT: AIVaultData = {
  openrouter_api_key: USER_OPENROUTER_KEY,
  openrouter_model: "",
  gemini_api_key: "",
  gemini_model: "",
  openai_api_key: "",
  openai_model: "",
  custom_ai_endpoint: "",
  custom_ai_key: "",
  custom_ai_model: "",
  saved_at: new Date().toISOString(),
};

/** Get the persistent AI keys & models from the dedicated AI Vault */
export function getAIVault(): AIVaultData {
  if (typeof window === "undefined") return DEFAULT_AI_VAULT;
  try {
    const raw = localStorage.getItem(AI_VAULT_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(AI_VAULT_STORAGE_KEY, JSON.stringify(DEFAULT_AI_VAULT));
      return DEFAULT_AI_VAULT;
    }
    const parsed = JSON.parse(raw);
    const vault: AIVaultData = {
      openrouter_api_key: parsed.openrouter_api_key || USER_OPENROUTER_KEY,
      openrouter_model:
        !parsed.openrouter_model || DEAD_OPENROUTER_MODELS.includes(parsed.openrouter_model)
          ? DEFAULT_AI_VAULT.openrouter_model
          : parsed.openrouter_model,
      gemini_api_key: parsed.gemini_api_key || "",
      gemini_model:
        parsed.gemini_model === "gemini-2.0-flash" ? "" : parsed.gemini_model || "",
      openai_api_key: parsed.openai_api_key || "",
      openai_model: parsed.openai_model || "gpt-4o-mini",
      custom_ai_endpoint: parsed.custom_ai_endpoint || "",
      custom_ai_key: parsed.custom_ai_key || "",
      custom_ai_model: parsed.custom_ai_model || "",
      saved_at: parsed.saved_at || new Date().toISOString(),
    };
    return vault;
  } catch {
    return DEFAULT_AI_VAULT;
  }
}

/** Save updated keys and models to the dedicated AI Vault */
export function saveAIVault(partial: Partial<AIVaultData>): AIVaultData {
  const current = getAIVault();
  const updated: AIVaultData = {
    ...current,
    ...partial,
    saved_at: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(AI_VAULT_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    // Dispatch event with full configuration
    const fullConfig = getStoredConfig();
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: fullConfig }));
  }
  return updated;
}

/** Helper to mask sensitive keys in the UI */
export function maskApiKey(key: string): string {
  if (!key || !key.trim()) return "खाली छ (Not configured)";
  const trimmed = key.trim();
  if (trimmed.length <= 12) return "••••••••••••";
  return `${trimmed.substring(0, 10)}••••••••••••••••${trimmed.substring(trimmed.length - 4)}`;
}

export function getStoredConfig(): AppConfig {
  const vault = getAIVault();
  if (typeof window === "undefined") {
    return {
      ...DEFAULT_CONFIG,
      ...vault,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    let ai_provider = parsed.ai_provider || DEFAULT_CONFIG.ai_provider;
    if (ai_provider === "gemini" && !vault.gemini_api_key && vault.openrouter_api_key) {
      ai_provider = "openrouter";
    }

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      ai_provider,
      logo_url: parsed.logo_url || DEFAULT_CONFIG.logo_url,
      // Always integrate keys and active models directly from the AI Vault
      openrouter_api_key: vault.openrouter_api_key,
      openrouter_model: vault.openrouter_model,
      gemini_api_key: vault.gemini_api_key,
      gemini_model: vault.gemini_model,
      openai_api_key: vault.openai_api_key,
      openai_model: vault.openai_model,
      custom_ai_endpoint: vault.custom_ai_endpoint,
      custom_ai_key: vault.custom_ai_key,
      custom_ai_model: vault.custom_ai_model,
    };
  } catch {
    return {
      ...DEFAULT_CONFIG,
      ...vault,
    };
  }
}

export function saveStoredConfig(config: Partial<AppConfig>): AppConfig {
  // 1. Synchronize AI credentials into the dedicated AI Vault
  const aiUpdates: Partial<AIVaultData> = {};
  if (config.openrouter_api_key !== undefined)
    aiUpdates.openrouter_api_key = config.openrouter_api_key;
  if (config.openrouter_model !== undefined) aiUpdates.openrouter_model = config.openrouter_model;
  if (config.gemini_api_key !== undefined) aiUpdates.gemini_api_key = config.gemini_api_key;
  if (config.gemini_model !== undefined) aiUpdates.gemini_model = config.gemini_model;
  if (config.openai_api_key !== undefined) aiUpdates.openai_api_key = config.openai_api_key;
  if (config.openai_model !== undefined) aiUpdates.openai_model = config.openai_model;
  if (config.custom_ai_endpoint !== undefined)
    aiUpdates.custom_ai_endpoint = config.custom_ai_endpoint;
  if (config.custom_ai_key !== undefined) aiUpdates.custom_ai_key = config.custom_ai_key;
  if (config.custom_ai_model !== undefined) aiUpdates.custom_ai_model = config.custom_ai_model;

  if (Object.keys(aiUpdates).length > 0) {
    saveAIVault(aiUpdates);
  }

  // 2. Save general organization settings
  if (typeof window !== "undefined") {
    try {
      const current = getStoredConfig();
      const updated = { ...current, ...config };
      const nonSecret = { ...updated };
      delete (nonSecret as any).openrouter_api_key;
      delete (nonSecret as any).gemini_api_key;
      delete (nonSecret as any).openai_api_key;
      delete (nonSecret as any).custom_ai_key;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nonSecret));
    } catch {}
    const latest = getStoredConfig();
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: latest }));
    return latest;
  }
  return getStoredConfig();
}

export function useAppConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>(() => getStoredConfig());

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<AppConfig>;
      if (custom.detail) {
        setConfig(custom.detail);
      } else {
        setConfig(getStoredConfig());
      }
    };
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return config;
}

// ─────────────────────────────────────────────
// Agentic AI Utilities (Gemini, OpenRouter, OpenAI)
// ─────────────────────────────────────────────

export interface ScannedBillData {
  vendor_name?: string;
  pan_vat?: string;
  bill_number?: string;
  date_bs?: string;
  total_amount?: number;
  other_charges?: number;
  other_charges_desc?: string;
  discount?: number;
  discount_desc?: string;
  line_items?: Array<{
    item_code?: string;
    name: string;
    qty: number;
    uom: string;
    rate: number;
    amount: number;
  }>;
  raw_response?: string;
}

/** Converts a File/Blob to a base64 string */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64 || "");
    };
    reader.onerror = (error) => reject(error);
  });
}

/** Queries Google AI Studio API dynamically to list currently active models for the user's API key */
export async function fetchAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const key = apiKey.trim();
  if (!key) return [];
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await res.json();
    if (!res.ok || !Array.isArray(data.models)) return [];
    return data.models
      .filter(
        (m: unknown) =>
          typeof m === "object" &&
          m !== null &&
          "name" in m &&
          "supportedGenerationMethods" in m &&
          Array.isArray(
            (m as { supportedGenerationMethods: unknown }).supportedGenerationMethods,
          ) &&
          (m as { supportedGenerationMethods: string[] }).supportedGenerationMethods.includes(
            "generateContent",
          ),
      )
      .map((m: unknown) => (m as { name: string }).name.replace(/^models\//, ""))
      .sort((a: string, b: string) => (b.includes("flash") ? 1 : -1));
  } catch {
    return [];
  }
}

/** Queries OpenRouter public API to dynamically discover currently active free multimodal/vision models */
export async function fetchAvailableOpenRouterModels(): Promise<string[]> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (!res.ok) return OPENROUTER_FREE_VISION_MODELS;
    const json = await res.json();
    if (!Array.isArray(json?.data)) return OPENROUTER_FREE_VISION_MODELS;

    const freeVisionModels = json.data
      .filter((m: any) => {
        const id = (m?.id || "").toLowerCase();
        // Check if free
        const isFree =
          id.endsWith(":free") || (m?.pricing?.prompt === "0" && m?.pricing?.completion === "0");
        if (!isFree) return false;

        // Check if vision/multimodal capable
        const modality = (m?.architecture?.modality || "").toLowerCase();
        const desc = (m?.description || "").toLowerCase();
        const isVision =
          modality.includes("image") ||
          modality.includes("multimodal") ||
          id.includes("vl") ||
          id.includes("vision") ||
          id.includes("flash") ||
          desc.includes("vision") ||
          desc.includes("multimodal");

        return isVision;
      })
      .map((m: any) => m.id as string);

    // Prioritize high-accuracy OCR models like Qwen 2.5 VL and Llama 3.2 Vision
    const prioritized = Array.from(
      new Set([
        ...OPENROUTER_FREE_VISION_MODELS.filter((m) => freeVisionModels.includes(m)),
        ...freeVisionModels,
      ]),
    );

    return prioritized.length > 0 ? prioritized : OPENROUTER_FREE_VISION_MODELS;
  } catch {
    return OPENROUTER_FREE_VISION_MODELS;
  }
}

/** Test connectivity of the chosen AI API provider */
export async function testAIConnection(
  config: AppConfig,
): Promise<{ success: boolean; message: string }> {
  try {
    if (config.ai_provider === "gemini") {
      const apiKey = config.gemini_api_key.trim();
      if (!apiKey) return { success: false, message: "Gemini API Key खाली छ।" };
      const model = (config.gemini_model || "gemini-3.8-flash").replace(/^models\//, "");

      // Execute generateContent
      let url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      let res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Respond with OK." }] }],
        }),
      });
      let data = await res.json();

      // If model deprecated or not found, try smart fallback to gemini-1.5-flash
      if (
        !res.ok &&
        (res.status === 404 || data?.error?.message?.includes("no longer available"))
      ) {
        const fallback = "gemini-1.5-flash";
        url = `https://generativelanguage.googleapis.com/v1beta/models/${fallback}:generateContent?key=${apiKey}`;
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Respond with OK." }] }],
          }),
        });
        data = await res.json();
        if (res.ok) {
          saveStoredConfig({ gemini_model: fallback });
          return {
            success: true,
            message: `${model} उपलब्ध नभएकाले स्वचालित रूपमा ${fallback} मा जडान सफल भयो!`,
          };
        }
      }

      if (!res.ok) {
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      return { success: true, message: `Google Gemini (${model}) जडान सफल भयो!` };
    } else if (config.ai_provider === "openrouter") {
      const apiKey = config.openrouter_api_key.trim();
      if (!apiKey) return { success: false, message: "OpenRouter API Key खाली छ।" };

      const candidateModels = Array.from(
        new Set([config.openrouter_model, ...OPENROUTER_FREE_VISION_MODELS].filter(Boolean)),
      );

      let lastError = "";
      for (const model of candidateModels) {
        try {
          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "HTTP-Referer": "https://hamiyuwaclub.org",
              "X-Title": config.entity_name || "Sangstha AI",
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: "Respond with OK." }],
              max_tokens: 5,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            if (model !== config.openrouter_model) {
              saveStoredConfig({ openrouter_model: model });
            }
            return {
              success: true,
              message:
                model !== config.openrouter_model
                  ? `${config.openrouter_model || "पहिलो मोडल"} उपलब्ध नभएकाले स्वचालित रूपमा ${model} मा जडान सफल भयो!`
                  : `OpenRouter (${model}) जडान सफल भयो!`,
            };
          }
          lastError = data?.error?.message || `HTTP ${res.status}`;
          if (res.status === 401) {
            return { success: false, message: `OpenRouter API Key अमान्य छ: ${lastError}` };
          }
        } catch (e: any) {
          lastError = e?.message || "नेटवर्क त्रुटि";
        }
      }
      return { success: false, message: `OpenRouter जडान असफल: ${lastError}` };
    } else if (config.ai_provider === "openai") {
      const apiKey = config.openai_api_key.trim();
      if (!apiKey) return { success: false, message: "OpenAI API Key खाली छ।" };
      const model = config.openai_model || "gpt-4o-mini";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Respond with OK." }],
          max_tokens: 5,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      return { success: true, message: `OpenAI (${model}) जडान सफल भयो!` };
    } else {
      if (!config.custom_ai_endpoint) {
        return { success: false, message: "Custom AI Endpoint खाली छ।" };
      }
      return { success: true, message: "Custom AI Endpoint कन्फिगर गरिएको छ।" };
    }
  } catch (err: unknown) {
    return {
      success: false,
      message:
        err instanceof Error && err.message ? err.message : err?.toString?.() || "जडान असफल भयो।",
    };
  }
}

/** Resolves an ordered list of AI providers to try based on saved API keys */
export function getPrioritizedAIProviders(
  config: AppConfig,
): Array<"openrouter" | "gemini" | "openai"> {
  const vault = getAIVault();
  const openrouterKey = config.openrouter_api_key?.trim() || vault.openrouter_api_key?.trim();
  const geminiKey = config.gemini_api_key?.trim() || vault.gemini_api_key?.trim();
  const openaiKey = config.openai_api_key?.trim() || vault.openai_api_key?.trim();
  const preferred = config.ai_provider;
  const list: Array<"openrouter" | "gemini" | "openai"> = [];

  const hasKey = (p: "openrouter" | "gemini" | "openai") => {
    if (p === "openrouter") return Boolean(openrouterKey);
    if (p === "gemini") return Boolean(geminiKey);
    if (p === "openai") return Boolean(openaiKey);
    return false;
  };

  // 1. If preferred provider has a saved key, put it first
  if (preferred !== "custom" && hasKey(preferred as any)) {
    list.push(preferred as "openrouter" | "gemini" | "openai");
  }

  // 2. Add any other providers that have saved keys
  (["openrouter", "gemini", "openai"] as const).forEach((p) => {
    if (hasKey(p) && !list.includes(p)) {
      list.push(p);
    }
  });

  // 3. Fallback: if no key is found at all, return preferred or openrouter
  if (list.length === 0) {
    if (preferred === "gemini" || preferred === "openrouter" || preferred === "openai") {
      list.push(preferred);
    } else {
      list.push("openrouter");
    }
  }

  return list;
}

/** Multimodal Bill / Document scanning using ANY saved AI API (OpenRouter, Gemini, or OpenAI) */
export async function scanBillWithAI(file: File, config: AppConfig): Promise<ScannedBillData> {
  const mimeType = file.type || "image/jpeg";
  const base64Data = await fileToBase64(file);
  const vault = getAIVault();

  const prompt = `You are an expert OCR accountant for a waste management and community organization in Nepal.
Inspect this bill, receipt, or invoice photo/document carefully.
Extract the following information in strict JSON format:
{
  "vendor_name": "Vendor / Business Name from header",
  "pan_vat": "PAN or VAT number if visible",
  "bill_number": "Invoice or bill or receipt number",
  "date_bs": "Date in Bikram Sambat (BS) format YYYY-MM-DD or AD converted to approx BS",
  "total_amount": 0.00,
  "other_charges": 0.00,
  "other_charges_desc": "Charges that are ADDED to the item total: VAT, delivery/freight, load-unload, service charge etc.",
  "discount": 0.00,
  "discount_desc": "Charge that is DEDUCTED from the item total: discount, rebate, allowance etc.",
  "line_items": [
    {
      "item_code": "",
      "name": "Item or service description",
      "qty": 1,
      "uom": "nos",
      "rate": 0.00,
      "amount": 0.00
    }
  ]
}
Rules:
- Amounts must be numeric without currency symbols.
- If quantity is unspecified, use 1.
- other_charges must ONLY include amounts ADDED on top of the item lines (VAT, transport/freight, load-unload wages, service charge, packaging etc.) and other_charges_desc must name each of them.
- discount must ONLY include amounts DEDUCTED from the bill (discount, rebate, trade allowance); a deduction must never be reported under other_charges.
- Include VAT/charge/discount lines in their fields, not as line_items; line_items must be only the goods/services.
- If total amount is visible, ensure total_amount matches the grand total of the bill.
- Respond ONLY with the JSON object, wrapped in \`\`\`json ... \`\`\` or raw JSON.`;

  const providers = getPrioritizedAIProviders(config);
  let lastError = "";

  for (const provider of providers) {
    try {
      if (provider === "openrouter") {
        const apiKey = (
          config.openrouter_api_key?.trim() ||
          vault.openrouter_api_key?.trim() ||
          USER_OPENROUTER_KEY
        ).trim();
        if (!apiKey) continue;
        const activeModel = config.openrouter_model || vault.openrouter_model;
        const candidateModels = Array.from(
          new Set([activeModel, ...OPENROUTER_FREE_VISION_MODELS].filter(Boolean)),
        );
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        for (const model of candidateModels) {
          try {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "HTTP-Referer": "https://hamiyuwaclub.org",
                "X-Title": config.entity_name || "Sangstha AI",
              },
              body: JSON.stringify({
                model,
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: prompt },
                      { type: "image_url", image_url: { url: dataUrl } },
                    ],
                  },
                ],
              }),
            });

            const data = await res.json();
            if (res.ok) {
              if (model !== activeModel) {
                saveStoredConfig({ openrouter_model: model });
              }
              const text = data?.choices?.[0]?.message?.content || "";
              return parseOCRJsonResponse(text);
            }
            lastError = `OpenRouter (${model}): ${data?.error?.message || `HTTP ${res.status}`}`;
            if (res.status === 401) break;
          } catch (e: any) {
            lastError = `OpenRouter (${model}): ${e?.message || "नेटवर्क त्रुटि"}`;
          }
        }
      } else if (provider === "gemini") {
        const apiKey = (config.gemini_api_key?.trim() || vault.gemini_api_key?.trim()).trim();
        if (!apiKey) continue;
        const candidateModels = Array.from(
          new Set(
            [
              config.gemini_model || vault.gemini_model || "gemini-3.8-flash",
              "gemini-3.8-flash",
              "gemini-1.5-flash",
              "gemini-2.5-flash",
            ].filter(Boolean),
          ),
        );

        for (const rawModel of candidateModels) {
          const model = rawModel.replace(/^models\//, "");
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: prompt },
                      {
                        inlineData: {
                          mimeType: mimeType === "application/pdf" ? "application/pdf" : mimeType,
                          data: base64Data,
                        },
                      },
                    ],
                  },
                ],
              }),
            });
            const data = await res.json();
            if (res.ok) {
              if (model !== config.gemini_model) {
                saveStoredConfig({ gemini_model: model });
              }
              const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
              return parseOCRJsonResponse(text);
            }
            lastError = `Gemini (${model}): ${data?.error?.message || `HTTP ${res.status}`}`;
          } catch (e: any) {
            lastError = `Gemini (${model}): ${e?.message || "नेटवर्क त्रुटि"}`;
          }
        }
      } else if (provider === "openai") {
        const apiKey = config.openai_api_key.trim();
        if (!apiKey) continue;
        const model = config.openai_model || "gpt-4o-mini";
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        try {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: dataUrl } },
                  ],
                },
              ],
              response_format: { type: "json_object" },
            }),
          });
          const data = await res.json();
          if (res.ok) {
            const text = data?.choices?.[0]?.message?.content || "";
            return parseOCRJsonResponse(text);
          }
          lastError = `OpenAI (${model}): ${data?.error?.message || `HTTP ${res.status}`}`;
        } catch (e: any) {
          lastError = `OpenAI (${model}): ${e?.message || "नेटवर्क त्रुटि"}`;
        }
      }
    } catch (err: any) {
      lastError = err?.message || "API त्रुटि";
    }
  }

  throw new Error(
    `कुनै पनि बचत गरिएको AI API बाट बिल स्क्यान हुन सकेन। (विवरण: ${lastError || "कृपया 'Settings' मा गएर OpenRouter वा Gemini API Key जाँच्नुहोस्।"}${/429|rate-limited/i.test(lastError) ? RATE_LIMIT_HINT : ""})`,
  );
}

/** Meeting minutes drafting input */
export interface MinutesDraftInput {
  organization_name: string;
  event_title: string;
  event_locality?: string;
  meeting_date: string;
  members: string[];
  advisors: string[];
  representatives: string[];
  agendas: Array<{ text: string; decision?: string; done: boolean }>;
}

/** Formats a Nepal-style official meeting minutes (कार्यविवरण) without AI */
export function buildMinutesFallbackText(input: MinutesDraftInput): string {
  const attendees: string[] = [];
  if (input.members.length) attendees.push(`सदस्यहरू: ${input.members.join(", ")}`);
  if (input.advisors.length) attendees.push(`सल्लाहकारहरू: ${input.advisors.join(", ")}`);
  if (input.representatives.length)
    attendees.push(`प्रतिनिधिहरू: ${input.representatives.join(", ")}`);
  const agendas = input.agendas
    .map(
      (a, i) =>
        `${i + 1}. ${a.text}${a.done ? " (पूरा भयो)" : " (जारी)"}${a.decision?.trim() ? `\n   निर्णय: ${a.decision.trim()}` : ""}`,
    )
    .join("\n\n");
  return [
    `${input.organization_name} — औपचारिक कार्यविवरण (Meeting Minutes)`,
    `प्रस्तुत बिषय: ${input.event_title}`,
    input.event_locality ? `स्थान: ${input.event_locality}` : "",
    `मिति: ${input.meeting_date}`,
    "",
    "उपस्थिति:",
    ...attendees.map((l) => `• ${l}`),
    "",
    "एजेन्डा तथा निर्णयहरू:",
    agendas || "—",
    "",
    "कार्यान्वयन बाँकी एजेन्डाहरू अर्को सभामा स्वतः समेटिनेछ।",
    "",
    "_____________________          _____________________",
    "सचिवको सही                    अध्यक्षको सही",
  ]
    .filter((s) => s !== "")
    .join("\n");
}

/** Official Nepali meeting minutes (कार्यविवरण) drafting via ANY saved AI API */
export async function draftMinutesWithAI(
  input: MinutesDraftInput,
  config: AppConfig,
): Promise<string> {
  const agendaBlock = input.agendas
    .map(
      (a, i) =>
        `${i + 1}. ${a.text}\n   निर्णय/प्रस्ताव: ${a.decision?.trim() || "—"}\n   अवस्था: ${a.done ? "कार्यान्वयन पूरा" : "अझै जारी"}`,
    )
    .join("\n");
  const prompt = `तपाईं नेपालमा सञ्चालित "${input.organization_name}" का लागि विधिवत् सभा/कार्यक्रमको कार्यविवरण (Meeting Minutes) लेख्ने विशेषज्ञ हुनुहुन्छ।
सोही अनुसार औपचारिक नेपाली भाषामा मिनेट तयार गर्नुहोस्।

कार्यक्रम: ${input.event_title}${input.event_locality ? `\nस्थान: ${input.event_locality}` : ""}
मिति: ${input.meeting_date}

उपस्थिति:
सदस्यहरू: ${input.members.join(", ") || "—"}
सल्लाहकारहरू: ${input.advisors.join(", ") || "—"}
प्रतिनिधिहरू: ${input.representatives.join(", ") || "—"}

एजेन्डा तथा निर्णयहरू:
${agendaBlock || "—"}

नियमहरू:
- औपचारिक ढाँचामा लेख्नुहोस्: शीर्षक, मिति, उपस्थिति, एजेन्डा-वार छलफल र निर्णय, सभाध्यक्षता, समापन।
- हरेक एजेन्डामा छलफलको सारांश १-२ वाक्य र प्रस्ताव/निर्णय विवरण उल्लेख गर्नुहोस्।
- अपूरा एजेन्डालाई "अर्को सभामा जारी रहने" भनेर चिन्हित गर्नुहोस्।
- उपस्थित नभएका व्यक्ति कल्पना नगर्नुहोस्।
- केवल मिनेटको मुख्य सामग्री लेख्नुहोस्, अनावश्यक भूमिका वा व्याख्या नगर्नुहोस्।`;

  const vault = getAIVault();
  const providers = getPrioritizedAIProviders(config);
  let lastError = "";

  for (const provider of providers) {
    try {
      if (provider === "openrouter") {
        const apiKey = (
          config.openrouter_api_key?.trim() ||
          vault.openrouter_api_key?.trim() ||
          USER_OPENROUTER_KEY
        ).trim();
        if (!apiKey) continue;
        const candidateModels = Array.from(
          new Set(
            [
              config.openrouter_model || vault.openrouter_model,
              ...OPENROUTER_FREE_TEXT_MODELS,
            ].filter(Boolean),
          ),
        );

        for (const model of candidateModels) {
          try {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "HTTP-Referer": "https://hamiyuwaclub.org",
                "X-Title": config.entity_name || "Sangstha AI",
              },
              body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
              }),
            });
            const data = await res.json();
            if (res.ok) {
              return data?.choices?.[0]?.message?.content || "";
            }
            lastError = `OpenRouter (${model}): ${data?.error?.message || `HTTP ${res.status}`}`;
            if (res.status === 401) break;
          } catch (e: any) {
            lastError = `OpenRouter (${model}): ${e?.message || "नेटवर्क त्रुटि"}`;
          }
        }
      } else if (provider === "gemini") {
        const apiKey = config.gemini_api_key.trim();
        if (!apiKey) continue;
        const candidateModels = Array.from(
          new Set(
            [
              config.gemini_model || "gemini-3.8-flash",
              "gemini-3.8-flash",
              "gemini-1.5-flash",
              "gemini-2.5-flash",
            ].filter(Boolean),
          ),
        );

        for (const rawModel of candidateModels) {
          const model = rawModel.replace(/^models\//, "");
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const body = { contents: [{ parts: [{ text: prompt }] }] };
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const data = await res.json();
            if (res.ok) {
              return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            }
            lastError = `Gemini (${model}): ${data?.error?.message || `HTTP ${res.status}`}`;
          } catch (e: any) {
            lastError = `Gemini (${model}): ${e?.message || "नेटवर्क त्रुटि"}`;
          }
        }
      } else if (provider === "openai") {
        const apiKey = config.openai_api_key.trim();
        if (!apiKey) continue;
        const model = config.openai_model || "gpt-4o-mini";
        try {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: prompt }],
            }),
          });
          const data = await res.json();
          if (res.ok) {
            return data?.choices?.[0]?.message?.content || "";
          }
          lastError = `OpenAI (${model}): ${data?.error?.message || `HTTP ${res.status}`}`;
        } catch (e: any) {
          lastError = `OpenAI (${model}): ${e?.message || "नेटवर्क त्रुटि"}`;
        }
      }
    } catch (err: any) {
      lastError = err?.message || "AI त्रुटि";
    }
  }

  throw new Error(
    `मिनेट ड्राफ्ट गर्न सकिएन। कुनै पनि बचत गरिएको AI API सक्रिय छैन। विवरण: ${lastError}${/429|rate-limited/i.test(lastError) ? RATE_LIMIT_HINT : ""}`,
  );
}

/** Dashboard AI Chatbot interface */
export interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

/** Asks the organization AI Copilot using ANY saved AI API */
export async function askAIChatbot(
  messages: ChatMessage[],
  systemContext: string,
  config: AppConfig,
): Promise<{ text: string; providerUsed: string; modelUsed: string }> {
  const vault = getAIVault();
  const providers = getPrioritizedAIProviders(config);
  let lastError = "";

  const systemPrompt = `तपाईं ${config.entity_name || "संस्था"} को आधिकारिक संस्थागत AI सहायक (Institutional AI Copilot) हुनुहुन्छ।
तपाईंको काम संस्थाका पदाधिकारी, कर्मचारी र व्यवस्थापकहरूलाई फोहोरमैला संकलन, रसिद तथ्याङ्क, आर्थिक हिसाबकिताब, खर्च विवरण, कर्मचारी तथा सदस्य, सामग्री (Item Master), र स्थिर सम्पत्ति (Fixed Assets) सम्बन्धी भरपर्दो र द्रुत उत्तर दिनु हो।

तपाईंसँग हालको प्रणालीको वास्तविक तथ्याङ्क (Live System Context):
${systemContext}

निर्देशनहरू:
1. उत्तर स्पष्ट, शिष्ट, र नेपाली भाषामा दिनुहोस्।
2. संख्या वा रकम उल्लेख गर्दा नेपाली ढाँचामा "रु." र सही हिसाब दिनुहोस्।
3. तथ्याङ्क दिँदा बुलेट वा सफा तालिका प्रयोग गर्नुहोस्।
4. यदि प्रयोगकर्ताले संस्था बाहिरका सामान्य प्रश्न सोधे भने पनि विनम्रतापूर्वक उत्तर दिनुहोस्।`;

  for (const provider of providers) {
    try {
      if (provider === "openrouter") {
        const apiKey = (
          config.openrouter_api_key?.trim() ||
          vault.openrouter_api_key?.trim() ||
          USER_OPENROUTER_KEY
        ).trim();
        if (!apiKey) continue;
        const candidateModels = Array.from(
          new Set(
            [
              config.openrouter_model || vault.openrouter_model,
              ...OPENROUTER_FREE_TEXT_MODELS,
            ].filter(Boolean),
          ),
        );

        for (const model of candidateModels) {
          try {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "HTTP-Referer": "https://hamiyuwaclub.org",
                "X-Title": config.entity_name || "Sangstha AI",
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: systemPrompt },
                  ...messages.map((m) => ({ role: m.role, content: m.content })),
                ],
              }),
            });
            const data = await res.json();
            if (res.ok) {
              const text = data?.choices?.[0]?.message?.content || "";
              return { text, providerUsed: "OpenRouter", modelUsed: model };
            }
            lastError = `OpenRouter (${model}): ${data?.error?.message || `HTTP ${res.status}`}`;
            if (res.status === 401) break;
          } catch (e: any) {
            lastError = `OpenRouter (${model}): ${e?.message || "नेटवर्क त्रुटि"}`;
          }
        }
      } else if (provider === "gemini") {
        const apiKey = config.gemini_api_key.trim();
        if (!apiKey) continue;
        const candidateModels = Array.from(
          new Set(
            [
              config.gemini_model || "gemini-3.8-flash",
              "gemini-3.8-flash",
              "gemini-1.5-flash",
              "gemini-2.5-flash",
            ].filter(Boolean),
          ),
        );

        for (const rawModel of candidateModels) {
          const model = rawModel.replace(/^models\//, "");
          try {
            const contents = [
              {
                role: "user",
                parts: [
                  {
                    text: `${systemPrompt}\n\n[System initialized. Answer user questions based on the above context]`,
                  },
                ],
              },
              {
                role: "model",
                parts: [
                  {
                    text: `नमस्ते! म ${config.entity_name || "संस्था"} को संस्थागत AI सहायक हुँ। म तपाईंलाई संस्थाको रसिद, खर्च, सदस्य तथा सम्पत्ति व्यवस्थापनमा कसरी सहयोग गर्न सक्छु?`,
                  },
                ],
              },
              ...messages.map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
              })),
            ];
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents }),
            });
            const data = await res.json();
            if (res.ok) {
              const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
              return { text, providerUsed: "Google Gemini", modelUsed: model };
            }
            lastError = `Gemini (${model}): ${data?.error?.message || `HTTP ${res.status}`}`;
          } catch (e: any) {
            lastError = `Gemini (${model}): ${e?.message || "नेटवर्क त्रुटि"}`;
          }
        }
      } else if (provider === "openai") {
        const apiKey = config.openai_api_key.trim();
        if (!apiKey) continue;
        const model = config.openai_model || "gpt-4o-mini";
        try {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                ...messages.map((m) => ({ role: m.role, content: m.content })),
              ],
            }),
          });
          const data = await res.json();
          if (res.ok) {
            const text = data?.choices?.[0]?.message?.content || "";
            return { text, providerUsed: "OpenAI", modelUsed: model };
          }
          lastError = `OpenAI (${model}): ${data?.error?.message || `HTTP ${res.status}`}`;
        } catch (e: any) {
          lastError = `OpenAI (${model}): ${e?.message || "नेटवर्क त्रुटि"}`;
        }
      }
    } catch (err: any) {
      lastError = err?.message || "AI त्रुटि";
    }
  }

  throw new Error(
    `AI सहायकबाट उत्तर पाउन सकिएन। कुनै पनि बचत गरिएको API सक्रिय छैन। विवरण: ${lastError}${/429|rate-limited/i.test(lastError) ? RATE_LIMIT_HINT : ""}`,
  );
}

function parseOCRJsonResponse(text: string): ScannedBillData {
  try {
    let clean = text.trim();
    if (clean.startsWith("```json")) {
      clean = clean
        .replace(/^```json/, "")
        .replace(/```$/, "")
        .trim();
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```/, "").replace(/```$/, "").trim();
    }
    const parsed = JSON.parse(clean);
    return {
      vendor_name: parsed.vendor_name || "",
      pan_vat: parsed.pan_vat || "",
      bill_number: parsed.bill_number || "",
      date_bs: parsed.date_bs || "",
      total_amount: Number(parsed.total_amount) || 0,
      other_charges: Number(parsed.other_charges) || 0,
      other_charges_desc: parsed.other_charges_desc || "",
      line_items: Array.isArray(parsed.line_items) ? parsed.line_items : [],
      raw_response: text,
    };
  } catch {
    return {
      total_amount: 0,
      raw_response: text,
      line_items: [],
    };
  }
}
