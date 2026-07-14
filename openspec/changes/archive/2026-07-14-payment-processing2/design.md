## Context

TicketBox is a NestJS modular monolith with PostgreSQL as the transactional source of truth, Redis for short-lived coordination and failure isolation, and Kafka for asynchronous work. The current checkout flow creates `PENDING` orders and atomically increments ticket-type reservation counters, but its per-user limit is a read-then-write check that can race across requests. The current payment controller accepts client-supplied order amounts and callback URLs, does not persist initiation before provider interaction, does not verify callbacks, and exposes a client-driven confirmation endpoint that can mark an order paid and issue tickets.

This design replaces that happy path with a server-authoritative sandbox payment boundary and strengthens checkout concurrency without introducing another database or service. Audience users initiate and inspect only their own payments. Organizer configuration remains the source of ticket capacity and per-user limits. Check-in Staff behavior is unchanged and continues to trust only server-issued tickets backed by paid orders.

VNPAY and MoMo remain external sandbox systems. Public concert list, concert detail, and ticket availability reads have no synchronous dependency on either provider and continue using the existing PostgreSQL/Redis cache-aside paths during provider outages.

## Goals / Non-Goals

**Goals:**

- Make payment initiation server-authoritative, authenticated, ownership-checked, rate-limited, and idempotent.
- Verify provider callbacks before changing authoritative state.
- Make payment settlement, reservation finalization/release, and ticket issuance conditional and exactly-once under retries and concurrency.
- Bound provider calls with timeouts and share circuit-breaker state through Redis across backend instances.
- Expose provider availability and authoritative payment status for graceful frontend behavior.
- Reconcile uncertain sandbox attempts without using browser redirects as proof of payment.
- Prevent both inventory overselling and per-user quota violations under simultaneous checkout requests.
- Preserve PostgreSQL as final authority and fail protected mutations closed when required Redis coordination is unavailable.
- Provide deterministic failure injection and integration tests suitable for a repeatable local demonstration.

**Non-Goals:**

- Production settlement, refunds, chargebacks, recurring payments, or providers other than VNPAY and MoMo.
- Multi-account identity or payment-instrument anti-scalping.
- Seat-level allocation, microservice extraction, a new database, or managed cloud infrastructure.
- Redesigning RBAC, notification delivery, Artist Bio, VIP CSV import, or offline check-in.
- Treating a browser return URL as authoritative payment confirmation.

## Decisions

### 1. Introduce a server-authoritative PaymentsService and narrow API contracts

The payment controller becomes a transport layer over a `PaymentsService`; it no longer performs fulfillment directly.

- `POST /payments/initiate` requires JWT authentication, `ticket:purchase`, the existing payment/checkout mutation rate limit, and a body containing only `orderId`, `provider`, and `idempotencyKey`.
- The service loads the order, verifies Audience ownership, requires a payable non-expired `PENDING` order, and derives the amount and provider callback/return URLs from PostgreSQL and server configuration.
- `GET /payments/:paymentId` requires the same owner and returns authoritative status suitable for polling after a provider redirect.
- `GET /payments/providers` reports only coarse availability (`available`, `temporarily_unavailable`) and retry timing; it exposes no secrets or internal Redis data.
- Provider callbacks use dedicated unauthenticated transport endpoints such as `POST /payments/webhooks/vnpay` and `POST /payments/webhooks/momo`. They bypass user JWT because the caller is the provider, but require provider signature verification and callback-specific throttling/network controls.
- `/payments/confirm` is removed. The frontend return page treats query parameters as display hints only, extracts no authoritative success, and polls the backend payment resource.

The server-controlled contract prevents amount tampering, payment of another user's order, callback URL injection, and client-forged settlement. Dedicated provider callback parsers are preferred over a shared `any` payload because VNPAY and MoMo have different canonicalization and signature rules.

Alternative considered: keep the current generic `/payments` and `/payments/webhook` endpoints. Rejected because the generic client-trusting payload makes ownership, amount derivation, provider-specific validation, and callback verification ambiguous.

### 2. Persist an idempotent payment attempt before provider interaction

