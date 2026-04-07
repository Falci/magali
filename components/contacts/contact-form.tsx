"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, X } from "lucide-react";

type MultiField = { label: string; value: string };
type Tag = { id: string; name: string; color: string | null };

type ContactFormData = {
  firstName: string;
  lastName: string;
  nickname: string;
  company: string;
  jobTitle: string;
  birthday: string;
  notes: string;
  emails: MultiField[];
  phones: MultiField[];
  addresses: { label: string; street: string; city: string; state: string; zip: string; country: string }[];
  tagIds: string[];
};

const EMAIL_LABELS = ["home", "work", "other"];
const PHONE_LABELS = ["mobile", "home", "work", "other"];
const ADDRESS_LABELS = ["home", "work", "other"];

const defaultForm = (): ContactFormData => ({
  firstName: "",
  lastName: "",
  nickname: "",
  company: "",
  jobTitle: "",
  birthday: "",
  notes: "",
  emails: [],
  phones: [],
  addresses: [],
  tagIds: [],
});

export default function ContactForm({
  initialData,
  contactId,
  allTags,
}: {
  initialData?: Partial<ContactFormData>;
  contactId?: string;
  allTags: Tag[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ContactFormData>({ ...defaultForm(), ...initialData });
  const [newTagName, setNewTagName] = useState("");

  function set(field: keyof ContactFormData, value: unknown) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function addEmail() {
    set("emails", [...form.emails, { label: "home", value: "" }]);
  }
  function updateEmail(i: number, field: keyof MultiField, value: string) {
    const updated = form.emails.map((e, idx) => (idx === i ? { ...e, [field]: value } : e));
    set("emails", updated);
  }
  function removeEmail(i: number) {
    set("emails", form.emails.filter((_, idx) => idx !== i));
  }

  function addPhone() {
    set("phones", [...form.phones, { label: "mobile", value: "" }]);
  }
  function updatePhone(i: number, field: keyof MultiField, value: string) {
    const updated = form.phones.map((p, idx) => (idx === i ? { ...p, [field]: value } : p));
    set("phones", updated);
  }
  function removePhone(i: number) {
    set("phones", form.phones.filter((_, idx) => idx !== i));
  }

  function addAddress() {
    set("addresses", [...form.addresses, { label: "home", street: "", city: "", state: "", zip: "", country: "" }]);
  }
  function updateAddress(i: number, field: string, value: string) {
    const updated = form.addresses.map((a, idx) => (idx === i ? { ...a, [field]: value } : a));
    set("addresses", updated);
  }
  function removeAddress(i: number) {
    set("addresses", form.addresses.filter((_, idx) => idx !== i));
  }

  function toggleTag(tagId: string) {
    set("tagIds", form.tagIds.includes(tagId)
      ? form.tagIds.filter((id) => id !== tagId)
      : [...form.tagIds, tagId]);
  }

  async function createTag() {
    const name = newTagName.trim();
    if (!name) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const tag = await res.json();
      set("tagIds", [...form.tagIds, tag.id]);
      setNewTagName("");
      router.refresh();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim()) { toast.error("First name is required"); return; }
    setLoading(true);

    const url = contactId ? `/api/contacts/${contactId}` : "/api/contacts";
    const method = contactId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        birthday: form.birthday || null,
        emails: form.emails.filter((e) => e.value.trim()),
        phones: form.phones.filter((p) => p.value.trim()),
        addresses: form.addresses.filter((a) => a.street || a.city || a.country),
      }),
    });

    if (res.ok) {
      const saved = await res.json();
      toast.success(contactId ? "Contact updated" : "Contact created");
      router.push(`/contacts/${saved.id}`);
      router.refresh();
    } else {
      toast.error("Failed to save contact");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Basic info</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name *</Label>
            <Input id="firstName" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input id="nickname" value={form.nickname} onChange={(e) => set("nickname", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="birthday">Birthday</Label>
            <Input id="birthday" type="date" value={form.birthday} onChange={(e) => set("birthday", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input id="company" value={form.company} onChange={(e) => set("company", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job title</Label>
            <Input id="jobTitle" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Emails */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base">Email addresses</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={addEmail}>
            <Plus className="h-4 w-4 mr-1" />Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.emails.length === 0 && <p className="text-sm text-muted-foreground">No emails added.</p>}
          {form.emails.map((email, i) => (
            <div key={i} className="flex gap-2">
              <Select value={email.label} onValueChange={(v) => updateEmail(i, "label", v ?? email.label)}>
                <SelectTrigger className="w-28 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>{EMAIL_LABELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="email@example.com" value={email.value} onChange={(e) => updateEmail(i, "value", e.target.value)} className="flex-1" />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeEmail(i)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Phones */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base">Phone numbers</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={addPhone}>
            <Plus className="h-4 w-4 mr-1" />Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.phones.length === 0 && <p className="text-sm text-muted-foreground">No phones added.</p>}
          {form.phones.map((phone, i) => (
            <div key={i} className="flex gap-2">
              <Select value={phone.label} onValueChange={(v) => updatePhone(i, "label", v ?? phone.label)}>
                <SelectTrigger className="w-28 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>{PHONE_LABELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="+1 555 000 0000" value={phone.value} onChange={(e) => updatePhone(i, "value", e.target.value)} className="flex-1" />
              <Button type="button" variant="ghost" size="icon" onClick={() => removePhone(i)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Addresses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base">Addresses</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={addAddress}>
            <Plus className="h-4 w-4 mr-1" />Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.addresses.length === 0 && <p className="text-sm text-muted-foreground">No addresses added.</p>}
          {form.addresses.map((addr, i) => (
            <div key={i} className="space-y-2 border rounded-md p-3 relative">
              <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => removeAddress(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
              <Select value={addr.label} onValueChange={(v) => updateAddress(i, "label", v ?? addr.label)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{ADDRESS_LABELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Street" value={addr.street} onChange={(e) => updateAddress(i, "street", e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="City" value={addr.city} onChange={(e) => updateAddress(i, "city", e.target.value)} />
                <Input placeholder="State / Province" value={addr.state} onChange={(e) => updateAddress(i, "state", e.target.value)} />
                <Input placeholder="ZIP / Postal code" value={addr.zip} onChange={(e) => updateAddress(i, "zip", e.target.value)} />
                <Input placeholder="Country" value={addr.country} onChange={(e) => updateAddress(i, "country", e.target.value)} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tags</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <Badge
                key={tag.id}
                variant={form.tagIds.includes(tag.id) ? "default" : "outline"}
                className="cursor-pointer select-none"
                onClick={() => toggleTag(tag.id)}
                style={tag.color && !form.tagIds.includes(tag.id) ? { borderColor: tag.color, color: tag.color } : {}}
              >
                {tag.name}
                {form.tagIds.includes(tag.id) && <X className="h-3 w-3 ml-1" />}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="New tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createTag(); } }}
              className="max-w-48"
            />
            <Button type="button" variant="outline" size="sm" onClick={createTag}>Create tag</Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            placeholder="Any notes about this person…"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : contactId ? "Save changes" : "Create contact"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
