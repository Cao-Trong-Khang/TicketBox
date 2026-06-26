## Why

Organizer users currently create a concert and then must leave the create flow to configure ticket types on a separate page. This creates extra steps during the creation journey and makes it harder to complete a concert setup in one pass. The change should streamline the organizer experience while keeping the existing backend contract and public ticket visibility behavior intact.

## What Changes

- Update the organizer create-concert experience so ticket configuration is part of the same flow.
- Add a `Cấu hình vé` section/button inside `/organizer/concerts/new` where organizers can add one or more local ticket types before submitting.
- Remove `saleStartAt` and `saleEndAt` from the organizer ticket-type create/edit UI and payloads in the frontend.
- Keep the existing backend contract unchanged for this MVP and orchestrate the create flow from the frontend by creating the concert first and then creating each ticket type.
- If the concert is created but one or more ticket types fail, show a clear recovery message and link the organizer to the ticket-type management page for the new concert.
- Keep the existing ticket-type management page and dashboard navigation intact.

## Capabilities

### New Capabilities

- `frontend-create-concert-with-ticket-config`: Organizer create-concert flow that captures ticket configuration in the same page and handles multi-step creation with recovery messaging.

### Modified Capabilities

- None.

## Impact

- Frontend organizer experience: create-concert page, organizer ticket-type form, and organizer ticket-type management page.
- Backend integration: reuse existing organizer concert and ticket-type endpoints without changing their contracts.
- Public behavior: no public API changes; public ticket visibility remains governed by published concerts and active ticket types.
