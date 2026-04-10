import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { zipSync, strToU8 } from "fflate";
import type {
  Contact,
  ContactEmail,
  ContactPhone,
  ContactAddress,
  ContactTag,
  Tag,
  Interaction,
  Relationship,
} from "@prisma/client";

type ContactFull = Contact & {
  emails: ContactEmail[];
  phones: ContactPhone[];
  addresses: ContactAddress[];
  tags: (ContactTag & { tag: Tag })[];
  interactions: Interaction[];
  relationshipsFrom: (Relationship & { to: Contact })[];
  relationshipsTo: (Relationship & { from: Contact })[];
};

export async function GET(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const includeSettings = url.searchParams.get("settings") === "true";

  const [contacts, events, tags, settings] = await Promise.all([
    prisma.contact.findMany({
      include: {
        emails: true,
        phones: true,
        addresses: true,
        tags: { include: { tag: true } },
        interactions: { orderBy: { date: "desc" } },
        relationshipsFrom: { include: { to: true } },
        relationshipsTo: { include: { from: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.event.findMany({
      include: { contact: true },
      orderBy: { date: "asc" },
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    includeSettings
      ? prisma.settings.findUnique({ where: { id: "singleton" } })
      : Promise.resolve(null),
  ]);

  const contactsJson = contacts.map((c: ContactFull) => ({
    uid: c.uid,
    firstName: c.firstName,
    lastName: c.lastName ?? null,
    nickname: c.nickname ?? null,
    jobTitle: c.jobTitle ?? null,
    gender: c.gender ?? null,
    notes: c.notes ?? null,
    photo: c.photo ?? null,
    birthdayDay: c.birthdayDay ?? null,
    birthdayMonth: c.birthdayMonth ?? null,
    birthdayYear: c.birthdayYear ?? null,
    staleDays: c.staleDays ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    emails: c.emails.map((e) => ({ label: e.label, value: e.value })),
    phones: c.phones.map((p) => ({ label: p.label, value: p.value })),
    addresses: c.addresses.map((a) => ({
      label: a.label,
      street: a.street ?? null,
      city: a.city ?? null,
      state: a.state ?? null,
      zip: a.zip ?? null,
      country: a.country ?? null,
    })),
    tags: c.tags.map((ct) => ct.tag.name),
    interactions: c.interactions.map((i) => ({
      date: i.date.toISOString(),
      time: i.time ?? null,
      type: i.type,
      notes: i.notes ?? null,
    })),
    relationships: [
      ...c.relationshipsFrom.map((r) => ({
        toUid: r.to.uid,
        toName: [r.to.firstName, r.to.lastName].filter(Boolean).join(" "),
        type: r.type,
        notes: r.notes ?? null,
      })),
    ],
  }));

  const eventsJson = events.map((e) => ({
    uid: e.uid,
    title: e.title,
    date: e.date.toISOString().slice(0, 10),
    type: e.type,
    notes: e.notes ?? null,
    recurring: e.recurring ?? null,
    reminderDaysBefore: e.reminderDaysBefore ?? null,
    contactUid: e.contact?.uid ?? null,
    createdAt: e.createdAt.toISOString(),
  }));

  const tagsJson = tags.map((t) => ({ name: t.name, color: t.color ?? null }));

  const files: Record<string, Uint8Array> = {
    "contacts.json": strToU8(JSON.stringify(contactsJson, null, 2)),
    "events.json": strToU8(JSON.stringify(eventsJson, null, 2)),
    "tags.json": strToU8(JSON.stringify(tagsJson, null, 2)),
  };

  if (includeSettings && settings) {
    files["settings.json"] = strToU8(JSON.stringify(settings, null, 2));
  }

  const zipped = zipSync(files, { level: 6 });
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(Buffer.from(zipped), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="crm-export-${date}.zip"`,
    },
  });
}
