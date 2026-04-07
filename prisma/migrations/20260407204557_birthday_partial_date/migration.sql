/*
  Warnings:

  - You are about to drop the column `birthday` on the `Contact` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "birthday",
ADD COLUMN     "birthdayDay" INTEGER,
ADD COLUMN     "birthdayMonth" INTEGER,
ADD COLUMN     "birthdayYear" INTEGER;
