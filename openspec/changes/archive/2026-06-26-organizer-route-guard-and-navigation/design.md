## Context

The current frontend router already has an `RequireOrganizer` guard for the admin dashboard routes, but the organizer console routes are not wrapped with it. The Admin Dashboard also renders the "Concert Management" card as a static tile, so it does not clearly act as a navigation control.

## Goals / Non-Goals

**Goals:**

- Apply the existing organizer guard to the approved organizer routes.
- Make the "Concert Management" card navigate to the organizer dashboard.
- Keep the change limited to the frontend web app.

**Non-Goals:**

- No backend authorization changes.
- No dashboard layout redesign.
- No changes to other dashboard cards.
- No broader routing-system refactor.

## Decisions

- Reuse the existing `RequireOrganizer` component rather than introducing a new guard.
- Apply that guard only to the three organizer routes in scope: `/organizer/concerts`, `/organizer/concerts/new`, and `/organizer/concerts/:id/edit`.
- Use the existing `userHasRole('ORGANIZER')` check so behavior stays consistent with the current frontend auth model.
- Use a minimal interactive affordance for the "Concert Management" card, such as pointer and hover styling, while keeping the rest of the card layout unchanged.

## Risks / Trade-offs

- [Role-state mismatch] → The guard depends on the existing frontend role check from local storage, so it will behave consistently with the current app state model.
- [Scope creep] → Limiting the work to the approved routes and a single card reduces the chance of unrelated regressions.

## Migration Plan

- No database or API migration is required.

## Open Questions

- None; the scope is fixed to the approved organizer routes and the admin dashboard card.
