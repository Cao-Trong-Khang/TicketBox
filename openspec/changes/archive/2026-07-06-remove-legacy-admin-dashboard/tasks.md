## 1. Frontend redirect and routing cleanup

- [x] 1.1 Update the shared auth/session redirect helper so organizer users resolve to /organizer/concerts after successful sign-in.
- [x] 1.2 Remove the legacy /admin/dashboard route from the frontend router configuration.
- [x] 1.3 Retire the old admin dashboard page component and any route-only UI references that are no longer needed.

## 2. Tests and verification

- [x] 2.1 Update frontend auth and routing tests to expect the new organizer redirect target and the removal of /admin/dashboard.
- [x] 2.2 Run frontend lint, relevant tests, and the production build to verify the change.
