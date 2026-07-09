## Why

Organizer users can already create and publish concerts, but they still cannot manage the ticket types attached to those concerts. This change adds a secure organizer-only API for creating, editing, and toggling ticket types so concert inventory can be configured without touching the public ticket browsing experience.

## What Changes

- Add organizer ticket-type management endpoints under the existing organizer concert routes for listing, creating, updating, activating, and deactivating ticket types.
- Enforce organizer authorization and ownership checks so organizers can only manage ticket types for concerts they own.
- Validate ticket-type input rules for code, pricing, quantities, per-user limits, and sale windows while preserving inventory safety.
- Keep the existing public ticket-type API behavior unchanged except that it reflects the latest active ticket types after organizer changes.

## Capabilities

### New Capabilities

- `organizer-ticket-type-management`: Organizer API for managing ticket types for owned concerts.

### Modified Capabilities

-

## Impact

- Backend API: new organizer endpoints for concert ticket-type management.
- Backend modules: extend the existing ConcertsModule with organizer ticket-type controller and service logic.
- Caching: invalidate the existing public ticket-type cache entry after organizer changes so the public API reflects the latest active ticket types.
- Authorization: reuse existing JWT auth and organizer role checks from the current organizer concert flow.
- No payment, order, or frontend behavior changes are included in this task.
