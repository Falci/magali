import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import GraphClient from "./graph-client";

export default async function GraphPage() {
  await requireSession();

  const [contacts, companies, relationships, tags] = await Promise.all([
    prisma.contact.findMany({
      select: {
        id: true, firstName: true, lastName: true, staleDays: true,
        companyId: true,
        tags: { select: { tagId: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.relationship.findMany({
      select: { id: true, fromId: true, toId: true, type: true },
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
  ]);

  return <GraphClient contacts={contacts} companies={companies} relationships={relationships} tags={tags} />;
}
