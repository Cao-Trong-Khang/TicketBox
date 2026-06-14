## Context

TicketBox already has a public `GET /concerts` endpoint that returns only list metadata and intentionally excludes `seatingSvg`. The next step is a public detail endpoint that reuses the existing `concerts` module and the shared Redis cache service, but keeps the response shape small and stable.

The detail endpoint must remain public in the current codebase. There is no global auth guard to work around today, so no auth or RBAC change is needed for this feature.

The endpoint must be cache-aside because the response is public and read-heavy, but it should not cache ticket availability or ticket types. That keeps the detail response independent from fast-changing inventory data and avoids coupling it to the future availability endpoint.

## Goals / Non-Goals

**Goals:**

- Provide a public concert detail API at `GET /concerts/:id`.
- Return only published concerts.
- Return metadata plus `seatingSvg` and no other internal fields.
- Use Redis cache-aside with a 300-second TTL.
- Treat Redis parse failures as cache misses and delete the corrupted key when possible.
- Reuse the existing `concerts` module and `RedisCacheService`.

**Non-Goals:**

- No ticket-type or availability data in this endpoint.
- No auth/rbac changes.
- No new cache module.
- No schema changes.
- No checkout, payment, or notification changes.

## Decisions

1. Reuse the existing `concerts` module and cache service.
   - Decision: Implement the detail route inside `concerts.controller.ts` and the lookup logic in `concerts.service.ts`, using the existing `RedisCacheService`.
   - Rationale: The detail endpoint belongs to the same public browsing domain as the list endpoint, so keeping them together reduces wiring and duplication.
   - Alternatives considered: A separate module would isolate the route but would add unnecessary structure for a closely related public API.

2. Use `ParseUUIDPipe` on the route parameter.
   - Decision: Validate `:id` as a UUID at the controller boundary before the service is called.
   - Rationale: The existing schema uses UUID primary keys, and early validation reduces unnecessary database work on malformed input.
   - Alternatives considered: Letting Prisma reject invalid IDs would push a predictable validation concern into the data-access layer.

3. Cache the mapped DTO response, not the Prisma payload.
   - Decision: Store only the public response shape in Redis under `concerts:detail:{concertId}` with a 300-second TTL.
   - Rationale: The cache should mirror the public API contract, not internal Prisma shapes, and should stay stable if the query changes.
   - Alternatives considered: Caching raw Prisma objects would make the cache more brittle and could expose unnecessary internal fields.

4. Treat corrupted cache JSON as a recoverable miss.
   - Decision: If `JSON.parse` fails, treat the entry as a miss and delete the bad key if `RedisCacheService.del` is available.
   - Rationale: A single bad cache entry should not keep breaking requests; deleting the corrupted value helps the cache self-heal.
   - Alternatives considered: Returning an error would make the cache a source of outage rather than an optimization layer.

5. Return 404 for unpublished or missing concerts.
   - Decision: Query only `ConcertStatus.PUBLISHED` records and raise `NotFoundException` when none are found.
   - Rationale: Public users should not be able to distinguish unpublished drafts from absent records, and the endpoint should only expose published concerts.
   - Alternatives considered: Returning 403 for unpublished content would leak too much state and complicate the public browsing contract.

6. Exclude ticket types from this endpoint.
   - Decision: Keep `ticketTypes` out of the detail response and handle them in a future `GET /concerts/:id/ticket-types` endpoint.
   - Rationale: Ticket types change more frequently than metadata and should have their own cache behavior and lifecycle.
   - Alternatives considered: Embedding ticket types now would couple the detail cache to availability updates and weaken cache TTL choices.

## Risks / Trade-offs

- Redis may store stale detail data for up to 300 seconds → Mitigation: keep the TTL moderate and rely on PostgreSQL as the source of truth.
- Corrupted cache entries could cause repeated JSON parsing failures → Mitigation: delete the bad key and fall back to PostgreSQL.
- The detail payload includes `seatingSvg`, which can be larger than list data → Mitigation: keep ticket types out of the same endpoint and avoid inflating the response further.
- Future auth middleware changes could accidentally block the route → Mitigation: document the endpoint as public by design and add a public-route marker only if a global guard is introduced later.

## Migration Plan

1. Add the route and service method to the existing `concerts` module.
2. Add the DTO for the public detail response.
3. Wire the cache-aside flow using the existing Redis cache service.
4. Verify the public endpoint with a published concert fixture and a missing/unpublished fixture.
5. If a cache corruption issue is observed in testing, confirm the corrupted key is removed and the fallback path succeeds.

Rollback strategy: remove the new route and service method from the `concerts` module. No schema or data migration is required.

## Open Questions

- Should the future `GET /concerts/:id/ticket-types` endpoint share the same `concerts` module or be split into a separate feature module?
- If a global auth guard is introduced later, should this route use a shared `@Public()` decorator pattern or a module-specific exception?
