## Context

Currently, orders created during checkout are assigned a 15-minute expiration window (`Order.expiresAt = now + 15 minutes`). If a user abandons checkout or the payment gateway returns an error, the order remains in PENDING status indefinitely, and the reserved ticket quantities (`TicketType.reserved_quantity`) are never returned to the available pool.

This creates two problems:

1. **Inventory Lock**: Users see "sold out" for a concert even though reserved tickets are tied up in failed PENDING orders
2. **Stale Orders**: The database accumulates PENDING orders that will never be paid

The solution is a scheduled background job that periodically finds PENDING orders past their expiration time and transitions them to EXPIRED, releasing their reserved tickets back to TicketType.reserved_quantity for reuse.

**Current State**:

- Orders are created in src/modules/orders/orders.service.ts with expiresAt field
- Order schema has @@index([status]) and @@index([expiresAt]) for fast queries
- OrderItem model has onDelete: Cascade relationship to Order
- @nestjs/schedule is NOT currently installed in dependencies

## Goals / Non-Goals

**Goals:**

- Automatically expire PENDING orders that exceed their 15-minute reservation window
- Release reserved ticket quantities atomically with order expiration to restore inventory availability
- Prevent inventory locks caused by failed checkout attempts
- Operate as a resilient background job that handles transient failures gracefully
- Guard against race conditions with concurrent payment webhooks

**Non-Goals:**

- User-initiated order cancellation (separate feature)
- Payment refunds or compensation (out of scope; payment system handles webhooks)
- Notification to users about expired orders (future feature)
- Configurable expiration duration (fixed at 15 minutes per existing order creation logic)
- Tracking order history or audit logs for expiration events (status = EXPIRED is sufficient)
- Kafka integration (simple scheduled job, not event-driven)

## Decisions

### Decision 1: Use @nestjs/schedule for Periodic Execution

**Chosen**: @nestjs/schedule with @Cron decorator running every 60 seconds
**Rationale**:

- Simplest integration with NestJS modular architecture
- No external dependencies like Kafka or message queues
- Runs locally in the same process as the API
- Cron string `*/60 * * * * *` is clear and maintainable

**Alternatives Considered**:

- Kafka topics: Overkill for a simple scheduled job; adds operational complexity and external dependency
- Node cron library: Less integrated with NestJS; would require manual module setup
- Database-driven job queue: Unnecessary for a simple time-based job
- Worker process: Could work but requires separate deployment; single-process scheduler is sufficient for MVP

### Decision 2: Create OrderExpirationService in OrdersModule

**Chosen**: New OrderExpirationService in src/modules/orders/order-expiration.service.ts, registered in OrdersModule.providers
**Rationale**:

- Order expiration is a business concern of the Orders domain
- Service has direct access to injected Prisma and RedisCacheService via module imports
- Keeps related logic together (order creation → order expiration in same module)
- Simplifies testing and dependency injection

**Alternatives Considered**:

- Separate module: Over-engineering for a single service
- Utility function: Loses dependency injection benefits and NestJS Logger integration

### Decision 3: Query Max 100 Expired Orders Per Run

**Chosen**: `take: 100` in findMany query
**Rationale**:

- Prevents long-running transactions that could block concurrent API requests
- 100 orders processed in ~5-10 seconds (based on typical DB performance)
- 60-second job frequency means 100+ orders/min throughput is available
- Scales gracefully if expired order volume increases

**Alternatives Considered**:

- No limit: Risk of blocking API during high-traffic times
- Limit of 500+: Longer transactions, higher chance of lock contention

### Decision 4: Use Conditional WHERE status = PENDING in Update

**Chosen**: Prisma updateMany with `where: { id, status: PENDING }` + check result.count === 1
**Rationale**:

- Prevents race condition where payment webhook transitions order to PAID before expiration job updates it
- Conditional check is atomic with the update (no separate SELECT required)
- If count !== 1, order was already transitioned → skip ticket release
- Aligns with existing pattern in orders.service.ts reservation logic

**Alternatives Considered**:

- SELECT for UPDATE lock: More complex; SQLite doesn't support it; unnecessary for idempotency
- Application-level flag: Slower (two queries); not atomic
- Assume status = PENDING: Would incorrectly release tickets if payment webhook beats us

### Decision 5: Release Tickets Using GREATEST(0, reserved - qty) in Raw SQL

**Chosen**: `UPDATE ticket_types SET reserved_quantity = GREATEST(0, reserved - qty) WHERE id = ticketTypeId::uuid`
**Rationale**:

- GREATEST(0, x) prevents negative reserved_quantity if race conditions cause double-release
- Raw SQL with parameterized query is safe (no SQL injection risk)
- Atomic at database level (PostgreSQL constraint: reserved_quantity >= 0 not needed; GREATEST handles it)
- Matches existing reservation pattern in orders.service.ts

**Alternatives Considered**:

- Check-then-update: Two queries, race condition window
- Decrement without GREATEST: Could go negative; violates expected domain constraint

### Decision 6: Use Per-Order Transactions with All-or-Nothing Semantics

**Chosen**: Prisma.$transaction() for each order: update status, release all OrderItems, then post-transaction cache invalidation
**Rationale**:

- If any ticket release fails (e.g., invalid ticketTypeId), entire order update rolls back
- No partial states: order is either EXPIRED with all tickets released, or still PENDING with all tickets reserved
- Simplifies error handling: one catch block for entire order
- Aligns with existing pattern in orders.service.ts (per-order atomic transaction)

