ALTER TYPE "import_status" ADD VALUE IF NOT EXISTS 'DETECTED';
ALTER TYPE "import_status" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "import_status" ADD VALUE IF NOT EXISTS 'FAILED_TO_ENQUEUE';
ALTER TYPE "import_status" ADD VALUE IF NOT EXISTS 'RETRYABLE_FAILED';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'import_error_type') THEN
        CREATE TYPE "import_error_type" AS ENUM ('FILE', 'ROW', 'DUPLICATE');
    END IF;
END $$;

ALTER TABLE "vip_guest_imports" ADD COLUMN IF NOT EXISTS "source_name" TEXT;
ALTER TABLE "vip_guest_imports" ADD COLUMN IF NOT EXISTS "source_path" TEXT;
ALTER TABLE "vip_guest_imports" ADD COLUMN IF NOT EXISTS "source_fingerprint" TEXT;
ALTER TABLE "vip_guest_imports" ADD COLUMN IF NOT EXISTS "failure_code" TEXT;
ALTER TABLE "vip_guest_imports" ADD COLUMN IF NOT EXISTS "failure_message" TEXT;
ALTER TABLE "vip_guest_imports" ADD COLUMN IF NOT EXISTS "queued_at" TIMESTAMP(3);
ALTER TABLE "vip_guest_imports" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3);
ALTER TABLE "vip_guest_imports" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

UPDATE "vip_guest_imports"
SET
    "source_name" = COALESCE("source_name", 'SPONSOR_CSV'),
    "source_fingerprint" = COALESCE("source_fingerprint", md5("id"::text || ':' || "file_name")),
    "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP);

ALTER TABLE "vip_guest_imports" ALTER COLUMN "source_name" SET DEFAULT 'SPONSOR_CSV';
ALTER TABLE "vip_guest_imports" ALTER COLUMN "source_name" SET NOT NULL;
ALTER TABLE "vip_guest_imports" ALTER COLUMN "source_fingerprint" SET NOT NULL;
ALTER TABLE "vip_guest_imports" ALTER COLUMN "updated_at" SET NOT NULL;

ALTER TABLE "vip_guests" ADD COLUMN IF NOT EXISTS "normalized_full_name" TEXT;
ALTER TABLE "vip_guests" ADD COLUMN IF NOT EXISTS "normalized_email" TEXT;
ALTER TABLE "vip_guests" ADD COLUMN IF NOT EXISTS "normalized_phone" TEXT;
ALTER TABLE "vip_guests" ADD COLUMN IF NOT EXISTS "normalized_identity_key" TEXT;
ALTER TABLE "vip_guests" ADD COLUMN IF NOT EXISTS "source_row_number" INTEGER;
ALTER TABLE "vip_guests" ADD COLUMN IF NOT EXISTS "imported_at" TIMESTAMP(3);
ALTER TABLE "vip_guests" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

UPDATE "vip_guests"
SET
    "sponsor_source" = COALESCE("sponsor_source", 'SPONSOR_CSV'),
    "normalized_full_name" = COALESCE("normalized_full_name", lower(regexp_replace(trim("full_name"), '\s+', ' ', 'g'))),
    "normalized_email" = COALESCE("normalized_email", lower(trim("email"))),
    "normalized_phone" = COALESCE("normalized_phone", regexp_replace(COALESCE("phone", ''), '[^0-9+]', '', 'g')),
    "imported_at" = COALESCE("imported_at", "created_at", CURRENT_TIMESTAMP),
    "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP);

UPDATE "vip_guests"
SET "normalized_phone" = NULL
WHERE "normalized_phone" = '';

UPDATE "vip_guests"
SET "normalized_identity_key" = md5(
    COALESCE("normalized_email", '') || '|' ||
    COALESCE("normalized_phone", '') || '|' ||
    COALESCE("normalized_full_name", '')
)
WHERE "normalized_identity_key" IS NULL
  AND "external_guest_key" IS NULL
  AND (
      COALESCE("normalized_email", '') <> ''
      OR COALESCE("normalized_phone", '') <> ''
      OR COALESCE("normalized_full_name", '') <> ''
  );

ALTER TABLE "vip_guests" ALTER COLUMN "sponsor_source" SET DEFAULT 'SPONSOR_CSV';
ALTER TABLE "vip_guests" ALTER COLUMN "sponsor_source" SET NOT NULL;
ALTER TABLE "vip_guests" ALTER COLUMN "normalized_full_name" SET DEFAULT '';
ALTER TABLE "vip_guests" ALTER COLUMN "normalized_full_name" SET NOT NULL;
ALTER TABLE "vip_guests" ALTER COLUMN "imported_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "vip_guests" ALTER COLUMN "imported_at" SET NOT NULL;
ALTER TABLE "vip_guests" ALTER COLUMN "updated_at" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "vip_guest_import_errors" (
    "id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "type" "import_error_type" NOT NULL,
    "row_number" INTEGER,
    "field" TEXT,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "raw_row" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_guest_import_errors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "import_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vip_guest_imports_concert_id_source_name_source_fingerprint_key"
    ON "vip_guest_imports"("concert_id", "source_name", "source_fingerprint");
CREATE INDEX IF NOT EXISTS "vip_guest_imports_concert_id_status_idx" ON "vip_guest_imports"("concert_id", "status");
CREATE INDEX IF NOT EXISTS "vip_guest_imports_status_created_at_idx" ON "vip_guest_imports"("status", "created_at");
CREATE INDEX IF NOT EXISTS "vip_guest_imports_source_fingerprint_idx" ON "vip_guest_imports"("source_fingerprint");

CREATE INDEX IF NOT EXISTS "vip_guests_concert_id_status_idx" ON "vip_guests"("concert_id", "status");
CREATE INDEX IF NOT EXISTS "vip_guests_concert_id_sponsor_source_idx" ON "vip_guests"("concert_id", "sponsor_source");
CREATE INDEX IF NOT EXISTS "vip_guests_normalized_email_idx" ON "vip_guests"("normalized_email");
CREATE INDEX IF NOT EXISTS "vip_guests_normalized_phone_idx" ON "vip_guests"("normalized_phone");
CREATE INDEX IF NOT EXISTS "vip_guests_normalized_identity_key_idx" ON "vip_guests"("normalized_identity_key");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_guests_concert_sponsor_identity_key"
    ON "vip_guests"("concert_id", "sponsor_source", "normalized_identity_key")
    WHERE "normalized_identity_key" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "vip_guest_import_errors_import_id_idx" ON "vip_guest_import_errors"("import_id");
CREATE INDEX IF NOT EXISTS "vip_guest_import_errors_import_id_type_idx" ON "vip_guest_import_errors"("import_id", "type");
CREATE INDEX IF NOT EXISTS "vip_guest_import_errors_import_id_row_number_idx" ON "vip_guest_import_errors"("import_id", "row_number");

CREATE INDEX IF NOT EXISTS "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_import_id_idx" ON "audit_logs"("import_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");

ALTER TABLE "vip_guest_import_errors"
    ADD CONSTRAINT "vip_guest_import_errors_import_id_fkey"
    FOREIGN KEY ("import_id") REFERENCES "vip_guest_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_import_id_fkey"
    FOREIGN KEY ("import_id") REFERENCES "vip_guest_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
