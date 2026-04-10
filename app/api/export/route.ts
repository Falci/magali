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
  Event,
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

type EventFull = Event & { contact: Contact | null };

// ── YAML helpers ──────────────────────────────────────────────────────────────

function yamlStr(s: string): string {
  if (
    /[:#\[\]{}&*!|>'"%@`,]/.test(s) ||
    s.startsWith(" ") ||
    s.endsWith(" ") ||
    s.includes("\n") ||
    s === ""
  ) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  }
  return s;
}

// ── Contact → Markdown ────────────────────────────────────────────────────────

function contactToMarkdown(c: ContactFull): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");

  let yaml = `uid: ${c.uid}\n`;
  yaml += `firstName: ${yamlStr(c.firstName)}\n`;
  if (c.lastName) yaml += `lastName: ${yamlStr(c.lastName)}\n`;
  if (c.nickname) yaml += `nickname: ${yamlStr(c.nickname)}\n`;
  if (c.jobTitle) yaml += `jobTitle: ${yamlStr(c.jobTitle)}\n`;
  if (c.gender) yaml += `gender: ${c.gender}\n`;
  if (c.birthdayDay !== null) yaml += `birthdayDay: ${c.birthdayDay}\n`;
  if (c.birthdayMonth !== null) yaml += `birthdayMonth: ${c.birthdayMonth}\n`;
  if (c.birthdayYear !== null) yaml += `birthdayYear: ${c.birthdayYear}\n`;
  if (c.staleDays !== null) yaml += `staleDays: ${c.staleDays}\n`;

  if (c.tags.length > 0) {
    yaml += `tags:\n${c.tags.map((ct) => `  - ${yamlStr(ct.tag.name)}`).join("\n")}\n`;
  }
  if (c.emails.length > 0) {
    yaml += `emails:\n`;
    for (const e of c.emails) {
      yaml += `  - label: ${e.label}\n    value: ${yamlStr(e.value)}\n`;
    }
  }
  if (c.phones.length > 0) {
    yaml += `phones:\n`;
    for (const p of c.phones) {
      yaml += `  - label: ${p.label}\n    value: ${yamlStr(p.value)}\n`;
    }
  }
  if (c.addresses.length > 0) {
    yaml += `addresses:\n`;
    for (const a of c.addresses) {
      yaml += `  - label: ${a.label}\n`;
      if (a.street) yaml += `    street: ${yamlStr(a.street)}\n`;
      if (a.city) yaml += `    city: ${yamlStr(a.city)}\n`;
      if (a.state) yaml += `    state: ${yamlStr(a.state)}\n`;
      if (a.zip) yaml += `    zip: ${yamlStr(a.zip)}\n`;
      if (a.country) yaml += `    country: ${yamlStr(a.country)}\n`;
    }
  }
  yaml += `createdAt: ${c.createdAt.toISOString()}\n`;
  yaml += `updatedAt: ${c.updatedAt.toISOString()}\n`;

  let md = `---\n${yaml}---\n\n# ${name}\n`;

  if (c.notes) {
    md += `\n## Notes\n\n${c.notes}\n`;
  }

  if (c.interactions.length > 0) {
    md += `\n## Interactions\n\n`;
    for (const i of c.interactions) {
      const date = i.date.toISOString().slice(0, 10);
      const time = i.time ? ` ${i.time}` : "";
      const notes = i.notes ? `: ${i.notes}` : "";
      md += `- ${date}${time} (${i.type})${notes}\n`;
    }
  }

  const rels = [
    ...c.relationshipsFrom.map((r) => ({
      name: [r.to.firstName, r.to.lastName].filter(Boolean).join(" "),
      type: r.type,
      notes: r.notes,
    })),
    ...c.relationshipsTo.map((r) => ({
      name: [r.from.firstName, r.from.lastName].filter(Boolean).join(" "),
      type: r.type,
      notes: r.notes,
    })),
  ];
  if (rels.length > 0) {
    md += `\n## Relationships\n\n`;
    for (const r of rels) {
      const n = r.notes ? ` — ${r.notes}` : "";
      md += `- [[${r.name}]] (${r.type})${n}\n`;
    }
  }

  return md;
}

// ── Contact → JSON (machine-readable, used for import) ───────────────────────

