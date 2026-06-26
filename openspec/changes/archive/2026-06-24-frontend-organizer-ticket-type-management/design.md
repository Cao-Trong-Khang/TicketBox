## Context

The organizer area already has the concert dashboard, create/edit/publish concert pages, and shared organizer API helpers. The backend already exposes organizer-owned ticket-type endpoints for listing, creating, editing, activating, and deactivating ticket types for a specific concert, so the frontend work can stay scoped to UI composition, validation, and route wiring.

## Goals / Non-Goals

**Goals:**

- Add a dedicated organizer ticket-type management page for a specific concert.
- Support create, edit, activate, and deactivate operations using the existing backend API contract.
- Keep the UX aligned with the current organizer dashboard and shared UI conventions.
- Handle common states such as loading, errors, empty state, validation failures, and conflict errors.

**Non-Goals:**

- Payment, orders, QR issuance, or check-in flows.
- Backend schema or endpoint changes.
- Image upload, seating-map editing, or rich-content editing.

## Decisions

- Reuse the existing organizer concert feature module and router structure rather than introducing a separate feature area.
- Use a dedicated page at /organizer/concerts/:concertId/ticket-types for the full management experience.
- Keep form state local to the page, using datetime-local inputs in the browser and converting to ISO strings only when submitting.
- Treat the backend as the source of truth for validation and conflicts, while applying lightweight client-side validation for a better immediate UX.
- Present create/edit actions in a simple, MVP-friendly form and keep status changes as explicit actions with clear success and error feedback.
- Keep the dashboard navigation simple by replacing the placeholder action with a working route link.

## Risks / Trade-offs

- [Client-side validation may diverge from backend rules] → Keep the backend validation authoritative and surface backend messages inline.
- [Date inputs can be error-prone] → Centralize the conversion logic and avoid submitting raw local strings.
- [Organizer pages may require repeated refreshes after mutations] → Refresh the list after successful create/edit/status actions or update local state directly where it is safe.
