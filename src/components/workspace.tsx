import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAppState, SignInPanel } from "./app-shell";
import { getWorkspaceData } from "@/lib/workspace.functions";
import { Button } from "./ui/button";
import { RefreshCw } from "lucide-react";
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
export function WorkspacePage({ title, children }: { title: string; children: ReactNode }) {
  const { ready, signedIn, query } = useWorkspace();
  return (
    <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
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
      {!ready ? (
        <p role="status">Opening workspace…</p>
      ) : !signedIn ? (
        <SignInPanel />
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
