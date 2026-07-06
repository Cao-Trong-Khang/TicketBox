## Specification: Integrated AI Artist Bio Management

## Description

This change lets an Organizer select a PDF press kit while creating a concert and manage the existing asynchronous AI Artist Bio workflow directly inside the Edit Concert page. Audience users continue to receive only the latest completed biography through public concert detail, and Check-in Staff receive no access. The capability depends on the Web Application, Backend API, PostgreSQL, MinIO, Kafka, Background Worker, Redis, and the configured external AI Model or local mock adapter.

## Main Flow

1. The Organizer optionally selects a valid PDF in the Web Application while preparing a concert.
2. After the Backend API creates the owned concert and returns its ID, the Web Application uploads the PDF through the existing artist-document endpoint.
3. The Backend API stores authoritative document state in PostgreSQL, stores the private PDF in MinIO, and publishes the existing Kafka event.
4. The Background Worker extracts text, invokes the configured AI adapter, persists the result, and invalidates the Redis concert-detail cache.
5. The Edit Concert page polls document detail every four seconds and presents history, status, generated content, manual editing, regeneration, or sanitized failure details.
6. The Audience public concert detail continues to show only the latest completed biography.

## Failure Scenarios

- Invalid or oversized PDFs are rejected before upload and are still validated by the Backend API.
- Kafka, MinIO, or AI Model failure does not roll back a successfully created concert or make public concert browsing unavailable.
- A failed upload or generation attempt remains visible for recovery from the Edit Concert page.
- Unauthorized, non-owning, or read-only mutation requests are rejected without document, object, biography, or Kafka mutation.

## Constraints

- Artist Bio mutations require Bearer authentication, Organizer role, `concert:update` permission, concert ownership, document-to-concert validation, and an editable upcoming concert lifecycle.
- PostgreSQL remains authoritative for document and biography state.
- Existing endpoint paths, event payloads, status transitions, retry limits, storage layout, cache invalidation, and public biography selection MUST remain compatible.
- AI generation remains optional and asynchronous and MUST NOT block concert publication or public browsing.
- UI and AI prompt text touched by this change MUST be valid UTF-8 Vietnamese.

## Acceptance Criteria

- Automated tests verify deferred upload, four-second polling, terminal-state handling, manual edits, regeneration, failures, read-only behavior, standalone-route compatibility, correct UTF-8 text, and unchanged public biography selection.
- A local Docker Compose demo can create a concert with a press kit, navigate immediately to Edit Concert, observe processing, and display the completed biography publicly.

## ADDED Requirements

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
