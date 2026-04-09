"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";

type Tag = { id: string; name: string; color: string | null; _count: { contacts: number } };

export default function TagsSettingsClient({ initialTags }: { initialTags: Tag[] }) {
  const [tags, setTags] = useState<Tag[]>(initialTags);

  async function deleteTag(id: string) {
    const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTags((prev) => prev.filter((t) => t.id !== id));
    } else {
      toast.error("Failed to delete tag");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Tags</h1>
        <p className="text-sm text-muted-foreground">Manage tags used to categorize contacts</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>Manage tags used to categorize contacts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tags.length === 0 && (
            <p className="text-sm text-muted-foreground">No tags yet.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1.5 rounded-md border bg-muted px-2.5 py-1 text-sm"
              >
                <span>{tag.name}</span>
                {tag._count.contacts > 0 && (
                  <span className="text-xs text-muted-foreground">({tag._count.contacts})</span>
                )}
                <button
                  type="button"
                  onClick={() => deleteTag(tag.id)}
                  className="text-muted-foreground hover:text-destructive ml-0.5"
                  aria-label={`Delete tag ${tag.name}`}
                  title={
                    tag._count.contacts > 0
                      ? `Used by ${tag._count.contacts} contact(s) — will be unlinked`
                      : "Delete tag"
                  }
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
