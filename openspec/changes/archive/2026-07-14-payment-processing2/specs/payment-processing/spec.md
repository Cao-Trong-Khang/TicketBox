## Specification: Resilient Payment Processing

## Description

This capability allows an authenticated Audience user with `ticket:purchase` permission to pay for an owned pending order through the VNPAY or MoMo sandbox. The Backend API, PostgreSQL, Redis, provider adapters, Background Worker, and Web Application cooperate so that initiation is server-authoritative and idempotent, callbacks are verified, and tickets are issued exactly once.

## Main Flow

1. The Web Application asks the Backend API for provider availability and submits an owned order ID, provider, and payment idempotency key.
2. The Backend API checks authentication, `ticket:purchase`, ownership, order state, expiry, and rate limits, then derives the amount and callback URLs from trusted server state.
3. PostgreSQL persists the payment attempt before the selected provider adapter is called.
4. Redis supplies shared provider circuit state; the adapter calls VNPAY or MoMo with an explicit timeout.
5. A provider webhook is cryptographically verified and normalized by the Backend API.
6. One PostgreSQL transaction conditionally settles the PaymentTransaction and Order, finalizes reservations, and issues Tickets.
7. The Web Application obtains the authoritative outcome from the Backend API; a Background Worker reconciles stale or uncertain attempts.

## Failure Scenarios

- Invalid ownership, permission, order state, provider, or idempotency reuse is rejected without a provider call.
- Invalid signatures, altered amounts, unknown references, and browser redirect parameters cannot settle payment.
- Provider timeout and open-circuit conditions return controlled retryable results without disabling the other provider or public concert reads.
- Redis failure blocks new payment initiation, while verified callbacks and public read APIs remain operational.
- Duplicate callbacks, concurrent callbacks, and reconciliation races converge on one monotonic result and one ticket issuance.
- Definitive failure or expiry releases reservations once; uncertain or late success is retained for reconciliation or review rather than being guessed.

## Constraints

- PostgreSQL SHALL be authoritative for payment, order, reservation, inventory, and ticket state; Redis SHALL NOT be settlement authority.
- Protected Audience operations SHALL require authentication, `ticket:purchase`, ownership validation, and applicable mutation rate limits.
- Provider secrets and signature material SHALL remain server-side, and signature comparisons SHALL be timing-safe.
- Provider network requests SHALL have bounded deadlines and provider-isolated Redis-backed Closed/Open/Half-Open circuits.
- Public concert browsing and availability reads SHALL have no synchronous dependency on a payment provider.
- This is a sandbox/course-project implementation, but idempotency, signatures, persistence, timeouts, locking, and concurrency controls SHALL be genuine. Client-side fake settlement SHALL NOT be used.
- The capability depends on the existing authentication/RBAC foundation, PostgreSQL, Redis, order reservation model, ticket issuance, rate limiting, cache invalidation, and Background Worker infrastructure.

## Acceptance Criteria

- Automated tests and repeatable demo scripts SHALL prove same-key replay, conflicting reuse, signature rejection, duplicate callback safety, provider isolation, circuit recovery, reconciliation, and reservation release.
- The Web Application SHALL show unavailable, pending, successful, failed, expired, retryable, and review states using backend-authoritative data.
- The normative scenarios below SHALL pass against VNPAY/MoMo fixtures and the deterministic sandbox adapter.

## ADDED Requirements

### Requirement: Server-authoritative payment initiation

The system SHALL allow only an authenticated order owner with `ticket:purchase` permission to initiate payment for a non-expired payable order, and SHALL derive the payable amount, provider configuration, return URL, webhook URL, and provider reference from trusted server state.

#### Scenario: Owner initiates an eligible payment

- **GIVEN** an authenticated Audience user owns a non-expired `PENDING` order
- **WHEN** the user initiates payment with an enabled provider and a new idempotency key
- **THEN** the Backend API SHALL derive all authoritative payment fields and persist an initiated PaymentTransaction before contacting the provider

#### Scenario: Client attempts to alter authoritative fields

- **WHEN** a payment request supplies or tampers with an amount, owner, return URL, webhook URL, or provider reference
- **THEN** the system SHALL ignore or reject the untrusted fields and SHALL NOT use them to create or settle a provider payment

