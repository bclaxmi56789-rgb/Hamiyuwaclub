import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LogIn,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { signupOutcome } from "@/lib/email-auth";
import { useAppConfig } from "@/lib/app-config";
import { ThemeSelector } from "@/components/theme-selector";
import { saveAdminPin } from "@/lib/workspace.functions";

export function SignInPanel() {
  const appConfig = useAppConfig();
  const saveAdminPinFn = useServerFn(saveAdminPin);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [confirmAdminPin, setConfirmAdminPin] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  function changeMode(next: typeof mode) {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
    setAdminPin("");
    setConfirmAdminPin("");
    setConfirmation(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice(
          "यदि यो इमेल दर्ता छ भने, पासवर्ड रिसेट लिङ्क पठाइएको छ। कृपया आफ्नो इनबक्स वा स्प्याम फोल्डर जाँच्नुहोस्।"
        );
      } else if (mode === "signup") {
        if (!/^\d{4}$/.test(adminPin)) {
          setError("Admin PIN ठीक ४ अंक (4 digits) को हुनुपर्छ।");
          setBusy(false);
          return;
        }
        if (adminPin !== confirmAdminPin) {
          setError("Admin PIN र दोहोर्‍याइएको PIN मिलेन।");
          setBusy(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { admin_pin: adminPin },
          },
        });
        if (error) throw error;

        // If email confirmation is disabled and session is directly created, save admin_pin immediately
        if (data.session) {
          try {
            await saveAdminPinFn({ data: { admin_pin: adminPin } });
          } catch (pinErr) {
            console.warn("Failed to set admin pin on signup:", pinErr);
          }
        }

        if (signupOutcome(Boolean(data.session)) === "confirm-email") {
          setConfirmation(true);
          setPassword("");
          setAdminPin("");
          setConfirmAdminPin("");
          setNotice(
            "तपाईंको इमेलमा पुष्टिकरण लिङ्क पठाइएको छ। साइन इन गर्नुअघि लिङ्कमा थिच्नुहोस्। Admin PIN सुरक्षित राखिएको छ।"
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
      if (code === "email_not_confirmed") {
        setConfirmation(true);
        setError("कृपया पहिले आफ्नो इमेल प्रमाणित (confirm) गर्नुहोस्।");
      } else if (code === "invalid_credentials") {
        setError("इमेल ठेगाना वा पासवर्ड मिलेन।");
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "अनुरोध पूरा हुन सकेन। कृपया पुन: प्रयास गर्नुहोस्।"
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setNotice("पुष्टिकरण लिङ्क पुनः पठाइएको छ। इनबक्स वा स्प्याम फोल्डर जाँच्नुहोस्।");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "पुष्टिकरण लिङ्क पठाउन सकिएन।"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 selection:bg-primary/20 relative">
      {/* Background glow orb */}
      <div className="absolute -z-10 w-96 h-96 bg-primary/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Main 3D Credentials Card */}
      <div className="w-full max-w-md rounded-3xl border bg-card/95 backdrop-blur-2xl p-7 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.22)] border-t-white/30 relative overflow-hidden transition-all duration-300">
        {/* Top bar inside card: Theme selector */}
        <div className="flex items-center justify-between pb-6 border-b mb-6">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>सुरक्षित कार्यक्षेत्र</span>
          </div>
          <ThemeSelector />
        </div>

        {/* Brand identity */}
        <div className="text-center space-y-2 mb-6">
          <div className="mx-auto size-16 rounded-2xl bg-primary/10 border border-primary/20 p-2 flex items-center justify-center shadow-xs">
            {!logoErr && appConfig.logo_url ? (
              <img
                src={appConfig.logo_url}
                alt="Club Logo"
                className="w-full h-full object-contain"
                onError={() => setLogoErr(true)}
              />
            ) : (
              <div className="font-extrabold text-primary text-xl tracking-tighter">
                {appConfig.entity_name ? appConfig.entity_name.slice(0, 3) : "—"}
              </div>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              {appConfig.entity_name || ""}
            </h1>
            <p className="text-xs font-bold text-primary tracking-wide uppercase mt-0.5">
              {appConfig.entity_sub_name || ""}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium mt-1">
              {appConfig.address || ""}
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        {mode !== "forgot" && !confirmation && (
          <div className="grid grid-cols-2 p-1 rounded-xl bg-muted/60 mb-6 border text-xs font-bold">
            <button
              type="button"
              onClick={() => changeMode("login")}
              className={`py-2 rounded-lg transition-all text-center ${
                mode === "login"
                  ? "bg-card text-foreground shadow-2xs font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              साइन इन (Sign In)
            </button>
            <button
              type="button"
              onClick={() => changeMode("signup")}
              className={`py-2 rounded-lg transition-all text-center ${
                mode === "signup"
                  ? "bg-card text-foreground shadow-2xs font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              नयाँ खाता (Register)
            </button>
          </div>
        )}

        {/* Title for Forgot / Confirm mode */}
        {(mode === "forgot" || confirmation) && (
          <div className="mb-6 text-center space-y-1">
            <h2 className="text-lg font-bold text-foreground">
              {mode === "forgot" ? "पासवर्ड रिसेट (Reset Password)" : "इमेल पुष्टिकरण (Email Confirmation)"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {mode === "forgot"
                ? "तपाईंको दर्ता भएको इमेल ठेगाना लेख्नुहोस्।"
                : "तपाईंको खाता सक्रिय गर्न इमेल प्रमाणित गर्नुहोस्।"}
            </p>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={submit} className="space-y-4">
          {/* Email input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>इमेल ठेगाना (Email)</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                autoComplete="email"
                required
                disabled={busy}
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 text-xs sm:text-sm bg-background/50 h-10"
              />
            </div>
          </div>

          {/* Password input */}
          {mode !== "forgot" && !confirmation && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">
                  पासवर्ड (Password)
                </Label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => changeMode("forgot")}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    पासवर्ड बिर्सनुभयो?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type={visible ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={mode === "signup" ? 8 : undefined}
                  required
                  disabled={busy}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 text-xs sm:text-sm bg-background/50 h-10"
                />
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label={visible ? "पासवर्ड लुकाउनुहोस्" : "पासवर्ड देखाउनुहोस्"}
                >
                  {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Admin PIN fields during signup */}
          {mode === "signup" && !confirmation && (
            <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <KeyRound className="h-4 w-4 shrink-0" />
                <span>व्यवस्थापक PIN सेट गर्नुहोस् (Admin PIN Setup)</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                मुख्य व्यवस्थापकको रूपमा प्रवेश गर्दा तथा संवेदनशील परिवर्तन गर्दा यो ४ अंकको गोप्य PIN आवश्यक पर्नेछ।
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-foreground">
                    Admin PIN (४ अंक)
                  </Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    disabled={busy}
                    placeholder="••••"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="text-center font-mono tracking-widest bg-background/80 h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-foreground">
                    PIN पुष्टि (Confirm)
                  </Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    disabled={busy}
                    placeholder="••••"
                    value={confirmAdminPin}
                    onChange={(e) =>
                      setConfirmAdminPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    className="text-center font-mono tracking-widest bg-background/80 h-9"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Notice Message */}
          {notice && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-medium flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {/* Submit Actions */}
          <div className="pt-2 space-y-2">
            {confirmation ? (
              <>
                <Button
                  type="button"
                  className="w-full h-10 font-bold gap-2"
                  disabled={busy || !email.trim()}
                  onClick={resend}
                >
                  {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                  <span>पुष्टिकरण लिङ्क पुनः पठाउनुहोस्</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs font-semibold"
                  onClick={() => changeMode("login")}
                >
                  साइन इनमा फर्कनुहोस्
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full h-10 font-bold gap-2 shadow-sm"
                >
                  {busy ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  <span>
                    {busy
                      ? "कृपया पर्खनुहोस्..."
                      : mode === "signup"
                      ? "खाता सिर्जना गर्नुहोस्"
                      : mode === "forgot"
                      ? "रिसेट लिङ्क पठाउनुहोस्"
                      : "साइन इन गर्नुहोस्"}
                  </span>
                </Button>

                {mode === "forgot" && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-xs font-semibold"
                    onClick={() => changeMode("login")}
                  >
                    साइन इनमा फर्कनुहोस्
                  </Button>
                )}
              </>
            )}
          </div>
        </form>

        {/* Footer Link to Landing Page */}
        <div className="mt-8 pt-5 border-t text-center">
          <Link
            to="/landing"
            className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1.5 group"
          >
            <span>🌐 संस्थाको मुख्य Landing Page हेर्नुहोस्</span>
            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