function contactToJson(c: ContactFull) {
  return {
    uid: c.uid,
    firstName: c.firstName,
    lastName: c.lastName,
    nickname: c.nickname,
    jobTitle: c.jobTitle,
    gender: c.gender,
    notes: c.notes,
    photo: c.photo,
    birthdayDay: c.birthdayDay,
    birthdayMonth: c.birthdayMonth,
    birthdayYear: c.birthdayYear,
    staleDays: c.staleDays,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    emails: c.emails.map((e) => ({ label: e.label, value: e.value })),
    phones: c.phones.map((p) => ({ label: p.label, value: p.value })),
    addresses: c.addresses.map((a) => ({
      label: a.label,
      street: a.street,
      city: a.city,
      state: a.state,
      zip: a.zip,
      country: a.country,
    })),
    tags: c.tags.map((ct) => ct.tag.name),
    interactions: c.interactions.map((i) => ({
      date: i.date.toISOString(),
      time: i.time,
      type: i.type,
      notes: i.notes,
    })),
    relationships: c.relationshipsFrom.map((r) => ({
      toUid: r.to.uid,
      toName: [r.to.firstName, r.to.lastName].filter(Boolean).join(" "),
      type: r.type,
      notes: r.notes,
    })),
  };
}

// ── Event → Markdown ──────────────────────────────────────────────────────────

function eventToMarkdown(e: EventFull): string {
  const contactName = e.contact
    ? [e.contact.firstName, e.contact.lastName].filter(Boolean).join(" ")
    : null;

  let yaml = `uid: ${e.uid}\n`;
  yaml += `title: ${yamlStr(e.title)}\n`;
  yaml += `date: ${e.date.toISOString().slice(0, 10)}\n`;
  yaml += `type: ${e.type}\n`;
  if (e.recurring) yaml += `recurring: ${e.recurring}\n`;
  if (e.reminderDaysBefore !== null) yaml += `reminderDaysBefore: ${e.reminderDaysBefore}\n`;
  if (contactName) {
    yaml += `contact: ${yamlStr(contactName)}\n`;
    yaml += `contactUid: ${e.contact!.uid}\n`;
  }
  yaml += `createdAt: ${e.createdAt.toISOString()}\n`;

  let md = `---\n${yaml}---\n\n# ${e.title}\n`;
  if (e.notes) md += `\n## Notes\n\n${e.notes}\n`;
  if (contactName) md += `\n## Contact\n\n[[${contactName}]]\n`;
  return md;
}

// ── Event → JSON ──────────────────────────────────────────────────────────────

function eventToJson(e: EventFull) {
  return {
    uid: e.uid,
    title: e.title,
    date: e.date.toISOString(),
    type: e.type,
    notes: e.notes,
    recurring: e.recurring,
    reminderDaysBefore: e.reminderDaysBefore,
    contactUid: e.contact?.uid ?? null,
    contactName: e.contact
      ? [e.contact.firstName, e.contact.lastName].filter(Boolean).join(" ")
      : null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

// ── Tags → Markdown ───────────────────────────────────────────────────────────

function tagsToMarkdown(tags: Tag[]): string {
  let md = "# Tags\n\n";
  if (tags.length === 0) return md + "No tags.\n";
  md += "| Name | Color |\n|------|-------|\n";
  for (const t of tags) md += `| ${t.name} | ${t.color ?? ""} |\n`;
  return md;
}

// ── Route ─────────────────────────────────────────────────────────────────────

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

  const files: Record<string, Uint8Array> = {};

  // Human-readable markdown files (Obsidian-compatible)
  for (const c of contacts) {
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
    const safe = name.replace(/[/\\?%*:|"<>]/g, "-");
    files[`contacts/${safe}.md`] = strToU8(contactToMarkdown(c));
  }

  for (const e of events) {
    const safe = e.title.replace(/[/\\?%*:|"<>]/g, "-").trim();
    files[`events/${safe} (${e.uid.slice(0, 8)}).md`] = strToU8(eventToMarkdown(e));
  }

  files["tags.md"] = strToU8(tagsToMarkdown(tags));

  // Machine-readable JSON (used by CRM import)
  files["data/contacts.json"] = strToU8(JSON.stringify(contacts.map(contactToJson), null, 2));
  files["data/events.json"] = strToU8(JSON.stringify(events.map(eventToJson), null, 2));
  files["data/tags.json"] = strToU8(JSON.stringify(tags, null, 2));

  if (includeSettings && settings) {
    files["settings.json"] = strToU8(JSON.stringify(settings, null, 2));
    files["data/settings.json"] = strToU8(JSON.stringify(settings, null, 2));
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
