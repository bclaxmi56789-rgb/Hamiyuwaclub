import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { useAppState, SignInPanel } from "./app-shell";
import { getWorkspaceData } from "@/lib/workspace.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Lock, Eye, AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export function useWorkspace() {
  const app = useAppState();
  const fetchData = useServerFn(getWorkspaceData);
  const query = useQuery({
    queryKey: ["workspace", app.userId],
    queryFn: async () => {
      const isBlank = (d: unknown) => {
        const w = d as { people?: unknown[]; receipts?: unknown[] } | null | undefined;
        return Boolean(w) && !w?.people?.length && !w?.receipts?.length;
      };
      const data = await fetchData();
      // A first RPC right after sign-in can carry a session token that the
      // database still rejects or reads as a different scope, yielding a
      // successful but empty workspace. Refresh the session once and retry.
      if (!isBlank(data)) return data;
      try {
        await supabase.auth.refreshSession();
      } catch {
        // Keep whatever session exists
      }
      const retry = await fetchData();
      if (!isBlank(retry)) return retry;
      // One last delayed attempt before the bounded poll takes over
      await new Promise((r) => setTimeout(r, 1200));
      return await fetchData();
    },
    enabled: app.ready && app.signedIn,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
    retry: (count, err) => {
      const msg = String((err as Error)?.message || "");
      if (/Unauthorized/i.test(msg) && count < 3) return true;
      return count < 2;
    },
    retryDelay: 1200,
    refetchOnWindowFocus: false,
  });

  // A first fetch that *succeeds* with an entirely empty workspace right after
  // sign-in usually means the request raced the session token attach. Keep
  // re-checking on a short poll until records appear (bounded) so the dashboard
  // fills itself without a manual refresh. Note: TanStack structural sharing
  // keeps the data reference identical between empty results, so this is driven
  // by a counter state, not the data reference.
  const [emptyPoll, setEmptyPoll] = useState(0);
  useEffect(() => {
    if (!app.ready || !app.signedIn) return;
    const data = query.data as
      { people?: unknown[]; receipts?: unknown[]; trips?: unknown[] } | undefined;
    if (query.isPending || query.isError) return;
    const hasData = !data || Boolean(data.people?.length || data.receipts?.length);
    if (hasData) return;
    if (emptyPoll >= 10) return;
    const timer = setTimeout(() => {
      setEmptyPoll((c) => c + 1);
      void query.refetch();
    }, 1200);
    return () => clearTimeout(timer);
  }, [
    app.ready,
    app.signedIn,
    query.isPending,
    query.isError,
    query.isSuccess,
    query.data,
    query.refetch,
    emptyPoll,
  ]);

  return { ...app, query };
}

export function WorkspacePage({
  title,
  children,
  actionButton,
}: {
  title: string;
  children: ReactNode;
  actionButton?: ReactNode;
}) {
  const { ready, signedIn, query, isPageReadOnly, hasPageAccess } = useWorkspace();
  const location = useLocation();
  const path = location.pathname;

  const allowed = hasPageAccess(path);
  const readOnly = isPageReadOnly(path);

  return (
    <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink flex items-center gap-2">
            <span>{title}</span>
            {readOnly && (
              <span className="inline-flex items-center gap-1 rounded-full bg-info/10 border border-info/20 px-2.5 py-0.5 text-xs font-bold text-info">
                <Eye className="size-3.5" />
                हेर्न मात्र (Read-only)
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">{!readOnly && actionButton}</div>
      </div>

      {readOnly && (
        <div className="mb-4 rounded-xl border border-info/30 bg-info/5 p-3 text-xs text-info flex items-center gap-2 font-medium">
          <AlertCircle className="size-4 shrink-0 text-info" />
          <span>
            तपाईं यस पृष्ठमा <strong>हेर्न मात्र (Read-only)</strong> पहुँचमा हुनुहुन्छ। नयाँ रेकर्ड
            थप्ने वा सच्याउने अनुमति छैन।
          </span>
        </div>
      )}

      {!ready ? (
        <p role="status">Opening workspace…</p>
      ) : !signedIn ? (
        <SignInPanel />
      ) : !allowed ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3 my-6"
        >
          <div className="mx-auto size-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <Lock className="size-6" />
          </div>
          <h3 className="text-lg font-bold text-destructive">पहुँच निषेध गरिएको छ (Access Denied)</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            तपाईंको कर्मचारी खातालाई यस पृष्ठमा प्रवेश गर्ने अनुमति दिइएको छैन। कृपया व्यवस्थापक वा
            सुपरभाइजरसँग सम्पर्क गर्नुहोस्।
          </p>
        </div>
      ) : query.isPending ? (
        <p role="status">Loading records…</p>
      ) : query.isError ? (
        <div role="alert" className="py-8">
          <p className="text-destructive">Records could not be loaded.</p>
          <Button className="mt-3" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        children
      )}
    </main>
  );
}
export const money = (value: number) => `रु. ${value.toLocaleString("en-IN")}`;
export function EmptyRows({ columns, text }: { columns: number; text: string }) {
  return (
    <tr>
      <td colSpan={columns} className="py-12 text-center text-muted-foreground">
        {text}
      </td>
    </tr>
  );
}
