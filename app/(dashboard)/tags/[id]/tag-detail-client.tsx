"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  photo: string | null;
  emails: { value: string }[];
};

type Tag = {
  id: string;
  name: string;
  color: string | null;
  contacts: { contact: Contact }[];
};

export default function TagDetailClient({ tag: initial }: { tag: Tag }) {
  const router = useRouter();
  const [tag, setTag] = useState(initial);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function initials(c: Contact) {
    return `${c.firstName[0] ?? ""}${c.lastName?.[0] ?? ""}`.toUpperCase();
  }

  async function removeContact(contactId: string) {
    const res = await fetch(`/api/contacts/${contactId}/tags/${tag.id}`, { method: "DELETE" });
    if (res.ok) {
      setTag((t) => ({ ...t, contacts: t.contacts.filter((ct) => ct.contact.id !== contactId) }));
      toast.success("Tag removed from contact");
    } else {
      toast.error("Failed to remove tag");
    }
  }

  async function handleDeleteTag() {
    setDeleting(true);
    const res = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Tag deleted");
      router.push("/tags");
    } else {
      toast.error("Failed to delete tag");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/tags" />}>
          <ArrowLeft className="h-4 w-4 mr-1" />Tags
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Badge
            variant="outline"
            className="text-lg px-3 py-1"
            style={tag.color ? { borderColor: tag.color, color: tag.color } : {}}
          >
            {tag.name}
          </Badge>
          <p className="text-sm text-muted-foreground mt-1">
            {tag.contacts.length} contact{tag.contacts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />Delete tag
        </Button>
      </div>

      {tag.contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts with this tag.</p>
      ) : (
        <div className="rounded-md border divide-y">
          {tag.contacts.map(({ contact: c }) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <Link href={`/contacts/${c.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                <Avatar className="h-8 w-8 shrink-0">
                  {c.photo ? (
                    <img src={c.photo} alt="" className="h-full w-full object-cover rounded-full" />
                  ) : (
                    <AvatarFallback className="text-xs">{initials(c)}</AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {c.firstName} {c.lastName}
                    {c.nickname && <span className="text-muted-foreground font-normal"> "{c.nickname}"</span>}
                  </p>
                  {c.emails[0] && (
                    <p className="text-xs text-muted-foreground truncate">{c.emails[0].value}</p>
                  )}
                </div>
              </Link>
              <button
                onClick={() => removeContact(c.id)}
                className="text-muted-foreground hover:text-destructive shrink-0 ml-2"
                title="Remove tag from contact"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tag</DialogTitle>
            <DialogDescription>
              Delete <strong>{tag.name}</strong>? It will be removed from all {tag.contacts.length} contact{tag.contacts.length !== 1 ? "s" : ""}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTag} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
