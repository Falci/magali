-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- AlterTable: add companyId column before dropping company string
ALTER TABLE "Contact" ADD COLUMN "companyId" TEXT;

-- Migrate existing company strings → Company rows + link contacts
INSERT INTO "Company" (id, name, "createdAt", "updatedAt")
SELECT
    encode(sha256(name::bytea), 'hex'),
    name,
    NOW(),
    NOW()
FROM (SELECT DISTINCT company AS name FROM "Contact" WHERE company IS NOT NULL AND company <> '') AS t
ON CONFLICT (name) DO NOTHING;

UPDATE "Contact" c
SET "companyId" = co.id
FROM "Company" co
WHERE c.company = co.name;

-- DropColumn
ALTER TABLE "Contact" DROP COLUMN "company";

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