PostgreSQL owns payment initiation idempotency. `payment_transactions.idempotency_key` remains unique and is associated with a request fingerprint computed from the authenticated user, order, provider, and server-derived amount. The payment ID is used to derive a stable provider request/reference ID so a retry after a process crash reuses the same provider-side identity.

Initiation follows this sequence:

1. Validate user, order, provider, amount, expiry, and order state.
2. Insert an `INITIATED` PaymentTransaction with the unique idempotency key, request fingerprint, stable provider reference, and initiation lease metadata.
3. If the key already exists, compare fingerprints. Return the existing payment state for an exact replay; return `409 Conflict` for different semantics.
4. Only the transaction that conditionally owns the initiation lease may call the provider. Concurrent replays return the existing `INITIATED` state and poll instead of calling again.
5. Store the provider URL/reference and transition to `PENDING`, or record a retryable timeout/failure outcome. A crashed lease may be recovered by reconciliation using the same stable provider request ID.

The schema will add only fields required by this behavior, expected to include a request fingerprint, provider request/reference, payment URL or replay-safe response metadata, updated timestamp, initiation/reconciliation timestamps, failure code, and lease/attempt metadata. Exact names and enum additions are fixed in migration tasks after checking existing data.

Alternative considered: Redis-only idempotency. Rejected because Redis loss must not permit a second charge attempt and PostgreSQL is the project source of truth.

### 3. Verify callbacks before applying a monotonic payment state machine

Each provider adapter exposes typed operations for initiation, callback verification/parsing, and status query. Verification uses the provider's documented canonical field order and constant-time signature comparison. Callback verification is local cryptographic work and is not blocked by the initiation circuit breaker; an open initiation circuit must not prevent a valid delayed callback.

The normalized provider result contains provider name, stable provider reference, provider transaction ID, amount, outcome, and provider event identity when available. The service rejects invalid signatures, unknown references, mismatched providers, wrong amounts, and callbacks not associated with the persisted PaymentTransaction.

Payment transitions are monotonic:

```text
INITIATED -> PENDING -> SUCCESS
INITIATED -> PENDING -> FAILED
INITIATED -> PENDING -> TIMEOUT -> PENDING|SUCCESS|FAILED
terminal order/payment conflict -> REQUIRES_REVIEW
```

`TIMEOUT` means the result is uncertain, not a definitive failure. Reconciliation may advance it after querying the provider. Terminal success/failure never moves backward. A verified late success for an already expired/cancelled order is recorded as `REQUIRES_REVIEW`; it does not recreate released inventory or issue tickets automatically. Refund handling remains out of scope, but the state is visible and auditable.

Alternative considered: treat the return URL as confirmation and reconcile later. Rejected because redirects are controlled by the browser and can be forged or omitted.

### 4. Fulfill or release an order exactly once in one PostgreSQL transaction

All successful fulfillment is handled by one service operation using an interactive PostgreSQL transaction:

1. Lock the PaymentTransaction and Order rows (`FOR UPDATE`) in a deterministic order.
2. Re-check signature-normalized payment data, amount, provider reference, order ownership relationship, order expiry, and current states.
3. Conditionally transition the payment to `SUCCESS` and the order from `PENDING` to `PAID`.
4. If the order transition wins, lock affected TicketType rows in sorted ID order, convert reserved quantities to sold quantities, and create exactly the ordered number of Ticket rows.
5. If the order is already `PAID`, return the existing successful result without inventory or Ticket writes. If it is terminal for another reason, record review state and do not issue.
6. Commit before publishing purchase/notification events or invalidating caches. Post-commit side effects may retry independently and never determine whether tickets exist.

Failed payment, order expiry, and cancellation use the same pattern: a conditional transition out of `PENDING` is the single winner allowed to decrement reserved quantities. Existing expiration behavior is retained but coordinated with payment state so an uncertain payment is reconciled or marked for review rather than double-released.

Database uniqueness for idempotency keys and provider transaction IDs remains a second line of defense. Conditional transitions and row locks provide correctness even when callbacks have different delivery IDs.

Alternative considered: rely only on unique Ticket codes or the existing pre-transaction `order.status` check. Rejected because concurrent transactions can both observe `PENDING` before either commits.

### 5. Use Redis-backed provider circuit breakers with bounded calls

