import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import TagsSettingsClient from "./tags-client";

export default async function TagsSettingsPage() {
  await requireSession();

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true } } },
  });

  return <TagsSettingsClient initialTags={tags} />;
}
