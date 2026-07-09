## Context

The TicketBox frontend currently routes `/` and `/home` to the public concerts experience, while the app already has a role-based redirect helper and organizer-specific route protection. The change is to make the web experience auth-first without changing backend behavior or redesigning the existing auth pages.

## Goals / Non-Goals

**Goals:**

- Make unauthenticated users land on login first.
- Keep `/login` and `/register` publicly accessible.
- Redirect authenticated users from public entry routes to the appropriate role-based destination.
- Preserve organizer-only route protection for organizer and admin pages.
- Keep the change scoped to frontend routing, header rendering, and auth redirect handling.

**Non-Goals:**

- No backend changes.
- No redesign of the auth pages.
- No changes to role names or backend access-control logic.
- No expansion beyond frontend routing/header/auth behavior.

## Decisions

- Use a lightweight `RequireAuth` guard for audience-facing routes so unauthenticated users are redirected to `/login` before viewing protected pages.
- Use a `RedirectIfAuthenticated` guard for `/`, `/home`, `/login`, and `/register` so authenticated users are sent to their role-based destination instead of remaining on the auth pages.
- Keep the existing `RequireOrganizer` guard for organizer/admin routes and preserve its current role-based behavior.
- Reuse the existing role helper in `frontend/src/features/auth/session.ts` rather than introducing a parallel redirect implementation.
- Keep the guard logic minimal and centralized in `frontend/src/app/router.tsx` to avoid scattering auth behavior across the app.

## Risks / Trade-offs

- [Redirect loops] → Mitigation: ensure `RequireAuth` redirects only unauthenticated users and `RedirectIfAuthenticated` only handles authenticated users, with `/login` and `/register` remaining public entry points.
- [Header state mismatch after login/logout] → Mitigation: derive header links from auth state and re-render on auth-change events.
- [Role-based fallback ambiguity] → Mitigation: preserve the current audience default for non-organizers and keep organizer/admin routes protected by the existing organizer logic.
