import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import GraphClient from "./graph-client";

export default async function GraphPage() {
  await requireSession();

  const [contacts, relationships] = await Promise.all([
    prisma.contact.findMany({
      select: { id: true, firstName: true, lastName: true, staleDays: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.relationship.findMany({
      select: { id: true, fromId: true, toId: true, type: true },
    }),
  ]);

  return <GraphClient contacts={contacts} relationships={relationships} />;
}
