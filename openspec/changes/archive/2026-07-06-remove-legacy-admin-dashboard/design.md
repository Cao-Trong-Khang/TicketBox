## Context

The frontend already has a centralized post-login redirect helper, protected organizer routes, and a dedicated organizer console under /organizer/concerts. The legacy admin dashboard is still present as a route entry in the router and as a page component, so organizer users can still reach an outdated screen and tests still assert that behavior.

This change is limited to the web application layer. It does not require backend API changes, database changes, or new infrastructure. The existing JWT-based auth flow, role-based route guards, and organizer routing structure remain the foundation for the new behavior.

## Goals / Non-Goals

**Goals:**

- Replace the organizer post-login destination with the existing organizer console route.
- Remove the legacy admin dashboard route from the active router configuration.
- Keep current organizer route protection and redirect behavior for non-organizer users intact.

**Non-Goals:**

- No backend authentication redesign.
- No new organizer dashboard features beyond the redirect and route cleanup.
- No changes to audience or check-in flows.

## Decisions

### 1. Centralize the redirect change in the shared auth/session helper

The existing session helper already decides the post-login destination based on user roles. Updating that helper is the smallest change that ensures all successful sign-ins use the same destination logic.

Alternatives considered:

- Updating only the login page component: rejected because it would leave other auth entry points inconsistent.
- Adding a one-off redirect in the router: rejected because it would not cover the shared login success flow.

### 2. Remove the legacy route from the active router configuration

The old /admin/dashboard route should no longer be mounted in the frontend router. This makes the route unavailable and avoids keeping dead UI in the app shell.

Alternatives considered:

- Leaving the route in place but redirecting it to /organizer/concerts: rejected because it preserves a stale path and does not remove the outdated screen from the app structure.

### 3. Keep existing organizer guards and organizer routes unchanged

The change should preserve the current organizer route protections and the existing organizer console experience. Only the destination and the obsolete dashboard route change.

Alternatives considered:

- Reworking the organizer route tree or adding new role-based redirects in multiple places: rejected because it would expand scope and increase risk.

## Risks / Trade-offs

- [Existing tests or direct links may still assume /admin/dashboard exists] → Update tests and route expectations as part of the change.
- [Some admin-dashboard-only UI code may be left unused] → Remove or retire that page/component if it is no longer referenced after the route change.
- [Role handling may need to be validated for non-organizer users] → Keep the existing redirect decision for audience users and preserve unauthorized redirect behavior.

## Migration Plan

1. Update the shared auth redirect helper to use /organizer/concerts for organizer users.
2. Remove the legacy admin dashboard route entry from the router.
3. Remove or retire the old page component if it is no longer referenced.
4. Update frontend tests to match the new route and redirect behavior.
5. Run frontend lint, tests, and build to verify the change.

Rollback is straightforward because this change only removes a route and changes a redirect target; the previous behavior can be restored by reintroducing the old route and redirect mapping if needed.

## Open Questions

- Should any additional analytics or navigation entry point be added for the organizer console, or is the existing /organizer/concerts route sufficient as the landing destination?
