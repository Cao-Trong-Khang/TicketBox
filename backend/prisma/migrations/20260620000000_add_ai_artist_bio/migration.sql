CREATE TYPE "artist_document_status" AS ENUM ('uploaded', 'extracting', 'extracted', 'generating', 'done', 'failed');
CREATE TYPE "ai_artist_bio_status" AS ENUM ('generating', 'done', 'failed');

CREATE TABLE "artist_documents" (
    "id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "status" "artist_document_status" NOT NULL DEFAULT 'uploaded',
    "extracted_text" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "artist_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_artist_bios" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "status" "ai_artist_bio_status" NOT NULL DEFAULT 'generating',
    "generated_bio" TEXT,
    "failure_reason" VARCHAR(500),
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_artist_bios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_artist_bios_document_id_key" ON "ai_artist_bios"("document_id");
CREATE INDEX "artist_documents_concert_id_created_at_idx" ON "artist_documents"("concert_id", "created_at");
CREATE INDEX "artist_documents_status_created_at_idx" ON "artist_documents"("status", "created_at");
CREATE INDEX "ai_artist_bios_concert_id_status_created_at_idx" ON "ai_artist_bios"("concert_id", "status", "created_at");

ALTER TABLE "artist_documents" ADD CONSTRAINT "artist_documents_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_artist_bios" ADD CONSTRAINT "ai_artist_bios_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "artist_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_artist_bios" ADD CONSTRAINT "ai_artist_bios_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
