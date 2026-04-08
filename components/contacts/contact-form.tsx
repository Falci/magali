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
import { LabelCombobox } from "@/components/contacts/label-combobox";

type MultiField = { label: string; value: string };
type Tag = { id: string; name: string; color: string | null };

type ContactFormData = {
  firstName: string;
  lastName: string;
  nickname: string;
  company: string;
  jobTitle: string;
  birthdayMonth: string; // "1"–"12" or ""
  birthdayDay: string;   // "1"–"31" or ""
  birthdayYear: string;  // 4-digit year or ""
  staleDays: string;     // number or "" (blank = use global default)
  notes: string;
  emails: MultiField[];
  phones: MultiField[];
  addresses: { label: string; street: string; city: string; state: string; zip: string; country: string }[];
  tagIds: string[];
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

const defaultForm = (): ContactFormData => ({
  firstName: "",
  lastName: "",
  nickname: "",
  company: "",
  jobTitle: "",
  birthdayMonth: "",
  birthdayDay: "",
  birthdayYear: "",
  staleDays: "",
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
  emailLabels = ["home", "work", "other"],
  phoneLabels = ["mobile", "home", "work", "other"],
  addressLabels = ["home", "work", "other"],
  globalStaleDays = 90,
}: {
  initialData?: Partial<ContactFormData>;
  contactId?: string;
  allTags: Tag[];
  emailLabels?: string[];
  phoneLabels?: string[];
  addressLabels?: string[];
  globalStaleDays?: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ContactFormData>({ ...defaultForm(), ...initialData });
  const [newTagName, setNewTagName] = useState("");

  function set(field: keyof ContactFormData, value: unknown) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function addEmail() { set("emails", [...form.emails, { label: "home", value: "" }]); }
  function updateEmail(i: number, field: keyof MultiField, value: string) {
    set("emails", form.emails.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  }
  function removeEmail(i: number) { set("emails", form.emails.filter((_, idx) => idx !== i)); }

  function addPhone() { set("phones", [...form.phones, { label: "mobile", value: "" }]); }
  function updatePhone(i: number, field: keyof MultiField, value: string) {
    set("phones", form.phones.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }
  function removePhone(i: number) { set("phones", form.phones.filter((_, idx) => idx !== i)); }

  function addAddress() {
    set("addresses", [...form.addresses, { label: "home", street: "", city: "", state: "", zip: "", country: "" }]);
  }
  function updateAddress(i: number, field: string, value: string) {
    set("addresses", form.addresses.map((a, idx) => idx === i ? { ...a, [field]: value } : a));
  }
  function removeAddress(i: number) { set("addresses", form.addresses.filter((_, idx) => idx !== i)); }

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
        birthdayMonth: form.birthdayMonth ? parseInt(form.birthdayMonth) : null,
        birthdayDay: form.birthdayDay ? parseInt(form.birthdayDay) : null,
        birthdayYear: form.birthdayYear ? parseInt(form.birthdayYear) : null,
        staleDays: form.staleDays ? parseInt(form.staleDays) : null,
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
            <Label htmlFor="company">Company</Label>
            <Input id="company" value={form.company} onChange={(e) => set("company", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job title</Label>
            <Input id="jobTitle" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
          </div>

          {/* Birthday — three independent optional selects */}
          <div className="space-y-2 col-span-2">
            <Label>Birthday <span className="text-muted-foreground font-normal text-xs">(all fields optional)</span></Label>
            <div className="grid grid-cols-3 gap-2">
              <Select value={form.birthdayMonth} onValueChange={(v) => set("birthdayMonth", v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Month —</SelectItem>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.birthdayDay} onValueChange={(v) => set("birthdayDay", v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Day —</SelectItem>
                  {DAYS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Year"
                value={form.birthdayYear}
                onChange={(e) => set("birthdayYear", e.target.value.replace(/\D/g, "").slice(0, 4))}
                maxLength={4}
              />
            </div>
            {(form.birthdayMonth || form.birthdayDay || form.birthdayYear) && (
              <p className="text-xs text-muted-foreground">
                Preview:{" "}
                {[
                  form.birthdayMonth ? MONTHS[parseInt(form.birthdayMonth) - 1] : null,
                  form.birthdayDay || null,
                  form.birthdayYear || null,
                ].filter(Boolean).join(" ")}
              </p>
            )}
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Stale contact reminder <span className="text-muted-foreground font-normal text-xs">(days without contact — leave blank for global default)</span></Label>
            <Input
              type="number"
              min={1}
              max={3650}
              placeholder={`Use global default: ${globalStaleDays} days`}
              value={form.staleDays}
              onChange={(e) => set("staleDays", e.target.value)}
            />
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
              <LabelCombobox
                value={email.label}
                onChange={(v) => updateEmail(i, "label", v)}
                suggestions={emailLabels}
              />
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
              <LabelCombobox
                value={phone.label}
                onChange={(v) => updatePhone(i, "label", v)}
                suggestions={phoneLabels}
              />
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
              <LabelCombobox
                value={addr.label}
                onChange={(v) => updateAddress(i, "label", v)}
                suggestions={addressLabels}
              />
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
