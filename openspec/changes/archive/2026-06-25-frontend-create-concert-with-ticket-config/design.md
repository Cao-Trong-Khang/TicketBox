## Context

The organizer frontend already has a dedicated create concert page, a dedicated ticket-type management page, and reusable organizer form helpers. The backend currently exposes separate endpoints for creating a concert and creating ticket types, and the existing ticket-type forms are already built around a shared organizer ticket-type form component. The change should reuse those existing modules and keep the backend contract unchanged.

## Goals / Non-Goals

**Goals:**
- Make ticket configuration part of the organizer create-concert experience.
- Keep the flow simple for an MVP by orchestrating existing backend endpoints from the frontend.
- Remove sale window inputs from the organizer ticket-type UI for this task.
- Preserve the existing ticket-type management page and public visibility behavior.

**Non-Goals:**
- Backend transaction redesign.
- Payment, notification, e-ticket QR, check-in, image upload, seat map editing, or revenue dashboard work.

## Decisions

- Keep the backend unchanged and perform the create flow in two frontend steps: create the concert as DRAFT, then create ticket types with the existing organizer ticket-type endpoint, followed by activation for each created ticket type.
- Use local UI state on the create page to manage the ticket-type list before submit so the organizer can add and remove entries without leaving the page.
- Reuse the existing organizer ticket-type form and helper logic, but remove sale window fields from the UI and omit them from payloads.
- Keep the existing ticket-type management page available after creation and use it as the recovery destination if partial ticket-type setup fails.
- Preserve the existing ApiError handling and organizer styling patterns.

## Risks / Trade-offs

- [A multi-step create flow can leave the system partially configured if a later step fails] → Mitigation: show a clear recovery message and link to the ticket-type management page for the new concert.
- [The frontend orchestration relies on the current backend endpoints] → Mitigation: keep the flow simple and avoid introducing backend contract changes in this task.
- [Local form validation is only client-side] → Mitigation: keep backend as the source of truth and rely on server responses for final validation.

## Migration Plan

- Update the create-concert page and shared organizer ticket-type form/helpers.
- Reuse existing backend endpoints without changing them.
- Validate the new flow locally in the browser and through frontend build/lint/test commands.

## Open Questions

- None. The requested scope and backend contract are clear enough for the frontend implementation.
