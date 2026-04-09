import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import ContactForm from "@/components/contacts/contact-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const [contact, allTags, fieldLabels, settings] = await Promise.all([
    prisma.contact.findUnique({
      where: { id },
      include: {
        emails: true,
        phones: true,
        addresses: true,
        tags: { include: { tag: true } },
      },
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.fieldLabel.findMany({ orderBy: [{ field: "asc" }, { label: "asc" }] }),
    prisma.settings.findUnique({ where: { id: "singleton" }, select: { staleDays: true, dateFormat: true } }),
  ]);

  function groupLabels(rows: { field: string; label: string }[], contact: { emails: { label: string }[]; phones: { label: string }[]; addresses: { label: string }[] } | null) {
    const email = new Set(["home", "work", "other"]);
    const phone = new Set(["mobile", "home", "work", "other"]);
    const address = new Set(["home", "work", "other"]);
    for (const { field, label } of rows) {
      if (field === "email") email.add(label);
      else if (field === "phone") phone.add(label);
      else if (field === "address") address.add(label);
    }
    // Also include any labels already used on this contact
    for (const e of contact?.emails ?? []) email.add(e.label);
    for (const p of contact?.phones ?? []) phone.add(p.label);
    for (const a of contact?.addresses ?? []) address.add(a.label);
    return { email: Array.from(email), phone: Array.from(phone), address: Array.from(address) };
  }

  const labels = groupLabels(fieldLabels, contact);

  if (!contact) notFound();

  const initialData = {
    firstName: contact.firstName,
    lastName: contact.lastName ?? "",
    nickname: contact.nickname ?? "",
    jobTitle: contact.jobTitle ?? "",
    birthdayMonth: contact.birthdayMonth ? String(contact.birthdayMonth) : "",
    birthdayDay: contact.birthdayDay ? String(contact.birthdayDay) : "",
    birthdayYear: contact.birthdayYear ? String(contact.birthdayYear) : "",
    staleDays: contact.staleDays === 0 ? "0" : contact.staleDays ? String(contact.staleDays) : "",
    notes: contact.notes ?? "",
    emails: contact.emails.map((e: { label: string; value: string }) => ({ label: e.label, value: e.value })),
    phones: contact.phones.map((p: { label: string; value: string }) => ({ label: p.label, value: p.value })),
    addresses: contact.addresses.map((a: { label: string; street: string | null; city: string | null; state: string | null; zip: string | null; country: string | null }) => ({
      label: a.label,
      street: a.street ?? "",
      city: a.city ?? "",
      state: a.state ?? "",
      zip: a.zip ?? "",
      country: a.country ?? "",
    })),
    tagIds: contact.tags.map((t: { tagId: string }) => t.tagId),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<Link href={`/contacts/${id}`} />}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Edit contact</h1>
      </div>
      <ContactForm
        initialData={initialData}
        contactId={id}
        allTags={allTags}
        emailLabels={labels.email}
        phoneLabels={labels.phone}
        addressLabels={labels.address}
        globalStaleDays={settings?.staleDays ?? 90}
        dateFormat={settings?.dateFormat ?? "MMM d, yyyy"}
      />
    </div>
  );
}
