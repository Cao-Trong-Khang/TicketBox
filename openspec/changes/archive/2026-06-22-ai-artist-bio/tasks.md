## 1. Local Infrastructure and Configuration

- [x] 1.1 Add MinIO and bucket-initialization services, persistent volume, health checks, private artist-document bucket, and backend/worker dependencies to Docker Compose; verify the full stack starts locally. [AC: local PostgreSQL/Kafka/MinIO/Redis/mock-AI integration]
- [x] 1.2 Add validated environment configuration for MinIO endpoint, credentials, bucket, Kafka topic, AI adapter/provider, provider credentials, extraction limits, and retry settings, with safe `.env.example` defaults. [AC: local mock adapter; secret hygiene]
- [x] 1.3 Add and lock the NestJS multipart/object-storage, PDF extraction, Kafka, and AI provider dependencies required by the adapters. [AC: valid upload; worker extraction/generation]

## 2. PostgreSQL Schema and Persistence

- [x] 2.1 Add Prisma enums/models for `artist_documents` and `ai_artist_bios`, including UUID keys, concert/document relations, pipeline statuses, nullable result/failure fields, timestamps, and one biography row per document. [AC: ordered status changes; duplicate handling]
- [x] 2.2 Create and apply an additive migration with foreign keys and indexes for concert document history and latest completed biography lookup; regenerate the Prisma client. [AC: listing/detail scoping; newest completed public bio]
- [x] 2.3 Add deterministic development seed/demo fixtures only where needed to exercise owned-concert upload and optional completed/failed states without a live provider. [AC: local demo scenarios]

## 3. Storage, Event, Extraction, and AI Adapters

- [x] 3.1 Implement a private MinIO storage adapter that generates server-owned object keys, uploads/downloads PDFs, applies timeouts, and performs best-effort cleanup without exposing credentials or object internals. [AC: valid upload; MinIO retry; secret hygiene]
- [x] 3.2 Implement the `ai.bio.requested` Kafka publisher and typed payload contract `{ document_id, concert_id, storage_key, attempt }`, awaiting broker acknowledgement and keying messages by document id. [AC: asynchronous 202; Kafka failure behavior]
- [x] 3.3 Implement PDF signature validation, bounded extraction, whitespace/control-character cleaning, and the permanent under-50-character failure result. [AC: text cleaning; scanned/empty PDF failure]
- [x] 3.4 Define the AI biography port and implement deterministic mock plus configured OpenAI/Gemini adapter(s), controlled prompt construction, sanitized errors, and a hard 4,000-character cleaned-text cap. [AC: prompt cap; mock adapter; provider secret hygiene]

## 4. Organizer Document API

- [x] 4.1 Add the artist-document NestJS module, DTOs, multipart interceptor/validation, and standard `{ error, message, status_code }` exception mapping for the new endpoints. [AC: upload/400; standard errors]
- [x] 4.2 Implement the upload service/controller flow with Bearer auth, Organizer permission, Layer 2 concert ownership, PDF/10 MB validation, MinIO upload, `uploaded` persistence, acknowledged Kafka publication, rollback/recoverable failure handling, and HTTP 202 response. [AC: valid upload/202; invalid file/400; auth/401; role/non-owner/403; Kafka failure]
- [x] 4.3 Implement owned-concert document list and detail queries with document-to-concert consistency checks and optional extracted text, bio, failure, and generation fields. [AC: listing/detail scoping]
- [x] 4.4 Implement manual biography override with non-empty bounded input, conflict handling when no editable bio exists, `done` state persistence, audit integration where available, and concert-detail cache invalidation. [AC: manual edit; public edit visibility]
- [x] 4.5 Implement regeneration by copying the source PDF metadata/storage key into a new `uploaded` document attempt, publishing a new keyed event, preserving history, and returning the new id with HTTP 202. [AC: regeneration produces new document id]

## 5. Kafka Background Worker

- [x] 5.1 Add the AI-bio worker entry point/module and consumer wiring so it can run as a separate local Docker Compose process and commit offsets only after durable terminal state. [AC: asynchronous integration; crash/redelivery persistence]
- [x] 5.2 Implement idempotent conditional state transitions, terminal `done` short-circuiting, and biography upsert by unique document id for duplicate Kafka delivery. [AC: ordered states; duplicate event handling]
- [x] 5.3 Implement the successful pipeline: MinIO download, `extracting`, cleaned-text persistence, `extracted`, `generating`, AI call, completed bio/document transaction, generation timestamp, and Redis concert-detail invalidation. [AC: end-to-end upload to done; public completed bio]
- [x] 5.4 Implement three-attempt exponential MinIO timeout retry, two-attempt AI timeout retry, at-least-60-second AI rate-limit delay, permanent extraction failure, exhausted-retry failure persistence, and sanitized failure reasons. [AC: every retry policy and terminal failure]
- [x] 5.5 Add safe reconciliation/republication for documents left `uploaded` after Kafka publish failure, ensuring repeated recovery remains idempotent. [AC: Kafka failure leaves recoverable durable state]

## 6. Public Concert Detail Integration

- [x] 6.1 Extend the public concert-detail query/DTO to select the latest `done` biography by creation time and serialize `artist_bio` only for a non-empty completed result. [AC: absent for missing/processing/failed; newest completed present]
- [x] 6.2 Invalidate the existing Redis concert-detail key after worker completion and manual edit, and verify TTL fallback preserves public availability when invalidation or AI infrastructure is degraded. [AC: edited bio visibility; stale-cache recovery; public API isolation]

## 7. Organizer and Public Web UI

- [x] 7.1 Add typed frontend API functions and Organizer document-management UI for `.pdf` selection, client-side 10 MB validation, upload, list/detail status, and standard error display. [AC: UI PDF/size validation; upload status]
- [x] 7.2 Implement cancellable 3–5 second polling for active documents that stops on `done`, `failed`, unmount, or a replacement attempt, and render generated output or failure reason. [AC: polling cadence and terminal stop]
- [x] 7.3 Add Regenerate and Edit Manually controls wired to their APIs with ownership-safe routes, new-attempt selection, validation, and updated biography rendering. [AC: frontend regeneration and editing]
- [x] 7.4 Render the optional `artist_bio` section on public concert detail without showing a placeholder or leaking processing/failure state when the field is absent. [AC: optional public rendering]

## 8. Automated Verification and Local Demo

- [x] 8.1 Add API unit/integration tests for upload 202, invalid type/size 400, unauthenticated 401, wrong role/non-owner 403, document-concert mismatch, scoped list/detail, manual edit/conflict, regeneration, standard error envelopes, and Kafka publication failure. [AC: admin API acceptance matrix]
- [x] 8.2 Add worker tests for status ordering, cleaning/50-character threshold, 4,000-character cap, all retry/delay branches, permanent failure, duplicate delivery, terminal short-circuit, and crash-before-offset-commit behavior. [AC: worker acceptance matrix]
- [x] 8.3 Add public API/cache tests for absent missing/processing/failed-only bios, newest completed selection, manual edit visibility, invalidation, and continued browsing while AI dependencies are unavailable. [AC: public API acceptance matrix]
- [x] 8.4 Add frontend tests for file validation, polling lifecycle, terminal output/failure UI, regeneration, manual editing, and optional public biography rendering. [AC: frontend acceptance matrix]
- [x] 8.5 Run migrations, lint, backend/frontend test suites, builds, and an end-to-end Docker Compose demo using MinIO, Kafka, Redis, PostgreSQL, and the mock AI adapter; document the exact local demo commands and observed state progression. [AC: locally verifiable happy path and important failures]
