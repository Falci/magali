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

  const DEFAULT_EMAIL_LABELS = ["home", "work", "other"];
  const DEFAULT_PHONE_LABELS = ["mobile", "home", "work", "other"];
  const DEFAULT_ADDRESS_LABELS = ["home", "work", "other"];

  function mergeLabels(defaults: string[], existing: { label: string }[]) {
    const set = new Set(defaults);
    for (const { label } of existing) set.add(label);
    return Array.from(set);
  }

  const [contact, allTags, emailLabels, phoneLabels, addressLabels, settings] = await Promise.all([
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
    prisma.contactEmail.findMany({ select: { label: true }, distinct: ["label"] }),
    prisma.contactPhone.findMany({ select: { label: true }, distinct: ["label"] }),
    prisma.contactAddress.findMany({ select: { label: true }, distinct: ["label"] }),
    prisma.settings.findUnique({ where: { id: "singleton" }, select: { staleDays: true } }),
  ]);

  if (!contact) notFound();

  const initialData = {
    firstName: contact.firstName,
    lastName: contact.lastName ?? "",
    nickname: contact.nickname ?? "",
    company: contact.company ?? "",
    jobTitle: contact.jobTitle ?? "",
    birthdayMonth: contact.birthdayMonth ? String(contact.birthdayMonth) : "",
    birthdayDay: contact.birthdayDay ? String(contact.birthdayDay) : "",
    birthdayYear: contact.birthdayYear ? String(contact.birthdayYear) : "",
    staleDays: contact.staleDays ? String(contact.staleDays) : "",
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
        emailLabels={mergeLabels(DEFAULT_EMAIL_LABELS, emailLabels)}
        phoneLabels={mergeLabels(DEFAULT_PHONE_LABELS, phoneLabels)}
        addressLabels={mergeLabels(DEFAULT_ADDRESS_LABELS, addressLabels)}
        globalStaleDays={settings?.staleDays ?? 90}
      />
    </div>
  );
}
