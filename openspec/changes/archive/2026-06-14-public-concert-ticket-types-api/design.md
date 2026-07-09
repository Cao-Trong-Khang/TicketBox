## Context

TicketBox already exposes public concert list and detail endpoints through the existing `ConcertsModule`, and both use Redis cache-aside with the shared `RedisCacheService`. The next API needs to expose ticket-type data for a single published concert, but it must remain separate from concert metadata because availability changes faster than the concert detail payload.

This endpoint is intended for frontend display only. The backend will still enforce inventory and quota rules later in the purchase flow using PostgreSQL transactions, so this API must never be treated as an authoritative source of availability.

## Goals / Non-Goals

**Goals:**

- Provide a public `GET /concerts/:id/ticket-types` endpoint for published concerts.
- Return only active ticket types with display-oriented fields and computed availability.
- Reuse the existing `ConcertsModule` and `RedisCacheService`.
- Cache mapped DTOs in Redis with a 5-second TTL.
- Recover safely from corrupted cache entries by treating them as misses.
- Keep the endpoint public in the current codebase.

**Non-Goals:**

- No `POST /orders` or payment behavior.
- No WebSocket or SSE updates.
- No auth/rbac changes.
- No new module unless the existing concerts module becomes insufficient.
- No seat-level booking or inventory reservation logic.

## Decisions

1. Reuse the existing `ConcertsModule` and add one service method.
   - Decision: Implement the route in the existing concerts controller and the query/mapping logic in the existing concerts service.
   - Rationale: The endpoint belongs to the same public concert browsing surface as the list and detail APIs.
   - Alternatives considered: A separate module would add structure but would not improve separation enough to justify the extra wiring.

2. Validate the route parameter with `ParseUUIDPipe`.
   - Decision: Parse `:id` as a UUID at the controller boundary.
   - Rationale: The schema uses UUID primary keys, and early validation avoids unnecessary database work for malformed input.
   - Alternatives considered: Deferring validation to Prisma would make error handling less consistent and less explicit.

3. Sort ticket types by `priceVnd ASC`, then `code ASC`.
   - Decision: Use price as the primary sort key and code as a deterministic tie-breaker.
   - Rationale: The frontend will typically present lower-price ticket tiers first, and code provides stable ordering when prices are equal.
   - Alternatives considered: Sorting by code or name first would be more arbitrary and less aligned with how users browse ticket tiers.

4. Cache mapped DTOs with a short TTL.
   - Decision: Store the final public DTO array in Redis under `concerts:{concertId}:ticket-types` with a 5-second TTL.
   - Rationale: The endpoint is display-only and near-realtime, so a short cache window smooths traffic without pretending to be authoritative.
   - Alternatives considered: Not caching at all would increase database load during page refreshes; using a longer TTL would create too much staleness for availability data.

5. Treat invalid cached JSON as a recoverable miss.
   - Decision: If the cached payload cannot be parsed, delete the corrupted key when possible and fall back to PostgreSQL.
   - Rationale: A corrupted entry should not keep breaking the endpoint, and deleting it lets the cache self-heal.
   - Alternatives considered: Returning an error would make Redis a reliability risk instead of an optimization layer.

6. Keep availability read-only and clamp invalid values.
   - Decision: Compute `availableQuantity` as `Math.max(0, totalQuantity - reservedQuantity - soldQuantity)` and return only the public DTO fields.
   - Rationale: The endpoint is for display only and must not leak internal reservation/sales counters or expose negative availability values.
   - Alternatives considered: Returning the raw quantity math would leak internals and show confusing negative values when data is temporarily inconsistent.

## Risks / Trade-offs

- A 5-second cache can still be slightly stale during sale spikes → Mitigation: keep the TTL short and rely on PostgreSQL for the final purchase transaction.
- Sorting by price first may not match every organizer's desired marketing order → Mitigation: use a deterministic fallback by `code`, and revisit ordering only if product requirements change.
- Corrupted cache entries could create repeated JSON parse failures → Mitigation: delete the bad key and repopulate from PostgreSQL.
- The endpoint could be mistaken as authoritative for buying decisions → Mitigation: document it as display-only and keep the real oversell protection in the later order flow.

## Migration Plan

1. Add the new route and service method to the existing concerts module.
2. Add the public ticket-type response DTO.
3. Add cache-aside handling with parse recovery and key deletion.
4. Verify the endpoint against a published concert fixture and a missing/unpublished fixture.
5. Confirm the TTL and cache-hit path with a local Redis instance.

Rollback strategy: remove the new route, service method, and DTO from the concerts module. No schema or data migration is required.

## Open Questions

- None at the moment. The endpoint is intentionally limited to display-only data and short-lived caching so it stays separate from future order/availability logic.
