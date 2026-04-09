import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import GeneralSettingsClient from "./general-client";

export default async function GeneralSettingsPage() {
  await requireSession();

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });

  return <GeneralSettingsClient initialSettings={settings ?? null} />;
}
