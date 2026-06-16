ALTER TABLE "vip_guests" ADD COLUMN IF NOT EXISTS "sponsor_company" TEXT;
ALTER TABLE "vip_guests" ADD COLUMN IF NOT EXISTS "invited_by" TEXT;
ALTER TABLE "vip_guests" ADD COLUMN IF NOT EXISTS "guest_type" TEXT;
ALTER TABLE "vip_guests" ADD COLUMN IF NOT EXISTS "allowed_gate" TEXT;
ALTER TABLE "vip_guests" ADD COLUMN IF NOT EXISTS "notes" TEXT;
