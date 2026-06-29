-- AlterTable
ALTER TABLE "concerts" ADD COLUMN     "performance_start_at" TIMESTAMP(3);

-- Backfill existing concerts with the previous concert start as performance time
UPDATE "concerts"
SET "performance_start_at" = "starts_at"
WHERE "performance_start_at" IS NULL;
