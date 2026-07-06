## Purpose

This capability lets an Organizer upload a PDF press kit for a concert they own, observe asynchronous extraction and AI generation, regenerate or manually edit the result, and make only the latest completed biography visible to Audience users. It depends on the Web Application, NestJS Backend API, PostgreSQL, Kafka, Background Worker, MinIO, Redis concert-detail cache, and an external AI Model or local mock adapter. Check-in Staff have no access to its admin operations.

## Requirements

### Requirement: Organizer press-kit upload
The system SHALL expose `POST /admin/concerts/:concertId/documents` for an authenticated Organizer with the required permission and ownership of the target concert. It MUST accept multipart field `file`, accept only a valid PDF no larger than 10 MB, store it in private MinIO storage, create an `artist_documents` record with status `uploaded`, publish `ai.bio.requested`, and return HTTP 202 with `{ document_id, status: "uploaded" }` only after the event is acknowledged.

#### Scenario: Owned concert PDF is accepted asynchronously
- **WHEN** an authorized Organizer uploads a valid PDF of at most 10 MB for a concert they own
- **THEN** the system stores the object and document record, publishes `{ document_id, concert_id, storage_key, attempt }`, and returns HTTP 202 without waiting for extraction or AI generation

#### Scenario: Invalid upload is rejected
- **WHEN** the uploaded file is not a valid PDF or exceeds 10 MB
- **THEN** the system returns HTTP 400 in the standard error format and does not publish a generation event

#### Scenario: Upload event cannot be published
- **WHEN** storage and document creation succeed but Kafka does not acknowledge `ai.bio.requested`
- **THEN** the system does not return HTTP 202, returns a controlled service error, and leaves the document in an idempotently recoverable `uploaded` state

### Requirement: Layered organizer authorization
Every artist-document admin endpoint MUST require Bearer authentication, the Organizer role and required permission at the API boundary, a domain-service ownership check against `concerts.organizer_id`, and validation that the document belongs to the path concert.

#### Scenario: Non-owner is denied
- **WHEN** an authenticated Organizer attempts any artist-document operation on another Organizer's concert
- **THEN** the system returns HTTP 403 and performs no document, object, biography, or Kafka mutation

#### Scenario: Cross-concert document reference is denied
- **WHEN** an Organizer supplies a document id that does not belong to the concert id in the route
- **THEN** the system rejects the request without exposing the other concert's document data

### Requirement: Document listing and detail status
The system SHALL expose owned-concert document listing and detail endpoints. The list MUST include document status and upload time. Detail MUST include `document_id`, `status`, `uploaded_at`, and, when available, extracted text, generated biography, sanitized failure reason, and generation time.

#### Scenario: Organizer lists owned documents
- **WHEN** the concert owner calls `GET /admin/concerts/:concertId/documents`
- **THEN** the system returns that concert's documents with status and `uploaded_at`, without documents from other concerts

#### Scenario: Organizer observes a terminal result
- **WHEN** the owner requests a completed or failed document by id
- **THEN** the response includes only the optional result or failure fields that exist for that document

### Requirement: Durable asynchronous status machine
PostgreSQL MUST be authoritative for document and biography state. A document SHALL progress through `uploaded -> extracting -> extracted -> generating -> done`, or transition to `failed` from processing, and terminal state changes MUST be persisted before the worker commits the Kafka offset.

#### Scenario: Successful processing transition
- **WHEN** a worker completes extraction and AI generation
- **THEN** the document transitions in order to `done` and its biography is persisted as `done` before the event offset is committed

#### Scenario: Worker crashes before completion
- **WHEN** the worker crashes before committing the event offset
- **THEN** Kafka can redeliver the event and another consumer can resume idempotently from durable state

### Requirement: PDF extraction and cleaning
The Background Worker MUST download the PDF from MinIO, extract text outside the API request path, normalize it into cleaned text, and store the cleaned text. It MUST treat cleaned text shorter than 50 characters as a permanent extraction failure.

#### Scenario: Text PDF is extracted
- **WHEN** a PDF produces at least 50 characters after cleaning
- **THEN** the system persists the cleaned text, marks the document `extracted`, and continues to generation

#### Scenario: Scanned or empty PDF cannot be extracted
- **WHEN** cleaned extraction yields fewer than 50 characters
- **THEN** the system marks processing failed with `Could not extract text. Please upload a text-based PDF.` and does not retry or call the AI model

