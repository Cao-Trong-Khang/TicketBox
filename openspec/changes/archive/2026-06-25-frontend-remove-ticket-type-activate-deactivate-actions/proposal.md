## Why

Organizer users currently see activate and deactivate controls beside ticket types in the edit experience, which is more stateful than the product decision wants. Simplifying that UI to an edit-only experience reduces confusion and keeps the organizer workflow aligned with the preferred active-and-editable model.

## What Changes

- Remove Activate and Deactivate controls from organizer ticket-type rows on the edit concert page.
- Apply the same simplification to the legacy organizer ticket-type management page.
- Keep ticket-type status visible as read-only text or badge information.
- Preserve create, edit, and validation behavior for organizer ticket types.
- Preserve the existing create-concert flow that auto-activates newly created ticket types.
- Leave backend endpoints and backend API behavior unchanged.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- None

## Impact

- Frontend organizer ticket-type UI in the edit concert experience and legacy management route.
- Frontend tests covering organizer ticket-type actions.
- No backend, payment, notification, QR, or check-in code changes.