#### Scenario: User attempts to pay another user's order

- **WHEN** an authenticated user initiates payment for an order they do not own
- **THEN** the system SHALL deny the request without persisting or sending a provider attempt

### Requirement: PostgreSQL-backed idempotent initiation

The system SHALL require a payment idempotency key, bind it to the authenticated user, order, provider, and server-derived amount, and ensure retries cannot create another provider charge attempt.

#### Scenario: Exact replay returns the original attempt

- **GIVEN** a payment initiation has already been persisted for an idempotency key
- **WHEN** the same user repeats the same request with that key
- **THEN** the system SHALL return the existing PaymentTransaction or replay-safe result and SHALL NOT create another provider attempt

#### Scenario: Conflicting reuse is rejected

- **GIVEN** an idempotency key is bound to an existing payment request
- **WHEN** it is reused with a different order, provider, user, or derived amount
- **THEN** the system SHALL return a conflict and SHALL NOT contact a provider

#### Scenario: Concurrent identical initiation

- **WHEN** concurrent backend instances receive identical requests with the same idempotency key
- **THEN** exactly one persisted attempt SHALL own provider initiation and all other requests SHALL observe that attempt

#### Scenario: Initiator crashes after persistence

- **GIVEN** the initiating process stops after persisting an attempt but before recording a provider response
- **WHEN** initiation recovery or reconciliation runs
- **THEN** it SHALL reuse the stable provider request reference and SHALL NOT create a second charge identity

### Requirement: Verified provider callbacks

The system SHALL verify the provider-specific signature and match the provider, persisted reference, transaction identity, order association, and amount before accepting a VNPAY or MoMo callback.

#### Scenario: Valid signed callback is accepted

- **GIVEN** a callback has a valid provider signature and matches a persisted payment
- **WHEN** the provider webhook endpoint receives it
- **THEN** the system SHALL normalize the result and submit it to the authoritative conditional settlement flow

#### Scenario: Invalid or mismatched callback is rejected

- **WHEN** a callback is unsigned, incorrectly signed, references an unknown payment, or contains a mismatched provider, amount, order, or transaction reference
- **THEN** the system SHALL reject it without changing PaymentTransaction, Order, reservation, inventory, or Ticket state

#### Scenario: Browser return is not proof of payment

- **WHEN** a browser opens a success URL or changes payment-related query parameters
- **THEN** no payment or order state SHALL change and the Web Application SHALL query the authenticated status endpoint for the result

### Requirement: Monotonic exactly-once settlement

The system SHALL apply payment, order, reservation, sold-inventory, and ticket transitions conditionally in an authoritative PostgreSQL transaction so that successful fulfillment occurs exactly once.

#### Scenario: Concurrent success callbacks

- **GIVEN** multiple valid success callbacks for the same PaymentTransaction arrive concurrently
- **WHEN** they are processed by different backend instances
- **THEN** one conditional settlement SHALL win, the order SHALL become paid once, reservations SHALL be finalized once, and exactly the ordered number of Tickets SHALL exist

#### Scenario: Duplicate success after settlement

- **GIVEN** the order and payment are already successfully settled
- **WHEN** the same or a differently identified duplicate success callback arrives
- **THEN** the system SHALL acknowledge the existing result without creating tickets or changing inventory again

#### Scenario: Terminal state cannot move backward

- **GIVEN** a payment has reached a terminal success or definitive failure state
- **WHEN** a stale or conflicting result is processed
- **THEN** the system SHALL preserve the monotonic state and record or surface the conflict without replaying fulfillment

### Requirement: Reservation release and uncertain outcomes

The system SHALL release an order's reservations exactly once after a definitive payment failure or valid expiry, and SHALL not interpret a provider timeout as proof of failure or success.

#### Scenario: Definitive provider failure releases reservation

- **GIVEN** a pending order receives a verified definitive payment failure
- **WHEN** the conditional failure transition succeeds
- **THEN** the system SHALL make the order non-payable and release its reserved quantities exactly once

#### Scenario: Timeout remains reconcilable

- **WHEN** a provider call times out without an authoritative result
- **THEN** the system SHALL record an uncertain retryable state and SHALL reconcile it rather than issue tickets or immediately infer a decline

