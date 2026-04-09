import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import FieldTypesSettingsClient from "./field-types-client";

const DEFAULT_FIELD_LABELS = [
  { field: "email", label: "home" },
  { field: "email", label: "work" },
  { field: "email", label: "other" },
  { field: "phone", label: "mobile" },
  { field: "phone", label: "home" },
  { field: "phone", label: "work" },
  { field: "phone", label: "other" },
  { field: "address", label: "home" },
  { field: "address", label: "work" },
  { field: "address", label: "other" },
];

export default async function FieldTypesSettingsPage() {
  await requireSession();

  // Seed defaults if none exist yet
  await prisma.fieldLabel.createMany({
    data: DEFAULT_FIELD_LABELS,
    skipDuplicates: true,
  });

  const fieldLabels = await prisma.fieldLabel.findMany({
    orderBy: [{ field: "asc" }, { label: "asc" }],
  });

  return <FieldTypesSettingsClient initialFieldLabels={fieldLabels} />;
}
