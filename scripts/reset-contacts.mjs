/**
 * Deletes all contact data so you can re-run the Monica import.
 * Leaves auth tables (users, sessions) and Settings untouched.
 *
 * Usage:
 *   node scripts/reset-contacts.mjs
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load DATABASE_URL from .env
const envPath = resolve(process.cwd(), ".env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim().replace(/^"|"$/g, "")];
    })
);

const url = process.env.DATABASE_URL ?? env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Counting records…");
  const [contacts, tags, events, interactions, relationships] = await Promise.all([
    prisma.contact.count(),
    prisma.tag.count(),
    prisma.event.count(),
    prisma.interaction.count(),
    prisma.relationship.count(),
  ]);

  console.log(`  Contacts:      ${contacts}`);
  console.log(`  Tags:          ${tags}`);
  console.log(`  Events:        ${events}`);
  console.log(`  Interactions:  ${interactions}`);
  console.log(`  Relationships: ${relationships}`);
  console.log();

  if (contacts === 0 && tags === 0) {
    console.log("Nothing to delete.");
    return;
  }

  // Confirm
  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => {
    rl.question("Delete all of the above? [y/N] ", (answer) => {
      rl.close();
      if (answer.toLowerCase() !== "y") {
        console.log("Aborted.");
        process.exit(0);
      }
      resolve();
    });
  });

  console.log("\nDeleting…");

  // Order matters: delete child records first, then parents.
  // Most cascade automatically on Contact delete, but do it explicitly for clarity.
  const [delRel, delInter] = await Promise.all([
    prisma.relationship.deleteMany(),
    prisma.interaction.deleteMany(),
  ]);
  console.log(`  Deleted ${delRel.count} relationships, ${delInter.count} interactions`);

  const [delEmail, delPhone, delAddr, delTag] = await Promise.all([
    prisma.contactEmail.deleteMany(),
    prisma.contactPhone.deleteMany(),
    prisma.contactAddress.deleteMany(),
    prisma.contactTag.deleteMany(),
  ]);
  console.log(`  Deleted ${delEmail.count} emails, ${delPhone.count} phones, ${delAddr.count} addresses, ${delTag.count} contact-tags`);

  // Unlink events from contacts (SetNull) then optionally delete them
  await prisma.event.updateMany({ data: { contactId: null } });
  const delEvents = await prisma.event.deleteMany();
  console.log(`  Deleted ${delEvents.count} events`);

  const delContacts = await prisma.contact.deleteMany();
  console.log(`  Deleted ${delContacts.count} contacts`);

  const delTags = await prisma.tag.deleteMany();
  console.log(`  Deleted ${delTags.count} tags`);

  console.log("\nDone. Ready for a fresh import.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