#### Scenario: Verified success arrives after release

- **GIVEN** an order was already expired or cancelled and its reservation was released
- **WHEN** a verified late success arrives
- **THEN** the system SHALL place the payment in a review state and SHALL NOT restore inventory or issue tickets automatically

### Requirement: Shared provider failure isolation

The system SHALL use an independent Redis-backed Closed/Open/Half-Open circuit breaker per provider and explicit provider-call timeouts shared across backend instances.

#### Scenario: One provider is unavailable

- **GIVEN** VNPAY's shared circuit is open and MoMo is healthy
- **WHEN** provider availability is requested or a payment is initiated
- **THEN** VNPAY SHALL be reported temporarily unavailable while MoMo remains usable

#### Scenario: Both providers are unavailable

- **GIVEN** both provider circuits are open
- **WHEN** a user initiates payment
- **THEN** the system SHALL return a controlled retryable response with retry metadata while concert browsing and ticket availability remain operational

#### Scenario: Half-open probe is coordinated

- **GIVEN** a provider's open interval has elapsed
- **WHEN** multiple backend instances attempt a probe concurrently
- **THEN** Redis SHALL grant at most one live half-open probe lease and its result SHALL close or reopen the shared circuit

#### Scenario: Redis is unavailable during initiation

- **WHEN** shared circuit state cannot be obtained safely
- **THEN** new payment initiation SHALL fail closed with a controlled retryable response and SHALL NOT contact the provider

#### Scenario: Callback arrives while initiation circuit is open

- **GIVEN** the relevant provider initiation circuit is open
- **WHEN** a valid signed delayed callback arrives
- **THEN** local verification and conditional settlement SHALL still run

### Requirement: Idempotent payment reconciliation

The Background Worker SHALL reconcile stale initiated, pending, and timed-out attempts in bounded batches using conditional leases and the same authoritative transition functions used by callbacks.

#### Scenario: Lost callback is recovered

- **GIVEN** a persisted payment remains stale because its provider callback was lost
- **WHEN** reconciliation obtains an authoritative provider result
- **THEN** the system SHALL apply the corresponding conditional success or failure transition exactly once

#### Scenario: Callback races with reconciliation

- **WHEN** a valid callback and a reconciliation worker process the same payment concurrently
- **THEN** both paths SHALL converge on one valid final state without duplicate release, inventory finalization, or ticket issuance

#### Scenario: Provider result remains unknown

- **WHEN** reconciliation cannot obtain authoritative evidence
- **THEN** the system SHALL retain an uncertain or review state according to expiry policy and SHALL NOT fabricate success

### Requirement: Authoritative payment status and degradation UI

The system SHALL expose owner-authorized payment status and coarse provider availability so the Web Application can display payment progress without using browser-controlled data as authority.

#### Scenario: Owner polls payment status

- **WHEN** the authenticated owner requests a persisted payment's status
- **THEN** the Backend API SHALL return its authoritative pending, successful, failed, expired, retryable, or review state without exposing secrets

#### Scenario: Non-owner requests payment status

- **WHEN** a different user requests the payment resource
- **THEN** the Backend API SHALL deny access

#### Scenario: User retries after a transport error

- **GIVEN** the Web Application did not receive the initiation response
- **WHEN** it retries with the retained idempotency key
- **THEN** it SHALL receive the existing payment state and SHALL NOT initiate settlement from the client

### Requirement: Deterministic secure sandbox demonstration

The system SHALL provide deterministic sandbox/test-provider behavior for timeout, failure, recovery, and signed callbacks while exercising the production-shaped persistence, verification, circuit, and settlement paths.

#### Scenario: Demonstrated provider outage and recovery

- **WHEN** the documented demo injects provider timeouts and then recovery
- **THEN** observers SHALL be able to verify the shared circuit transitions, provider isolation, controlled errors, and half-open recovery without real money movement

#### Scenario: Demo success cannot bypass verification

- **WHEN** a deterministic sandbox payment succeeds
- **THEN** it SHALL use a verifiable provider result and the normal conditional fulfillment service rather than an endpoint that arbitrarily marks an order paid
