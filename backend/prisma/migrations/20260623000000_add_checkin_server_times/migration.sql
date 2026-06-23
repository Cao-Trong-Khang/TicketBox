ALTER TABLE "check_ins"
    ADD COLUMN "client_scanned_at" TIMESTAMP(3),
    ADD COLUMN "server_received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "server_checked_in_at" TIMESTAMP(3);

UPDATE "check_ins"
SET
    "client_scanned_at" = "scanned_at",
    "server_received_at" = COALESCE("synced_at", "scanned_at"),
    "server_checked_in_at" = CASE
        WHEN "status" = 'SUCCESS' THEN "scanned_at"
        ELSE NULL
    END;

CREATE INDEX "check_ins_server_received_at_idx" ON "check_ins"("server_received_at");
CREATE INDEX "check_ins_server_checked_in_at_idx" ON "check_ins"("server_checked_in_at");
