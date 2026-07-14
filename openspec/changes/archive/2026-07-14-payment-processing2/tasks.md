## 1. Establish Schema and Migration Safety

- [x] 1.1 Audit existing Order, OrderItem, PaymentTransaction, TicketType, and Ticket rows and document invariants that the migration must preserve. [payment-processing: monotonic exactly-once settlement; ticket-purchasing: reservations finalized or released exactly once]
- [x] 1.2 Extend the Prisma payment model and enums with request fingerprint, stable provider reference, initiation/reconciliation lease metadata, failure metadata, timestamps, and review/uncertain states required by the design. [payment-processing: PostgreSQL-backed idempotent initiation; idempotent payment reconciliation]
- [x] 1.3 Add database uniqueness, lookup indexes, and safe conditional-state constraints for idempotency keys, provider references, provider transaction IDs, orders, and reconciliation scans. [payment-processing: PostgreSQL-backed idempotent initiation; monotonic exactly-once settlement]
- [x] 1.4 Create a forward Prisma migration that adds nullable fields first, classifies or backfills legacy payment rows, and enforces only constraints valid for existing data. [payment-processing: deterministic secure sandbox demonstration]
- [x] 1.5 Update local seed data with payable, paid, failed, expired, uncertain, and concurrency-demo orders without introducing a fake settled payment path. [payment-processing: deterministic secure sandbox demonstration; ticket-purchasing: per-user limits remain correct under concurrency]
- [x] 1.6 Add and run a migration verification script that detects duplicate references, inconsistent paid orders, negative counters, duplicate tickets, and capacity violations in Docker Compose PostgreSQL. [payment-processing: monotonic exactly-once settlement; ticket-purchasing: global inventory cannot be oversold]
- [x] 1.7 Regenerate Prisma Client and prove a clean Docker Compose database can migrate and seed from scratch. [payment-processing: deterministic secure sandbox demonstration]

## 2. Build the Server-Authoritative Payment Domain

- [x] 2.1 Define typed payment provider, normalized result, authoritative status, availability, error, and state-transition contracts used by PaymentsService. [payment-processing: server-authoritative payment initiation; verified provider callbacks]
- [x] 2.2 Replace client-trusting initiation DTOs with an authenticated contract containing only order ID, provider, and required idempotency key. [payment-processing: server-authoritative payment initiation]
- [x] 2.3 Implement order ownership, permission, payable-state, expiry, provider-readiness, and server-derived amount/URL validation in PaymentsService. [payment-processing: server-authoritative payment initiation]
- [x] 2.4 Implement deterministic request fingerprinting and the PostgreSQL create-or-replay operation with conflicting-key detection. [payment-processing: PostgreSQL-backed idempotent initiation]
- [x] 2.5 Implement a conditional initiation lease and stable provider request identity so only one concurrent caller contacts a provider and crashed attempts are recoverable. [payment-processing: PostgreSQL-backed idempotent initiation]
- [x] 2.6 Implement owner-authorized payment status and coarse provider-availability service queries with no secret or internal Redis data leakage. [payment-processing: authoritative payment status and degradation UI]
- [x] 2.7 Add stable HTTP error codes and retry metadata for validation, conflict, provider-unavailable, coordination-unavailable, timeout, pending, and review outcomes. [payment-processing: shared provider failure isolation; authoritative payment status and degradation UI]

## 3. Implement VNPAY, MoMo, and Deterministic Provider Adapters

