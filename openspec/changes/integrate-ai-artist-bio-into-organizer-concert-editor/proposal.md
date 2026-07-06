## Why

Organizer users currently manage AI-generated artist biographies on a separate admin page, disconnected from the concert creation and editing workflow where artist and publication information is prepared. Integrating the existing asynchronous press-kit workflow into the organizer concert editor reduces navigation friction while preserving failure isolation, review controls, and public browsing availability.

## What Changes

- Add an optional PDF press-kit selector to the Organizer Create Concert experience, using the existing PDF-only and 10 MB validation rules.
- Defer press-kit upload until the concert API returns a concert ID, then queue generation through the existing artist-document endpoint without waiting for the AI result.
- Treat concert creation as successful even when post-create ticket setup or press-kit upload fails, and present precise partial-success recovery feedback.
- Redirect successful creation to the Organizer Edit Concert page so generation status can be monitored.
- Embed document upload, history, four-second polling, generated biography review, manual editing, failure details, and regeneration in the Organizer Edit Concert page.
- Extract reusable Artist Bio UI and state management so the embedded editor and existing standalone route share one implementation.
- Make biography mutations unavailable when the concert editor is read-only while retaining read access to existing results.
- Correct corrupted Vietnamese text in touched Artist Bio and organizer concert source files, AI prompts, and tests, and store the corrected files as UTF-8.
- Preserve the current MinIO, Kafka, worker, AI adapter, PostgreSQL, Redis invalidation, authorization, ownership, and public biography behavior; no new backend endpoint, database, or external service is introduced.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `ai-artist-bio`: Extend the Organizer Web Application requirements so the existing asynchronous workflow is available inside concert creation and editing, supports read-only presentation, and remains available through the standalone route.
- `organizer-concert-management`: Extend concert creation behavior with an optional post-create press-kit upload, non-transactional partial-success handling, and redirect to the editor for asynchronous monitoring.

## Impact

- **Roles:** Organizer users gain the integrated workflow. Audience users continue to see only the latest completed biography. Check-in Staff behavior and access are unchanged.
- **Frontend:** Affects the shared organizer concert form, Create Concert page, Edit Concert page, standalone Artist Bio page, Artist Bio API integration, styles, and associated tests.
- **Backend:** Existing artist-document APIs and AI worker contracts remain unchanged; only corrupted Vietnamese provider prompt text and its tests require correction.
- **External systems:** Continues to interact with the configured AI Model through the existing adapter. It does not interact with VNPAY/MoMo, the Email Provider, or Sponsor CSV Files.
- **Architecture and constraints:** Supports the global Organizer administration goal and the asynchronous AI status/fallback constraint. PostgreSQL remains authoritative, Kafka remains the asynchronous boundary, MinIO remains private document storage, Redis remains a cache, and AI degradation cannot break concert creation or public concert browsing.
- **Compatibility:** The standalone Artist Bio route remains functional and existing API consumers remain compatible. No conflict with the global Proposal or Technical Design is identified.
