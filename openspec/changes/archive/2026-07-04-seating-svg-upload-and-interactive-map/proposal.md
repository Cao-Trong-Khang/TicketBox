## Why

Organizer users need a reliable way to attach a seating map to a concert without pasting raw SVG markup, while audience users need an interactive map that shows ticket-zone availability. The current system already carries a seating SVG field, but it lacks a safe upload workflow, server-side sanitization, and an interactive audience rendering experience.

## What Changes

- Add an organizer-facing SVG file upload flow for concert create and edit forms.
- Read uploaded SVG files as text in the web app and submit them through the existing concert create/update payload as seatingSvg.
- Enforce backend validation and sanitization before saving Concert.seatingSvg.
- Render sanitized seating SVG inline on the public concert detail page through an interactive seat-map component.
- Refresh ticket availability on the concert detail page via polling without changing checkout, payment, or check-in behavior.
- Keep public concert list lightweight and avoid seat-map rendering there.

## Capabilities

### New Capabilities

- concert-seating-map: Organizer upload, backend validation, and audience interactive rendering of seating SVG for concerts.

### Modified Capabilities

- None.

## Impact

- Backend concert management flow in the NestJS concerts module, including organizer create/update and public concert detail responses.
- Frontend organizer concert form and public concert detail page.
- Existing concert and ticket-type APIs, plus the ticket availability cache invalidation path.
- No change to payment, order, ticket issuance, or check-in flows.
