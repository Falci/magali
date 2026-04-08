-- Deletes all contact data so you can re-run the Monica import.
-- Leaves auth tables (User, Session, Account, Verification) and Settings untouched.
--
-- Usage:
--   psql $DATABASE_URL -f scripts/reset-contacts.sql

TRUNCATE
  "Relationship",
  "Interaction",
  "ContactEmail",
  "ContactPhone",
  "ContactAddress",
  "ContactTag",
  "Event",
  "Contact",
  "Tag"
CASCADE;