- [x] 3.1 Implement the VNPAY sandbox initiation adapter using server configuration, stable references, canonical parameters, and an explicit request deadline where network I/O is required. [payment-processing: server-authoritative payment initiation; shared provider failure isolation]
- [x] 3.2 Implement VNPAY callback canonicalization, signature verification with timing-safe comparison, and normalized result parsing with fixture tests. [payment-processing: verified provider callbacks]
- [x] 3.3 Implement the MoMo sandbox initiation adapter with server-derived callback URLs, stable references, credentials, and AbortController-backed timeout handling. [payment-processing: server-authoritative payment initiation; shared provider failure isolation]
- [x] 3.4 Implement MoMo callback canonicalization, signature verification with timing-safe comparison, and normalized result parsing with fixture tests. [payment-processing: verified provider callbacks]
- [x] 3.5 Implement provider status-query operations used by reconciliation, preserving uncertainty where a sandbox cannot provide authoritative evidence. [payment-processing: idempotent payment reconciliation]
- [x] 3.6 Implement a configuration-gated deterministic adapter or provider fixture that produces signed success/failure callbacks and controlled delay, timeout, outage, and recovery behavior through the normal service path. [payment-processing: deterministic secure sandbox demonstration]
- [x] 3.7 Validate all provider configuration at startup/readiness and ensure logs redact credentials, signatures, and sensitive callback fields. [payment-processing: server-authoritative payment initiation; verified provider callbacks]

## 4. Add Shared Circuit Breaking and Provider Degradation

- [x] 4.1 Implement namespaced per-provider Redis circuit state and an atomic transition script for Closed, Open, and Half-Open states. [payment-processing: shared provider failure isolation]
- [x] 4.2 Implement a token-owned single Half-Open probe lease, expiry, and compare-and-release behavior shared across backend instances. [payment-processing: shared provider failure isolation]
- [x] 4.3 Classify timeout, transport, provider 5xx, validation, and business-decline outcomes so only infrastructure failures affect the circuit. [payment-processing: shared provider failure isolation]
- [x] 4.4 Wrap every provider initiation and status call with configured deadlines, circuit admission, outcome recording, and controlled retryable error mapping. [payment-processing: shared provider failure isolation]
- [x] 4.5 Make Redis/circuit unavailability fail new payment initiation closed while keeping callback verification and public concert/availability reads independent. [payment-processing: shared provider failure isolation]
- [x] 4.6 Expose provider-isolated availability and retry timing for the frontend and health diagnostics without exposing circuit keys or secrets. [payment-processing: authoritative payment status and degradation UI]

## 5. Secure APIs and Exactly-Once Fulfillment

- [x] 5.1 Implement authenticated, permission-guarded, rate-limited `POST /payments/initiate`, owner-authorized payment status, and coarse provider-availability endpoints. [payment-processing: server-authoritative payment initiation; authoritative payment status and degradation UI]
- [x] 5.2 Implement separate VNPAY and MoMo webhook endpoints with raw/typed payload handling, callback throttling, signature verification, and no JWT dependency. [payment-processing: verified provider callbacks]
- [x] 5.3 Remove the backend `/payments/confirm` settlement endpoint and every service path that lets browser-controlled data mark an order paid. [payment-processing: verified provider callbacks]
- [x] 5.4 Implement row-locked conditional payment/order transition helpers that reject backward or incompatible transitions and surface late success for review. [payment-processing: monotonic exactly-once settlement; reservation release and uncertain outcomes]
- [x] 5.5 Implement successful fulfillment in one PostgreSQL transaction that locks payment, order, and sorted TicketType rows, finalizes reservations once, and issues exactly the ordered Tickets once. [payment-processing: monotonic exactly-once settlement]
- [x] 5.6 Implement definitive failure and expiry closure through a single winning conditional order transition that releases reservations once. [payment-processing: reservation release and uncertain outcomes; ticket-purchasing: reservations finalized or released exactly once]
- [x] 5.7 Move cache invalidation, Kafka events, and notifications after commit and make their retries unable to alter core settlement or reissue Tickets. [payment-processing: monotonic exactly-once settlement]
- [x] 5.8 Add audit-safe structured logs and metrics for initiation replay, signature rejection, transition conflict, duplicate callback, provider latency, circuit state, release, fulfillment, and review state. [payment-processing: all acceptance criteria]

## 6. Reconcile Pending and Timed-Out Payments

