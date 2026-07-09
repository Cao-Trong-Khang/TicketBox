## Why

Organizer-facing concert management is currently missing from the backend API. This change delivers a secure, role-restricted organizer workflow for creating, editing, and publishing concert drafts without altering the existing public concert browsing API.

## What Changes

- Add organizer-only concert management endpoints under `GET /organizer/concerts`, `POST /organizer/concerts`, `GET /organizer/concerts/:id`, `PATCH /organizer/concerts/:id`, and `POST /organizer/concerts/:id/publish`.
- Implement organizer authorization using the existing `JwtAuthGuard` and the current `ROLE_CODES.organizer` role lookup in the database.
- Keep public `ConcertsController` and `ConcertsService` unchanged.
- Add `OrganizerConcertsController` and `OrganizerConcertsService` inside `ConcertsModule` to support organizer-specific create/update/publish operations.
- Enforce ownership checks so organizers can only manage concerts they own, and return `404 NotFound` for missing or non-owned concerts.
- Add DTOs, validation, and publish readiness checks for organizer-managed concerts.

## Capabilities

### New Capabilities

- `organizer-concert-management`: Organizer concert management API for drafting and publishing concerts.

### Modified Capabilities

-

## Impact

- Backend API: new organizer-specific concert endpoints under `organizer/concerts`.
- Backend modules: extend `ConcertsModule` with organizer controller and service.
- Authentication/authorization: use existing JWT auth and database role checks for organizers.
- Caching: invalidate public concert list/detail Redis caches on publish.
- No changes to public concert consumer behavior or frontend pages in this task.
