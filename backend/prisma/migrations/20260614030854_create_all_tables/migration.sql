-- CreateEnum
CREATE TYPE "concert_status" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'FINISHED');

-- CreateEnum
CREATE TYPE "ticket_type_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SOLD_OUT');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('VNPAY', 'MOMO');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('INITIATED', 'SUCCESS', 'FAILED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('ACTIVE', 'USED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "check_in_mode" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "check_in_status" AS ENUM ('SUCCESS', 'INVALID_QR', 'ALREADY_USED', 'WRONG_CONCERT', 'CANCELLED_TICKET', 'CONFLICT');

-- CreateEnum
CREATE TYPE "check_in_sync_status" AS ENUM ('SYNCED', 'PENDING', 'FAILED');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('ORDER_PAID', 'TICKET_ISSUED', 'CONCERT_REMINDER', 'CONCERT_CANCELLED');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "artist_bio_job_status" AS ENUM ('UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "import_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "vip_guest_status" AS ENUM ('ACTIVE', 'CHECKED_IN', 'CANCELLED');

-- CreateTable
CREATE TABLE "concerts" (
    "id" UUID NOT NULL,
    "organizer_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "artist_name" TEXT,
    "description" TEXT,
    "venue_name" TEXT NOT NULL,
    "venue_address" TEXT,
    "banner_url" TEXT,
    "seating_svg" TEXT,
    "status" "concert_status" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_types" (
    "id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_vnd" INTEGER NOT NULL,
    "total_quantity" INTEGER NOT NULL,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "sold_quantity" INTEGER NOT NULL DEFAULT 0,
    "per_user_limit" INTEGER NOT NULL,
    "sale_start_at" TIMESTAMP(3) NOT NULL,
    "sale_end_at" TIMESTAMP(3),
    "status" "ticket_type_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_code" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PENDING',
    "total_amount_vnd" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "ticket_type_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_vnd" INTEGER NOT NULL,
    "subtotal_vnd" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "provider_transaction_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'INITIATED',
    "amount_vnd" INTEGER NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "ticket_code" TEXT NOT NULL,
    "qr_hash" TEXT NOT NULL,
    "order_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "ticket_type_id" UUID NOT NULL,
    "status" "ticket_status" NOT NULL DEFAULT 'ACTIVE',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_in_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" UUID NOT NULL,
    "ticket_id" UUID,
    "vip_guest_id" UUID,
    "concert_id" UUID NOT NULL,
    "staff_user_id" UUID NOT NULL,
    "source_device_id" TEXT,
    "mode" "check_in_mode" NOT NULL,
    "status" "check_in_status" NOT NULL,
    "sync_status" "check_in_sync_status" NOT NULL DEFAULT 'SYNCED',
    "scanned_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "concert_id" UUID,
    "type" "notification_type" NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'PENDING',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artist_bio_jobs" (
    "id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "extracted_text" TEXT,
    "generated_bio" TEXT,
    "failure_reason" TEXT,
    "status" "artist_bio_job_status" NOT NULL DEFAULT 'UPLOADED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artist_bio_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vip_guest_imports" (
    "id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" "import_status" NOT NULL DEFAULT 'PENDING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "accepted_rows" INTEGER NOT NULL DEFAULT 0,
    "rejected_rows" INTEGER NOT NULL DEFAULT 0,
    "duplicate_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_guest_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vip_guests" (
    "id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "sponsor_source" TEXT,
    "external_guest_key" TEXT,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "vip_guest_status" NOT NULL DEFAULT 'ACTIVE',
    "checked_in_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_guests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "concerts_status_idx" ON "concerts"("status");

-- CreateIndex
CREATE INDEX "concerts_starts_at_idx" ON "concerts"("starts_at");

-- CreateIndex
CREATE INDEX "concerts_status_starts_at_idx" ON "concerts"("status", "starts_at");

-- CreateIndex
CREATE INDEX "ticket_types_concert_id_idx" ON "ticket_types"("concert_id");

-- CreateIndex
CREATE INDEX "ticket_types_concert_id_status_idx" ON "ticket_types"("concert_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_types_concert_id_code_key" ON "ticket_types"("concert_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_code_key" ON "orders"("order_code");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_concert_id_idx" ON "orders"("concert_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_expires_at_idx" ON "orders"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_user_id_idempotency_key_key" ON "orders"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_ticket_type_id_idx" ON "order_items"("ticket_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_idempotency_key_key" ON "payment_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_transactions_order_id_idx" ON "payment_transactions"("order_id");

-- CreateIndex
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_provider_provider_transaction_id_key" ON "payment_transactions"("provider", "provider_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_code_key" ON "tickets"("ticket_code");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_qr_hash_key" ON "tickets"("qr_hash");

-- CreateIndex
CREATE INDEX "tickets_owner_user_id_idx" ON "tickets"("owner_user_id");

-- CreateIndex
CREATE INDEX "tickets_concert_id_idx" ON "tickets"("concert_id");

-- CreateIndex
CREATE INDEX "tickets_ticket_type_id_idx" ON "tickets"("ticket_type_id");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "check_ins_ticket_id_idx" ON "check_ins"("ticket_id");

-- CreateIndex
CREATE INDEX "check_ins_vip_guest_id_idx" ON "check_ins"("vip_guest_id");

-- CreateIndex
CREATE INDEX "check_ins_concert_id_idx" ON "check_ins"("concert_id");

-- CreateIndex
CREATE INDEX "check_ins_staff_user_id_idx" ON "check_ins"("staff_user_id");

-- CreateIndex
CREATE INDEX "check_ins_source_device_id_idx" ON "check_ins"("source_device_id");

-- CreateIndex
CREATE INDEX "check_ins_scanned_at_idx" ON "check_ins"("scanned_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_concert_id_idx" ON "notifications"("concert_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_scheduled_at_idx" ON "notifications"("scheduled_at");

-- CreateIndex
CREATE INDEX "artist_bio_jobs_concert_id_idx" ON "artist_bio_jobs"("concert_id");

-- CreateIndex
CREATE INDEX "artist_bio_jobs_status_idx" ON "artist_bio_jobs"("status");

-- CreateIndex
CREATE INDEX "vip_guest_imports_concert_id_idx" ON "vip_guest_imports"("concert_id");

-- CreateIndex
CREATE INDEX "vip_guest_imports_status_idx" ON "vip_guest_imports"("status");

-- CreateIndex
CREATE INDEX "vip_guests_concert_id_idx" ON "vip_guests"("concert_id");

-- CreateIndex
CREATE INDEX "vip_guests_email_idx" ON "vip_guests"("email");

-- CreateIndex
CREATE INDEX "vip_guests_phone_idx" ON "vip_guests"("phone");

-- CreateIndex
CREATE INDEX "vip_guests_status_idx" ON "vip_guests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "vip_guests_concert_id_sponsor_source_external_guest_key_key" ON "vip_guests"("concert_id", "sponsor_source", "external_guest_key");

-- AddForeignKey
ALTER TABLE "concerts" ADD CONSTRAINT "concerts_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_vip_guest_id_fkey" FOREIGN KEY ("vip_guest_id") REFERENCES "vip_guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_bio_jobs" ADD CONSTRAINT "artist_bio_jobs_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_bio_jobs" ADD CONSTRAINT "artist_bio_jobs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vip_guest_imports" ADD CONSTRAINT "vip_guest_imports_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vip_guests" ADD CONSTRAINT "vip_guests_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "vip_guest_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vip_guests" ADD CONSTRAINT "vip_guests_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
