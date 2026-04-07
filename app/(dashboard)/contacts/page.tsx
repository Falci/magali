import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import ContactsClient from "./contacts-client";

export default async function ContactsPage() {
  await requireSession();

  const [contacts, tags] = await Promise.all([
    prisma.contact.findMany({
      include: {
        emails: true,
        phones: true,
        tags: { include: { tag: true } },
        _count: { select: { interactions: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);

  return <ContactsClient initialContacts={contacts} tags={tags} />;
}
