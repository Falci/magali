import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import ContactForm from "@/components/contacts/contact-form";

const DEFAULT_EMAIL_LABELS = ["home", "work", "other"];
const DEFAULT_PHONE_LABELS = ["mobile", "home", "work", "other"];
const DEFAULT_ADDRESS_LABELS = ["home", "work", "other"];

function mergeLabels(defaults: string[], existing: { label: string }[]) {
  const set = new Set(defaults);
  for (const { label } of existing) set.add(label);
  return Array.from(set);
}

export default async function NewContactPage() {
  await requireSession();
  const [allTags, emailLabels, phoneLabels, addressLabels, settings] = await Promise.all([
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.contactEmail.findMany({ select: { label: true }, distinct: ["label"] }),
    prisma.contactPhone.findMany({ select: { label: true }, distinct: ["label"] }),
    prisma.contactAddress.findMany({ select: { label: true }, distinct: ["label"] }),
    prisma.settings.findUnique({ where: { id: "singleton" }, select: { staleDays: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New contact</h1>
        <p className="text-sm text-muted-foreground">Add someone to your CRM</p>
      </div>
      <ContactForm
        allTags={allTags}
        emailLabels={mergeLabels(DEFAULT_EMAIL_LABELS, emailLabels)}
        phoneLabels={mergeLabels(DEFAULT_PHONE_LABELS, phoneLabels)}
        addressLabels={mergeLabels(DEFAULT_ADDRESS_LABELS, addressLabels)}
        globalStaleDays={settings?.staleDays ?? 90}
      />
    </div>
  );
}