### Requirement: AI biography generation through an adapter
The worker MUST send a controlled prompt and no more than 4,000 characters of cleaned press-kit text to the configured OpenAI, Gemini, or mock adapter. A successful result MUST be stored in `ai_artist_bios` with status `done`, `generated_bio`, and `generated_at`, and the associated document MUST become `done`.

#### Scenario: AI adapter generates a biography
- **WHEN** extraction succeeds and the configured AI adapter returns a valid biography
- **THEN** the system persists one completed biography for the document and marks the document `done`

#### Scenario: Local mock adapter is configured
- **WHEN** the application runs locally without a live AI credential
- **THEN** the worker can generate a deterministic biography through the same adapter contract

### Requirement: Failure-specific retry policy
The worker MUST retry MinIO timeout failures at most three times using exponential backoff, AI timeout failures at most two times, and AI rate-limit failures only after waiting at least 60 seconds. When the applicable limit is exhausted, it MUST persist `failed` state and a sanitized failure reason.

#### Scenario: Transient MinIO timeout recovers
- **WHEN** a MinIO download times out and succeeds within three attempts
- **THEN** the worker continues the pipeline without marking the document failed

#### Scenario: AI timeouts are exhausted
- **WHEN** the AI model continues timing out through the permitted two retries
- **THEN** the worker marks the document and biography failed with a safe failure reason and commits the terminal outcome

#### Scenario: AI provider rate limits the request
- **WHEN** the AI adapter reports a rate limit
- **THEN** the worker waits at least 60 seconds before the next bounded attempt

### Requirement: Idempotent event processing
The `ai.bio.requested` consumer MUST tolerate duplicate delivery by keying work to `document_id`, treating completed documents as terminal, using conditional state transitions, and enforcing at most one `ai_artist_bios` row per document.

#### Scenario: Completed event is redelivered
- **WHEN** Kafka redelivers an event for a document already marked `done`
- **THEN** the consumer acknowledges it without creating another biography row or changing the completed output

### Requirement: Biography regeneration
The system SHALL expose `POST /admin/concerts/:concertId/documents/:documentId/regenerate`. For an owned source document it MUST create a new `artist_documents` attempt with status `uploaded`, reuse the source PDF storage object, publish a new `ai.bio.requested` event, and return HTTP 202 with the new document id.

#### Scenario: Owner regenerates from an existing press kit
- **WHEN** the concert owner requests regeneration for an existing document
- **THEN** the original attempt remains unchanged and the response identifies a newly queued document attempt

### Requirement: Manual biography override
The system SHALL expose `PUT /admin/concerts/:concertId/documents/:documentId/bio` for the concert owner. It MUST validate a non-empty `generated_bio`, update that document's biography directly as `done`, keep the document `done`, and invalidate public concert-detail cache.

#### Scenario: Owner edits generated content
- **WHEN** the owner submits a valid manual biography for a completed document
- **THEN** the system returns HTTP 200 with the updated biography and subsequent public detail reads can display the edit

#### Scenario: No editable biography exists
- **WHEN** the owner attempts an override before a biography record exists
- **THEN** the system returns a conflict error without creating an unrelated biography

### Requirement: Conditional public biography exposure
`GET /concerts/:concertId` MUST remain unauthenticated and include `artist_bio` only from the latest `ai_artist_bios` record for that concert whose status is `done`, ordered by biography creation time descending. The property MUST be omitted entirely when no completed biography exists, including while processing or after failure.

#### Scenario: Latest completed biography is public
- **WHEN** a published concert has one or more completed biographies
- **THEN** public concert detail includes `artist_bio` from the newest completed biography, including any manual edit

#### Scenario: Biography is unavailable
- **WHEN** a concert has no document or its latest attempts are only processing or failed and no earlier completed biography exists
- **THEN** public concert detail succeeds and omits the `artist_bio` property entirely

#### Scenario: AI infrastructure is unavailable
- **WHEN** MinIO, Kafka, or the AI model is degraded
- **THEN** public concert browsing and detail remain available independently of the generation workflow

### Requirement: Organizer admin user experience
The Organizer Web Application MUST accept `.pdf` only, reject files over 10 MB client-side, upload through the admin API, and poll document detail every 3â€“5 seconds while processing. It MUST stop polling at a terminal state and show generated content, failure reason, Regenerate, and Edit Manually controls as applicable.

