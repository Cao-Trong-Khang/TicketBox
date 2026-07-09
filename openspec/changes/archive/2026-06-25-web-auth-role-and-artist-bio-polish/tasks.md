## 1. Auth Profile and Role Routing

- [x] 1.1 Return auth user profiles with server-derived roles from login, refresh, and `/auth/me` flows.
- [x] 1.2 Keep JWT payload identity-only and avoid trusting token role claims for authorization.
- [x] 1.3 Store `accessToken`, `refreshToken`, and `userRoles` after successful web login.
- [x] 1.4 Redirect `ORGANIZER` users to `/admin/dashboard` and `AUDIENCE` users to `/concerts` after login.
- [x] 1.5 Clear access token, refresh token, and stored roles on logout.

## 2. Staff Mobile-Only Web Behavior

- [x] 2.1 Preserve existing `CHECKIN_STAFF` role naming and semantics.
- [x] 2.2 Prevent `CHECKIN_STAFF`-only accounts from establishing a web session.
- [x] 2.3 Show a clear login error explaining staff accounts are for the mobile check-in app.
- [x] 2.4 Do not add a staff web route or `/checkin` web experience.

## 3. Organizer Web Navigation

- [x] 3.1 Add `/admin/dashboard` for Organizer users.
- [x] 3.2 Add frontend Organizer guards around `/admin/*` routes.
- [x] 3.3 Show Organizer navigation only for stored `ORGANIZER` role sessions.
- [x] 3.4 Add an Organizer-only AI Artist Bio action on concert detail linking to the existing upload/review route.

## 4. AI Artist Bio Polish

- [x] 4.1 Change the AI prompt to require Vietnamese plain-text biography output.
- [x] 4.2 Change mock AI output to Vietnamese for local/demo consistency.
- [x] 4.3 Decode uploaded Vietnamese PDF filenames before validation and database persistence.
- [x] 4.4 Preserve existing PDF extension, MIME, size, and signature validation behavior.

## 5. Verification

- [x] 5.1 Add frontend tests for Audience routing, Organizer routing, and Check-in Staff-only web blocking.
- [x] 5.2 Add backend tests for Vietnamese AI mock output and Vietnamese PDF filename decoding.
- [x] 5.3 Run frontend tests, frontend typecheck, and frontend production build.
- [x] 5.4 Run backend tests and backend build.