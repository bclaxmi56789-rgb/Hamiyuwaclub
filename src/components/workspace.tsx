import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useAppState, SignInPanel } from "./app-shell";
import { getWorkspaceData } from "@/lib/workspace.functions";
import { Button } from "./ui/button";
import { RefreshCw, Lock, Eye, AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export function useWorkspace() {
  const app = useAppState();
  const fetchData = useServerFn(getWorkspaceData);
  const query = useQuery({
    queryKey: ["workspace", app.userId],
    queryFn: () => fetchData(),
    enabled: app.ready && app.signedIn,
  });
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
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                <Eye className="size-3.5" />
                हेर्न मात्र (Read-only)
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && actionButton}
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh records"
            title="Refresh records"
            disabled={!signedIn || query.isFetching}
            onClick={() => query.refetch()}
          >
            <RefreshCw />
          </Button>
        </div>
      </div>

      {readOnly && (
        <div className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2 font-medium">
          <AlertCircle className="size-4 shrink-0 text-blue-600" />
          <span>
            तपाईं यस पृष्ठमा <strong>हेर्न मात्र (Read-only)</strong> पहुँचमा हुनुहुन्छ। नयाँ रेकर्ड थप्ने वा सच्याउने अनुमति छैन।
          </span>
        </div>
      )}

      {!ready ? (
        <p role="status">Opening workspace…</p>
      ) : !signedIn ? (
        <SignInPanel />
      ) : !allowed ? (
        <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center space-y-3 my-6">
          <div className="mx-auto size-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600">
            <Lock className="size-6" />
          </div>
          <h3 className="text-lg font-bold text-rose-700">पहुँच निषेध गरिएको छ (Access Denied)</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            तपाईंको कर्मचारी खातालाई यस पृष्ठमा प्रवेश गर्ने अनुमति दिइएको छैन। कृपया व्यवस्थापक वा सुपरभाइजरसँग सम्पर्क गर्नुहोस्।
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
