## 1. UTF-8 Baseline and Shared Validation

- [x] 1.1 Replace mojibake strings with correctly encoded UTF-8 Vietnamese in the Artist Bio provider, Artist Bio frontend, organizer concert files touched by this change, and their tests; verify the provider test asserts the intended Vietnamese prompt/output text. (AI Artist Bio acceptance: correct UTF-8 text)
- [x] 1.2 Extract or reuse one PDF validation helper for `.pdf` MIME/extension checks and the 10 MB limit so Create Concert and the shared Artist Bio panel produce consistent client-side behavior. (AI Artist Bio acceptance: deferred upload validation)

## 2. Backend Lifecycle Enforcement

- [x] 2.1 Extend Artist Bio domain ownership lookup to determine whether the owned concert is upcoming and not cancelled without changing endpoint paths, Prisma schema, event payloads, or storage contracts. (AI Artist Bio acceptance: read-only behavior)
- [x] 2.2 Reject upload, manual biography edit, and regeneration for cancelled, ongoing, or ended concerts with the standard controlled conflict envelope while preserving list and detail access. (AI Artist Bio acceptance: direct mutation cannot bypass read-only state)
- [x] 2.3 Add backend service/controller tests covering owner authorization, document-to-concert validation, editable mutations, read-only mutation rejection with no side effects, and unchanged asynchronous/public behavior. (AI Artist Bio acceptance: authorization and read-only regression coverage)

## 3. Reusable Artist Bio Experience

- [x] 3.1 Extract the current Artist Bio upload, document history, selection, error, and editor state into a reusable `ArtistBioPanel` or equivalent shared feature surface accepting `concertId` and `isReadonly`. (AI Artist Bio acceptance: shared embedded and standalone behavior)
- [x] 3.2 Move four-second polling and terminal-state handling into the shared implementation, including request cleanup when selection or host page changes. (AI Artist Bio acceptance: polling and terminal-state handling)
- [x] 3.3 Implement shared manual edit and regeneration behavior that selects a newly queued regeneration attempt and exposes only sanitized API failure details. (AI Artist Bio acceptance: manual editing, regeneration, and failure presentation)
- [x] 3.4 Convert `ArtistBioAdminPage` into a backward-compatible host for the shared experience and derive the same concert lifecycle read-only state used by the organizer editor. (AI Artist Bio acceptance: standalone-route compatibility)

## 4. Create Concert Integration

- [x] 4.1 Add an optional Artist Bio PDF selector, validation message, selected-file summary, and deferred file state to `OrganizerConcertForm` without adding the file to the concert JSON payload. (Concert Management acceptance: optional press kit and unchanged create contract)
- [x] 4.2 Extend the form submit options to return the optional PDF alongside the existing banner selection and update existing form consumers and tests. (Concert Management acceptance: deferred client state)
- [x] 4.3 Refactor post-create orchestration so ticket setup and optional press-kit upload are independent branches attempted only after a concert ID is returned, while ticket create/activate operations remain ordered within their branch. (Concert Management acceptance: request ordering and independent branch outcomes)
- [x] 4.4 Collect success and failure results for both post-create branches and navigate to `/organizer/concerts/:id/edit` for every successfully created concert with structured, non-secret recovery feedback. (Concert Management acceptance: mixed outcomes and post-create navigation)
- [x] 4.5 Add Create Concert tests for no PDF, invalid PDF, oversized PDF, upload-after-ID ordering, asynchronous HTTP 202 handling, ticket-only failure, PDF-only failure, both failures, and successful navigation. (Concert Management acceptance: happy path and all partial-failure combinations)

## 5. Edit Concert Integration

- [x] 5.1 Embed the shared Artist Bio panel in `OrganizerConcertEditPage` using the loaded concert ID and its existing upcoming/cancelled lifecycle calculation. (AI Artist Bio acceptance: embedded management)
- [x] 5.2 Present queued-generation and branch-specific recovery feedback passed from Create Concert without obscuring normal concert or ticket management feedback. (Concert Management acceptance: recoverable post-create outcomes)
- [x] 5.3 Disable Artist Bio mutation controls for read-only concerts while retaining document history and result visibility, and keep loading/error states independent from the main concert form. (AI Artist Bio acceptance: read-only presentation and availability)
- [x] 5.4 Add Edit Concert and standalone-route tests for upload, history, polling, completed content, manual edit, regeneration, failed state, read-only controls, and shared behavior. (AI Artist Bio acceptance: embedded and backward-compatible behavior)

## 6. Regression and Local Verification

- [x] 6.1 Run focused backend Artist Bio tests and frontend Artist Bio, organizer form, and organizer page tests; resolve regressions without changing the established endpoint or status contracts. (Both specs: automated acceptance coverage)
- [x] 6.2 Run the full backend and frontend test suites to verify concert creation/editing, banner upload, ticket types, RBAC/ownership, worker behavior, cache invalidation, and public concert detail remain compatible. (Both specs: regression acceptance)
- [x] 6.3 Rebuild and start the Backend API and AI Bio Worker with Docker Compose, then demo create-with-PDF, immediate redirect, status polling, completed public biography, manual edit, regeneration, partial upload failure recovery, and read-only access. (Both specs: local Docker Compose acceptance)
