"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Plus, Users, ExternalLink, Pencil } from "lucide-react";
import { ContactCombobox, type ContactOption } from "@/components/contacts/contact-combobox";

const RELATIONSHIP_TYPES = [
  "friend", "family", "colleague", "partner", "spouse",
  "acquaintance", "mentor", "mentee",
  "child", "parent", "sibling",
  "ex-spouse", "ex-partner",
  "other",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function deriveLabel(type: string, direction: "from" | "to", otherGender: string | null): string {
  const REVERSE: Record<string, string> = {
    child: "parent", parent: "child",
    son: "parent", daughter: "parent",
    father: "child", mother: "child",
    sibling: "sibling", brother: "sibling", sister: "sibling",
    mentor: "mentee", mentee: "mentor",
    spouse: "spouse", husband: "spouse", wife: "spouse",
    "ex-spouse": "ex-spouse", "ex-partner": "ex-partner",
  };
  const GENDERED: Record<string, { male: string; female: string }> = {
    parent: { male: "father", female: "mother" },
    child:  { male: "son",    female: "daughter" },
    sibling: { male: "brother", female: "sister" },
    spouse: { male: "husband", female: "wife" },
  };

  const base = direction === "from" ? (REVERSE[type] ?? type) : type;
  if (!otherGender || otherGender === "other") return base;
  return GENDERED[base]?.[otherGender as "male" | "female"] ?? base;
}

type OtherContact = ContactOption;
type Relationship = {
  id: string;
  type: string;
  notes: string | null;
  other: OtherContact;
  direction: "from" | "to";
};

type NewContactForm = {
  firstName: string;
  lastName: string;
  gender: string;
  birthdayMonth: string;
  birthdayDay: string;
  birthdayYear: string;
};

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

function defaultNewContact(firstName = ""): NewContactForm {
  return { firstName, lastName: "", gender: "", birthdayMonth: "", birthdayDay: "", birthdayYear: "" };
}

// Returns the label for the CURRENT contact given a stored type and "from" direction
function currentContactLabel(type: string): string {
  // When creating, current contact is always FROM, and type means "FROM is type"
  // e.g. type "child" → current contact is the child
  // We just display the type as-is for the current contact
  return type;
}

export default function RelationshipsSection({
  contactId,
  contactName,
  relationships,
  allContacts,
}: {
  contactId: string;
  contactName: string;
  relationships: Relationship[];
  allContacts: OtherContact[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [newContact, setNewContact] = useState<NewContactForm>(defaultNewContact());
  const [relType, setRelType] = useState("friend");
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editingRel, setEditingRel] = useState<Relationship | null>(null);
  const [editType, setEditType] = useState("friend");
  const [editLoading, setEditLoading] = useState(false);

  const REVERSE: Record<string, string> = {
    child: "parent", parent: "child",
    son: "parent", daughter: "parent",
    father: "child", mother: "child",
    sibling: "sibling", brother: "sibling", sister: "sibling",
    mentor: "mentee", mentee: "mentor",
    spouse: "spouse", husband: "spouse", wife: "spouse",
    "ex-spouse": "ex-spouse", "ex-partner": "ex-partner",
  };

  const linked = relationships.map((r) => r.other.id);
  const available = allContacts.filter((c) => !linked.includes(c.id));

  const selectedContact = allContacts.find((c) => c.id === selectedId);
  const selectedName = selectedContact
    ? `${selectedContact.firstName}${selectedContact.lastName ? ` ${selectedContact.lastName}` : ""}`
    : null;

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setSelectedId(null);
      setMode("existing");
      setNewContact(defaultNewContact());
      setRelType("friend");
    }
  }

  function handleContactChange(id: string | null) {
    setSelectedId(id);
    setMode("existing");
  }

  function handleCreateNew(firstName: string) {
    setSelectedId(null);
    setMode("new");
    setNewContact(defaultNewContact(firstName));
  }

  function setNewField(field: keyof NewContactForm, value: string) {
    setNewContact((prev) => ({ ...prev, [field]: value }));
  }

  async function handleAdd() {
    setLoading(true);
    try {
      let toId = selectedId;

      if (mode === "new") {
        if (!newContact.firstName.trim()) {
          toast.error("First name is required");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: newContact.firstName.trim(),
            lastName: newContact.lastName.trim() || null,
            gender: newContact.gender || null,
            birthdayMonth: newContact.birthdayMonth ? parseInt(newContact.birthdayMonth) : null,
            birthdayDay: newContact.birthdayDay ? parseInt(newContact.birthdayDay) : null,
            birthdayYear: newContact.birthdayYear ? parseInt(newContact.birthdayYear) : null,
            emails: [],
            phones: [],
            addresses: [],
            tagIds: [],
          }),
        });
        if (!res.ok) { toast.error("Failed to create contact"); setLoading(false); return; }
        const created = await res.json();
        toId = created.id;
        toast.success(`Created ${newContact.firstName}`);
      }

      if (!toId) { toast.error("Select a contact"); setLoading(false); return; }

      const relRes = await fetch("/api/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId: contactId, toId, type: relType }),
      });

      if (relRes.ok) {
        toast.success("Relationship added");
        handleOpenChange(false);
        router.refresh();
      } else {
        toast.error("Failed to add relationship");
      }
    } finally {
      setLoading(false);
    }
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

  function openEdit(rel: Relationship) {
    setEditingRel(rel);
    setEditType(rel.type);
  }

  async function handleEditSave() {
    if (!editingRel) return;
    setEditLoading(true);
    const res = await fetch(`/api/relationships/${editingRel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: editType, notes: editingRel.notes }),
    });
    if (res.ok) {
      toast.success("Relationship updated");
      setEditingRel(null);
      router.refresh();
    } else {
      toast.error("Failed to update relationship");
    }
    setEditLoading(false);
  }

  const canAdd = mode === "existing" ? selectedId !== null : newContact.firstName.trim() !== "";
  const newContactSearchParams = newContact.firstName
    ? `?firstName=${encodeURIComponent(newContact.firstName)}${newContact.lastName ? `&lastName=${encodeURIComponent(newContact.lastName)}` : ""}`
    : "";

  // Direction preview sentence for the add dialog
  const directionPreview =
    (selectedName || (mode === "new" && newContact.firstName.trim()))
      ? `${contactName} is ${currentContactLabel(relType)} of ${selectedName ?? newContact.firstName.trim()}`
      : null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Users className="h-4 w-4" />Relationships
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {relationships.length === 0 && (
            <p className="text-sm text-muted-foreground">No relationships linked yet.</p>
          )}
          {relationships.map((rel) => (
            <div key={rel.id} className="flex items-center justify-between gap-2 text-sm">
              <a href={`/contacts/${rel.other.id}`} className="hover:underline font-medium">
                {rel.other.firstName} {rel.other.lastName}
              </a>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize text-xs">
                  {deriveLabel(rel.type, rel.direction, rel.other.gender)}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => openEdit(rel)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
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

      {/* Add dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add relationship</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Contact selector */}
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <ContactCombobox
                contacts={available}
                value={selectedId}
                onChange={handleContactChange}
                onCreateNew={handleCreateNew}
              />
            </div>

            {/* New contact quick-form */}
            {mode === "new" && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New contact details</p>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">First name <span className="text-destructive">*</span></Label>
                    <Input
                      value={newContact.firstName}
                      onChange={(e) => setNewField("firstName", e.target.value)}
                      className="h-8 text-sm"
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Last name</Label>
                    <Input
                      value={newContact.lastName}
                      onChange={(e) => setNewField("lastName", e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Gender</Label>
                  <Select value={newContact.gender || "unset"} onValueChange={(v) => setNewField("gender", v === "unset" ? "" : (v ?? ""))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Not specified" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Not specified</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Birthday (partial ok)</Label>
                  <div className="flex gap-1.5">
                    <Select value={newContact.birthdayMonth || "none"} onValueChange={(v) => setNewField("birthdayMonth", v === "none" ? "" : (v ?? ""))}>
                      <SelectTrigger className="h-8 text-sm flex-1">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Month</SelectItem>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={newContact.birthdayDay || "none"} onValueChange={(v) => setNewField("birthdayDay", v === "none" ? "" : (v ?? ""))}>
                      <SelectTrigger className="h-8 text-sm w-16">
                        <SelectValue placeholder="Day" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Day</SelectItem>
                        {DAYS.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={newContact.birthdayYear}
                      onChange={(e) => setNewField("birthdayYear", e.target.value)}
                      placeholder="Year"
                      className="h-8 text-sm w-20"
                      maxLength={4}
                    />
                  </div>
                </div>

                <Link
                  href={`/contacts/new${newContactSearchParams}`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  <ExternalLink className="size-3" />
                  Open full add contact form
                </Link>
              </div>
            )}

            {/* Relationship type */}
            <div className="space-y-1.5">
              <Label>Relationship type</Label>
              <Select value={relType} onValueChange={(v) => setRelType(v ?? relType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {directionPreview && (
                <p className="text-xs text-muted-foreground italic">{directionPreview}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={loading || !canAdd}>
              {loading ? "Adding…" : "Add relationship"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editingRel !== null} onOpenChange={(v) => { if (!v) setEditingRel(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit relationship</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {editingRel && (
              <p className="text-sm text-muted-foreground">
                Editing relationship with <span className="font-medium text-foreground">{editingRel.other.firstName} {editingRel.other.lastName}</span>
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Relationship type</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v ?? editType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingRel && (
                <p className="text-xs text-muted-foreground italic">
                  {contactName} is {editingRel.direction === "from" ? editType : (REVERSE[editType] ?? editType)} of {editingRel.other.firstName} {editingRel.other.lastName}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRel(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
