## Why

Organizers need a safe way to turn artist press kits into publishable biography content without making uploads wait on slow PDF extraction or an external AI model. An asynchronous, reviewable workflow keeps the public concert experience available while exposing clear processing and failure states to the concert owner.

## What Changes

- Add organizer-only PDF press-kit upload, document listing/detail, regeneration, and manual biography editing APIs, protected by JWT role checks and server-side concert ownership checks.
- Store uploaded PDFs in local MinIO and persist authoritative document, processing, generated biography, and failure state in PostgreSQL.
- Publish `ai.bio.requested` jobs to Kafka and process extraction and AI generation in a background worker with bounded, failure-specific retries.
- Validate PDF type and a 10 MB limit, clean extracted text, reject unusable documents, and restrict AI prompt input to 4,000 characters.
- Extend public concert detail responses with `artist_bio` only when the latest biography is complete, including organizer-edited output; omit the field for missing, processing, or failed content.
- Add organizer admin UI for upload validation, status polling, failure display, regeneration, generated biography review, and manual editing.
- Add MinIO to the local Docker Compose stack and an adapter boundary for OpenAI, Gemini, or a deterministic mock AI provider.
- Use the standard API error envelope `{ error, message, status_code }` for the new endpoints.

## Capabilities

### New Capabilities

- `ai-artist-bio`: Asynchronous press-kit upload, PDF extraction, AI biography generation, retry/failure handling, organizer review and override, and conditional public biography display.

### Modified Capabilities

None.

## Impact

- **Roles:** Organizers gain document-management and biography-review capabilities for concerts they own; Audience users can read completed biographies on published concert details; Check-in Staff are unaffected.
- **Backend and data:** Adds a NestJS artist-document/AI-bio module and worker, Prisma models/migration for `artist_documents` and `ai_artist_bios`, Kafka producer/consumer integration, MinIO storage integration, and public concert-detail query/cache invalidation changes.
- **Frontend:** Adds organizer upload/status/edit/regenerate UI and renders an optional biography in the public concert detail page.
- **External systems:** Calls an AI Model through an adapter. It does not interact with VNPAY/MoMo, the Email Provider, or Sponsor CSV Files.
- **Infrastructure and dependencies:** Extends local Docker Compose with MinIO and adds PDF extraction, multipart upload, object-storage client, and AI provider dependencies.
- **Alignment:** Supports the global goals for asynchronous AI press-kit processing, explicit status/fallback behavior, organizer ownership enforcement, Kafka-driven background work, PostgreSQL authority, and resilient public browsing. No conflict with the global proposal or technical design is identified.