Circuit state is shared per provider in Redis rather than held in a NestJS process. An atomic Redis script records Closed/Open/Half-Open state, consecutive failures, rolling outcomes, open timestamp, and a single half-open probe lease. Configuration supplies provider timeout, failure threshold, rolling error threshold, open duration, and probe lease; sensible demo defaults follow the global blueprint (for example five consecutive failures and a 60-second open interval).

- Network, timeout, and provider 5xx failures count toward opening the circuit.
- Validation errors, user conflicts, and verified provider business declines do not count as infrastructure failures.
- Open circuits reject new initiation quickly with `503 Service Unavailable`, a stable error code, and retry metadata.
- After the open interval, only one request receives the Half-Open probe lease. Success closes the circuit; failure reopens it.
- Redis failure causes payment initiation to fail closed with a controlled retryable response because shared protection cannot be guaranteed. It does not affect provider callbacks or public read APIs.
- VNPAY URL creation still passes through configured readiness/credential checks; deterministic demo mode supplies an adapter that can intentionally delay, timeout, fail, or recover so Closed/Open/Half-Open behavior is observable without real money.
- MoMo and any provider status query use `AbortController`-backed deadlines. No external request may remain unbounded.

Alternative considered: retain per-process circuit state. Rejected because multiple backend instances would disagree and continue overloading an unhealthy provider.

### 6. Reconcile uncertain payments through an idempotent scheduled job

A bounded scheduled worker scans stale `INITIATED`, `PENDING`, and `TIMEOUT` transactions in batches. It conditionally claims each row with a lease, queries the matching provider using the stable reference and timeout/circuit rules, and feeds the normalized result into the same verified transition/fulfillment service used by callbacks. Concurrent worker runs and callbacks are safe because state transitions are conditional.

The job never fabricates success. Unsupported or unavailable status queries keep the attempt uncertain until the order expires, after which it is moved to review or a definitive failure according to provider evidence. Batch limits, lease expiry, attempt counts, and timestamps prevent an infinite hot loop.

Alternative considered: rely solely on provider webhook delivery. Rejected because the requirements explicitly cover lost callbacks and client-observed timeouts.

### 7. Serialize inventory and per-user quota during checkout

Redis protects the hot path, while PostgreSQL decides correctness.

1. Perform the existing order-idempotency lookup as a fast path.
2. Acquire short-lived token-owned Redis locks for all affected scopes in deterministic lexical order: the user's concert quota scope and each ticket type's inventory scope. Acquisition failure or Redis unavailability returns a retryable response before PostgreSQL mutation. Lua compare-and-delete releases only locks owned by the request.
3. Start a PostgreSQL interactive transaction at `SERIALIZABLE` isolation with bounded retry for serialization/deadlock failures.
4. Re-check order idempotency inside the transaction.
5. Lock TicketType rows in sorted ID order with `SELECT ... FOR UPDATE`, and acquire transaction-scoped advisory locks derived from `(userId, concertId, ticketTypeId)` before quota aggregation.
6. Compute effective quota from successfully paid quantities plus non-expired `PENDING` reservations for the same user/concert/ticket type. Counting active reservations prevents simultaneous small orders from reserving more quota than can later be paid; failed/expired reservations cease consuming quota after their single conditional release.
7. Validate per-user limits and remaining inventory, then create the order/items and increment reservations in the same transaction.
8. Commit, invalidate availability caches, and release Redis locks in `finally`.

The PostgreSQL locks are sufficient for final correctness; Redis reduces contention and fulfills the fail-closed high-load coordination requirement. Locks are acquired consistently to avoid deadlocks, and transaction retries are bounded with jitter.

Alternative considered: only raise the transaction isolation level. Rejected because the global blueprint requires Redis hot-path coordination and explicit inventory row locking, and uncoordinated serializable retries can create excessive database contention during a sale spike.

### 8. Frontend displays backend-authoritative state

The pending-order page requests provider availability before enabling methods and generates one payment idempotency key per user action, retaining it across network retries. Initiation responses redirect only when a backend-persisted URL is available. Timeout or Open-circuit responses keep the order page usable and show retry timing or the healthy alternative provider.

