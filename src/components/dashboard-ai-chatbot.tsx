import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Trash2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useAppConfig,
  askAIChatbot,
  getPrioritizedAIProviders,
  type ChatMessage,
} from "@/lib/app-config";

interface DashboardAIChatbotProps {
  totalCollection: number;
  receiptCount: number;
  customerCount: number;
  ward: string;
  year: number;
  byWard: Array<{ key: string; count: number; amount: number }>;
  byTole: Array<{ key: string; count: number; amount: number }>;
  recentReceipts: Array<{ no: string; name: string; total: number; ward: string; date: string }>;
}

const QUICK_QUESTIONS = [
  "चालू आर्थिक वर्षको कुल संकलन र रसिद संख्या कति छ?",
  "कुन वडाबाट सबैभन्दा धेरै रकम संकलन भएको छ?",
  "दर्ता भएका ग्राहकहरूको मुख्य अवस्था कस्तो छ?",
  "सामग्री (Item) र स्थिर सम्पत्ति (Fixed Asset) को लगत कसरी हेर्ने?",
  "आर्थिक वर्ष अनुसार संकलनको संक्षिप्त प्रतिवेदन दिनुहोस्।",
];

export function DashboardAIChatbot({
  totalCollection,
  receiptCount,
  customerCount,
  ward,
  year,
  byWard,
  byTole,
  recentReceipts,
}: DashboardAIChatbotProps) {
  const config = useAppConfig();
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `नमस्ते! म **हामी युवा क्लब**को संस्थागत AI सहायक (Institutional AI Copilot) हुँ। \nतपाईं यहाँ संस्थाको **रसिद संकलन, वडागत तथ्याङ्क, खर्च, सदस्य, कर्मचारी, सामग्री (Item Master), वा स्थिर सम्पत्ति (Fixed Assets)** सम्बन्धी कुनै पनि जानकारी सोध्न सक्नुहुन्छ। \n\nतलका द्रुत प्रश्नहरूमा थिच्नुहोस् वा आफ्नो प्रश्न लेख्नुहोस् — आवाजबाट पनि सोध्न सक्नुहुन्छ! 🎙️`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeModelInfo, setActiveModelInfo] = useState<{ provider: string; model: string } | null>(
    null
  );

  // ── Voice Input (STT) ─────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // ── Voice Output (TTS) ────────────────────────────────────────
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Determine active provider label
  const prioritized = getPrioritizedAIProviders(config);
  const primaryProvider = prioritized[0] || config.ai_provider;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Stop recognition & TTS on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel?.();
    };
  }, []);

  // ── STT helpers ───────────────────────────────────────────────
  function startListening() {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert(
        "तपाईंको ब्राउजरमा Voice Input समर्थित छैन।\n(Your browser does not support Voice Input.)"
      );
      return;
    }
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = "ne-NP"; // Nepali; browser may fall back to en
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const results = event?.results;
      if (!results) return;
      const transcript = Array.from(results)
        .map((r: any) => r[0]?.transcript || "")
        .join("");
      setInputValue(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    setIsListening(false);
  }

  // ── TTS helper ────────────────────────────────────────────────
  function speakText(text: string, id: string) {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    if (speakingId === id) {
      setSpeakingId(null);
      return;
    }
    // Strip markdown bold/italic markers for cleaner speech
    const clean = text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "ne-NP";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  }

  // ── System context ────────────────────────────────────────────
  function getSystemContext() {
    const wardBreakdown = byWard
      .map((w) => `वडा नं. ${w.key}: रु. ${w.amount.toLocaleString("ne-NP")} (${w.count} रसिदहरू)`)
      .join(", ");
    const toleBreakdown = byTole
      .slice(0, 8)
      .map((t) => `${t.key}: रु. ${t.amount.toLocaleString("ne-NP")} (${t.count} रसिद)`)
      .join(", ");
    const recent = recentReceipts
      .slice(0, 5)
      .map((r) => `रसिद नं. ${r.no} (${r.name}, वडा ${r.ward}, रु. ${r.total})`)
      .join("; ");

    return `
संस्थाको नाम: ${config.entity_name} (${config.entity_sub_name})
ठेगाना: ${config.address}
पान/भ्याट नं.: ${config.pan_vat || "उल्लेख नभएको"}
छानिएको वडा: ${ward ? `वडा नं. ${ward}` : "सबै वडाहरू (All Wards)"}
छानिएको आर्थिक वर्ष: २०${year ? year - 1 : "८१"}/०${year || "८२"}
कुल संकलन रकम: रु. ${totalCollection.toLocaleString("ne-NP")}
कुल रसिद संख्या: ${receiptCount}
कुल दर्ता भएका ग्राहक संख्या: ${customerCount}
वडागत संकलन विवरण: ${wardBreakdown || "कुनै तथ्याङ्क छैन"}
मुख्य टोलगत संकलन: ${toleBreakdown || "कुनै तथ्याङ्क छैन"}
हालैका रसिदहरू: ${recent || "कुनै रसिद छैन"}
सिस्टम सुविधाहरू: रसिद संकलन, खर्च तथा बिल स्क्यान (AI OCR), मिटिङ मिनेट (Meeting Minutes), सदस्य तथा कर्मचारी (Members & Payroll), भेन्डर लगत (Vendors), सामग्री सूची (Item Master: item_code, name, parent, sub_parent, uom, units, amount), र स्थिर सम्पत्ति (Fixed Asset Master: code, name, parent, sub_parent, uom, units, amount)।
    `.trim();
  }

  // ── Send message ──────────────────────────────────────────────
  async function handleSend(textToSend?: string) {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    // Stop listening if still active
    if (isListening) stopListening();

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue("");
    setLoading(true);

    try {
      const context = getSystemContext();
      const chatHistory = newMessages.slice(-10);
      const res = await askAIChatbot(chatHistory, context, config);

      setActiveModelInfo({ provider: res.providerUsed, model: res.modelUsed });

      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: res.text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: `⚠️ **त्रुटि देखा पर्यो:** ${err.message || "जडान हुन सकेन।"} \n\n*कृपया 'Settings' मा गएर OpenRouter वा Gemini API Key जाँच्नुहोस्।*`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    if (!confirm("च्याट इतिहास खाली गर्न चाहनुहुन्छ?")) return;
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
    setMessages([
      {
        id: "welcome-reset",
        role: "assistant",
        content:
          "च्याट इतिहास खाली गरियो। मलाई संस्थाको संकलन वा अन्य कुनै विषयमा सोध्न सक्नुहुन्छ!",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setActiveModelInfo(null);
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-muted/40 border-b">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-primary/10 p-2 text-primary ring-1 ring-primary/20">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-foreground">
                हामी युवा क्लब AI सहायक (Dashboard Copilot)
              </h3>
              <Badge
                variant="outline"
                className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30 text-[10px] py-0 px-2 font-mono gap-1"
              >
                <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                {activeModelInfo
                  ? `${activeModelInfo.provider}`
                  : primaryProvider === "openrouter"
                  ? "OpenRouter (Free)"
                  : primaryProvider === "gemini"
                  ? "Google Gemini"
                  : "OpenAI"}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              बचत गरिएको कुनै पनि API मार्फत जोडिएको · आवाज इनपुट/आउटपुट सहित 🎙️
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleClear}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            title="च्याट खाली गर्नुहोस्"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setIsOpen((v) => !v)}
            className="h-7 w-7 p-0"
            title={isOpen ? "च्याट बन्द गर्नुहोस्" : "च्याट खोल्नुहोस्"}
          >
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="flex flex-col h-[460px]">
          {/* Quick Questions Pills */}
          <div className="px-4 py-2 border-b bg-muted/10 overflow-x-auto flex items-center gap-1.5 scrollbar-none">
            <span className="text-[11px] font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" /> द्रुत प्रश्नहरू:
            </span>
            {QUICK_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(q)}
                disabled={loading}
                className="text-[11px] whitespace-nowrap rounded-full border bg-background hover:bg-muted/80 px-2.5 py-1 text-foreground transition-colors shrink-0 shadow-2xs hover:border-primary/40 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.map((m) => {
              const isUser = m.role === "user";
              const isSpeaking = speakingId === m.id;
              return (
                <div
                  key={m.id || m.content.substring(0, 10)}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                      isUser
                        ? "bg-primary text-primary-foreground rounded-br-xs"
                        : "bg-muted/60 text-foreground border border-border/50 rounded-bl-xs"
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{m.content}</div>
                  </div>

                  {/* Timestamp + model info + TTS button */}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground px-1">
                    <span>{m.timestamp}</span>
                    {!isUser && activeModelInfo && (
                      <span className="font-mono text-[9px] text-muted-foreground/70">
                        • {activeModelInfo.provider} ({activeModelInfo.model.split("/").pop()})
                      </span>
                    )}
                    {/* TTS button — only on assistant messages */}
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => speakText(m.content, m.id!)}
                        className={`flex items-center gap-0.5 px-1 rounded transition-colors ${
                          isSpeaking
                            ? "text-primary animate-pulse"
                            : "text-muted-foreground/60 hover:text-primary"
                        }`}
                        title={isSpeaking ? "बोल्न रोक्नुहोस्" : "यो सन्देश सुन्नुहोस् (TTS)"}
                      >
                        {isSpeaking ? (
                          <VolumeX className="h-3.5 w-3.5" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 w-fit rounded-xl px-3 py-2 border">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>AI विश्लेषण गर्दैछ...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t bg-background flex items-center gap-2"
          >
            {/* Voice input button */}
            <Button
              type="button"
              variant={isListening ? "default" : "outline"}
              size="sm"
              onClick={isListening ? stopListening : startListening}
              disabled={loading}
              className={`shrink-0 px-3 gap-1.5 transition-all ${
                isListening
                  ? "bg-red-500 hover:bg-red-600 border-red-500 text-white animate-pulse"
                  : "text-muted-foreground hover:text-primary"
              }`}
              title={isListening ? "रोक्नुहोस् (Stop listening)" : "आवाजबाट सोध्नुहोस् (Voice Input)"}
            >
              {isListening ? (
                <>
                  <MicOff className="h-4 w-4" />
                  <span className="text-[11px] hidden sm:inline">सुन्दैछ...</span>
                </>
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>

            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                isListening
                  ? "🎙️ सुन्दैछ — बोल्नुहोस्..."
                  : "तपाईंको प्रश्न यहाँ लेख्नुहोस् वा माइक थिच्नुहोस्..."
              }
              disabled={loading}
              className={`text-xs sm:text-sm bg-muted/20 transition-all ${
                isListening ? "border-red-400 ring-1 ring-red-400/30 placeholder:text-red-400/80" : ""
              }`}
            />

            <Button
              type="submit"
              disabled={loading || !inputValue.trim()}
              size="sm"
              className="gap-1.5 shrink-0 px-4"
            >
              <span>पठाउनुहोस्</span>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