**Alternatives Considered**:

- Single batch transaction: One rollback fails entire batch (50-100 orders); prefer per-order resilience
- Ticketless release: Silently skip OrderItems with errors; risks hiding data corruption

### Decision 7: Post-Transaction Cache Invalidation (Non-Fatal)

**Chosen**: After transaction commits, call `redisCache.del("concerts:{concertId}:ticket-types")` with try-catch logging (non-fatal)
**Rationale**:

- Redis failure should not rollback database changes (eventual consistency acceptable)
- Concert detail API will re-populate cache on next read if cache miss occurs
- RedisCacheService.del() already has internal try-catch; wrapping is defensive but non-breaking
- Matches existing pattern in orders.service.ts post-transaction cache invalidation

**Alternatives Considered**:

- Throw on Redis error: Would rollback database changes; too strict for a non-critical cache
- No invalidation: Stale cache until TTL expires; acceptable but slower consistency

### Decision 8: Continue-on-Error Pattern for Batch Resilience

**Chosen**: Wrap each order's transaction in try-catch; log error and continue to next order
**Rationale**:

- One bad order (e.g., malformed ticketTypeId reference) should not block 99 other orders from expiring
- Transient DB errors (connection timeouts) may succeed on next run
- Makes job resilient to intermittent failures
- Simplifies monitoring: error count = metric, not a job failure

**Alternatives Considered**:

- Throw on first error: Entire batch fails; not resilient
- Batch-level transaction: One error = 0 orders processed; same problem

### Decision 9: Install @nestjs/schedule Dependency

**Chosen**: Add `@nestjs/schedule` to backend/package.json dependencies, import ScheduleModule.forRoot() in AppModule
**Rationale**:

- @Cron decorator requires this package
- Lightweight (no runtime overhead for unused cron jobs)
- Official NestJS package; well-maintained and tested

**Alternatives Considered**:

- Manual setInterval: Not integrated with NestJS lifecycle; harder to test
- Node cron package: Less NestJS integration

### Decision 10: Log Summary Counts, Not Per-Item Details

**Chosen**: Log aggregated counts at job completion: total candidates, expired, skipped (already transitioned), failed
**Rationale**:

- 100 orders × 10 items = 1000 events per run; per-item logs would be noise
- Summary metrics are more useful for monitoring and debugging
- Reduces disk I/O and log volume
- Errors are still logged at order level for specific failures

**Alternatives Considered**:

- Per-item logging: Too verbose; log files grow rapidly
- No logging: Loses visibility into job health and error patterns

## Risks / Trade-offs

**Clock Skew** → **Mitigation**: If server clock is wrong (drifts backward), orders might expire early or late. Accept as acceptable for MVP; add monitoring alert for clock drift if needed.

**Payment Webhook Timing Window** → **Mitigation**: Conditional WHERE status = PENDING guards against webhook transitioning order to PAID between job query and update. Idempotent behavior ensures correctness.

**Redis Failure** → **Mitigation**: Cache invalidation is non-fatal; stale cache persists until TTL expires or next manual refresh. Database state is correct regardless. Acceptable for eventual consistency model.

**Batch Size Limitation** → **Trade-off**: Max 100 orders per run means high-volume expirations take multiple cycles (60 seconds each). Acceptable: even at 10,000 expired orders, clears in 10 minutes. Alternative would be longer transactions blocking API queries.

**No Deduplication for Duplicate Job Invocations** → **Mitigation**: Conditional WHERE status = PENDING prevents double-expiration if two job instances run simultaneously. Second instance's update returns count = 0 and skips release (idempotent).

**No User Notification on Expiration** → **Trade-off**: Users won't know why their reserved order expired. Acceptable for MVP; notification system is separate feature. Users see tickets become available again, which is the important part.

**Transient DB Errors Silently Retry** → **Trade-off**: If a query times out, that order waits 60 seconds for next attempt. Acceptable: eventual consistency; order will expire on next run if the transient error resolves.

## Migration Plan

**Deployment**:

1. Install @nestjs/schedule: `npm install @nestjs/schedule`
2. Update src/app.module.ts: Add `ScheduleModule.forRoot()` to imports
3. Create src/modules/orders/order-expiration.service.ts with @Cron decorator and logic
4. Register OrderExpirationService in OrdersModule.providers
5. Run `npm run build` and `npm run lint` to verify
6. Run `npm test` to verify unit tests pass
7. Deploy (no database migration needed; uses existing Order and TicketType tables)

**Rollback**:

- Remove ScheduleModule.forRoot() from AppModule.imports
- Remove OrderExpirationService registration from OrdersModule.providers
- Redeploy
- No data cleanup needed; expired orders remain in PENDING status until manually handled (non-critical)

**Testing**:

- Unit tests: Mock Prisma, Redis, verify transaction logic, conditional update behavior
- Integration tests: Create PENDING order with past expiresAt, run job, verify status = EXPIRED and reserved_quantity decremented
- Concurrency test: Simulate payment webhook race condition, verify idempotent behavior

## Open Questions

1. **Monitoring & Alerting**: Should we set up alerts if >1000 orders expire in a single run? (Suggests payment issues or mass user abandonment)
2. **Audit Trail**: Should expired orders be logged to an audit table for historical analysis? (Deferred to future feature)
3. **Timezone Handling**: Is expiresAt stored in UTC? Confirm assumption before deployment.
