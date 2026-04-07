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
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/contacts/${contactId}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, date, notes: notes.trim() || null }),
    });
    if (res.ok) {
      toast.success("Interaction logged");
      setNotes("");
      router.refresh();
    } else {
      toast.error("Failed to log interaction");
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
      </div>
      <Textarea
        placeholder="Optional notes…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
      />
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Logging…" : "Log interaction"}
      </Button>
    </form>
  );
}
