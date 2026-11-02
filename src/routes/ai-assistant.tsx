import { createFileRoute } from "@tanstack/react-router";
import { useWorkspace, WorkspacePage, money } from "@/components/workspace";
import { DashboardAIChatbot } from "@/components/dashboard-ai-chatbot";
import { np, collectionBy } from "@/lib/receipt-rules";
import { Bot } from "lucide-react";

export const Route = createFileRoute("/ai-assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — Hami Yuwa Club" },
      {
        name: "description",
        content:
          "Institutional AI copilot for collections, dues, vendors and accounting questions.",
      },
      { property: "og:title", content: "AI Assistant" },
    ],
  }),
  component: AIAssistant,
});

function AIAssistant() {
  const { query, ward, year } = useWorkspace();

  const yearReceipts =
    query.data?.receipts.filter((r) => (!ward || r.ward === ward) && Number(r.year) === year) ?? [];
  const people = query.data?.people.filter((p) => !ward || p.ward === ward) ?? [];
  const total = yearReceipts.reduce((a, r) => a + r.total, 0);
  const byWard = collectionBy(yearReceipts, (r) => r.ward).sort(
    (a, b) => Number(a.key) - Number(b.key),
  );
  const byTole = collectionBy(yearReceipts, (r) => r.tole);

  return (
    <WorkspacePage title="AI Assistant (संस्थागत सहायक)">
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "कुल संकलन (Total collection)", value: money(total) },
          { label: "रसिद (Receipts)", value: String(yearReceipts.length) },
          { label: "ग्राहक (Customers)", value: String(people.length) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 break-words text-xl font-extrabold text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-1 shadow-xs">
        <DashboardAIChatbot
          totalCollection={total}
          receiptCount={yearReceipts.length}
          customerCount={people.length}
          ward={ward}
          year={year}
          byWard={byWard}
          byTole={byTole}
          recentReceipts={yearReceipts.slice(0, 10)}
        />
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <Bot className="mt-0.5 size-4 shrink-0" />
        <span>
          यो सहायकले वडा नं. {ward || "—"} र आर्थिक वर्ष {np(year)} को तथ्याङ्क (कुल संकलन, रसिद,
          वडा/टोल विश्लेषण, हालका रसिदहरू) का आधारमा नेपाली र अंग्रेजीमा जवाफ दिन्छ। Settings मा AI
          कुञ्जी (API key) राखिएको छ भने सिधै प्रयोग गर्न सकिन्छ।
        </span>
      </p>
    </WorkspacePage>
  );
}
