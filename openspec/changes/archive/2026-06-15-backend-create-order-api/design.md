## Context

The frontend now has a ticket quantity selection UI, but the backend lacks an authenticated API to create pending orders and reserve tickets. The system must handle concurrent requests under high load (concert sales drops) without overselling. PostgreSQL is the source of truth for inventory; Redis caches ticket availability but is not authoritative. Order and OrderItem models already exist in the schema with idempotencyKey unique constraint on (userId, idempotencyKey).

## Goals / Non-Goals

**Goals:**

- Enable authenticated users to create PENDING orders with atomic ticket reservation
- Prevent overselling under concurrent requests using PostgreSQL-level atomicity
- Enforce per-user purchase limits across active (PENDING + PAID) orders
- Provide idempotent endpoint (retry-safe with same idempotencyKey)
- Invalidate stale Redis cache after successful reservation
- Establish foundation for future payment + ticket issuance workflows

**Non-Goals:**

- Payment processing (deferred to separate feature)
- Ticket issuance or QR code generation
- Order expiration worker (deferred to background job)
- Order history / detail endpoints
- Frontend integration or UI updates
- Refund / cancellation workflows

## Decisions

### Decision 1: Atomic Ticket Reservation via Raw SQL Conditional Update

**Choice**: Use raw SQL UPDATE with conditional WHERE clause to atomically reserve tickets in PostgreSQL.

```sql
UPDATE ticket_types
SET reserved_quantity = reserved_quantity + ${quantity}
WHERE id = ${ticketTypeId}
  AND (total_quantity - reserved_quantity - sold_quantity) >= ${quantity}
```

**Rationale:**

- Single atomic statement: check availability + increment in one operation
- PostgreSQL handles lock & commit at statement level; no race condition
- Zero rows affected = inventory exhausted → we detect and rollback entire transaction
- Simpler than SELECT FOR UPDATE + manual increment (avoids lock contention)

**Alternatives Considered:**

- Optimistic locking with version column: adds complexity; raw SQL simpler for this constraint check
- SELECT FOR UPDATE: locks row, queues concurrent requests; less scalable under burst traffic
- Application-level checking: not atomic; vulnerability to TOCTOU (time-of-check-time-of-use) race

### Decision 2: Fetch Ticket Types Once, Reuse Throughout Transaction

**Choice**: Single query for all ticket types in transaction; build Map; reuse for validation, pricing, and reservation.

**Rationale:**

- Reduces DB round trips (1 query vs. N queries)
- Price data (unitPriceVnd) guaranteed consistent within transaction snapshot
- Simplifies validation loop (no refetch needed)
- Per-user limit query independent (separate concern)

**Alternatives Considered:**

- Refetch for each item: wasteful; prices could stale between validation and creation
- Query price at OrderItem creation: correct but less efficient than reuse

### Decision 3: Always Query Existing Orders for Per-User Limit (Even if Solo Request Below Limit)

**Choice**: For each ticket type, query existing PENDING + PAID order quantities regardless of request quantity.

**Rationale:**

- Prevents user from bypassing limit via multiple requests (e.g., limit=5, request 3 then retry for 3 again)
- Simple rule: no conditional query logic → fewer bugs
- DB query is indexed (userId, ticketTypeId, order.status); negligible cost

**Alternatives Considered:**

- Skip query if request quantity < perUserLimit: gameable; not implemented

### Decision 4: Reject Duplicate ticketTypeIds in Request with 400 Bad Request

**Choice**: Fail validation if request contains same ticketTypeId twice.

**Rationale:**

- Prevents ambiguity in user intent (merge or separate orders?)
- Simple rule; clear error message
- MVP simplicity; merging logic deferred if needed

**Alternatives Considered:**

- Merge quantities: more lenient but adds complexity; not needed for MVP

### Decision 5: Idempotency Check Outside Transaction (Before Validation)

**Choice**: Query existing order by (userId, idempotencyKey) before entering transaction; return immediately if found.

**Rationale:**

- Fail-fast: no unnecessary validation if idempotent request
- Transaction shorter & less contended
- Schema already has unique constraint; no risk of double-creation

**Alternatives Considered:**

- Check idempotency inside transaction: wastes validation work on retries

### Decision 6: Create Order Before OrderItems (Explicit Sequencing)

**Choice**: Within transaction, create Order first; collect orderId; then create OrderItems referencing orderId.

**Rationale:**

- Clear causality: Order must exist before Items
- Foreign key constraint enforced by DB
- Explicit transaction order reduces edge cases

### Decision 7: Fire-and-Forget Redis Cache Invalidation

**Choice**: After transaction commits, call redisCache.del(key). If deletion fails, log warning; do not rollback or fail request.

**Rationale:**

- Cache is not authoritative (eventual consistency acceptable)
- 5-second TTL on ticket-types key mitigates stale views
- Avoids cascading failure: Redis outage doesn't break order creation
- RedisCacheService already catches errors internally

**Alternatives Considered:**

- Fail request if Redis deletion fails: too strict for non-authoritative cache
- Async task: adds complexity; not needed for MVP

### Decision 8: orderCode Generation Format

**Choice**: TBX + timestamp (8 digits, last from Date.now()) + random 4-char suffix.

Example: `TBX06158C7K`

**Rationale:**

- Collision extremely unlikely (8-digit timestamp + 4 random chars = 36^4 \* 10^8 combinations)
- Deterministic for human readability; not sequential (no business logic leakage)
- DB unique constraint catches any collision; fails gracefully

**Alternatives Considered:**

- Sequential per concert: more complex; requires separate sequence table
- Full UUID: less human-friendly for customer service

## Risks / Trade-offs

| Risk                                                                                      | Mitigation                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Concurrent conditional update both return 0 rows** (both users hit same last 5 tickets) | First update succeeds; second fails with ConflictException; transaction rolls back. Expected behavior.                                                                                                                  |
| **Redis deletion fails**                                                                  | Order already committed to DB. Cache eventually invalidates (5s TTL). Frontend may see stale availability briefly; acceptable.                                                                                          |
| **Per-user limit query misses concurrent PENDING order**                                  | Queries only committed orders. Concurrent request creating order in parallel: both see same existing count, both create orders. Result: slight overage. Acceptable for MVP; payment stage will enforce stricter limits. |
| **orderCode collision**                                                                   | DB unique constraint catches and fails gracefully. Extremely rare.                                                                                                                                                      |
| **High concurrency on single popular concert**                                            | Conditional UPDATE creates PostgreSQL lock per ticket type (not per row). Scalable; no per-ticket locks.                                                                                                                |

## Migration Plan

**Deployment Steps:**

1. Create OrdersModule, controller, service, DTOs in backend/src/modules/orders
2. Add OrdersModule to AppModule imports
3. Deploy backend
4. Frontend can begin calling POST /orders (no schema changes; safe to deploy backend independently)

**Rollback Strategy:**

- Remove OrdersModule from AppModule; redeploy
- Existing pending orders remain in DB (no data loss)
- Orders created during feature flag period can be ignored or manually handled post-incident

## Open Questions

None at this stage. All technical choices are grounded in global architecture (PostgreSQL source-of-truth, Redis eventual consistency, NestJS layered modules, idempotency pattern).
