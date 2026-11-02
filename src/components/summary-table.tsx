import { money, EmptyRows } from "./workspace";
import { np } from "@/lib/receipt-rules";

/** Simple grouped report table: name | receipts | amount (used on Dashboard & Reports). */
export function SummaryTable({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number; amount: number }[];
}) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-accent">
            <tr>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3 text-right">Receipts</th>
              <th className="px-3 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b">
                <td className="p-3">{r.label}</td>
                <td className="p-3 text-right">{np(r.count)}</td>
                <td className="p-3 text-right whitespace-nowrap">{money(r.amount)}</td>
              </tr>
            ))}
            {!rows.length && <EmptyRows columns={3} text="No collections for these filters." />}
          </tbody>
        </table>
      </div>
    </div>
  );
}
