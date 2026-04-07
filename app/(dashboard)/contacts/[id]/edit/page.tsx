import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import ContactForm from "@/components/contacts/contact-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const [contact, allTags] = await Promise.all([
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
  ]);

  if (!contact) notFound();

  const initialData = {
    firstName: contact.firstName,
    lastName: contact.lastName ?? "",
    nickname: contact.nickname ?? "",
    company: contact.company ?? "",
    jobTitle: contact.jobTitle ?? "",
    birthday: contact.birthday ? format(new Date(contact.birthday), "yyyy-MM-dd") : "",
    notes: contact.notes ?? "",
    emails: contact.emails.map((e) => ({ label: e.label, value: e.value })),
    phones: contact.phones.map((p) => ({ label: p.label, value: p.value })),
    addresses: contact.addresses.map((a) => ({
      label: a.label,
      street: a.street ?? "",
      city: a.city ?? "",
      state: a.state ?? "",
      zip: a.zip ?? "",
      country: a.country ?? "",
    })),
    tagIds: contact.tags.map((t) => t.tagId),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/contacts/${id}`}><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Edit contact</h1>
      </div>
      <ContactForm initialData={initialData} contactId={id} allTags={allTags} />
    </div>
  );
}
