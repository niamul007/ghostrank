-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "scanApproved" BOOLEAN NOT NULL DEFAULT false;

-- Existing agencies (WebMox, DJ) keep working: approve them all.
UPDATE "Agency" SET "scanApproved" = true;
