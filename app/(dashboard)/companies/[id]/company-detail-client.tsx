"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, Edit2, Trash2, X, Check, ExternalLink } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Tag = { id: string; name: string; color: string | null };
type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  jobTitle: string | null;
  photo: string | null;
  emails: { value: string }[];
  tags: { tag: Tag }[];
};
type Company = {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  contacts: Contact[];
  _count: { contacts: number };
};

export default function CompanyDetailClient({ company: initial }: { company: Company }) {
  const router = useRouter();
  const [company, setCompany] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(initial.name);
  const [editWebsite, setEditWebsite] = useState(initial.website ?? "");
  const [editNotes, setEditNotes] = useState(initial.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!editName.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), website: editWebsite.trim() || null, notes: editNotes.trim() || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCompany((c) => ({ ...c, name: updated.name, website: updated.website, notes: updated.notes }));
      setEditing(false);
      toast.success("Company updated");
    } else {
      toast.error("Failed to update company");
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/companies/${company.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Company deleted");
      router.push("/companies");
    } else {
      toast.error("Failed to delete company");
    }
    setDeleting(false);
  }

  function initials(c: Contact) {
    return `${c.firstName[0] ?? ""}${c.lastName?.[0] ?? ""}`.toUpperCase();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/companies" />}>
          <ArrowLeft className="h-4 w-4 mr-1" />Companies
        </Button>
      </div>

      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-lg border bg-muted flex items-center justify-center shrink-0">
          <Building2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input type="url" placeholder="https://example.com" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving || !editName.trim()}>
                  <Check className="h-3.5 w-3.5 mr-1" />{saving ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditName(company.name); setEditWebsite(company.website ?? ""); setEditNotes(company.notes ?? ""); }}>
                  <X className="h-3.5 w-3.5 mr-1" />Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">{company.name}</h1>
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:underline flex items-center gap-1 mt-0.5">
                  {company.website}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {company.notes && <p className="text-sm text-muted-foreground mt-1">{company.notes}</p>}
            </>
          )}
        </div>
        {!editing && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="h-3.5 w-3.5 mr-1" />Edit
            </Button>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Contacts ({company._count.contacts})</CardTitle>
        </CardHeader>
        <CardContent>
          {company.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts linked to this company.</p>
          ) : (
            <div className="divide-y -mx-2">
              {company.contacts.map((c) => (
                <Link key={c.id} href={`/contacts/${c.id}`} className="flex items-center gap-3 px-2 py-2.5 rounded hover:bg-muted/50 transition-colors">
                  <Avatar className="h-8 w-8 shrink-0">
                    {c.photo ? (
                      <img src={c.photo} alt="" className="h-full w-full object-cover rounded-full" />
                    ) : (
                      <AvatarFallback className="text-xs">{initials(c)}</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {c.firstName} {c.lastName}
                      {c.nickname && <span className="text-muted-foreground font-normal"> "{c.nickname}"</span>}
                    </p>
                    {c.jobTitle && <p className="text-xs text-muted-foreground">{c.jobTitle}</p>}
                    {c.emails[0] && <p className="text-xs text-muted-foreground">{c.emails[0].value}</p>}
                  </div>
                  {c.tags.slice(0, 2).map(({ tag }) => (
                    <Badge key={tag.id} variant="secondary" className="text-xs px-1.5 py-0 shrink-0">
                      {tag.name}
                    </Badge>
                  ))}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete company</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{company.name}</strong>?
              {company._count.contacts > 0 && (
                <> This company has <strong>{company._count.contacts} contact{company._count.contacts !== 1 ? "s" : ""}</strong> — they will remain but their company will be unset.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
