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

// ── Minimal YAML frontmatter parser ──────────────────────────────────────────

function yamlScalar(s: string): unknown {
  if (s === "null" || s === "~" || s === "") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (s.startsWith('"') && s.endsWith('"')) {
    return s
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .replace(/\\n/g, "\n");
  }
  return s;
}

function parseFrontmatter(md: string): Record<string, unknown> {
  const match = md.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, unknown> = {};
  const lines = match[1].split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const topMatch = line.match(/^(\w+):\s*(.*)$/);
    if (!topMatch) { i++; continue; }
    const key = topMatch[1];
    const val = topMatch[2].trim();
    if (val === "") {
      // Block: list of scalars or list of maps
      const items: unknown[] = [];
      i++;
      while (i < lines.length && lines[i].startsWith("  ")) {
        const itemLine = lines[i];
        if (itemLine.startsWith("  - ")) {
          const rest = itemLine.slice(4).trim();
          const colonIdx = rest.indexOf(": ");
          if (colonIdx === -1) {
            // Simple list item
            items.push(yamlScalar(rest));
            i++;
          } else {
            // Map item — consume subsequent indented lines
            const item: Record<string, unknown> = {};
            item[rest.slice(0, colonIdx)] = yamlScalar(rest.slice(colonIdx + 2).trim());
            i++;
            while (i < lines.length && lines[i].startsWith("    ")) {
              const sub = lines[i].trim();
              const sc = sub.indexOf(": ");
              if (sc > -1) item[sub.slice(0, sc)] = yamlScalar(sub.slice(sc + 2).trim());
              i++;
            }
            items.push(item);
          }
        } else {
          i++;
        }
      }
      result[key] = items;
    } else {
      result[key] = yamlScalar(val);
      i++;
    }
  }
  return result;
}

// ── Parse interactions from markdown body ─────────────────────────────────────
// Format: `- YYYY-MM-DD[ HH:MM] (type)[: notes]`

function parseInteractions(
  md: string,
): { date: string; time: string | null; type: string; notes: string | null }[] {
  const section = md.match(/## Interactions\n\n([\s\S]*?)(?:\n## |\n*$)/);
  if (!section) return [];
  const lines = section[1].split("\n").filter((l) => l.startsWith("- "));
  return lines.flatMap((line) => {
    const m = line.match(
      /^- (\d{4}-\d{2}-\d{2})( \d{2}:\d{2})? \(([^)]+)\)(: (.*))?$/,
    );
    if (!m) return [];
    return [
      {
        date: m[1] + "T00:00:00.000Z",
        time: m[2]?.trim() ?? null,
        type: m[3],
        notes: m[5] ?? null,
      },
    ];
  });
}

// ── Parse a contact MD file into ContactJson ──────────────────────────────────

function contactFromMd(md: string): ContactJson | null {
  const fm = parseFrontmatter(md);
  if (!fm["uid"] || !fm["firstName"]) return null;
  return {
    uid: fm["uid"] as string,
    firstName: fm["firstName"] as string,
    lastName: (fm["lastName"] as string | null) ?? null,
    nickname: (fm["nickname"] as string | null) ?? null,
    jobTitle: (fm["jobTitle"] as string | null) ?? null,
    gender: (fm["gender"] as string | null) ?? null,
    birthdayDay: (fm["birthdayDay"] as number | null) ?? null,
    birthdayMonth: (fm["birthdayMonth"] as number | null) ?? null,
    birthdayYear: (fm["birthdayYear"] as number | null) ?? null,
    staleDays: (fm["staleDays"] as number | null) ?? null,
    notes: null, // notes live in the markdown body — skip for import simplicity
    photo: (fm["photo"] as string | null) ?? null,
    emails: ((fm["emails"] as Record<string, unknown>[] | null) ?? []).map((e) => ({
      label: (e["label"] as string) ?? "home",
      value: (e["value"] as string) ?? "",
    })),
    phones: ((fm["phones"] as Record<string, unknown>[] | null) ?? []).map((p) => ({
      label: (p["label"] as string) ?? "mobile",
      value: (p["value"] as string) ?? "",
    })),
    addresses: ((fm["addresses"] as Record<string, unknown>[] | null) ?? []).map((a) => ({
      label: (a["label"] as string) ?? "home",
      street: (a["street"] as string | null) ?? null,
      city: (a["city"] as string | null) ?? null,
      state: (a["state"] as string | null) ?? null,
      zip: (a["zip"] as string | null) ?? null,
      country: (a["country"] as string | null) ?? null,
    })),
    tags: ((fm["tags"] as string[] | null) ?? []),
    interactions: parseInteractions(md),
    relationships: [],
  };
}

// ── Parse an event MD file into EventJson ─────────────────────────────────────

function eventFromMd(md: string): EventJson | null {
  const fm = parseFrontmatter(md);
  if (!fm["uid"] || !fm["title"] || !fm["date"]) return null;
  return {
    uid: fm["uid"] as string,
    title: fm["title"] as string,
    date: (fm["date"] as string) + "T00:00:00.000Z",
    type: (fm["type"] as string) ?? "custom",
    notes: (fm["notes"] as string | null) ?? null,
    recurring: (fm["recurring"] as string | null) ?? null,
    reminderDaysBefore: (fm["reminderDaysBefore"] as number | null) ?? null,
    contactUid: (fm["contactUid"] as string | null) ?? null,
  };
}

// ── Parse tags.md table ───────────────────────────────────────────────────────

function tagsFromMd(md: string): TagJson[] {
  const rows = [...md.matchAll(/^\| ([^|]+) \| ([^|]*) \|$/gm)];
  const result: TagJson[] = [];
  for (const row of rows) {
    const name = row[1].trim();
    if (name === "Name") continue; // header row
    result.push({ id: "", name, color: row[2].trim() || null });
  }
  return result;
}

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

  let contacts: ContactJson[];
  let events: EventJson[];
  let tags: TagJson[];

  // Prefer MD-based parsing; fall back to legacy data/*.json for old exports
  const mdContactKeys = Object.keys(zipped).filter(
    (k) => k.startsWith("contacts/") && k.endsWith(".md"),
  );

  if (mdContactKeys.length > 0) {
    contacts = mdContactKeys
      .map((k) => contactFromMd(strFromU8(zipped[k])))
      .filter((c): c is ContactJson => c !== null);

    const mdEventKeys = Object.keys(zipped).filter(
      (k) => k.startsWith("events/") && k.endsWith(".md"),
    );
    events = mdEventKeys
      .map((k) => eventFromMd(strFromU8(zipped[k])))
      .filter((e): e is EventJson => e !== null);

    const tagsMdRaw = zipped["tags.md"];
    tags = tagsMdRaw ? tagsFromMd(strFromU8(tagsMdRaw)) : [];
  } else {
    // Legacy JSON-based import
    const contactsRaw = zipped["data/contacts.json"];
    if (!contactsRaw) {
      return NextResponse.json(
        { error: "Not a valid CRM export: no contacts found" },
        { status: 400 },
      );
    }
    try {
      contacts = JSON.parse(strFromU8(contactsRaw));
      events = zipped["data/events.json"] ? JSON.parse(strFromU8(zipped["data/events.json"])) : [];
      tags = zipped["data/tags.json"] ? JSON.parse(strFromU8(zipped["data/tags.json"])) : [];
    } catch {
      return NextResponse.json({ error: "Corrupted data files in ZIP" }, { status: 400 });
    }
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
