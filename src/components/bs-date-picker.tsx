import { useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { bsCalendarMonth, MONTHS, np, parseBS, todayBS } from "@/lib/receipt-rules";

export function BSDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: 2083, month: 6 });
  const grid = bsCalendarMonth(view.year, view.month);
  function move(delta: number) {
    const month = (view.month + delta + 12) % 12;
    const year = view.year + (view.month + delta < 0 ? -1 : view.month + delta > 11 ? 1 : 0);
    if (bsCalendarMonth(year, month)) setView({ year, month });
  }
  function select(day: number) {
    onChange(`${view.year}/${String(view.month + 1).padStart(2, "0")}/${String(day).padStart(2, "0")}`);
    setOpen(false);
  }
  return <Popover open={open} onOpenChange={next => {
    if (next) { const date = parseBS(value) ?? parseBS(todayBS()); if (date) setView({ year: date.y, month: date.m - 1 }); }
    setOpen(next);
  }}>
    <PopoverTrigger asChild><Button variant="outline" aria-label="Select Nepali date" className="h-auto w-full justify-between px-2 py-2 font-semibold"><span>{value ? np(value) : "मिति"}</span><CalendarIcon className="size-4 shrink-0" /></Button></PopoverTrigger>
    <PopoverContent align="start" className="pointer-events-auto w-[300px] max-w-[calc(100vw-24px)] p-3" aria-label="Nepali calendar">
      <div className="mb-3 flex items-center justify-between gap-2"><Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeft /></Button><div className="flex gap-1"><select aria-label="Calendar month" className="min-w-0 bg-popover font-semibold" value={view.month} onChange={e => setView({ ...view, month: Number(e.target.value) })}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select><select aria-label="Calendar year" className="bg-popover font-semibold" value={view.year} onChange={e => setView({ ...view, year: Number(e.target.value) })}>{Array.from({ length: 91 }, (_, i) => 2000 + i).filter(y => bsCalendarMonth(y, view.month)).map(y => <option key={y} value={y}>{np(y)}</option>)}</select></div><Button variant="ghost" size="icon" aria-label="Next month" onClick={() => move(1)}><ChevronRight /></Button></div>
      <div role="grid" aria-label={`${MONTHS[view.month]} ${np(view.year)}`} className="grid grid-cols-7 gap-1">
        {["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"].map(d => <span key={d} className="py-2 text-center text-xs text-muted-foreground">{d}</span>)}
        {Array.from({ length: grid?.startDay ?? 0 }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: grid?.days ?? 0 }, (_, i) => { const d = i + 1; const selected = parseBS(value); const active = selected?.y === view.year && selected.m === view.month + 1 && selected.d === d; return <Button key={d} variant={active ? "default" : "ghost"} aria-label={`Choose ${view.year}/${String(view.month + 1).padStart(2, "0")}/${String(d).padStart(2, "0")}`} aria-pressed={active} className="h-9 w-full p-0" onClick={() => select(d)}>{np(d)}</Button>; })}
      </div>
      <Button variant="ghost" className="mt-3 w-full border-t" onClick={() => { onChange(todayBS()); setOpen(false); }}>आज</Button>
    </PopoverContent>
  </Popover>;
}