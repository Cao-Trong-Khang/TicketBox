## Why

TicketBox currently exposes a payment-shaped happy path, but it does not yet provide a trustworthy payment boundary: browser redirect parameters can trigger settlement, callbacks are not verified, initiation is not persisted idempotently, provider failures are not coordinated across backend instances, and concurrent completion can produce inconsistent Order, PaymentTransaction, inventory, or Ticket state. At the same time, the current read-then-create per-user quota check can be bypassed by simultaneous checkout requests that use different idempotency keys.

This change is required to satisfy the course-project goals for unstable VNPAY/MoMo integrations, double-charge and duplicate-ticket prevention, failure isolation, global inventory safety, and organizer-configured per-user limits under high contention. The implementation remains sandbox/demo-only, but its verification, idempotency, timeout, circuit-breaker, locking, and concurrency controls must be real rather than simulated through client-side settlement.

## What Changes

- Replace the current controller-centric payment flow with a server-authoritative payment capability that verifies the authenticated Audience user, order ownership, payable order state, amount, provider, and server-controlled callback destinations.
- Require payment-initiation idempotency and persist the authoritative attempt before contacting VNPAY or MoMo. Reusing a key for the same operation returns the existing result; conflicting reuse is rejected and never creates another provider charge attempt.
- **BREAKING**: remove the browser-driven `/payments/confirm` settlement behavior. A frontend redirect or query string may display an informational result but can never mark an order paid or issue tickets.
- **BREAKING**: replace the existing client-trusting payment initiation contract with a secure contract that does not accept authoritative amount or webhook configuration from the browser.
- Verify provider identity, callback signature, transaction reference, order association, amount, and outcome before applying any successful or failed payment transition.
- Make payment, order, reservation, sold-inventory, and ticket-issuance transitions conditional, monotonic, retry-safe, and idempotent so duplicate or concurrent callbacks issue tickets exactly once.
- Record failed and timed-out payment outcomes and release reservations exactly once when an order can no longer be paid.
- Add bounded provider timeouts, shared Closed/Open/Half-Open circuit state, controlled retryable errors, and provider availability reporting. One failed provider does not disable the other; both failed providers do not interrupt public concert browsing or ticket-availability reads.
- Add reconciliation for sandbox payment attempts that remain pending or whose callback result is uncertain, without treating a client redirect as confirmation.
- Enforce per-user purchase limits for each user, concert, and ticket type under simultaneous checkout attempts, while keeping PostgreSQL authoritative for inventory, paid purchases, reservations, and issued tickets.
- Coordinate the checkout hot path through Redis and authoritative PostgreSQL transactions so required coordination failures fail closed before inventory or quota mutation, and successful concurrent operations cannot oversell inventory or exceed a user's configured limit.
- Update the audience payment UI to obtain provider availability and authoritative payment status from the backend and to present unavailable, pending, successful, failed, and retryable states without claiming tickets were issued prematurely.
- Add the schema constraints and migration path needed for idempotent attempts, provider references, transition metadata, reconciliation, and exactly-once fulfillment while preserving valid existing orders, payments, and tickets where possible.
- Add unit, integration, end-to-end, failure-injection, and concurrency tests plus deterministic sandbox/test-provider behavior and repeatable README demo scenarios.

## Capabilities

### New Capabilities

- `payment-processing`: Provides secure sandbox VNPAY/MoMo initiation, PostgreSQL-backed idempotency, verified callbacks, conditional settlement, exactly-once ticket issuance, timeout and reconciliation handling, shared circuit-breaker state, provider degradation, and authoritative payment-status reporting.

### Modified Capabilities

- `ticket-purchasing`: Strengthens checkout so global inventory and per-user ticket limits remain correct across simultaneous requests, required coordination failures fail closed, and reservations are finalized or released exactly once according to authoritative payment outcomes.

## Impact

