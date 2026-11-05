import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useWorkspace, WorkspacePage, EmptyRows, money } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { np, MONTHS, fiscalLabel } from "@/lib/receipt-rules";
import { ReceiptVoucher } from "@/components/receipt-voucher";
import type { Receipt } from "@/lib/receipt-rules";
import { Eye } from "lucide-react";
export const Route = createFileRoute("/receipts")({
  head: () => ({
    meta: [
      { title: "Receipt History — Sangstha" },
      { name: "description", content: "Search and reprint saved ward receipts by fiscal year." },
      { property: "og:title", content: "Sangstha history" },
      { property: "og:description", content: "Saved payments and printable receipts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: History,
});
function History() {
  const { query, ward, year } = useWorkspace();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Receipt | null>(null);
  const receipts =
    query.data?.receipts.filter(
      (r) =>
        (!ward || r.ward === ward) &&
        Number(r.year) === year &&
        `${r.name} ${r.card} ${r.no}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  return (
    <WorkspacePage title="Receipt history">
      <div className="no-print">
        <div className="mb-3 text-xs text-muted-foreground">
          नगद/बैंक रसिद, भुक्तानी र सारसम्पर्क बुक गर्न{" "}
          <Link
            to="/receipts-payments"
            className="font-bold text-primary underline-offset-2 hover:underline"
          >
            रसिद तथा भुक्तानी (Receipts &amp; Payments) पृष्ठमा
          </Link>{" "}
          जानुहोस्।
        </div>
        <input
          aria-label="Search receipts"
          className="mb-5 w-full max-w-md rounded-md border bg-card px-3 py-2"
          placeholder="Search receipt, customer or card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-accent">
              <tr>
                {["Receipt", "Date", "Ward", "Customer", "Months", "Payment", "Amount", ""].map(
                  (t, i) => (
                    <th className="px-3 py-3" key={i}>
                      {t}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr className="border-b" key={r.id}>
                  <td className="p-3">{r.no}</td>
                  <td className="p-3 whitespace-nowrap">{np(r.date)}</td>
                  <td className="p-3">{r.ward}</td>
                  <td className="p-3">
                    {r.name}
                    <div className="text-xs text-muted-foreground">{r.card}</div>
                  </td>
                  <td className="p-3">
                    {r.months
                      .map(
                        (m) =>
                          `${MONTHS[m.m]}${m.year && String(m.year) !== r.year ? ` (${fiscalLabel(m.year)})` : ""}`,
                      )
                      .join(", ")}
                  </td>
                  <td className="p-3">{r.mode}</td>
                  <td className="p-3 whitespace-nowrap">{money(r.total)}</td>
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="View receipt"
                      aria-label={`View receipt ${r.no}`}
                      onClick={() => setSelected(r)}
                    >
                      <Eye />
                    </Button>
                  </td>
                </tr>
              ))}
              {!receipts.length && <EmptyRows columns={8} text="No matching receipts." />}
            </tbody>
          </table>
        </div>
      </div>
      {selected && <ReceiptVoucher r={selected} onClose={() => setSelected(null)} />}
    </WorkspacePage>
  );
}