The return page never renders final success from query parameters alone. It reads a payment/order reference, calls the authenticated status endpoint, and displays `pending`, `paid/tickets issued`, `failed`, `expired`, or `requires review` according to backend state. Refreshing the page does not re-initiate or settle payment.

### 9. Test and demo through real mechanisms with deterministic adapters

Unit tests cover fingerprints, provider canonicalization/signatures, state transitions, circuit transitions, and lock helpers. PostgreSQL/Redis integration tests run genuinely concurrent requests and callbacks rather than sequential mocks. End-to-end tests cover authentication/ownership, tampered callbacks, same-key replay, conflicting-key reuse, callback duplication, provider outage isolation, expiry/failure release, late success review, and public reads during outage.

Demo mode is explicitly non-production and selected by configuration. It uses the same PaymentsService, persistence, verification, circuit breaker, and fulfillment code, but a deterministic provider adapter/script can produce signed success/failure callbacks and controlled timeouts. No endpoint is added that marks arbitrary orders paid.

## Risks / Trade-offs

- **[Risk] Lock contention reduces checkout throughput.** -> Acquire Redis and PostgreSQL locks in deterministic order, keep transactions small, apply bounded retries with jitter, and measure concurrency tests.
- **[Risk] A process crashes after persisting initiation but before storing the provider URL.** -> Use stable provider references, initiation leases, and reconciliation so recovery reuses the same attempt.
- **[Risk] Redis is unavailable during a sale.** -> Fail checkout/payment initiation closed with retry metadata while leaving public reads and verified callbacks independent.
- **[Risk] Provider callback formats or sandbox behavior differ from assumptions.** -> Isolate typed provider parsers, use fixture-based signature tests, and retain deterministic demo adapters.
- **[Risk] A verified success arrives after reservation release.** -> Record `REQUIRES_REVIEW`, do not oversell or auto-issue, and expose the inconsistency for operator/demo inspection.
- **[Risk] Existing seed payment rows do not satisfy new non-null fields or state rules.** -> Add nullable columns first, backfill deterministic fingerprints/references where possible, classify legacy rows, then enforce constraints only after validation.
- **[Trade-off] Counting active pending reservations is stricter than counting only paid tickets.** -> This is necessary to prevent concurrent reservations from exceeding the eventual paid limit; reservations expire or release on definitive failure.
- **[Trade-off] Callback processing remains synchronous for core settlement.** -> Core Order/Payment/inventory/Ticket consistency belongs in one PostgreSQL transaction; notifications and other side effects remain asynchronous/post-commit.

## Migration Plan

1. Add backward-compatible nullable payment metadata, timestamps, lease/reconciliation fields, status values, and required indexes/constraints. Add a migration verification query for duplicate provider references and legacy inconsistent rows.
2. Backfill or classify existing PaymentTransaction fixtures without changing already valid paid orders or issued tickets. Regenerate Prisma types and update seeds.
3. Implement the new service/provider interfaces, Redis circuit/lock helpers, reconciliation job, and secure endpoints behind configuration while the old client flow remains disabled in frontend code.
4. Switch the frontend to the new initiation/status flow and remove `/payments/confirm` from both frontend and backend in the same release.
5. Run unit, PostgreSQL/Redis integration, migration, and end-to-end tests; execute deterministic outage, duplicate-callback, and quota-concurrency demos.
6. After validation, enforce any deferred non-null/check constraints that are safe for existing data.

Rollback keeps the additive columns and enum values because removing payment audit data is unsafe. Application rollback may return to the previous binary only before new secure-flow data is written; after cutover, rollback means disabling new initiation, keeping verified callbacks/reconciliation active, and deploying a forward fix. The insecure `/payments/confirm` endpoint must not be restored.

## Open Questions

- Confirm the exact VNPAY and MoMo sandbox status-query capabilities available to the team; when a provider cannot be queried, the reconciliation policy will retain uncertainty and use expiry/review rather than infer success.
- Confirm whether demo operators need an authenticated read-only reconciliation dashboard or whether logs, database verification scripts, and the Audience status page are sufficient. This does not change settlement authority.
- Confirm acceptable lock-wait and end-to-end checkout latency targets for the course demo so timeout and retry defaults can be finalized without weakening correctness.
