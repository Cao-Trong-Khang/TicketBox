## Context

TicketBox already supports public concert browsing through `ConcertsController` and `ConcertsService`. The backend currently lacks a dedicated organizer API for concert creation, draft editing, and publishing workflows. Organizer-side concert management must use the existing NestJS module and auth model while preserving current public API behavior and Redis caching strategies.

## Goals / Non-Goals

**Goals:**

- Add organizer-only concert management endpoints within `ConcertsModule`.
- Use existing `JwtAuthGuard` and database-backed `ROLE_CODES.organizer` checks for authorization.
- Ensure organizers can only manage concerts they own (`organizerId === request.user.id`).
- Support draft creation, draft updates, and publish operations with readiness validation.
- Invalidate public Redis cache only when a concert is published.

**Non-Goals:**

- No ticket type management or ticket sales logic.
- No image upload, payment, order, ticket, or QR code features.
- No frontend implementation or organizer-facing UI changes.
- No new backend module, external services, or storage systems.

## Decisions

- Keep public concert browsing unchanged. The existing `ConcertsService` remains responsible for published concert queries and public cache keys.
- Add `OrganizerConcertsController` and `OrganizerConcertsService` to `ConcertsModule` rather than creating a new module. This keeps concert domain behavior centralized and avoids duplicating models or Prisma access patterns.
- Authenticate organizer endpoints with the existing `JwtAuthGuard` and validate organizer role in service logic. A database lookup is required because JWT payload does not include role claims.
- Use explicit DTOs and `class-validator` for create/update requests. Validate `startsAt < endsAt` on create and update, and enforce required fields for creation.
- Enforce ownership as a 404 response for non-owned or missing concerts. This prevents leaking whether a concert exists to other organizers.
- Publish readiness validation uses the concert row itself; only a `PUBLISHED` status change occurs in this task. This keeps the publish workflow simple and avoids side effects beyond cache invalidation.
- Use `RedisCacheService.del()` after publish to invalidate `concerts:list:published` and `concerts:detail:{id}`. Redis failures are logged but non-fatal to avoid blocking organizer workflows.

## Risks / Trade-offs

- [Role validation latency] → Checking organizer role in the database on every organizer request adds a small lookup cost. Mitigation: query once per request in service and keep checks minimal.
- [Ownership check complexity] → Returning 404 for non-owned concerts is safer but may obscure audit diagnostics. Mitigation: use strict ownership queries and centralized helper methods.
- [Caching edge cases] → Publish invalidation may leave stale public cache if other cache keys are introduced later. Mitigation: keep cache-key conventions explicit and add documentation/comments near publish logic.
- [Draft update constraints] → Restricting updates to `DRAFT` simplifies MVP but requires future work for organizer corrections after publish. Mitigation: document as non-goal and keep status update logic separate from patch semantics.
