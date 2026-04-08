"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isFuture, isPast } from "date-fns";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Interaction = {
  id: string;
  date: string;
  time: string | null;
  type: string;
  notes: string | null;
  contact: { id: string; firstName: string; lastName: string | null };
};

const INTERACTION_EMOJI: Record<string, string> = {
  call: "📞",
  message: "💬",
  "in-person": "🤝",
  email: "📧",
  video: "🎥",
  letter: "✉️",
  other: "📌",
};

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const start = startOfMonth(currentMonth).toISOString();
      const end = endOfMonth(currentMonth).toISOString();
      const res = await fetch(`/api/calendar/interactions?start=${start}&end=${end}`);
      if (res.ok) setInteractions(await res.json());
      setLoading(false);
    }
    load();
  }, [currentMonth]);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDayOfWeek = startOfMonth(currentMonth).getDay(); // 0=Sun

  const dayInteractions = (day: Date) =>
    interactions.filter((i) => isSameDay(new Date(i.date), day));

  const selectedInteractions = selectedDay ? dayInteractions(selectedDay) : [];

  function prevMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <a
          href="/api/calendar/ical"
          download="magali.ics"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Download className="h-4 w-4" />
          Export iCal
        </a>
      </div>

      <div className="grid md:grid-cols-[1fr_280px] gap-6">
        {/* Calendar grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
            <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="bg-muted/50 text-center text-xs font-medium text-muted-foreground py-1.5">
                {d}
              </div>
            ))}
            {/* Empty cells before month start */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-background min-h-[60px]" />
            ))}
            {days.map((day) => {
              const items = dayInteractions(day);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "bg-background min-h-[60px] p-1 text-left hover:bg-accent transition-colors",
                    isSelected && "ring-2 ring-inset ring-primary",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  <span className={cn(
                    "text-xs font-medium inline-flex h-5 w-5 items-center justify-center rounded-full",
                    isToday(day) && "bg-primary text-primary-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {items.slice(0, 2).map((i) => (
                      <div key={i.id} className={cn(
                        "text-xs truncate px-0.5 rounded",
                        isFuture(new Date(i.date)) ? "text-blue-700 bg-blue-50" : "text-muted-foreground bg-muted"
                      )}>
                        {INTERACTION_EMOJI[i.type] ?? "📌"} {i.contact.firstName}
                      </div>
                    ))}
                    {items.length > 2 && (
                      <div className="text-xs text-muted-foreground px-0.5">+{items.length - 2} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        <div className="space-y-2">
          <h3 className="font-medium text-sm">
            {selectedDay ? format(selectedDay, "EEEE, MMMM d") : "Select a day"}
          </h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : selectedInteractions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interactions on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedInteractions
                .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
                .map((i) => (
                  <div key={i.id} className="border rounded-md p-2.5 text-sm space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span>{INTERACTION_EMOJI[i.type] ?? "📌"}</span>
                      <Link href={`/contacts/${i.contact.id}`} className="font-medium hover:underline">
                        {i.contact.firstName} {i.contact.lastName}
                      </Link>
                      {isFuture(new Date(i.date)) && (
                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 ml-auto">scheduled</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{i.type}</span>
                      {i.time && <span>· {i.time}</span>}
                    </div>
                    {i.notes && <p className="text-xs text-muted-foreground">{i.notes}</p>}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