- [x] 6.1 Implement a bounded Background Worker scan for stale initiated, pending, and timed-out payments using indexed timestamps and batch limits. [payment-processing: idempotent payment reconciliation]
- [x] 6.2 Implement conditional claim leases, lease recovery, attempt tracking, and jitter so concurrent workers do not hot-loop or duplicate provider queries. [payment-processing: idempotent payment reconciliation]
- [x] 6.3 Feed authoritative reconciliation results through the same conditional success/failure/review functions used by verified callbacks. [payment-processing: idempotent payment reconciliation; monotonic exactly-once settlement]
- [x] 6.4 Coordinate reconciliation with order expiry so unknown results are never fabricated and verified late success cannot recreate released inventory. [payment-processing: reservation release and uncertain outcomes; idempotent payment reconciliation]
- [x] 6.5 Add Docker Compose configuration for reconciliation cadence, lease, batch size, deadlines, and deterministic demo controls with safe defaults. [payment-processing: deterministic secure sandbox demonstration]

## 7. Serialize Checkout Quota and Inventory

- [x] 7.1 Implement token-owned Redis locks for user/concert quota and TicketType inventory scopes with deterministic ordering, bounded wait, lease expiry, and atomic compare-and-delete release. [ticket-purchasing: checkout coordination fails closed]
- [x] 7.2 Make Redis unavailability or coordination timeout return a stable retryable checkout error before any PostgreSQL mutation. [ticket-purchasing: checkout coordination fails closed]
- [x] 7.3 Run checkout mutations in a Prisma interactive `SERIALIZABLE` transaction with bounded jittered retries for serialization and deadlock conflicts. [ticket-purchasing: checkout database conflicts are bounded and atomic]
- [x] 7.4 Recheck order idempotency inside the transaction and preserve exact-replay versus conflicting-reuse behavior across retries. [ticket-purchasing: Audience can create checkout orders; checkout database conflicts are bounded and atomic]
- [x] 7.5 Acquire transaction-scoped quota locks for user/concert/ticket-type scopes and row locks for TicketTypes in deterministic order. [ticket-purchasing: per-user limits remain correct under concurrency; global inventory cannot be oversold]
- [x] 7.6 Compute effective quota from paid quantities plus non-expired pending reservations and enforce the organizer-configured per-user limit inside the locked transaction. [ticket-purchasing: per-user limits remain correct under concurrency]
- [x] 7.7 Validate global capacity and atomically create Order/OrderItems and increment reservations in the same transaction, ignoring stale cache as authority. [ticket-purchasing: global inventory cannot be oversold]
- [x] 7.8 Update order-expiration and payment-failure paths to use the shared conditional release operation and invalidate availability data only after commit. [ticket-purchasing: reservations finalized or released exactly once]

## 8. Update the Audience Payment Experience

- [x] 8.1 Update frontend payment API types and calls for provider availability, secure initiation, owner-authorized status polling, stable errors, and retry metadata. [payment-processing: authoritative payment status and degradation UI]
- [x] 8.2 Generate one payment idempotency key per user payment action, retain it across transport retries, and clear it only after a definitive new action boundary. [payment-processing: PostgreSQL-backed idempotent initiation]
- [x] 8.3 Disable unavailable providers independently and render controlled retry/alternative-provider guidance when one or both circuits are unavailable. [payment-processing: shared provider failure isolation; authoritative payment status and degradation UI]
- [x] 8.4 Replace PaymentSuccessPage query-driven settlement with authenticated polling that renders pending, paid/tickets-issued, failed, expired, retryable, and review states from backend data. [payment-processing: verified provider callbacks; authoritative payment status and degradation UI]
- [x] 8.5 Remove all frontend calls and assumptions related to `/payments/confirm` and ensure refresh/back navigation cannot re-initiate or settle payment. [payment-processing: verified provider callbacks]
- [x] 8.6 Add frontend component/API tests for provider degradation, initiation replay, polling transitions, forged success query strings, timeout, failure, and review messaging. [payment-processing: authoritative payment status and degradation UI]

## 9. Verify Security, Idempotency, and Concurrency

