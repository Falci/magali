import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import ContactForm from "@/components/contacts/contact-form";

export default async function NewContactPage() {
  await requireSession();
  const allTags = await prisma.tag.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New contact</h1>
        <p className="text-sm text-muted-foreground">Add someone to your CRM</p>
      </div>
      <ContactForm allTags={allTags} />
    </div>
  );
}
