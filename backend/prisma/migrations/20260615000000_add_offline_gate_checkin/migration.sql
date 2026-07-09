ALTER TYPE "check_in_status" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "check_in_status" ADD VALUE IF NOT EXISTS 'UNAUTHORIZED';

ALTER TABLE "check_ins" ADD COLUMN "local_scan_id" TEXT;

CREATE TABLE "check_in_assignments" (
    "id" UUID NOT NULL,
    "staff_user_id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "gate_name" TEXT,
    "source_device_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_in_assignments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "vip_guests" ADD COLUMN "qr_hash" TEXT;

CREATE UNIQUE INDEX "check_in_assignments_staff_user_id_concert_id_gate_name_key"
    ON "check_in_assignments"("staff_user_id", "concert_id", "gate_name");
CREATE INDEX "check_in_assignments_staff_user_id_idx" ON "check_in_assignments"("staff_user_id");
CREATE INDEX "check_in_assignments_concert_id_idx" ON "check_in_assignments"("concert_id");
CREATE INDEX "check_in_assignments_source_device_id_idx" ON "check_in_assignments"("source_device_id");
CREATE INDEX "check_in_assignments_active_idx" ON "check_in_assignments"("active");

CREATE INDEX "check_ins_source_device_id_local_scan_id_idx"
    ON "check_ins"("source_device_id", "local_scan_id");
CREATE UNIQUE INDEX "check_ins_source_device_id_local_scan_id_unique"
    ON "check_ins"("source_device_id", "local_scan_id")
    WHERE "source_device_id" IS NOT NULL AND "local_scan_id" IS NOT NULL;
CREATE UNIQUE INDEX "check_ins_success_ticket_id_unique"
    ON "check_ins"("ticket_id")
    WHERE "ticket_id" IS NOT NULL AND "status" = 'SUCCESS';
CREATE UNIQUE INDEX "check_ins_success_vip_guest_id_unique"
    ON "check_ins"("vip_guest_id")
    WHERE "vip_guest_id" IS NOT NULL AND "status" = 'SUCCESS';

CREATE UNIQUE INDEX "vip_guests_qr_hash_key" ON "vip_guests"("qr_hash");

ALTER TABLE "check_in_assignments"
    ADD CONSTRAINT "check_in_assignments_staff_user_id_fkey"
    FOREIGN KEY ("staff_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "check_in_assignments"
    ADD CONSTRAINT "check_in_assignments_concert_id_fkey"
    FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