- [x] 9.1 Add PaymentsService unit tests for ownership, authoritative field derivation, fingerprints, exact replay, conflicting reuse, stable references, leases, and error mapping. [payment-processing: server-authoritative payment initiation; PostgreSQL-backed idempotent initiation]
- [x] 9.2 Add callback and state-machine unit tests for bad signatures, mismatches, monotonic transitions, timeout uncertainty, late success review, and duplicate results. [payment-processing: verified provider callbacks; monotonic exactly-once settlement; reservation release and uncertain outcomes]
- [x] 9.3 Add Redis integration tests using Docker Compose for cross-instance Open/Half-Open/Closed transitions, single probe, provider isolation, expiry, and Redis failure. [payment-processing: shared provider failure isolation]
- [x] 9.4 Add PostgreSQL integration tests that deliver concurrent valid callbacks and callback/reconciliation races and assert one payment result, one order transition, exact inventory counters, and exact Ticket count. [payment-processing: monotonic exactly-once settlement; idempotent payment reconciliation]
- [x] 9.5 Add reconciliation integration tests for lost callbacks, crashed leases, definitive failure, unknown status, order expiry, and verified late success. [payment-processing: idempotent payment reconciliation; reservation release and uncertain outcomes]
- [x] 9.6 Add checkout concurrency tests with different idempotency keys for the limit-four/two-paid/two-concurrent-requests scenario and assert at most one succeeds. [ticket-purchasing: per-user limits remain correct under concurrency]
- [x] 9.7 Add global inventory concurrency tests across multiple users and ticket types that assert sold plus active reserved never exceeds capacity and failed transactions leave no partial rows. [ticket-purchasing: global inventory cannot be oversold; checkout database conflicts are bounded and atomic]
- [x] 9.8 Add checkout failure-injection tests for Redis outage, busy locks, stale lock cleanup, stale cache/pre-check, serialization retries, and failure/expiry release races. [ticket-purchasing: checkout coordination fails closed; reservations finalized or released exactly once]
- [x] 9.9 Add API/E2E tests for RBAC, non-owner access, tampered client fields, forged redirects, signed/unsigned provider callbacks, payment states, and removal of `/payments/confirm`. [payment-processing: server-authoritative payment initiation; verified provider callbacks; authoritative payment status and degradation UI]
- [x] 9.10 Run backend, frontend, migration, integration, and E2E suites against the Docker Compose stack and record the commands and passing results. [payment-processing and ticket-purchasing: all acceptance criteria]

## 10. Document and Rehearse the Course Demo

- [x] 10.1 Document environment variables, sandbox credentials, callback setup, timeouts, circuit thresholds, reconciliation, Redis coordination, migrations, seeds, and startup commands without committing secrets. [payment-processing: deterministic secure sandbox demonstration]
- [x] 10.2 Add a repeatable demo for same-key payment replay and conflicting reuse that proves one persisted attempt and at most one provider charge identity. [payment-processing: PostgreSQL-backed idempotent initiation]
- [x] 10.3 Add a repeatable signed-callback demo for tampering rejection, duplicate/concurrent delivery, exactly-once tickets, and browser query strings having no settlement authority. [payment-processing: verified provider callbacks; monotonic exactly-once settlement]
- [x] 10.4 Add a repeatable outage demo showing timeout-driven circuit opening, independent provider availability, both-provider controlled failure, unaffected public reads, and Half-Open recovery. [payment-processing: shared provider failure isolation]
- [x] 10.5 Add a repeatable reconciliation demo for lost callback, timed-out attempt, definitive failure release, and late-success review. [payment-processing: idempotent payment reconciliation; reservation release and uncertain outcomes]
- [x] 10.6 Add a repeatable concurrent checkout demo proving both the per-user limit example and global no-oversell behavior, plus fail-closed Redis outage behavior. [ticket-purchasing: all acceptance criteria]
- [x] 10.7 Record sandbox/course-project boundaries, migration/rollback limitations, known provider differences, and evidence that no production money settlement, refund, or fake client settlement is included. [payment-processing: deterministic secure sandbox demonstration]
