## Why

The current concert timing model mixes event-time semantics with sale-window semantics. Organizers need a clear way to define when ticket sales open and close for a concert, while audiences need a clear way to see when the actual performance starts. The current implementation uses the same fields for both meanings, which creates confusion in organizer workflows, validation, and audience presentation.

## What Changes

- Introduce a separate concert performance start field while preserving the existing organizer screen structure.
- Reinterpret the existing concert start/end fields as the concert-level ticket sale window.
- Move purchase validation to the concert-level sale window.
- Keep ticket-type sale timing fields for backward compatibility but stop using them for new validation logic.
- Update public and organizer UI copy and display so the difference between sale availability and performance time is explicit.

## Capabilities

### New Capabilities

- `concert-timing-semantics`: Introduces explicit concert sale-window semantics plus a separate performance start time for the actual event.

### Modified Capabilities

- `concert-management`: Organizer concert creation and editing behavior changes to accept a performance start field and treat the existing start/end fields as sale-window fields.
- `ticket-purchase`: Purchase validation changes to use the concert-level sale window instead of per-ticket-type sale windows.
- `concert-discovery`: Public concert display changes to show performance time as the primary date while keeping sale availability clear.

## Impact

- Backend concert and order modules.
- Organizer concert DTOs, services, and forms.
- Public concert DTOs and audience UI.
- Ticket-type organizer flow and related tests.
- Existing data will need a conservative migration/backfill strategy for the new performance-start field.
