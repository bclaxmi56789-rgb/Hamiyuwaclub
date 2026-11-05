import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Reset Password — Sangstha" },
    { name: "description", content: "Set a new password for your Sangstha payment collection account." },
    { property: "og:title", content: "Sangstha — Reset Password" },
    { property: "og:description", content: "Secure password recovery for your collection workspace." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPassword,
});
function ResetPassword() {
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const recoveryLink = hash.get("type") === "recovery";
    // Auth consumes the recovery hash during startup. Preserve its intent per tab.
    if (recoveryLink) sessionStorage.setItem("password-recovery", "true");
    const allowed = recoveryLink || sessionStorage.getItem("password-recovery") === "true";
    supabase.auth.getUser().then(({ data, error }) => setRecovery(allowed && !error && Boolean(data.user))).catch(() => setRecovery(false));
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true); sessionStorage.removeItem("password-recovery"); setPassword(""); setConfirm("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update password."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-sm px-5 py-12"><h1 className="mb-6 text-2xl font-bold">Reset password</h1>{done ? <p role="status">Your password has been updated.</p> : !recovery ? <p role="status">Open the password reset link from your email to set a new password.</p> : <form className="space-y-4" onSubmit={submit}><label className="block text-sm font-semibold">New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-md border bg-card px-3 py-2" /></label><label className="block text-sm font-semibold">Confirm password<input type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1 w-full rounded-md border bg-card px-3 py-2" /></label>{error && <p role="alert" className="text-destructive">{error}</p>}<Button disabled={busy} className="w-full">{busy ? "Updating…" : "Update password"}</Button></form>}<Button asChild variant="ghost" className="mt-4"><Link to="/masters">Return to workspace</Link></Button></main>;
}