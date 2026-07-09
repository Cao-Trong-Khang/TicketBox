## Why

The current frontend already proves that Vite, React, routing, and backend API calls work, but the source layout is still prototype-shaped: `App.tsx` owns route setup, home shell content, navigation behavior, and inline UI styling. Login and register are also placed as generic pages even though they are the first real user workflow.

Before adding TicketBox domain screens, the frontend should have a clearer folder structure and a polished authentication entry point. The first user-facing scope should stay intentionally small: login, register, and an empty home screen.

## What Changes

- Refactor `/frontend/src` into a scalable structure using app-level wiring, shared layout/UI components, feature-level auth code, generic pages, and shared API utilities.
- Keep only three user-visible screens in this change:
  - `/login`
  - `/register`
  - `/`
- Replace the current route-ready/health-style home content with a minimal empty home screen.
- Redesign login and register with shared, responsive UI primitives instead of large inline styles.
- Keep backend auth integration through configured API base URL.
- Use the selected registration flow: successful register shows success feedback and sends the user to `/login`; it does not auto-login.
- On successful login, store `{ accessToken }` in the client and navigate to `/`.
- Remove the current `/profile` route from this frontend shell scope.

## Capabilities

- New: none.
- Modified:
  - `project-foundation`: refine the frontend application foundation into a three-screen auth shell with cleaner source organization.

## Impact

- Affected users:
  - `AUDIENCE`: primary early user flow for registration and login.
  - `ORGANIZER`: indirectly benefits from the same future-ready frontend structure.
  - `CHECKIN_STAFF`: no direct UI in this change.
- Affected code:
  - `frontend/src/App.tsx`
  - `frontend/src/main.tsx`
  - `frontend/src/styles.css`
  - `frontend/src/pages/*`
  - `frontend/src/lib/*`
  - frontend tests under `frontend/src`
- External systems:
  - Backend API auth endpoints are used.
  - No payment provider, email provider, AI service, sponsor integration, or new external service is introduced.
- Non-goals:
  - No RBAC UI enforcement.
  - No concert browsing, ticket purchase, organizer dashboard, or check-in UI.
  - No fake domain data on the home screen.
