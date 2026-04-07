import { NextRequest, NextResponse } from "next/server";
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
  date: string | null; // ISO 8601
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
    dates: {
      birthdate: MonicaBirthdate;
    };
    career: {
      job: string | null;
      company: string | null;
    };
  };
  contact_fields: MonicaContactField[];
  addresses: MonicaAddress[];
  tags: MonicaTag[];
};

async function fetchAllMonicaContacts(domain: string, token: string): Promise<MonicaContact[]> {
  const base = domain.replace(/\/$/, "");
  const all: MonicaContact[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(`${base}/api/contacts?limit=100&page=${page}&with=addresses,contact_fields,tags`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Monica API error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const contacts: MonicaContact[] = json.data ?? [];
    all.push(...contacts);

    if (!json.meta?.current_page || json.meta.current_page >= json.meta.last_page) break;
    page++;
  }

  return all;
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

export async function POST(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { domain, token } = await req.json();
  if (!domain || !token) {
    return NextResponse.json({ error: "domain and token are required" }, { status: 400 });
  }

  let monicaContacts: MonicaContact[];
  try {
    monicaContacts = await fetchAllMonicaContacts(domain, token);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to fetch from Monica: ${message}` }, { status: 502 });
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const c of monicaContacts) {
    // Skip partial contacts — they are relationship sub-contacts, not standalone people
    if (c.is_partial) {
      skipped++;
      continue;
    }

    try {
      const { day, month, year } = parseBirthday(c.information.dates.birthdate);

      // Separate contact fields by type
      const emails = c.contact_fields
        .filter((f) => f.contact_field_type.type === "email")
        .map((f) => ({ label: "home", value: f.value }));

      const phones = c.contact_fields
        .filter((f) => f.contact_field_type.type === "phone")
        .map((f) => ({ label: "mobile", value: f.value }));

      const addresses = c.addresses.map((a) => ({
        label: a.name || "home",
        street: a.street ?? null,
        city: a.city ?? null,
        state: a.province ?? null,
        zip: a.postal_code ?? null,
        country: a.country?.name ?? null,
      }));

      // Upsert tags
      const tagIds: string[] = [];
      for (const t of c.tags) {
        const tag = await prisma.tag.upsert({
          where: { name: t.name },
          create: { name: t.name },
          update: {},
        });
        tagIds.push(tag.id);
      }

      await prisma.contact.create({
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

      imported++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${c.first_name} ${c.last_name ?? ""}: ${message}`);
      skipped++;
    }
  }

  return NextResponse.json({ imported, skipped, errors });
}
