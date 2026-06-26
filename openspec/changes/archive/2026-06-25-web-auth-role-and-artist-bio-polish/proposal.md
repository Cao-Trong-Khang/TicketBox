## Why

TicketBox already has authentication/RBAC, public concert browsing, and the AI Artist Bio workflow, but the web experience still needed polish around role-aware navigation and Organizer content operations. Staff accounts are intended for the mobile check-in app only, Organizer users need a clear path from a concert to AI Artist Bio management, and generated artist biographies should be Vietnamese for the Vietnamese concert audience. Uploaded Vietnamese PDF file names also need to remain readable in the Organizer document history.

## What Changes

- Return server-side user roles in auth profile responses so the web app can route after login without trusting JWT role claims.
- Store web session roles in `localStorage` after login and route Organizer users to `/admin/dashboard` while Audience users continue to `/concerts`.
- Block `CHECKIN_STAFF`-only accounts from establishing a web session because staff is mobile-only.
- Add an Organizer-only admin dashboard route and protect `/admin/*` routes with a frontend Organizer guard.
- Surface an Organizer action on concert detail that links to the existing AI Artist Bio PDF upload/review route.
- Ensure logout clears access token, refresh token, and stored web roles.
- Change AI Artist Bio prompt and local mock provider output to Vietnamese.
- Decode uploaded PDF file names before validation/storage so Vietnamese names display correctly in document history.
- Add focused frontend and backend tests for role routing, staff-only web blocking, Vietnamese AI output, and PDF filename decoding.

## Capabilities

### Modified Capabilities

- `authentication-foundation`: Auth responses expose server-derived profile roles for web routing, and `/auth/me` returns a profile with roles.
- `rbac-foundation`: Web route access uses stored server-derived roles for UI guards while backend authorization remains server-side.
- `ai-artist-bio`: Organizer entry points, Vietnamese AI generation, and uploaded Vietnamese PDF filename handling are improved.

## Impact

- Backend Auth module returns role-aware profiles from database state and keeps JWT identity-only.
- Frontend Auth shell stores role state for navigation, protects Organizer routes, and blocks mobile-only staff accounts from web sessions.
- Frontend Concert detail gives Organizers a direct path to AI Artist Bio upload/review for the current concert.
- Backend AI Artist Bio provider now asks providers to produce Vietnamese plain text and the mock adapter follows the same language contract.
- Backend document upload preserves Vietnamese PDF filenames in history.
- Existing mobile Check-in Staff semantics are preserved; no web staff page or web check-in route is added.