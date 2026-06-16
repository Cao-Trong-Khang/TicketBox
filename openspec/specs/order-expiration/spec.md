## Specification: Order Expiration

## Description

The order expiration feature automatically expires PENDING orders that have exceeded their 15-minute reservation window and releases reserved ticket quantities back to the TicketType pool. This prevents inventory from being locked by failed payment checkouts and ensures accurate ticket availability for subsequent purchase attempts. The feature runs as a scheduled background job (every 60 seconds) and operates with no external system dependencies.

**Affected User Roles**: Audience (indirect benefit - inventory released back to public)

## Main Flow

The background scheduler invokes the expiration job every 60 seconds:

1. **Backend API** (scheduler) queries PostgreSQL for all PENDING orders where `expiresAt <= now()`, limited to 100 per run, ordered by `expiresAt` ascending
2. For each order, begin an atomic database transaction
3. **PostgreSQL**: Conditionally update order status from PENDING to EXPIRED using `WHERE id = ? AND status = PENDING` to guard against concurrent payment webhooks
4. Check the update result count; if count != 1, another process already transitioned the order (payment completed or user cancelled) → skip ticket release for this order
5. If count == 1, proceed with ticket release:
   - For each OrderItem in the expired order, execute raw SQL: `UPDATE ticket_types SET reserved_quantity = GREATEST(0, reserved_quantity - quantity) WHERE id = ticketTypeId`
   - GREATEST(0, ...) prevents negative reserved_quantity due to race conditions
6. Commit the transaction
7. **Post-transaction** (non-fatal): Call Redis to invalidate `concerts:{concertId}:ticket-types` cache for the concert of the expired order
8. Log outcome: summary counts of candidates, expired, skipped (already transitioned), and failed orders
9. Repeat for next order in batch

## Failure Scenarios

**Scenario: Payment Webhook Transitions Order Before Expiration Job Updates**

- **WHEN** expiration job fetches PENDING order AND payment webhook transitions order to PAID before job executes conditional update
- **THEN** conditional UPDATE with `status = PENDING` check returns count = 0 → job skips ticket release → no double-release of tickets → order correctly remains PAID with payment transaction recorded

**Scenario: One Ticket Type Release Fails Mid-Transaction**

- **WHEN** expiration job releases OrderItem #1 ticket type successfully AND $executeRaw for OrderItem #2 throws database error
- **THEN** entire transaction rolls back → OrderItem #1 tickets remain reserved → order still PENDING in database → next run will retry → all-or-nothing semantics preserved

**Scenario: Redis Cache Invalidation Fails**

- **WHEN** transaction commits (order expired, tickets released) AND `redisCache.del()` throws error connecting to Redis
- **THEN** error is caught and logged as warning (non-fatal) → database state is correct → next read will either hit stale cache or cache will expire naturally → eventual consistency achieved

**Scenario: Query Timeout on Large Order Batch**

- **WHEN** expiration job queries PENDING orders AND concurrent checkout creates rapid new orders, causing query to timeout
- **THEN** timeout error is caught at job level → job completes early for this run → next run (60 seconds later) retries → no inventory state corruption

**Scenario: Duplicate Job Invocation**

- **WHEN** two scheduler instances run simultaneously (e.g., deployment overlap) AND both find same PENDING order to expire
- **THEN** First instance's transaction commits (order = EXPIRED) → second instance's conditional update returns count = 0 (status != PENDING) → second instance skips and continues → idempotent behavior preserved

## Constraints

**Consistency & Atomicity**

- MUST use per-order database transactions (Prisma.$transaction) to ensure all-or-nothing semantics: either order expires and all tickets release, or nothing changes
- MUST use conditional WHERE clauses (status = PENDING check) in update to guard against concurrent payment webhooks or user cancellations
- MUST prevent negative reserved_quantity using GREATEST(0, reserved - qty) in raw SQL
- MUST NOT hold transaction locks longer than necessary (execute and commit within milliseconds)

**Performance & Scalability**

- MUST process no more than 100 expired orders per job run to prevent long-running transactions blocking other database queries
- MUST rely on existing database indexes: @@index([status]) and @@index([expiresAt]) to make WHERE status = PENDING AND expiresAt <= now() queries fast
- MUST run every 60 seconds (no configurable frequency changes)

**Resilience & Observability**

- MUST catch and log per-order errors without stopping subsequent orders in the batch (continue-on-error pattern)
- MUST log summary counts: candidates queried, successfully expired, skipped (already transitioned), and failed
- MUST NOT throw unhandled exceptions that crash the job scheduler
- Redis cache invalidation failures MUST NOT rollback database transaction (non-fatal pattern)

**Data Integrity**

- MUST NOT release tickets for orders that have already transitioned to PAID, FAILED, or CANCELLED status (conditional update prevents this)
- MUST NOT allow double-release of tickets if job runs twice on same order (idempotency via conditional WHERE status = PENDING)
- MUST preserve all order history: order.status = EXPIRED is permanent (no deletion)

**Security**

- No user authentication required (background job)
- No RBAC check required (internal system operation)

## Acceptance Criteria

**GIVEN** a PENDING order with expiresAt = now - 1 minute

- **WHEN** expiration job runs
- **THEN** order.status transitions to EXPIRED AND reserved_quantity decrements by the item quantity for each TicketType AND concerts:{concertId}:ticket-types cache key is deleted from Redis

**GIVEN** a PAID order with expiresAt = now - 1 minute

- **WHEN** expiration job runs
- **THEN** order status remains PAID AND reserved_quantity is NOT modified AND no cache invalidation occurs

**GIVEN** a PENDING order that will expire in 1 minute

- **WHEN** expiration job runs at current time
- **THEN** order status remains PENDING AND reserved_quantity is NOT modified (not yet expired)

**GIVEN** 150 PENDING expired orders exist

- **WHEN** expiration job runs
- **THEN** only first 100 orders (by expiresAt ascending) are processed AND remaining 50 are processed in next job run 60 seconds later

**GIVEN** a PENDING order AND concurrent payment webhook transitions order to PAID before conditional update executes

- **WHEN** expiration job attempts conditional update with WHERE status = PENDING
- **THEN** update returns count = 0 AND no tickets are released AND no conflict occurs

**GIVEN** all OrderItems successfully transitioned to released AND Redis is unavailable

- **WHEN** redisCache.del() fails
- **THEN** error is logged as warning AND database transaction is committed (non-fatal) AND subsequent reads handle stale cache gracefully

**GIVEN** one OrderItem fails to release mid-transaction due to database error

- **WHEN** expiration job executes raw SQL for second OrderItem
- **THEN** entire transaction rolls back (ACID) AND order remains PENDING AND reserved_quantity unchanged for both items
