## Why

Organizer users can already create and manage concerts, but they still cannot manage the ticket types that define what audiences can purchase for each concert. This leaves an important part of the organizer workflow incomplete and prevents the organizer experience from reaching the intended MVP depth.

## What Changes

- Add a new organizer ticket-type management page at /organizer/concerts/:concertId/ticket-types.
- Enable organizers to list, create, edit, activate, and deactivate ticket types for their own concerts.
- Replace the current dashboard placeholder action for Quản lý vé with a working navigation entry.
- Keep the scope limited to frontend organizer management behavior and existing backend APIs.

## Capabilities

### New Capabilities

- organizer-ticket-type-management: organizer ticket-type list, create, edit, activate, and deactivate flows in the web app.

### Modified Capabilities

- organizer-dashboard: organizer dashboard now routes ticket-type management from the dashboard action.

## Impact

- Frontend organizer routes, pages, and shared UI under the organizer concert feature area.
- Frontend organizer API helpers and localized error handling for ticket-type flows.
- Existing public concert detail behavior remains unchanged except that it continues to show only active ticket types.
