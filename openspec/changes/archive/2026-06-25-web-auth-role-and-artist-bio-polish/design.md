## Context

This polish change sits on top of the archived Auth/RBAC Phase 2 and AI Artist Bio work. The backend already treats PostgreSQL as the source of truth for roles, refresh tokens, and AI Artist Bio processing state. The frontend already has a login page, public concerts, and an Organizer AI Artist Bio admin page.

## Decisions

### 1. Use database-derived roles in auth responses, not JWT role claims

The login and `/auth/me` responses include a user profile with roles loaded from PostgreSQL. JWT payloads remain identity-only. The web app can use the returned roles for routing and navigation, while all final authorization continues to happen in backend guards and domain services.

### 2. Keep Check-in Staff mobile-only

A user with only `CHECKIN_STAFF` is not given a web session. The login page shows a clear message that the account is intended for the mobile check-in app. No `/checkin` web route and no staff web page are introduced.

### 3. Add light frontend Organizer guards

The web app stores server-derived role codes after login. `/admin/*` routes check for `ORGANIZER` and redirect non-Organizers to public concerts. This is a UI guard only; backend endpoints remain protected by JWT, permissions, and ownership checks.

### 4. Make AI Artist Bio discoverable from concert detail

Organizer users see an AI Artist Bio action on the current concert detail page. It links to the existing `/admin/concerts/:concertId/artist-bio` workflow so the upload and review experience is reached from the object being managed.

### 5. Generate Vietnamese biographies by default

The AI prompt is written in Vietnamese and explicitly asks for Vietnamese plain text, no invented facts, and a public concert-page tone. The mock provider also returns a Vietnamese prefix so local and automated verification match the production language contract.

### 6. Decode multipart file names before persistence

Uploaded PDF names from multipart can arrive as UTF-8 bytes interpreted as Latin-1, causing Vietnamese mojibake in document history. The upload service decodes the filename before PDF extension validation and database persistence, falling back to the original name if decoding produces replacement characters.

## Verification

- Frontend tests cover Audience redirect, Organizer redirect, and Check-in Staff-only web blocking.
- Frontend typecheck and production build pass.
- Backend tests cover Vietnamese mock output and Vietnamese PDF filename decoding.
- Backend test suite and build pass.

## Non-Goals

- Add a web check-in experience for staff.
- Change backend staff assignment semantics or mobile check-in authorization.
- Backfill already-uploaded document names or already-generated English biographies in the database.