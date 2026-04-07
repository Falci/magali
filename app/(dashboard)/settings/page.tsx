import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  await requireSession();
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  return <SettingsClient initialSettings={settings ?? null} />;
}
