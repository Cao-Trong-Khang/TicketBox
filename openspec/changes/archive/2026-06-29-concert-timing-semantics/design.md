## Context

The current concert model uses the same timing fields for two different concepts: the ticket sale window and the actual event start. That ambiguity is visible in organizer forms, public concert display, lifecycle/status calculation, and purchase validation. The change needs to make the distinction explicit without breaking the existing organizer flow or unrelated payment and check-in behavior.

## Goals / Non-Goals

**Goals:**

- Introduce an explicit performance start field for concerts while preserving the current organizer form structure.
- Reinterpret the existing concert start/end fields as the concert-level ticket sale window.
- Update lifecycle/status semantics so they reflect ticket-sale availability rather than event performance timing.
- Align public and organizer UI copy with the new semantics.

**Non-Goals:**

- Payment flow changes, seat-level booking, or mobile check-in redesign.
- New external services or a major data model rewrite beyond an additive concert field and validation updates.

## Decisions

- Add a new nullable `performanceStartAt` column to the concert model, with a safe backfill strategy from the existing concert start value for older records. This keeps the change additive and backward-compatible.
- Keep the existing concert `startsAt` and `endsAt` fields as the authoritative ticket-sale window for the MVP. This preserves the current organizer workflow and avoids a larger contract redesign.
- Compute lifecycle/status values from the sale window rather than from the performance start. Existing override states such as `CANCELLED` and `FINISHED` remain as business-state overrides.
- Use the concert-level sale window for purchase validation and stop relying on ticket-type sale-window checks for new order validation logic. Ticket-type sale fields remain present for compatibility but are no longer the source of truth for purchases.
- Keep the organizer form structure intact and update labels/help text instead of introducing a new screen pattern. The public-facing concert cards and detail pages will show the performance start as the primary event time and the sale window as availability context.

## Risks / Trade-offs

- [Existing records may not have a meaningful performance time] → Mitigation: backfill from the old concert start value and allow the field to remain optional during rollout.
- [The old UI labels are ambiguous] → Mitigation: update copy and helper text so the distinction is apparent to organizers and audiences.
- [Some downstream code may still assume the old semantics] → Mitigation: update backend services, DTOs, and tests together and keep the change scoped to concert timing and purchase validation.

## Migration Plan

1. Add the new concert field in Prisma and apply the database migration.
2. Backfill existing concerts using the current concert start time where no explicit performance time exists.
3. Deploy backend and frontend changes together so organizer forms, public display, lifecycle logic, and purchase validation all use the same semantics.
4. Keep the old fields intact during rollout and only tighten validation after the new field and UI are verified.

## Open Questions

- Should `performanceStartAt` be required for published concerts, or should it remain optional with a fallback to the sale-window start during the rollout?
- Should existing historical concerts use the old concert start value as the initial performance time, or should that be set manually by organizers during a follow-up cleanup step?
