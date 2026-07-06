## Context

TicketBox already implements AI Artist Bio as an event-driven workflow. The Organizer Web Application uploads a PDF to the NestJS Backend API; the API stores the private object in MinIO, persists `artist_documents` in PostgreSQL, and publishes `ai.bio.requested` to Kafka. A Background Worker extracts text, invokes the configured AI Model adapter, persists `ai_artist_bios`, and invalidates the Redis concert-detail cache. The current UI exposes this workflow only through `ArtistBioAdminPage`, while organizer concert creation and editing use `OrganizerConcertForm` on separate pages.

This change affects Organizer users directly and Audience users only through the unchanged public display of the latest completed biography. Check-in Staff are unaffected. The design must preserve asynchronous failure isolation, server-side role/permission/ownership checks, the existing document APIs and status machine, PostgreSQL authority, and the availability of public concert browsing when AI infrastructure is degraded.

## Goals / Non-Goals

**Goals:**

- Let an Organizer optionally select a press-kit PDF during concert creation and queue it only after a concert ID exists.
- Embed the complete Artist Bio management experience in the Edit Concert page.
- Share upload, document history, polling, manual edit, regeneration, and error presentation between the embedded editor and standalone route.
- Make post-create partial outcomes explicit without rolling back a successfully created concert.
- Enforce the same read-only lifecycle used by the concert editor for Artist Bio mutations while retaining read access.
- Repair touched Vietnamese UI and AI prompt text as UTF-8 and make tests assert the corrected text.

**Non-Goals:**

- Replacing MinIO, Kafka, PostgreSQL, Redis, the AI adapter, or the worker.
- Adding database tables, columns, endpoints, events, synchronous AI generation, or a new external service.
- Making a generated biography mandatory for concert creation or publication.
- Waiting for AI completion before returning from concert creation or navigating to the editor.
- Changing how the public API selects the latest completed biography.

## Decisions

### 1. Treat the create-page PDF as deferred client state

`OrganizerConcertForm` will validate and retain an optional `File`, then return it beside the selected banner file in its submit options. `OrganizerConcertCreatePage` will first create the concert through the unchanged JSON endpoint and only then call the existing multipart artist-document endpoint with the returned ID.

This avoids temporary upload tokens, orphan-document APIs, and database changes. Uploading before concert creation was rejected because the existing authorization and storage model requires an owned concert ID.

### 2. Model post-create work as independent, recoverable operations

After concert creation, ticket-type setup and optional press-kit upload are independent post-create operations. The page will attempt both branches even if one fails, collect their outcomes, and navigate to the Edit Concert page with structured feedback identifying successful and failed branches. Ticket drafts remain sequential within their branch because each ticket type must be created before it is activated.

Concert creation is the commit boundary: no compensating delete or rollback occurs after the concert exists. The generated biography is optional, and a Kafka or AI failure must not reinterpret the successful concert response as failure. This is consistent with the existing event-driven architecture and failure isolation goals.

### 3. Extract one reusable Artist Bio feature surface

The current `ArtistBioAdminPage` state and rendering will be moved into a reusable `ArtistBioPanel` (with smaller child components or a hook where useful). It accepts a `concertId` and `isReadonly` contract. The Edit Concert page renders it with lifecycle-derived read-only state; the standalone route remains a thin wrapper that resolves the concert and applies the same lifecycle rule.

API calls, document selection, four-second polling, terminal-state detection, upload validation, manual editing, regeneration, and error conversion live in the shared feature. Duplicating a second editor implementation was rejected because polling and partial status behavior would drift.

### 4. Preserve asynchronous status behavior

The panel continues to poll document detail every four seconds while the selected document is non-terminal and stops at `done` or `failed`. Upload and regeneration only wait for HTTP 202 and then select the newly returned document attempt. Navigation away does not cancel server-side processing because durable PostgreSQL state and Kafka own the workflow.

No frontend optimistic `done` state is introduced. PostgreSQL remains authoritative, and Audience users see content only after the existing worker or manual-edit transaction marks a biography `done` and invalidates the Redis detail cache.

### 5. Enforce read-only behavior in both client and domain service

The UI disables upload, manual edit, and regeneration when a concert is cancelled, ongoing, or ended, matching `OrganizerConcertEditPage` lifecycle semantics. Listing and detail remain available.

Because UI disabling is not authorization, Artist Bio mutation service methods will also reject non-editable concert lifecycle states after authentication, `concert:update` permission, organizer role, ownership, and document-to-concert checks. Existing endpoint paths and ownership rules remain intact. A controlled conflict response prevents direct API calls from bypassing the editor state.

### 6. Keep failure feedback specific and non-secret

Create-page feedback distinguishes ticket setup failure from press-kit queue failure and always includes a route to the created concert. The embedded panel displays only existing sanitized failure reasons. It does not expose AI prompts, provider responses, credentials, or MinIO object details.

### 7. Correct mojibake at source and test the intended language

Touched frontend source, provider prompt strings, and tests will be rewritten as valid UTF-8. Tests that currently match corrupted byte-decoding artifacts will instead assert correct Vietnamese text. No runtime re-encoding shim will be added because that would preserve corrupted source and create inconsistent behavior.

## Risks / Trade-offs

- **Concert exists while post-create setup is incomplete** → Always navigate to its editor with branch-specific recovery feedback and retain the existing management controls.
- **Two post-create branches produce mixed outcomes** → Collect outcomes independently instead of short-circuiting on the first rejected promise.
- **The browser closes after concert creation but before PDF upload** → The concert remains valid; the Organizer can upload the PDF from Edit Concert later.
- **AI processing outlives the page session** → Durable Kafka/PostgreSQL processing continues, and the editor reloads status on return.
- **Shared panel refactoring regresses the standalone route** → Keep the route and add the same interaction tests against both hosts.
- **Frontend and backend disagree on read-only timing** → Centralize frontend lifecycle calculation and add backend service tests for cancelled, ongoing, and ended concerts.
- **Large encoding cleanup creates unrelated diffs** → Limit correction to Artist Bio files, organizer concert files modified by this change, and their tests.

## Migration Plan

1. Introduce shared Artist Bio UI without removing the standalone route.
2. Add the embedded Edit Concert panel and lifecycle-aware mutation guards.
3. Add deferred PDF selection and post-create orchestration.
4. Correct touched UTF-8 strings and update tests.
5. Run focused frontend/backend tests, then full regression suites.
6. Rebuild and restart both the Backend API and AI Bio Worker Docker images.

Rollback consists of reverting the frontend integration and service lifecycle guard. No data migration or database rollback is required because schemas, stored documents, events, and existing biographies are unchanged.

## Open Questions

None. The existing architecture and APIs support the integration without changing the global Proposal or Technical Design.