- **Impacted roles**: Audience users receive the changed checkout and payment behavior. Organizers retain control over ticket capacity and per-user limits and receive more reliable sales outcomes. Check-in Staff behavior and permissions are unchanged, but issued tickets become trustworthy because only verified payment fulfillment can create them.
- **Backend code**: Significant changes to `payments`, `orders`, ticket issuance, order expiration, Redis coordination, provider adapters, configuration, error mapping, and scheduled reconciliation. Sensitive payment and checkout endpoints require authentication, authorization, ownership validation, and existing mutation rate limits where applicable.
- **Frontend code**: Payment selection, redirect-result handling, order status, retry behavior, provider availability, and success/failure pages will use backend-authoritative state. The frontend will no longer call a settlement endpoint.
- **APIs**: Payment initiation and status contracts change; insecure confirmation is removed; provider callbacks become provider-specific verified entry points or an equivalently verified contract. Exact routes and payloads are defined in the design and specifications.
- **Database**: `orders`, `payment_transactions`, inventory/reservation state, and related uniqueness or transition fields may require a forward migration and data-compatibility checks. PostgreSQL remains the source of truth.
- **Redis**: Redis is used for shared circuit state and short-lived checkout coordination or pre-checks, never as the final authority for payment, ticket ownership, inventory, or quota. Protected checkout mutations fail closed when required Redis coordination is unavailable.
- **External systems**: The change interacts with VNPAY and MoMo sandbox endpoints and verified callbacks. It does not introduce real settlement, additional providers, cloud-only infrastructure, or new databases.
- **Existing architecture**: The change supports the global modular-monolith, PostgreSQL, Redis, cache-aside, rate-limiting, and provider-adapter decisions. Public concert list, detail, and availability APIs remain isolated from payment-provider failures. Unrelated RBAC, Artist Bio, notification, VIP CSV, and offline check-in flows remain outside the change except for consuming trustworthy issued-ticket state.
- **Operations and documentation**: Docker/local configuration gains explicit sandbox and deterministic failure-demo settings. README instructions cover migrations, seed prerequisites, provider setup, outage simulation, idempotency replay, duplicate callbacks, and concurrent quota demonstrations.

## Success Criteria

- Repeating payment initiation with the same idempotency key produces one authoritative PaymentTransaction and at most one provider charge attempt.
- A client redirect, forged browser query string, unsigned callback, wrong amount, wrong order reference, or wrong provider reference cannot mark an order paid or issue tickets.
- Repeated and concurrent valid success callbacks leave one final paid state, one inventory finalization, and exactly the purchased number of tickets.
- Provider timeout/error thresholds open shared circuit state and return a controlled retryable response; another healthy provider remains available, and public concert reads continue when both providers are unavailable.
- Pending or uncertain sandbox payments can be reconciled without duplicate settlement, while definitive failure or expiry releases reservations exactly once.
- Given a per-user limit of four and two existing paid tickets, two concurrent requests for two more tickets allow at most one request to reserve/proceed, and the authoritative user total never exceeds four.
- Concurrent users cannot reserve or receive more tickets than total capacity, and Redis unavailability cannot cause a checkout mutation to proceed without required coordination.
- Automated tests reproduce the idempotency, duplicate-callback, provider-outage, reservation-release, global inventory, and per-user concurrency scenarios, and the documented demo can be run locally without real money movement.

## Risks and Boundaries

- Sandbox providers differ in callback fields and availability, so deterministic test-provider behavior is required for a repeatable course demonstration while real adapter verification remains implemented.
- Stronger database serialization and high-contention locking may reduce checkout throughput; the Design phase must define bounded lock scope, retry behavior, and deadlock handling without weakening correctness.
- Shared Redis coordination introduces an availability dependency for protected mutations; failure behavior must remain fail-closed for checkout while read-only features degrade independently.
- Existing payment and ticket fixtures may not satisfy new transition or uniqueness constraints, so migration and seed compatibility must be explicitly validated before enforcement.
- Detailed state machines, API payloads, Redis keys, lock strategy, circuit thresholds, timeout values, reconciliation cadence, and provider signature algorithms are deferred to the Design and specification phases.
- Refunds, recurring payments, production money settlement, providers beyond VNPAY/MoMo, multi-account identity enforcement, seat-level booking, and unrelated RBAC, Artist Bio, VIP CSV, notification, or offline check-in redesign are out of scope.
