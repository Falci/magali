// Pure transformation functions for Monica HQ import.
// Kept separate so they can be unit-tested without a database.

export type MonicaContactField = {
  value: string;
  contact_field_type: { type: string; name: string };
};

export type MonicaAddress = {
  name: string;
  street: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: { iso: string; name: string } | null;
};

export type MonicaTag = { id: number; name: string };

export type MonicaBirthdate = {
  is_age_based: boolean | null;
  is_year_unknown: boolean | null;
  date: string | null;
};

export type MonicaContact = {
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
  contact_fields?: MonicaContactField[];
  addresses?: MonicaAddress[];
  tags?: MonicaTag[];
};

export type MonicaRelationship = {
  id: number;
  relationship_type: { name: string };
  of_contact: { id: number; first_name: string; last_name: string | null };
};

export type ParsedBirthday = {
  day: number | null;
  month: number | null;
  year: number | null;
};

export type TransformedContact = {
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  company: string | null;
  jobTitle: string | null;
  notes: string | null;
  birthdayDay: number | null;
  birthdayMonth: number | null;
  birthdayYear: number | null;
  emails: { label: string; value: string }[];
  phones: { label: string; value: string }[];
  addresses: {
    label: string;
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
  }[];
  tagNames: string[];
};

export function parseBirthday(b: MonicaBirthdate | null): ParsedBirthday {
  if (!b || !b.date) return { day: null, month: null, year: null };
  const d = new Date(b.date);
  return {
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: b.is_year_unknown ? null : d.getUTCFullYear(),
  };
}

export function transformContact(c: MonicaContact): TransformedContact {
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

  return {
    firstName: c.first_name,
    lastName: c.last_name ?? null,
    nickname: c.nickname ?? null,
    company: c.information.career.company ?? null,
    jobTitle: c.information.career.job ?? null,
    notes: c.description ?? null,
    birthdayDay: day,
    birthdayMonth: month,
    birthdayYear: year,
    emails,
    phones,
    addresses,
    tagNames: (c.tags ?? []).map((t) => t.name),
  };
}
