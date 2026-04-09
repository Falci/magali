"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Plus } from "lucide-react";

type TagWithCount = {
  id: string;
  name: string;
  color: string | null;
  _count: { contacts: number };
};

export default function TagsClient({ initialTags }: { initialTags: TagWithCount[] }) {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function createTag(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const tag = await res.json();
      setTags((prev) => [...prev, { ...tag, _count: { contacts: 0 } }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      toast.success("Tag created");
      router.refresh();
    } else {
      toast.error("Failed to create tag");
    }
    setCreating(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Tags</h1>
          <p className="text-sm text-muted-foreground">{tags.length} tag{tags.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <form onSubmit={createTag} className="flex gap-2 max-w-sm">
        <Input
          placeholder="New tag name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={creating || !newName.trim()}>
          <Plus className="h-4 w-4 mr-1" />Add
        </Button>
      </form>

      {tags.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Tag className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No tags yet</p>
          <p className="text-sm">Create a tag above or add one when editing a contact.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <Link key={tag.id} href={`/tags/${tag.id}`}>
              <Badge
                variant="outline"
                className="text-sm px-3 py-1.5 cursor-pointer hover:bg-muted transition-colors"
                style={tag.color ? { borderColor: tag.color, color: tag.color } : {}}
              >
                {tag.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {tag._count.contacts}
                </span>
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
