import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import DavSettingsClient from "./dav-client";

export default async function DavSettingsPage() {
  await requireSession();

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });

  return <DavSettingsClient davToken={settings?.davToken ?? null} />;
}
