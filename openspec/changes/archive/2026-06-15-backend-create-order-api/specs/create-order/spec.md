## Specification: Create Order

## Description

Authenticated users (Audience role) can submit a pending order with concert tickets. The system validates concert availability, ticket type eligibility, per-user purchase limits, and inventory under concurrent requests. Orders are stored in PostgreSQL with PENDING status and 15-minute expiration. Idempotent API (same userId + idempotencyKey returns existing order without re-processing).

## Main Flow

1. **Frontend** → POST /orders with concertId, items[], idempotencyKey
2. **Backend API** (authenticated via JwtAuthGuard)
   - Checks idempotency: if order exists for (userId, idempotencyKey), return it
   - Validates concert exists and status = PUBLISHED
   - Fetches all requested ticket types from PostgreSQL
   - Validates each ticket type: ACTIVE status, sale window (saleStartAt ≤ now ≤ saleEndAt or null), positive quantity
   - Queries PostgreSQL: sum of PENDING + PAID order quantities per user per ticket type
   - Validates: existing + requested ≤ perUserLimit
   - **Begins database transaction**:
     - Conditional UPDATE on ticket_types: reserves tickets where (total - reserved - sold) ≥ requested
     - If any UPDATE affects 0 rows → rolls back entire transaction, returns 409 Conflict
     - Creates Order (status=PENDING, expiresAt=now+15min)
     - Creates OrderItem records with unitPriceVnd from ticket types
     - **Commits transaction**
3. **Post-commit**: DELETE Redis key `concerts:{concertId}:ticket-types`
4. **Response**: orderId, orderCode, PENDING status, totalAmountVnd, expiresAt

## Failure Scenarios

- **Concert not found** → 404 Not Found
- **Concert not PUBLISHED** → 409 Conflict
- **Ticket type not found** → 404 Not Found
- **Ticket type not ACTIVE** → 409 Conflict
- **Outside sales window** → 409 Conflict
- **Invalid quantity (≤0, not integer)** → 400 Bad Request
- **Duplicate ticketTypeIds in request** → 400 Bad Request
- **Per-user limit exceeded** → 409 Conflict (existing PENDING/PAID quantity + requested exceeds perUserLimit)
- **Not enough inventory** (conditional update returns 0 rows) → 409 Conflict, entire transaction rolls back
- **Redis cache deletion fails** → Logged as warning; order is already committed; no rollback
- **Idempotency collision (concurrent requests, same key)** → Both resolve to same idempotencyKey unique constraint; first request wins; second returns 409 or existing order per implementation
- **Unauthenticated request** → 401 Unauthorized (JwtAuthGuard)

## Constraints

- **Atomicity**: All reservations are all-or-nothing; no partial reservations
- **Concurrency**: Conditional update uses raw SQL to ensure PostgreSQL-level atomicity; no race conditions
- **Per-user limits**: Applied across all active (PENDING + PAID) orders for each ticket type; includes current request
- **Availability**: Do not trust frontend values; re-validate from database
- **Idempotency**: userId + idempotencyKey unique constraint prevents duplicate orders; no payment yet so no charge duplication risk
- **Order expiration**: Set to 15 minutes; expiration processing deferred to future worker (not in scope)
- **Redis cache**: Invalidated only after order committed; eventual consistency acceptable (5-second TTL mitigates stale views)
- **No payment integration** in this feature; order remains PENDING indefinitely until payment workflow implemented
- **RBAC**: Only Audience users can create orders (no explicit check needed; JwtAuthGuard + user context sufficient for MVP)

## Acceptance Criteria

#### Scenario: Successful order creation with available tickets

- **WHEN** authenticated user POSTs /orders with valid concertId, single ticket type, quantity < perUserLimit, concert PUBLISHED, ticket type ACTIVE, within sales window
- **THEN** system returns 200 OK with orderId, orderCode, PENDING status, totalAmountVnd, expiresAt (now+15min)
- **AND** Order stored in PostgreSQL with idempotency_key
- **AND** OrderItem created with unitPriceVnd, quantity, subtotalVnd
- **AND** ticket_types.reserved_quantity incremented
- **AND** Redis key deleted

#### Scenario: Idempotent retry returns existing order

- **WHEN** user submits same (userId, idempotencyKey) twice
- **THEN** second request returns same orderId, orderCode, status, totalAmountVnd from first request
- **AND** no new Order or reservation created
- **AND** ticket_types.reserved_quantity not incremented again

#### Scenario: Rejects when per-user limit exceeded (including pending orders)

- **WHEN** user has existing PENDING order with 3 tickets of type X (perUserLimit=5), and requests 3 more of type X
- **THEN** system returns 409 Conflict
- **AND** no new Order created
- **AND** ticket_types.reserved_quantity not incremented

#### Scenario: Rejects when inventory insufficient under concurrent requests

- **WHEN** 2 concurrent requests both try to reserve last 5 tickets, each requesting 5
- **THEN** first request succeeds (0 rows affected check passes)
- **AND** second request returns 409 Conflict (0 rows affected from conditional update)
- **AND** first transaction committed; second transaction rolled back
- **AND** total reserved = 5 (not 10)

#### Scenario: Rejects duplicate ticketTypeIds in single request

- **WHEN** request contains items=[{ticketTypeId: X, quantity: 2}, {ticketTypeId: X, quantity: 1}]
- **THEN** system returns 400 Bad Request

#### Scenario: Concert not published

- **WHEN** user requests order for concert with status DRAFT/CANCELLED/FINISHED
- **THEN** system returns 409 Conflict
- **AND** no reservation attempted

#### Scenario: Outside sales window

- **WHEN** current time is before saleStartAt or after saleEndAt (if set)
- **THEN** system returns 409 Conflict
- **AND** no reservation attempted

#### Scenario: Unauthenticated request

- **WHEN** POST /orders without valid JWT
- **THEN** system returns 401 Unauthorized
- **AND** no processing attempted
