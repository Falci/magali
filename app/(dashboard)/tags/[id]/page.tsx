import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import TagDetailClient from "./tag-detail-client";

export default async function TagDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const tag = await prisma.tag.findUnique({
    where: { id },
    include: {
      contacts: {
        include: {
          contact: {
            select: {
              id: true, firstName: true, lastName: true, nickname: true,
              photo: true,
              emails: { select: { value: true }, take: 1 },
            },
          },
        },
        orderBy: { contact: { firstName: "asc" } },
      },
    },
  });

  if (!tag) notFound();

  const allTags = await prisma.tag.findMany({
    select: { id: true },
    orderBy: { name: "asc" },
  });

  return <TagDetailClient tag={tag} allTagIds={allTags.map((t) => t.id)} />;
}
