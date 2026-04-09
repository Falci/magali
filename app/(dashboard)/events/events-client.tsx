"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, LayoutGrid, List } from "lucide-react";
import type { UpcomingEvent } from "@/lib/events";

const EVENT_EMOJI: Record<string, string> = {
  birthday: "🎂",
  anniversary: "💍",
  reminder: "🔔",
  custom: "📅",
};

const EVENT_TYPES = ["custom", "anniversary", "reminder"];
const RECURRING_OPTIONS = [
  { value: "", label: "One-time" },
  { value: "YEARLY", label: "Yearly" },
  { value: "MONTHLY", label: "Monthly" },
];

type Contact = { id: string; firstName: string; lastName: string | null };

export default function EventsClient({
  upcomingEvents,
  contacts,
}: {
  upcomingEvents: UpcomingEvent[];
  contacts: Contact[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"cards" | "list">("cards");

  useEffect(() => {
    const saved = localStorage.getItem("events-view");
    if (saved === "list" || saved === "cards") setView(saved);
  }, []);

  function setViewAndPersist(v: "cards" | "list") {
    setView(v);
    localStorage.setItem("events-view", v);
  }
  const [form, setForm] = useState({
    title: "",
    date: "",
    type: "custom",
    recurring: "",
    contactId: "",
    notes: "",
    reminderDaysBefore: "",
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.date) { toast.error("Title and date are required"); return; }
    setLoading(true);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        recurring: form.recurring || null,
        contactId: form.contactId || null,
        reminderDaysBefore: form.reminderDaysBefore ? parseInt(form.reminderDaysBefore) : null,
      }),
    });
    if (res.ok) {
      toast.success("Event created");
      setOpen(false);
      setForm({ title: "", date: "", type: "custom", recurring: "", contactId: "", notes: "", reminderDaysBefore: "" });
      router.refresh();
    } else {
      toast.error("Failed to create event");
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (id.startsWith("birthday-")) { toast.error("Birthday events are auto-generated from contact birthdays"); return; }
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Event deleted");
      router.refresh();
    } else {
      toast.error("Failed to delete event");
    }
  }

  // Group by month
  const grouped = upcomingEvents.reduce<Record<string, UpcomingEvent[]>>((acc, ev) => {
    const key = format(ev.nextDate, "MMMM yyyy");
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Events</h1>
          <p className="text-sm text-muted-foreground">{upcomingEvents.length} upcoming in the next year</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-md border overflow-hidden">
            <Button
              variant={view === "cards" ? "default" : "ghost"}
              size="sm"
              className="rounded-none border-0"
              onClick={() => setViewAndPersist("cards")}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              className="rounded-none border-0 border-l"
              onClick={() => setViewAndPersist("list")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button><Plus className="h-4 w-4 mr-2" />Add event</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New event</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input id="date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v ?? form.type })}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Recurring</Label>
                  <Select value={form.recurring} onValueChange={(v) => setForm({ ...form, recurring: v ?? "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RECURRING_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Contact (optional)</Label>
                  <Select value={form.contactId} onValueChange={(v) => setForm({ ...form, contactId: v ?? "" })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Remind me <span className="text-muted-foreground font-normal text-xs">(days before, leave blank for default)</span></Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  placeholder="Use global default"
                  value={form.reminderDaysBefore}
                  onChange={(e) => setForm({ ...form, reminderDaysBefore: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create event"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {upcomingEvents.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-2">📅</p>
          <p className="font-medium">No upcoming events</p>
          <p className="text-sm">Add events or birthdays to your contacts to see them here.</p>
        </div>
      ) : view === "cards" ? (
        <div className="space-y-6">
          {Object.entries(grouped).map(([month, events]) => (
            <div key={month}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{month}</h2>
              <div className="space-y-2">
                {events.map((ev) => (
                  <Card key={ev.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl shrink-0">{EVENT_EMOJI[ev.type] ?? "📅"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{ev.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm text-muted-foreground">{format(ev.nextDate, "MMMM d")}</span>
                            {ev.recurring && <Badge variant="outline" className="text-xs">{ev.recurring === "YEARLY" ? "yearly" : "monthly"}</Badge>}
                            {ev.contactName && (
                              <Link href={`/contacts/${ev.contactId}`} className="text-xs text-muted-foreground hover:underline">
                                {ev.contactName}
                              </Link>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={ev.daysUntil === 0 ? "default" : ev.daysUntil <= 7 ? "destructive" : "secondary"}>
                            {ev.daysUntil === 0 ? "Today" : ev.daysUntil === 1 ? "Tomorrow" : `${ev.daysUntil}d`}
                          </Badge>
                          {!ev.id.startsWith("birthday-") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(ev.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {upcomingEvents.map((ev) => (
            <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-lg shrink-0">{EVENT_EMOJI[ev.type] ?? "📅"}</span>
              <div className="flex-1 min-w-0 flex items-center gap-4">
                <p className="font-medium text-sm truncate min-w-32">{ev.title}</p>
                <span className="text-sm text-muted-foreground shrink-0">{format(ev.nextDate, "MMM d, yyyy")}</span>
                {ev.contactName && (
                  <Link href={`/contacts/${ev.contactId}`} className="text-xs text-muted-foreground hover:underline hidden sm:block truncate">
                    {ev.contactName}
                  </Link>
                )}
                {ev.recurring && <Badge variant="outline" className="text-xs shrink-0">{ev.recurring === "YEARLY" ? "yearly" : "monthly"}</Badge>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={ev.daysUntil === 0 ? "default" : ev.daysUntil <= 7 ? "destructive" : "secondary"} className="text-xs">
                  {ev.daysUntil === 0 ? "Today" : ev.daysUntil === 1 ? "Tomorrow" : `${ev.daysUntil}d`}
                </Badge>
                {!ev.id.startsWith("birthday-") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(ev.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
