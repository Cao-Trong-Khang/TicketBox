## Why

Organizer-only routes in the web app currently lack consistent client-side protection, and the Admin Dashboard's "Concert Management" card does not clearly guide organizers to the organizer console. This change improves access control and navigation clarity for organizer-only flows without changing backend behavior or redesigning the dashboard.

## What Changes

- Protect the organizer console routes `/organizer/concerts`, `/organizer/concerts/new`, and `/organizer/concerts/:id/edit` with the existing organizer guard so non-organizers are redirected to `/concerts`.
- Make the "Concert Management" card on the Admin Dashboard navigate to `/organizer/concerts`.
- Leave the other dashboard cards unchanged and avoid refactoring the routing system or backend authorization.

## Capabilities

### New Capabilities

- `organizer-route-access`: Frontend organizer route protection and navigation behavior for organizer-only views.

### Modified Capabilities

- None.

## Impact

- Frontend router and organizer-related pages in the web application.
- Admin dashboard UI and card interaction behavior.
- Existing organizer role checks already used by the frontend auth/session logic.
- No backend API or database changes are required for this change.
