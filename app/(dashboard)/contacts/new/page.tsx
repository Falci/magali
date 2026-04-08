import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import ContactForm from "@/components/contacts/contact-form";

function groupLabels(rows: { field: string; label: string }[]) {
  const email = new Set(["home", "work", "other"]);
  const phone = new Set(["mobile", "home", "work", "other"]);
  const address = new Set(["home", "work", "other"]);
  for (const { field, label } of rows) {
    if (field === "email") email.add(label);
    else if (field === "phone") phone.add(label);
    else if (field === "address") address.add(label);
  }
  return { email: Array.from(email), phone: Array.from(phone), address: Array.from(address) };
}

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ firstName?: string; lastName?: string }>;
}) {
  await requireSession();
  const { firstName, lastName } = await searchParams;
  const [allTags, fieldLabels, settings, allCompanies] = await Promise.all([
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.fieldLabel.findMany({ orderBy: [{ field: "asc" }, { label: "asc" }] }),
    prisma.settings.findUnique({ where: { id: "singleton" }, select: { staleDays: true } }),
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const labels = groupLabels(fieldLabels);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New contact</h1>
        <p className="text-sm text-muted-foreground">Add someone to your CRM</p>
      </div>
      <ContactForm
        allTags={allTags}
        allCompanies={allCompanies}
        emailLabels={labels.email}
        phoneLabels={labels.phone}
        addressLabels={labels.address}
        globalStaleDays={settings?.staleDays ?? 90}
        initialData={{ firstName: firstName ?? "", lastName: lastName ?? "" }}
      />
    </div>
  );
}
