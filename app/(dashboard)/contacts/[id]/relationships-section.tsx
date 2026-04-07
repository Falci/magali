"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Users } from "lucide-react";

const RELATIONSHIP_TYPES = ["friend", "family", "colleague", "partner", "acquaintance", "mentor", "mentee", "other"];

type OtherContact = { id: string; firstName: string; lastName: string | null };
type Relationship = {
  id: string;
  type: string;
  notes: string | null;
  other: OtherContact;
  direction: "from" | "to";
};

export default function RelationshipsSection({
  contactId,
  relationships,
  allContacts,
}: {
  contactId: string;
  relationships: Relationship[];
  allContacts: OtherContact[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [type, setType] = useState("friend");
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!targetId) return;
    setLoading(true);
    const res = await fetch("/api/relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromId: contactId, toId: targetId, type }),
    });
    if (res.ok) {
      toast.success("Relationship added");
      setAdding(false);
      setTargetId("");
      router.refresh();
    } else {
      toast.error("Failed to add relationship");
    }
    setLoading(false);
  }

  async function handleDelete(relId: string) {
    const res = await fetch(`/api/relationships/${relId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Relationship removed");
      router.refresh();
    } else {
      toast.error("Failed to remove relationship");
    }
  }

  const linked = relationships.map((r) => r.other.id);
  const available = allContacts.filter((c) => !linked.includes(c.id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Users className="h-4 w-4" />Relationships
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setAdding(!adding)}>
            <Plus className="h-4 w-4 mr-1" />Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="flex flex-col gap-2 border rounded-md p-3">
            <Select value={targetId} onValueChange={(v) => setTargetId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select a contact…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => setType(v ?? type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={loading || !targetId}>
                {loading ? "Adding…" : "Add"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {relationships.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">No relationships linked yet.</p>
        )}
        {relationships.map((rel) => (
          <div key={rel.id} className="flex items-center justify-between gap-2 text-sm">
            <a href={`/contacts/${rel.other.id}`} className="hover:underline font-medium">
              {rel.other.firstName} {rel.other.lastName}
            </a>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize text-xs">{rel.type}</Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(rel.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
