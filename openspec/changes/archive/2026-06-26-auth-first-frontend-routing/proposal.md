## Why

The TicketBox web app currently exposes public concert browsing as the default experience at the root URL, which conflicts with the new auth-first product direction. The frontend should present authentication first, while preserving existing role-based behavior for audiences, organizers, and check-in staff.

## What Changes

- Make the web app start from login-first experience when no user is authenticated.
- Redirect authenticated users from public entry points such as `/`, `/home`, `/login`, and `/register` based on stored roles.
- Require authentication for audience-facing concert browsing and order flows.
- Preserve existing organizer-only protection for organizer and admin routes.
- Keep the change scoped to frontend routing, header navigation, and auth redirects only.

## Capabilities

### New Capabilities

- `auth-first-routing`: Frontend route access and redirect behavior for unauthenticated versus authenticated users.

### Modified Capabilities

- `authentication-foundation`: Existing authentication and web routing behavior for login redirect and access control.

## Impact

- Frontend routing in `frontend/src/app/router.tsx`
- Header layout in `frontend/src/components/layout/AppShell.tsx`
- Auth redirect helpers in `frontend/src/features/auth/session.ts`
- Auth-related tests in `frontend/src/App.test.tsx`