#### Scenario: UI tracks generation to completion
- **WHEN** an Organizer uploads a valid PDF and the job is processing
- **THEN** the UI refreshes status every 3â€“5 seconds and stops when it displays `done` or `failed`

#### Scenario: Client validation catches an oversized file
- **WHEN** an Organizer selects a PDF larger than 10 MB
- **THEN** the UI displays a validation error without sending the upload request

### Requirement: Standard error envelope and secret hygiene
All new API errors MUST use `{ error: string, message: string, status_code: number }`. Admin responses MUST NOT expose storage credentials, raw provider errors, prompts, or internal object access details.

#### Scenario: Protected endpoint fails
- **WHEN** a new admin request fails validation, authorization, conflict, or dependency handling
- **THEN** the response uses the standard error envelope and contains no provider secrets or raw internal errors

### Requirement: Deferred press-kit selection during concert creation
The Organizer Web Application SHALL provide an optional Artist Bio PDF selector during concert creation. It MUST accept only a PDF no larger than 10 MB client-side, retain the file without uploading it before concert creation, and upload it through `POST /admin/concerts/:concertId/documents` only after the Backend API returns the created concert ID.

#### Scenario: Selected press kit is uploaded after concert creation
- **WHEN** an Organizer submits a valid concert with a valid selected PDF
- **THEN** the Web Application creates the concert first and sends the PDF upload using the returned concert ID

#### Scenario: Invalid selected press kit is rejected locally
- **WHEN** an Organizer selects a non-PDF file or a PDF larger than 10 MB
- **THEN** the Web Application displays a validation error and does not include an Artist Bio upload in the create flow

### Requirement: Embedded Artist Bio editor
The Organizer Edit Concert page SHALL embed the existing Artist Bio experience, including PDF upload, document history, document selection, status display, polling every four seconds while processing, generated biography display, sanitized failure details, manual editing, and regeneration. Polling MUST stop when the selected attempt becomes `done` or `failed`.

#### Scenario: Embedded editor tracks generation
- **WHEN** an Organizer opens an owned editable concert and selects a processing document
- **THEN** the page refreshes its detail every four seconds until it displays a terminal state

#### Scenario: Organizer reviews and edits completed content
- **WHEN** an owned document is `done`
- **THEN** the embedded editor displays the generated biography and permits a non-empty manual edit through the existing endpoint

#### Scenario: Organizer regenerates an attempt
- **WHEN** an Organizer requests regeneration for an eligible owned document
- **THEN** the embedded editor queues a new attempt through the existing endpoint and selects the returned document for status monitoring

### Requirement: Shared standalone and embedded behavior
The standalone Artist Bio route and the embedded Edit Concert experience MUST use shared API, validation, polling, state-management, and presentation behavior. The standalone route SHALL remain functional for backward compatibility.

#### Scenario: Existing standalone route remains usable
- **WHEN** an Organizer navigates to the existing Artist Bio route for an owned concert
- **THEN** the shared experience provides the same document history and management behavior as the Edit Concert page

### Requirement: Lifecycle-aware Artist Bio access
The system SHALL allow an authorized Organizer to list and inspect Artist Bio documents for an owned concert in any lifecycle state, but MUST reject upload, manual edit, and regeneration when the concert is cancelled, ongoing, or ended. The Web Application MUST disable the corresponding controls, and the Backend API MUST enforce the lifecycle rule independently.

#### Scenario: Read-only concert displays existing Artist Bio data
- **WHEN** an Organizer opens a cancelled, ongoing, or ended owned concert
- **THEN** existing documents and biography results remain visible while mutation controls are disabled

#### Scenario: Direct mutation request cannot bypass read-only state
- **WHEN** an authorized owner directly calls an Artist Bio mutation endpoint for a cancelled, ongoing, or ended concert
- **THEN** the Backend API returns a controlled conflict response and performs no document, object, biography, or Kafka mutation

### Requirement: Correct UTF-8 Artist Bio content
The Artist Bio user interface, controlled AI prompts, and associated assertions touched by this change MUST contain correctly encoded UTF-8 Vietnamese text and MUST NOT depend on mojibake strings.

#### Scenario: Vietnamese prompt and UI are rendered correctly
- **WHEN** the Artist Bio UI renders or the AI adapter builds its controlled Vietnamese prompt
- **THEN** Vietnamese diacritics are preserved correctly and automated tests assert the intended text

