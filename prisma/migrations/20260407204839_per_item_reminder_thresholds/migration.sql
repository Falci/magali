-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "staleDays" INTEGER;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "reminderDaysBefore" INTEGER;
