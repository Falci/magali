import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { unzipSync, strFromU8 } from "fflate";

type ContactJson = {
  uid: string;
  firstName: string;
  lastName?: string | null;
  nickname?: string | null;
  jobTitle?: string | null;
  gender?: string | null;
  notes?: string | null;
  photo?: string | null;
  birthdayDay?: number | null;
  birthdayMonth?: number | null;
  birthdayYear?: number | null;
  staleDays?: number | null;
  emails?: { label: string; value: string }[];
  phones?: { label: string; value: string }[];
  addresses?: {
    label: string;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
  }[];
  tags?: string[];
  interactions?: { date: string; time?: string | null; type: string; notes?: string | null }[];
  relationships?: { toUid: string; toName: string; type: string; notes?: string | null }[];
};

type EventJson = {
  uid: string;
  title: string;
  date: string;
  type: string;
  notes?: string | null;
  recurring?: string | null;
  reminderDaysBefore?: number | null;
  contactUid?: string | null;
};

type TagJson = {
  id: string;
  name: string;
  color?: string | null;
};

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const buffer = await file.arrayBuffer();

  let zipped: Record<string, Uint8Array>;
  try {
    zipped = unzipSync(new Uint8Array(buffer));
  } catch {
    return NextResponse.json({ error: "Invalid ZIP file" }, { status: 400 });
  }

  const contactsRaw = zipped["data/contacts.json"];
  if (!contactsRaw) {
    return NextResponse.json(
      { error: "Not a valid CRM export: missing data/contacts.json" },
      { status: 400 },
    );
  }

  let contacts: ContactJson[];
  let events: EventJson[];
  let tags: TagJson[];

  try {
    contacts = JSON.parse(strFromU8(contactsRaw));
    events = zipped["data/events.json"] ? JSON.parse(strFromU8(zipped["data/events.json"])) : [];
    tags = zipped["data/tags.json"] ? JSON.parse(strFromU8(zipped["data/tags.json"])) : [];
  } catch {
    return NextResponse.json({ error: "Corrupted data files in ZIP" }, { status: 400 });
  }

  const errors: string[] = [];

  // ── 1. Upsert all tags ────────────────────────────────────────────────────
  const tagMap: Record<string, string> = {}; // name → db id
  for (const tag of tags) {
    try {
      const upserted = await prisma.tag.upsert({
        where: { name: tag.name },
        create: { name: tag.name, color: tag.color ?? null },
        update: {},
      });
      tagMap[tag.name] = upserted.id;
    } catch (e) {
      errors.push(`Tag "${tag.name}": ${e}`);
    }
  }

  // ── 2. Import contacts ────────────────────────────────────────────────────
  let imported = 0;
  let skipped = 0;
  const uidMap: Record<string, string> = {}; // exported uid → db id

  for (const c of contacts) {
    try {
      const existing = await prisma.contact.findUnique({ where: { uid: c.uid } });
      if (existing) {
        uidMap[c.uid] = existing.id;
        skipped++;
        continue;
      }

      // Ensure inline tags exist
      for (const name of c.tags ?? []) {
        if (!tagMap[name]) {
          const upserted = await prisma.tag.upsert({
            where: { name },
            create: { name },
            update: {},
          });
          tagMap[name] = upserted.id;
        }
      }

      const created = await prisma.contact.create({
        data: {
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
          emails: { create: (c.emails ?? []).map((e) => ({ label: e.label, value: e.value })) },
          phones: { create: (c.phones ?? []).map((p) => ({ label: p.label, value: p.value })) },
          addresses: {
            create: (c.addresses ?? []).map((a) => ({
              label: a.label,
              street: a.street ?? null,
              city: a.city ?? null,
              state: a.state ?? null,
              zip: a.zip ?? null,
              country: a.country ?? null,
            })),
          },
          tags: {
            create: (c.tags ?? []).map((name) => ({ tagId: tagMap[name] })),
          },
          interactions: {
            create: (c.interactions ?? []).map((i) => ({
              date: new Date(i.date),
              time: i.time ?? null,
              type: i.type,
              notes: i.notes ?? null,
            })),
          },
        },
      });

      uidMap[c.uid] = created.id;
      imported++;
    } catch (e) {
      errors.push(`Contact "${c.firstName} ${c.lastName ?? ""}": ${e}`);
    }
  }

  // ── 3. Import relationships ───────────────────────────────────────────────
  let relImported = 0;
  let relSkipped = 0;

  for (const c of contacts) {
    const fromId = uidMap[c.uid];
    if (!fromId) continue;

    for (const rel of c.relationships ?? []) {
      const toId = uidMap[rel.toUid];
      if (!toId) {
        relSkipped++;
        continue;
      }
      try {
        await prisma.relationship.upsert({
          where: { fromId_toId: { fromId, toId } },
          create: { fromId, toId, type: rel.type, notes: rel.notes ?? null },
          update: {},
        });
        relImported++;
      } catch {
        relSkipped++;
      }
    }
  }

  // ── 4. Import events ──────────────────────────────────────────────────────
  let evImported = 0;
  let evSkipped = 0;

  for (const e of events) {
    try {
      const existing = await prisma.event.findUnique({ where: { uid: e.uid } });
      if (existing) {
        evSkipped++;
        continue;
      }

      const contactId = e.contactUid ? (uidMap[e.contactUid] ?? null) : null;

      await prisma.event.create({
        data: {
          uid: e.uid,
          title: e.title,
          date: new Date(e.date),
          type: e.type,
          notes: e.notes ?? null,
          recurring: e.recurring ?? null,
          reminderDaysBefore: e.reminderDaysBefore ?? null,
          contactId,
        },
      });
      evImported++;
    } catch (e2) {
      errors.push(`Event "${(e as EventJson).title}": ${e2}`);
    }
  }

  return NextResponse.json({ imported, skipped, relImported, relSkipped, evImported, evSkipped, errors });
}
