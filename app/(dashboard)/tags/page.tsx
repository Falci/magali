import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import TagsClient from "./tags-client";

export default async function TagsPage() {
  await requireSession();

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true } } },
  });

  return <TagsClient initialTags={tags} />;
}
