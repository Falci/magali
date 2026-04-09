-- Data migration: create tags from companies and assign to contacts

-- Step 1: For each company, create a tag with the same name if one doesn't exist yet
INSERT INTO "Tag" (id, name, color)
SELECT gen_random_uuid()::text, c.name, NULL
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "Tag" t WHERE t.name = c.name
);

-- Step 2: For each contact that belongs to a company, assign the corresponding tag
INSERT INTO "ContactTag" ("contactId", "tagId")
SELECT ct.id, t.id
FROM "Contact" ct
JOIN "Company" c ON ct."companyId" = c.id
JOIN "Tag" t ON t.name = c.name
WHERE NOT EXISTS (
  SELECT 1 FROM "ContactTag" existing
  WHERE existing."contactId" = ct.id AND existing."tagId" = t.id
);

-- Schema migration: remove company from Contact and drop Company table
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "companyId";
DROP TABLE IF EXISTS "Company";
