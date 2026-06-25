CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "check_in_staff_assignments" (
    "id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "gate_label" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_in_staff_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");
CREATE INDEX "refresh_tokens_revoked_at_idx" ON "refresh_tokens"("revoked_at");

CREATE INDEX "check_in_staff_assignments_concert_id_idx" ON "check_in_staff_assignments"("concert_id");
CREATE INDEX "check_in_staff_assignments_user_id_idx" ON "check_in_staff_assignments"("user_id");
CREATE UNIQUE INDEX "check_in_staff_assignments_concert_id_user_id_key" ON "check_in_staff_assignments"("concert_id", "user_id");

ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "check_in_staff_assignments"
    ADD CONSTRAINT "check_in_staff_assignments_concert_id_fkey"
    FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "check_in_staff_assignments"
    ADD CONSTRAINT "check_in_staff_assignments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;