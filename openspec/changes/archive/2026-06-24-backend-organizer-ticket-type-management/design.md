## Context

TicketBox already exposes public concert and ticket-type APIs, and organizer users can manage their concerts through the existing organizer concert flow. The missing piece is a structured organizer API for managing ticket types attached to owned concerts, while keeping the public ticket-type listing behavior unchanged apart from reflecting the latest active inventory.

## Goals / Non-Goals

**Goals:**

- Add organizer-only ticket-type management endpoints under the existing ConcertsModule.
- Reuse current authentication, organizer role checks, and ownership enforcement patterns.
- Enforce inventory-safe validation and preserve public visibility rules for ACTIVE ticket types.
- Keep cache invalidation limited to the existing public ticket-type cache entry for the affected concert.

**Non-Goals:**

- Ticket deletion.
- Seat maps or venue layout changes.
- Payment, order, ticket issuance, or QR code workflows.
- Frontend changes or admin-only endpoints.

## Decisions

- Keep ticket-type management inside the existing ConcertsModule rather than introducing a new module. This preserves the current domain organization and reuses the existing organizer-concert and public-concert service patterns.
- Reuse the existing JWT guard and organizer role check from the organizer concert flow. The JWT payload is still treated as carrying only user identity, so role validation remains database-backed.
- Enforce ownership at the concert level and the ticket-type level. If the concert is missing or not owned by the current organizer, the API returns 404. If the ticket type is missing or belongs to another concert, the API also returns 404.
- Use 400 Bad Request for input validation issues such as negative price, non-positive quantity, invalid per-user limit, and invalid sale window ranges.
- Use 409 Conflict for business-rule conflicts such as duplicate ticket-type codes in the same concert, reducing total quantity below reserved plus sold quantity, and toggling a status that is already in the target state.
- Create new ticket types with `INACTIVE` status by default. The public ticket-type API continues to return only `ACTIVE` ticket types, so activation is required before public visibility changes.
- Invalidate the existing public ticket-type cache entry for the concert after create, update, activate, and deactivate operations. Redis failures remain non-fatal so organizer operations are not blocked by cache issues.

## Risks / Trade-offs

- [Inventory conflict handling] → Returning 409 for inventory reductions is more explicit than silently clamping values, but it requires organizers to adjust inventory deliberately. Mitigation: document the rule clearly in API responses and validation messages.
- [Cache staleness] → Public ticket-type data could briefly remain stale if invalidation fails or if a different cache layer is introduced later. Mitigation: keep invalidation logic centralized and non-fatal.
- [Status transition semantics] → Returning 409 for repeated activate/deactivate requests avoids ambiguous no-op behavior, but it means clients must handle repeated toggles explicitly. Mitigation: document the expected conflict response in the organizer API contract.
