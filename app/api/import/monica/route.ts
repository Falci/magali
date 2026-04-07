import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

// Monica API field types
type MonicaContactField = { value: string; contact_field_type: { type: string; name: string } };
type MonicaAddress = {
  name: string;
  street: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: { iso: string; name: string } | null;
};
type MonicaTag = { id: number; name: string };
type MonicaBirthdate = {
  is_age_based: boolean;
  is_year_unknown: boolean;
  date: string | null;
  age: number | null;
};
type MonicaContact = {
  id: number;
  is_partial: boolean;
  first_name: string;
  last_name: string | null;
  nickname: string | null;
  description: string | null;
  information: {
    dates: { birthdate: MonicaBirthdate };
    career: { job: string | null; company: string | null };
  };
  contact_fields: MonicaContactField[];
  addresses: MonicaAddress[];
  tags: MonicaTag[];
};
type MonicaRelationship = {
  id: number;
  relationship_type: { name: string };
  of_contact: { id: number; first_name: string; last_name: string | null };
};

async function fetchAllMonicaContacts(base: string, token: string): Promise<MonicaContact[]> {
  const all: MonicaContact[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${base}/api/contacts?limit=100&page=${page}&with=addresses,contact_fields,tags`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Monica API error ${res.status}: ${await res.text()}`);
    const json = await res.json();
    all.push(...(json.data ?? []));
    if (!json.meta?.current_page || json.meta.current_page >= json.meta.last_page) break;
    page++;
  }
  return all;
}

async function fetchRelationships(base: string, token: string, contactId: number): Promise<MonicaRelationship[]> {
  const res = await fetch(`${base}/api/contacts/${contactId}/relationships`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

function parseBirthday(b: MonicaBirthdate | null): { day: number | null; month: number | null; year: number | null } {
  if (!b || !b.date) return { day: null, month: null, year: null };
  const d = new Date(b.date);
  return {
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: b.is_year_unknown ? null : d.getUTCFullYear(),
  };
}

function sse(event: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { domain, token } = await req.json();
  if (!domain || !token) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "domain and token are required" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const base = domain.replace(/\/$/, "");

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(sse(event));

      try {
        send({ type: "status", message: "Connecting to Monica…" });

        let monicaContacts: MonicaContact[];
        try {
          monicaContacts = await fetchAllMonicaContacts(base, token);
        } catch (err: unknown) {
          send({ type: "error", message: err instanceof Error ? err.message : String(err) });
          controller.close();
          return;
        }

        const fullContacts = monicaContacts.filter((c) => !c.is_partial);
        const total = fullContacts.length;
        send({ type: "status", message: `Found ${monicaContacts.length} contacts (${total} to import, ${monicaContacts.length - total} partial skipped)…` });

        // Phase 1: import contacts, track monicaId → localId
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];
        const monicaToLocal = new Map<number, string>(); // monicaId → local cuid

        for (let i = 0; i < fullContacts.length; i++) {
          const c = fullContacts[i];
          const name = `${c.first_name}${c.last_name ? " " + c.last_name : ""}`;
          send({ type: "progress", current: i + 1, total, phase: "contacts", name });

          try {
            const { day, month, year } = parseBirthday(c.information.dates.birthdate);

            const emails = (c.contact_fields ?? [])
              .filter((f) => f.contact_field_type.type === "email")
              .map((f) => ({ label: "home", value: f.value }));

            const phones = (c.contact_fields ?? [])
              .filter((f) => f.contact_field_type.type === "phone")
              .map((f) => ({ label: "mobile", value: f.value }));

            const addresses = (c.addresses ?? []).map((a) => ({
              label: a.name || "home",
              street: a.street ?? null,
              city: a.city ?? null,
              state: a.province ?? null,
              zip: a.postal_code ?? null,
              country: a.country?.name ?? null,
            }));

            const tagIds: string[] = [];
            for (const t of (c.tags ?? [])) {
              const tag = await prisma.tag.upsert({
                where: { name: t.name },
                create: { name: t.name },
                update: {},
              });
              tagIds.push(tag.id);
            }

            const created = await prisma.contact.create({
              data: {
                firstName: c.first_name,
                lastName: c.last_name ?? null,
                nickname: c.nickname ?? null,
                company: c.information.career.company ?? null,
                jobTitle: c.information.career.job ?? null,
                notes: c.description ?? null,
                birthdayDay: day,
                birthdayMonth: month,
                birthdayYear: year,
                emails: emails.length ? { create: emails } : undefined,
                phones: phones.length ? { create: phones } : undefined,
                addresses: addresses.length ? { create: addresses } : undefined,
                tags: tagIds.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
              },
            });

            monicaToLocal.set(c.id, created.id);
            imported++;
          } catch (err: unknown) {
            errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
            skipped++;
          }
        }

        // Phase 2: import relationships
        send({ type: "status", message: `Contacts done. Importing relationships for ${monicaToLocal.size} contacts…` });

        let relImported = 0;
        let relSkipped = 0;
        const createdPairs = new Set<string>();
        let relDone = 0;

        for (const [monicaId, localId] of monicaToLocal) {
          relDone++;
          send({ type: "progress", current: relDone, total: monicaToLocal.size, phase: "relationships", name: "" });

          const rels = await fetchRelationships(base, token, monicaId);
          for (const rel of rels) {
            const relatedLocalId = monicaToLocal.get(rel.of_contact.id);
            if (!relatedLocalId) { relSkipped++; continue; } // related contact was partial / not imported

            // Deduplicate: skip if we've already created this pair (either direction)
            const pairKey = [localId, relatedLocalId].sort().join(":");
            if (createdPairs.has(pairKey)) continue;
            createdPairs.add(pairKey);

            try {
              await prisma.relationship.create({
                data: {
                  fromId: localId,
                  toId: relatedLocalId,
                  type: rel.relationship_type.name,
                },
              });
              relImported++;
            } catch {
              relSkipped++;
            }
          }
        }

        send({
          type: "done",
          imported,
          skipped,
          relImported,
          relSkipped,
          errors,
        });
      } catch (err: unknown) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
