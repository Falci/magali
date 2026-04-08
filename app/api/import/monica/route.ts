import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";
import {
  parseBirthday,
  transformContact,
  type MonicaContact,
  type MonicaRelationship,
} from "@/lib/monica-import";

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

async function fetchRelationships(base: string, token: string, contactId: number): Promise<{ rels: MonicaRelationship[]; error: string | null }> {
  const res = await fetch(`${base}/api/contacts/${contactId}/relationships`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) return { rels: [], error: `HTTP ${res.status} for contact ${contactId}` };
  const json = await res.json();
  return { rels: json.data ?? [], error: null };
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
            const t = transformContact(c);

            const tagIds: string[] = [];
            for (const name of t.tagNames) {
              const tag = await prisma.tag.upsert({
                where: { name },
                create: { name },
                update: {},
              });
              tagIds.push(tag.id);
            }

            const created = await prisma.contact.create({
              data: {
                firstName: t.firstName,
                lastName: t.lastName,
                nickname: t.nickname,
                company: t.company,
                jobTitle: t.jobTitle,
                notes: t.notes,
                birthdayDay: t.birthdayDay,
                birthdayMonth: t.birthdayMonth,
                birthdayYear: t.birthdayYear,
                emails: t.emails.length ? { create: t.emails } : undefined,
                phones: t.phones.length ? { create: t.phones } : undefined,
                addresses: t.addresses.length ? { create: t.addresses } : undefined,
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

          const { rels, error: fetchError } = await fetchRelationships(base, token, monicaId);
          if (fetchError) {
            errors.push(`[relationships] contact monica_id=${monicaId}: ${fetchError}`);
            continue;
          }

          for (const rel of rels) {
            let relatedLocalId = monicaToLocal.get(rel.of_contact.id);
            if (!relatedLocalId) {
              // Related contact is partial or failed to import — create a minimal stub
              try {
                const stub = await prisma.contact.create({
                  data: {
                    firstName: rel.of_contact.first_name,
                    lastName: rel.of_contact.last_name ?? null,
                  },
                });
                monicaToLocal.set(rel.of_contact.id, stub.id);
                relatedLocalId = stub.id;
              } catch (err: unknown) {
                errors.push(`[stub] ${rel.of_contact.first_name} ${rel.of_contact.last_name ?? ""}: ${err instanceof Error ? err.message : String(err)}`);
                relSkipped++;
                continue;
              }
            }

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
            } catch (err: unknown) {
              errors.push(`[relationship] monica_id=${monicaId} → monica_id=${rel.of_contact.id} (${rel.relationship_type.name}): ${err instanceof Error ? err.message : String(err)}`);
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
