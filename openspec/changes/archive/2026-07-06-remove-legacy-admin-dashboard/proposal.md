## Why

The legacy admin dashboard route is still wired into the frontend router and organizer authentication flow, which causes organizer users to land on an outdated screen after sign-in instead of the current organizer console. Removing that route and updating the redirect target will simplify the organizer experience and eliminate a stale entry point from the app.

## What Changes

- Remove the legacy /admin/dashboard route from the frontend router and retire the old admin dashboard page.
- Change organizer post-login redirection so organizer users land on /organizer/concerts after successful authentication.
- Preserve existing organizer management routes and the existing organizer guard behavior for protected organizer pages.
- Update frontend tests and route expectations to reflect the new organizer landing experience.
- BREAKING: direct navigation to /admin/dashboard will no longer be supported.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- organizer-route-access: organizer users will no longer be routed through the legacy admin dashboard and will instead reach the organizer concert console after sign-in.

## Impact

Frontend routing, auth/session redirect handling, organizer route tests, and any legacy admin-dashboard-only UI or styles that are no longer referenced by the active organizer experience.
