"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Pencil, Trash2, Check, X } from "lucide-react";

const INTERACTION_TYPES = ["call", "message", "in-person", "email", "video", "letter", "other"];

function localDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Interaction = {
  id: string;
  type: string;
  date: Date | string;
  time: string | null;
  notes: string | null;
};

function EditRow({
  interaction,
  onSave,
  onCancel,
}: {
  interaction: Interaction;
  onSave: (updated: Interaction) => void;
  onCancel: () => void;
}) {
  const d = new Date(interaction.date);
  const [type, setType] = useState(interaction.type);
  const [date, setDate] = useState(localDateString(d));
  const [time, setTime] = useState(interaction.time ?? "");
  const [notes, setNotes] = useState(interaction.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/interactions/${interaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, date, time: time || null, notes: notes.trim() || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      toast.success("Interaction updated");
      onSave(updated);
    } else {
      toast.error("Failed to update interaction");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-2 py-2">
      <div className="flex flex-wrap gap-2">
        <Select value={type} onValueChange={(v) => setType(v ?? type)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERACTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-36" />
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-28" />
      </div>
      <Textarea
        placeholder="Notes…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          <Check className="h-3.5 w-3.5 mr-1" />{saving ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1" />Cancel
        </Button>
      </div>
    </div>
  );
}

export default function InteractionLog({
  initialInteractions,
  dateFormat,
}: {
  initialInteractions: Interaction[];
  dateFormat: string;
}) {
  const router = useRouter();
  const [interactions, setInteractions] = useState(initialInteractions);
  const [editingId, setEditingId] = useState<string | null>(null);

  const now = new Date();
  const scheduled = interactions.filter((i) => new Date(i.date) > now);
  const past = interactions.filter((i) => new Date(i.date) <= now);

  async function deleteInteraction(id: string) {
    const res = await fetch(`/api/interactions/${id}`, { method: "DELETE" });
    if (res.ok) {
      setInteractions((prev) => prev.filter((i) => i.id !== id));
      toast.success("Interaction deleted");
      router.refresh();
    } else {
      toast.error("Failed to delete interaction");
    }
  }

  function handleSave(updated: Interaction) {
    setInteractions((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditingId(null);
    router.refresh();
  }

  function renderRow(interaction: Interaction) {
    if (editingId === interaction.id) {
      return (
        <div key={interaction.id}>
          <EditRow
            interaction={interaction}
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
          />
        </div>
      );
    }

    return (
      <div key={interaction.id} className="flex gap-3 text-sm group">
        <div className="shrink-0 text-xs text-muted-foreground w-24 pt-0.5">
          {format(new Date(interaction.date), dateFormat)}
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium capitalize">{interaction.type}</span>
          {interaction.notes && (
            <p className="text-muted-foreground mt-0.5">{interaction.notes}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={() => setEditingId(interaction.id)}
            className="text-muted-foreground hover:text-foreground p-0.5"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => deleteInteraction(interaction.id)}
            className="text-muted-foreground hover:text-destructive p-0.5"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (scheduled.length === 0 && past.length === 0) {
    return <p className="text-sm text-muted-foreground">No interactions logged yet.</p>;
  }

  return (
    <div className="space-y-3">
      {scheduled.length > 0 && (
        <>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Scheduled</p>
          {scheduled.map(renderRow)}
          {past.length > 0 && <Separator />}
        </>
      )}
      {past.map(renderRow)}
    </div>
  );
}
