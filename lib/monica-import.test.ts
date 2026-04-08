import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseBirthday, transformContact } from "./monica-import.ts";
import type { MonicaContact, MonicaRelationship } from "./monica-import.ts";

// ── Real fixture data from https://monica.falci.me/api/contacts/1 ────────────

const LEO: MonicaContact = {
  id: 1,
  is_partial: false,
  first_name: "Leo",
  last_name: null,
  nickname: null,
  description: null,
  information: {
    dates: {
      birthdate: {
        is_age_based: false,
        is_year_unknown: true,
        date: "2024-10-20T00:00:00Z",
      },
    },
    career: { job: null, company: null },
  },
  // contact_fields intentionally absent — matches real API response
  addresses: [],
  tags: [
    {
      id: 1,
      name: "eDreams",
    },
  ],
};

// Partial contacts from Leo's relationships
const ADRIA: MonicaContact = {
  id: 39,
  is_partial: true,
  first_name: "Adriá",
  last_name: "Valls",
  nickname: null,
  description: null,
  information: {
    dates: {
      birthdate: {
        is_age_based: false,
        is_year_unknown: false,
        date: "2023-10-07T00:00:00Z",
      },
    },
    career: { job: null, company: null },
  },
};

const MARIAN: MonicaContact = {
  id: 40,
  is_partial: true,
  first_name: "Marian",
  last_name: "Valls",
  nickname: null,
  description: null,
  information: {
    dates: {
      birthdate: {
        is_age_based: null,
        is_year_unknown: null,
        date: null,
      },
    },
    career: { job: null, company: null },
  },
};

// From https://monica.falci.me/api/contacts/1/relationships
const LEO_RELATIONSHIPS: MonicaRelationship[] = [
  {
    id: 67,
    relationship_type: { name: "child" },
    of_contact: { id: 39, first_name: "Adriá", last_name: "Valls" },
  },
  {
    id: 69,
    relationship_type: { name: "spouse" },
    of_contact: { id: 40, first_name: "Marian", last_name: "Valls" },
  },
];

// ── parseBirthday ────────────────────────────────────────────────────────────

describe("parseBirthday", () => {
  test("known month+day, unknown year (Leo)", () => {
    const result = parseBirthday({
      is_age_based: false,
      is_year_unknown: true,
      date: "2024-10-20T00:00:00Z",
    });
    assert.deepEqual(result, { day: 20, month: 10, year: null });
  });

  test("full date with known year (Adriá)", () => {
    const result = parseBirthday({
      is_age_based: false,
      is_year_unknown: false,
      date: "2023-10-07T00:00:00Z",
    });
    assert.deepEqual(result, { day: 7, month: 10, year: 2023 });
  });

  test("null date (Marian — no birthday)", () => {
    const result = parseBirthday({
      is_age_based: null,
      is_year_unknown: null,
      date: null,
    });
    assert.deepEqual(result, { day: null, month: null, year: null });
  });

  test("null birthdate object", () => {
    assert.deepEqual(parseBirthday(null), { day: null, month: null, year: null });
  });
});

// ── transformContact ─────────────────────────────────────────────────────────

describe("transformContact", () => {
  test("Leo: birthday with unknown year, tag preserved, no emails/phones", () => {
    const result = transformContact(LEO);
    assert.equal(result.firstName, "Leo");
    assert.equal(result.lastName, null);
    assert.equal(result.birthdayDay, 20);
    assert.equal(result.birthdayMonth, 10);
    assert.equal(result.birthdayYear, null);
    assert.deepEqual(result.tagNames, ["eDreams"]);
    assert.deepEqual(result.emails, []);
    assert.deepEqual(result.phones, []);
    assert.deepEqual(result.addresses, []);
  });

  test("Leo: absent contact_fields treated as empty (no crash)", () => {
    // contact_fields is not in the API response — must not throw
    const leo = { ...LEO };
    delete (leo as Record<string, unknown>).contact_fields;
    const result = transformContact(leo);
    assert.deepEqual(result.emails, []);
    assert.deepEqual(result.phones, []);
  });

  test("Adriá (partial): birthday with full date including year", () => {
    const result = transformContact(ADRIA);
    assert.equal(result.birthdayDay, 7);
    assert.equal(result.birthdayMonth, 10);
    assert.equal(result.birthdayYear, 2023);
  });

  test("Marian (partial): no birthday yields all-null fields", () => {
    const result = transformContact(MARIAN);
    assert.equal(result.birthdayDay, null);
    assert.equal(result.birthdayMonth, null);
    assert.equal(result.birthdayYear, null);
  });
});

// ── Relationship fixture structure ───────────────────────────────────────────

describe("Monica relationship response shape", () => {
  test("relationship list contains both of Leo's relationships", () => {
    assert.equal(LEO_RELATIONSHIPS.length, 2);
  });

  test("child relationship points to Adriá (id 39, partial)", () => {
    const rel = LEO_RELATIONSHIPS.find((r) => r.relationship_type.name === "child");
    assert.ok(rel, "child relationship must exist");
    assert.equal(rel.of_contact.id, 39);
    assert.equal(rel.of_contact.first_name, "Adriá");
    // Adriá is partial — in the real import this triggers stub creation
    assert.equal(ADRIA.is_partial, true);
  });

  test("spouse relationship points to Marian (id 40, partial)", () => {
    const rel = LEO_RELATIONSHIPS.find((r) => r.relationship_type.name === "spouse");
    assert.ok(rel, "spouse relationship must exist");
    assert.equal(rel.of_contact.id, 40);
    assert.equal(rel.of_contact.first_name, "Marian");
    assert.equal(MARIAN.is_partial, true);
  });

  test("both of_contact ids are absent from a contacts-only import map", () => {
    // Simulates what happens during import: partial contacts are filtered out
    const fullContacts = [LEO, ADRIA, MARIAN].filter((c) => !c.is_partial);
    const monicaToLocal = new Map(fullContacts.map((c) => [c.id, `local-${c.id}`]));

    for (const rel of LEO_RELATIONSHIPS) {
      const found = monicaToLocal.get(rel.of_contact.id);
      // Neither Adriá nor Marian should be in the map — stubs must be created
      assert.equal(found, undefined, `${rel.of_contact.first_name} should not be in the import map`);
    }
  });
});
