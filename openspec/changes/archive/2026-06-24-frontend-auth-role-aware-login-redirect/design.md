## Context

The frontend already has a simple login flow that stores the JWT and redirects to the home route. The backend already exposes a protected /auth/me endpoint, but it does not currently return role information. The change can be implemented by keeping the existing login response unchanged and enriching the existing profile response with role codes.

## Goals / Non-Goals

**Goals:**

- Route organizers to /organizer/concerts after login.
- Route audience users to /concerts after login.
- Preserve the current token storage behavior and login error handling.
- Keep the change focused on auth and redirect behavior.

**Non-Goals:**

- Add a global route guard.
- Hide or show the organizer navigation link by role.
- Rework the auth context or refresh-token flow.
- Change organizer authorization rules or implement organizer CRUD UI.

## Decisions

- Keep POST /auth/login unchanged and continue returning only accessToken.
- Use the existing GET /auth/me endpoint after login to obtain the current user's roles.
- Return roles from the backend as role code strings such as ORGANIZER.
- In the frontend, redirect to /organizer/concerts when the profile response includes ORGANIZER; otherwise redirect to /concerts.
- If /auth/me fails after login, fall back to /concerts rather than breaking the login flow.

## Risks / Trade-offs

- [The profile request is a second round-trip after login.] → This keeps the backend contract minimal while still providing role-based routing.
- [The frontend will rely on role data from /auth/me.] → The UI remains simple and avoids a broader authentication architecture change.

## Migration Plan

- No database migration is required.
- The backend change is limited to the existing auth profile response shape.

## Open Questions

- None; the implementation can proceed with the agreed minimal approach.
