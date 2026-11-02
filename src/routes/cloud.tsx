import { createFileRoute } from "@tanstack/react-router";
import { useWorkspace } from "@/components/workspace";
import { SignInPanel } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Cloud, Database, ShieldCheck, RefreshCw } from "lucide-react";
export const Route = createFileRoute("/cloud")({ head: () => ({ meta: [{ title: "Saved Records — Hami Yuwa Club" }, { name: "description", content: "Cloud record connection and storage status for Hami Yuwa Club." }, { property: "og:title", content: "Hami Yuwa Club saved records" }, { property: "og:description", content: "Check your saved receipt and customer records." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: CloudPage });
function CloudPage() {
  const { signedIn, query } = useWorkspace();
  return <main className="mx-auto max-w-5xl px-5 py-7 sm:px-8"><h1 className="mb-7 text-2xl font-extrabold text-ink">Saved records</h1><div className="flex items-center gap-4 border-b pb-6"><Cloud className="size-10 text-ink"/><div><h2 className="text-xl font-bold">Saved records</h2><p className="text-sm text-muted-foreground">{!signedIn ? "Sign in to check saved records" : query.isFetching ? "Checking connection…" : query.isError ? "Connection check failed" : query.data ? "Connected · records loaded" : "Connection not checked"}</p></div></div>
    {!signedIn ? <SignInPanel/> : <><dl className="mt-6 divide-y"><div className="flex flex-wrap justify-between gap-3 py-4"><dt className="flex items-center gap-2"><Database className="size-4"/>People Master entries</dt><dd className="font-bold">{query.data?.people.length ?? "—"}</dd></div><div className="flex flex-wrap justify-between gap-3 py-4"><dt>Saved receipts</dt><dd className="font-bold">{query.data?.receipts.length ?? "—"}</dd></div><div className="flex flex-wrap justify-between gap-3 py-4"><dt className="flex items-center gap-2"><ShieldCheck className="size-4"/>Record access</dt><dd>Current account only</dd></div></dl><Button className="mt-5" variant="outline" disabled={query.isFetching} onClick={()=>query.refetch()}><RefreshCw/>Check connection</Button></>}
  </main>;
}