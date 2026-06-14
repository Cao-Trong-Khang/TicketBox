## Context

TicketBox already has a NestJS modular monolith backend, Prisma as the ORM, PostgreSQL as the source of truth, and Redis available as a cache tier in the global architecture. The public concert list endpoint fits the audience browsing path and must stay lightweight because it is read-heavy and likely to be called frequently from the web application.

The current codebase does not appear to have a global auth guard, so the endpoint can be public by default in the present implementation. If a global guard is introduced later, the route will need an explicit public-route exception, but that is not required for this change today.

The list endpoint must expose only future concerts that are published, and it must derive `minPriceVnd` from active ticket types without exposing the full seating SVG. Redis is only an optimization layer; PostgreSQL remains the source of truth.

## Goals / Non-Goals

**Goals:**

- Provide a public `GET /concerts` browsing endpoint for upcoming published concerts.
- Keep the response small and stable for frontend consumption.
- Use cache-aside with Redis for the mapped DTO response.
- Keep PostgreSQL authoritative for concert visibility and ticket pricing.
- Preserve behavior when Redis is unavailable by falling back to PostgreSQL.
- Keep the change aligned with the existing NestJS modular monolith and Prisma data model.

**Non-Goals:**

- No concert detail endpoint.
- No seat-level booking or interactive zone booking changes.
- No auth/rbac redesign.
- No new database tables or schema changes.
- No payment, checkout, notification, or worker changes.
- No new external services beyond the existing Redis dependency.

## Decisions

1. Use Prisma enum values for filtering instead of hard-coded strings.
   - Decision: Query with `ConcertStatus.PUBLISHED` and `TicketTypeStatus.ACTIVE` from `@prisma/client`.
   - Rationale: The schema already defines these enums, so using them keeps the service type-safe and aligned with the database contract.
   - Alternatives considered: Hard-coded string literals would be simpler but more fragile and easier to drift from schema values.

2. Cache the mapped DTO response, not the raw Prisma payload.
   - Decision: Store the final list response shape in Redis after mapping fields and computing `minPriceVnd`.
   - Rationale: The public API contract should be cached directly, which avoids coupling cache contents to Prisma include shapes and keeps cache reads simple.
   - Alternatives considered: Caching raw Prisma objects would preserve more internal data but would increase coupling and risk leaking implementation-specific fields.

3. Use cache-aside with silent fallback on Redis failures.
   - Decision: Read Redis first, return cached data on hit, otherwise query PostgreSQL, map DTOs, and populate the cache. If Redis throws or is unavailable, log a warning and continue with the PostgreSQL path.
   - Rationale: This matches the global design principle that Redis is an optimization layer only and should not make public browsing unavailable.
   - Alternatives considered: Failing the request on cache errors would violate the availability goal and unnecessarily couple browsing to Redis health.

4. Keep the cache key and TTL local to the service.
   - Decision: Store the cache key and TTL constants inside `ConcertsService` for now.
   - Rationale: This keeps the feature simple and avoids prematurely extracting infrastructure constants into a separate file.
   - Alternatives considered: A separate constants module would be more reusable but is unnecessary for a single list endpoint.

5. Keep the route public in the current codebase.
   - Decision: Do not introduce a new public decorator unless a global auth guard is later added.
   - Rationale: The current backend does not use a global auth guard, so the route can remain publicly accessible without additional wiring.
   - Alternatives considered: Adding a `@Public()` decorator now would introduce extra abstraction before the project needs it.

## Risks / Trade-offs

- Redis cache staleness can temporarily show older results for up to the TTL, which may slightly delay visibility of newly published or updated concerts → Mitigation: use a short 60-second TTL and keep PostgreSQL authoritative.
- Computing `minPriceVnd` from active ticket types adds one relation to the list query → Mitigation: only select the ticket fields required for the minimum price calculation.
- Redis outages or serialization issues could degrade the list API if not handled carefully → Mitigation: wrap cache access in warning-only error handling and always fall back to PostgreSQL.
- Future introduction of a global auth guard could unintentionally affect this public endpoint → Mitigation: document the route as public by design and add an explicit public-route marker only if the auth architecture changes.
