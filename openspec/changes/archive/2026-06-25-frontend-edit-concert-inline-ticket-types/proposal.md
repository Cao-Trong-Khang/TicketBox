## Why

Organizer users can already edit a concert, but ticket-type configuration still lives on a separate management page. This forces extra navigation and makes the edit experience feel split even though the underlying organizer APIs already support concert editing and ticket-type management. Consolidating ticket-type management into the edit page will make concert maintenance simpler and keep the existing organizer workflow aligned with the create-concert experience.

## What Changes

- Add a ticket configuration section inside the organizer edit-concert page at `/organizer/concerts/:id/edit`.
- Load and display the existing ticket types for the selected concert directly on that page.
- Reuse the existing organizer ticket-type APIs, form component, and validation helpers for create, edit, activate, and deactivate actions.
- Remove the separate dashboard action for ticket management so the edit action becomes the single entry point.
- Keep the legacy `/organizer/concerts/:concertId/ticket-types` route for compatibility but redirect it to the edit page.
- Keep the current backend contract unchanged unless a real frontend/backend mismatch is discovered.

## Capabilities

### New Capabilities

- `frontend-edit-concert-inline-ticket-types`: Organizer edit-concert experience that includes inline ticket-type management and redirects the legacy ticket-type route to the edit page.

### Modified Capabilities

- None.

## Impact

- Frontend organizer experience: organizer dashboard, concert edit page, and router navigation.
- Frontend organizer state and form handling: ticket-type loading, validation, create/update/status flows, and read-only behavior for lifecycle-restricted concerts.
- Existing organizer APIs and backend contract: no change required unless validation or response shape mismatches are discovered during implementation.
