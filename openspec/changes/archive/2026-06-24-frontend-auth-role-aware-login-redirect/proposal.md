## Why

After login, organizers currently land in the same public-facing experience as audience users, which makes the organizer dashboard harder to discover and use. A role-aware redirect keeps the experience aligned with the user's role without introducing a broad auth-system rewrite.

## What Changes

- After a successful login, the frontend will determine the authenticated user's role and route them to the appropriate landing page.
- Organizer users will be sent to /organizer/concerts, while audience users will continue to the public concert experience at /concerts.
- The change will use the existing authentication flow and the existing backend profile endpoint, keeping the login response contract unchanged.
- No global route guard, no auth context rewrite, and no unrelated organizer CRUD UI changes are included.

## Capabilities

### New Capabilities

- auth-role-redirect: authenticated users can be routed to role-appropriate frontend destinations after login.

### Modified Capabilities

- None.

## Impact

- Frontend auth flow in the React/Vite app.
- Existing auth API helper and shared UI components.
- Minimal backend change to the existing /auth/me response to expose role codes.
