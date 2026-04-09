import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import NotificationsSettingsClient from "./notifications-client";

export default async function NotificationsSettingsPage() {
  await requireSession();

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });

  return <NotificationsSettingsClient initialSettings={settings ?? null} />;
}
