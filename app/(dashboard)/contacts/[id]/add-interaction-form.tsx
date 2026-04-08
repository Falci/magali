"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const INTERACTION_TYPES = ["call", "message", "in-person", "email", "video", "letter", "other"];

export default function AddInteractionForm({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [type, setType] = useState("call");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const isScheduled = date > new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/contacts/${contactId}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, date, time: time || null, notes: notes.trim() || null }),
    });
    if (res.ok) {
      toast.success(isScheduled ? "Interaction scheduled" : "Interaction logged");
      setNotes("");
      router.refresh();
    } else {
      toast.error("Failed to save interaction");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <Select value={type} onValueChange={(v) => setType(v ?? type)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERACTION_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-28" />
        {isScheduled && (
          <span className="self-center text-xs text-blue-600 font-medium">scheduled</span>
        )}
      </div>
      <Textarea
        placeholder="Optional notes…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
      />
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Saving…" : isScheduled ? "Schedule interaction" : "Log interaction"}
      </Button>
    </form>
  );
}
