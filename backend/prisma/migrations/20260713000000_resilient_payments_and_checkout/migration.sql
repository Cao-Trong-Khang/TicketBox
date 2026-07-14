-- Add states before data backfill so legacy rows remain valid.
ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS 'REQUIRES_REVIEW';

ALTER TABLE "payment_transactions"
  ADD COLUMN "provider_request_id" TEXT,
  ADD COLUMN "request_fingerprint" VARCHAR(64),
  ADD COLUMN "payment_url" TEXT,
  ADD COLUMN "failure_code" VARCHAR(100),
  ADD COLUMN "initiation_lease_until" TIMESTAMP(3),
  ADD COLUMN "reconciliation_lease_until" TIMESTAMP(3),
  ADD COLUMN "last_reconciled_at" TIMESTAMP(3),
  ADD COLUMN "reconciliation_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Legacy references are deterministic and never reused for a new provider call.
UPDATE "payment_transactions"
SET "provider_request_id" = 'legacy-' || "id"::text,
    "request_fingerprint" = encode(sha256(
      ("order_id"::text || '|' || "provider"::text || '|' || "amount_vnd"::text || '|legacy')::bytea
    ), 'hex')
WHERE "provider_request_id" IS NULL OR "request_fingerprint" IS NULL;

ALTER TABLE "payment_transactions"
  ALTER COLUMN "provider_request_id" SET NOT NULL,
  ALTER COLUMN "provider_request_id" SET DEFAULT gen_random_uuid()::text,
  ALTER COLUMN "request_fingerprint" SET NOT NULL,
  ALTER COLUMN "request_fingerprint" SET DEFAULT 'legacy';

CREATE UNIQUE INDEX "payment_transactions_provider_request_id_key"
  ON "payment_transactions"("provider_request_id");
CREATE INDEX "payment_transactions_status_updated_at_idx"
  ON "payment_transactions"("status", "updated_at");
CREATE INDEX "payment_transactions_reconciliation_lease_until_idx"
  ON "payment_transactions"("reconciliation_lease_until");

ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_type_quantity_bounds"
  CHECK (
    "total_quantity" >= 0 AND
    "reserved_quantity" >= 0 AND
    "sold_quantity" >= 0 AND
    "reserved_quantity" + "sold_quantity" <= "total_quantity"
  ) NOT VALID;

ALTER TABLE "order_items" ADD CONSTRAINT "order_item_positive_quantity"
  CHECK ("quantity" > 0 AND "unit_price_vnd" >= 0 AND "subtotal_vnd" >= 0) NOT VALID;
