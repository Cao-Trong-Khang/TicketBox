## Context

The organizer frontend already has a reusable concert edit page, a dedicated ticket-type management page, and a shared ticket-type form plus validation helpers. The current implementation keeps concert editing and ticket-type management as separate experiences, even though the same organizer APIs already support both flows. This change should consolidate the experience in the existing edit page and improve the organizer journey without introducing backend contract changes.

## Goals / Non-Goals

**Goals:**

- Place ticket-type management inside the organizer edit-concert page for the same concert.
- Reuse the existing organizer ticket-type APIs and reusable UI components where practical.
- Preserve existing lifecycle rules so upcoming concerts remain editable while ongoing, ended, and cancelled concerts remain read-only.
- Remove the visible dashboard entry point for separate ticket management while keeping the old route working for compatibility.

**Non-Goals:**

- Backend changes or Prisma migrations.
- Payment, notifications, QR codes, check-in, refunds, or public purchase flow changes.
- New sale window fields or saleStartAt/saleEndAt behavior.

## Decisions

- Keep the existing organizer frontend architecture intact and add the ticket-type section directly to the edit page instead of introducing a new manager page or route.
- Reuse the current organizer ticket-type API helpers and the shared ticket-type form/validation utilities so the edit page behaves consistently with the existing management page.
- Keep the existing lifecycle-based read-only rules in the edit page and apply them to ticket-type create/edit/status actions as well.
- Use local component state for ticket-type list management on the edit page, refreshing or updating it after each create/update/status change without resetting the concert form fields.
- Keep the existing route `/organizer/concerts/:concertId/ticket-types` available, but redirect it to the edit page so old links remain valid without exposing a separate ticket-management experience in normal navigation.
- Preserve the current ApiError handling and error messaging patterns so 400/401/403/404/409 responses are surfaced consistently.

## Risks / Trade-offs

- [The edit page now carries more UI responsibility] → Mitigation: keep the implementation scoped to existing shared components and existing organizer APIs so the change stays small and consistent.
- [Ticket-type state could accidentally interfere with concert form state] → Mitigation: keep ticket-type state separate from the concert form state and only update the ticket list after successful mutations.
- [Lifecycle restrictions could be inconsistent across the old route and new edit-page experience] → Mitigation: centralize the read-only decision logic in the edit page and reuse it for all ticket-type actions.

## Migration Plan

- Update the organizer edit page to fetch both the concert detail and its ticket types.
- Update the organizer dashboard to remove the separate ticket-management action.
- Update the router so the legacy ticket-type route redirects to the edit page.
- Validate the flow locally through frontend build/lint/test commands and a manual review of the organizer navigation paths.

## Open Questions

- None. The implementation can proceed with the current frontend/backend contract and the agreed UX decisions.
