## 1. Routing and guard setup

- [x] 1.1 Add a minimal `RequireAuth` guard for audience-facing routes in `frontend/src/app/router.tsx`
- [x] 1.2 Add a `RedirectIfAuthenticated` guard for `/`, `/home`, `/login`, and `/register`
- [x] 1.3 Preserve the existing `RequireOrganizer` behavior for organizer/admin routes

## 2. Header and auth state updates

- [x] 2.1 Update `frontend/src/components/layout/AppShell.tsx` so unauthenticated users see only the brand/title
- [x] 2.2 Update the header so authenticated users see the brand/title plus logout only
- [x] 2.3 Ensure header state updates correctly after login and logout

## 3. Session helper refinement

- [x] 3.1 Add or reuse a small authentication helper in `frontend/src/features/auth/session.ts` for auth presence checks
- [x] 3.2 Keep role-based redirect logic aligned with existing audience/organizer behavior

## 4. Regression tests

- [x] 4.1 Update `frontend/src/App.test.tsx` for `/` redirecting to login when unauthenticated
- [x] 4.2 Add coverage for authenticated redirects from `/`, `/home`, `/login`, and `/register`
- [x] 4.3 Verify protected routes redirect unauthenticated users to login
- [x] 4.4 Verify the header no longer renders the old nav links in the new auth-first state
