import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import ContactsClient from "./contacts-client";

export default async function ContactsPage() {
  await requireSession();

  const [contacts, tags] = await Promise.all([
    prisma.contact.findMany({
      select: {
        id: true, firstName: true, lastName: true, nickname: true,
        company: true, photo: true, staleDays: true,
        emails: { select: { label: true, value: true } },
        phones: { select: { label: true, value: true } },
        tags: { select: { tag: true } },
        _count: { select: { interactions: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);

  return <ContactsClient initialContacts={contacts} tags={tags} />;
}
