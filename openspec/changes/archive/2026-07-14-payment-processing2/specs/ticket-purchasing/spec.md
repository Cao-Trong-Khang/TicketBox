## Specification: Concurrent Ticket Purchasing

## Description

This capability allows an authenticated Audience user with `ticket:purchase` permission to reserve ticket quantities without exceeding organizer-configured per-user limits or global inventory. The Web Application calls the Backend API, Redis coordinates high-contention mutation paths, and PostgreSQL remains authoritative for quota, orders, reservations, inventory, payments, and issued Tickets.

## Main Flow

1. The Web Application submits a checkout request with an order idempotency key.
2. The Backend API authenticates the Audience user, checks `ticket:purchase`, validates the concert and sale window, and acquires token-owned Redis coordination locks.
3. Inside a serialized PostgreSQL transaction, the Backend API rechecks idempotency, locks quota and TicketType scopes in deterministic order, and calculates paid plus active-reserved quantities.
4. The same transaction validates the per-user limit and remaining inventory, creates the order and items, and increments reservations.
5. Verified payment settlement finalizes reservations once; definitive payment failure or order expiry releases them once.
6. Cache invalidation and Kafka/post-commit events occur only after authoritative database commit.

## Failure Scenarios

- Simultaneous requests with different idempotency keys cannot observe and consume the same remaining user quota.
- Simultaneous users cannot reserve beyond global inventory.
- Redis unavailability or coordination timeout fails checkout closed before PostgreSQL mutation.
- PostgreSQL serialization conflicts and deadlocks are retried only within a bounded policy and otherwise return a retryable error.
- Failed or expired orders cannot release the same reservation twice, including when expiration and payment callbacks race.
- Stale Redis/cache values cannot override PostgreSQL quota or inventory decisions.

## Constraints

- Protected checkout SHALL require authentication, `ticket:purchase`, ownership enforcement for later order/payment actions, and the existing mutation rate limit.
- Limits SHALL be scoped by user, concert, and ticket type.
- PostgreSQL SHALL be authoritative; Redis SHALL only coordinate, pre-check, cache, or lock and SHALL never approve quota or inventory independently.
- Required Redis coordination failure SHALL fail checkout mutations closed.
- Lock acquisition order, transaction duration, lock leases, and retries SHALL be bounded to control deadlocks and latency.
- The capability depends on authentication/RBAC, organizer ticket configuration, PostgreSQL, Redis, order expiration, verified payment processing, cache invalidation, Kafka/post-commit events, and ticket issuance.

## Acceptance Criteria

- Automated concurrency tests SHALL prove the user-limit example of a limit of four, two existing paid tickets, and two simultaneous requests for two tickets allowing at most one request.
- Automated tests SHALL prove global inventory cannot be oversold and reservations are finalized or released once.
- Failure-injection tests SHALL prove Redis failure blocks mutations and stale coordination/cache data cannot override PostgreSQL.
- The normative scenarios below SHALL be repeatable in the documented local demo.

## MODIFIED Requirements

### Requirement: Audience can create checkout orders

The system SHALL allow an authenticated Audience user with `ticket:purchase` permission to create an idempotent pending checkout order for an on-sale ticket type only when the requested inventory and the user's effective quota are available inside an authoritative coordinated transaction.

#### Scenario: Valid checkout creates a reservation

- **GIVEN** a published concert is on sale and the user has sufficient quota and inventory
- **WHEN** the Audience user submits a valid checkout request with a new idempotency key
- **THEN** one PostgreSQL transaction SHALL create the pending order and items and reserve the requested inventory

#### Scenario: Exact order replay is idempotent

- **GIVEN** an order was created for an idempotency key
- **WHEN** the same user repeats the identical checkout request with that key
- **THEN** the system SHALL return the existing order without reserving more inventory or quota

#### Scenario: Sold-out request is rejected

- **WHEN** authoritative remaining inventory is less than the requested quantity
- **THEN** checkout SHALL be rejected without creating an order or changing reservations

### Requirement: Per-user limits remain correct under concurrency

The system SHALL enforce the organizer-configured limit for each user, concert, and ticket type using paid quantities plus non-expired pending reservations inside a correctly serialized or locked PostgreSQL transaction.

#### Scenario: Different idempotency keys cannot bypass quota

- **GIVEN** the per-user limit is four and a user already owns two paid tickets of the type
- **WHEN** two requests with different idempotency keys concurrently request two additional tickets each
- **THEN** at most one request SHALL reserve tickets and the user's authoritative total SHALL never exceed four

#### Scenario: Pending reservation consumes quota

- **GIVEN** a user has an active pending reservation for two of four allowed tickets
- **WHEN** the same user requests three more tickets of that concert and ticket type
- **THEN** checkout SHALL be rejected because paid plus active-reserved quantity exceeds the limit

#### Scenario: Quota is isolated by scope

- **GIVEN** a user has reached the limit for one ticket type
- **WHEN** the user buys an eligible different ticket type or an eligible ticket for another concert
- **THEN** the first scope's count SHALL NOT consume the other scope's configured quota

#### Scenario: Different users buy independently

- **WHEN** different users concurrently buy the same ticket type within their individual limits
- **THEN** each user's quota SHALL be evaluated independently while sharing the same global inventory constraint

### Requirement: Global inventory cannot be oversold

The system SHALL lock and validate authoritative TicketType inventory in the same PostgreSQL transaction that creates reservations, regardless of cached availability or concurrent demand.

#### Scenario: Last inventory is contested

- **GIVEN** two tickets remain
- **WHEN** multiple eligible users concurrently request quantities whose sum exceeds two
- **THEN** committed active reservations plus sold quantity SHALL never exceed capacity and losing requests SHALL fail without partial mutation

#### Scenario: Availability cache is stale

- **GIVEN** Redis or frontend cache reports more availability than PostgreSQL
- **WHEN** checkout runs
- **THEN** PostgreSQL's locked inventory state SHALL determine the result

#### Scenario: Multiple ticket types are reserved

- **WHEN** a checkout operation affects multiple TicketType rows
- **THEN** the system SHALL acquire authoritative locks in deterministic order and commit all reservations atomically or none

### Requirement: Checkout coordination fails closed

The system SHALL use short-lived token-owned Redis coordination for required high-contention checkout scopes and SHALL perform no PostgreSQL checkout mutation when that coordination cannot be safely acquired.

#### Scenario: Redis is unavailable

- **WHEN** Redis coordination is unavailable during checkout
- **THEN** the Backend API SHALL return a controlled retryable response before creating an order or changing reservation or inventory state

#### Scenario: Coordination lock is busy

- **WHEN** the required quota or inventory scope cannot be acquired within its bounded wait
- **THEN** checkout SHALL fail with a retryable response and SHALL NOT continue uncoordinated

#### Scenario: Expired lock is replaced

- **GIVEN** one request's lock lease expires and another request acquires the scope
- **WHEN** the first request performs cleanup
- **THEN** token-checked release SHALL NOT delete the newer owner's lock

#### Scenario: PostgreSQL rejects stale pre-check

- **GIVEN** a Redis pre-check or cached count is stale
- **WHEN** the PostgreSQL transaction evaluates quota or inventory
- **THEN** the authoritative database decision SHALL override the pre-check

### Requirement: Checkout database conflicts are bounded and atomic

The system SHALL use serialization or explicit locks for quota and inventory, acquire them in deterministic order, and apply bounded retries for retryable database conflicts without producing partial orders.

#### Scenario: Serialization conflict occurs

- **WHEN** PostgreSQL aborts a checkout because of a serialization or deadlock conflict
- **THEN** the Backend API SHALL retry within the configured bound using the same idempotency identity or return a controlled retryable response

#### Scenario: Retry observes a committed order

- **GIVEN** another attempt committed the same idempotent checkout
- **WHEN** a retry enters its transaction
- **THEN** it SHALL return the committed order without applying another reservation

#### Scenario: Non-retryable validation fails

- **WHEN** quota, inventory, sale-window, or input validation fails inside the transaction
- **THEN** the entire transaction SHALL roll back without partial order items or reservation changes

### Requirement: Reservations are finalized or released exactly once

The system SHALL condition reservation finalization or release on a single winning order transition so payment callbacks, reconciliation, and expiration cannot mutate inventory more than once.

#### Scenario: Verified payment succeeds

- **GIVEN** a pending order has active reservations
- **WHEN** verified payment settlement conditionally changes it to paid
- **THEN** reserved quantities SHALL be converted to sold quantities once and exactly the purchased Tickets SHALL be issued

#### Scenario: Payment failure races with expiration

- **WHEN** definitive payment failure and order expiration concurrently attempt to close the same pending order
- **THEN** one transition SHALL release reservations and the other SHALL become an idempotent no-op

#### Scenario: Duplicate release command arrives

- **GIVEN** a reservation was already released
- **WHEN** expiration, failure, or retry requests release again
- **THEN** reservation and inventory counts SHALL remain unchanged and non-negative

#### Scenario: Released quota becomes available

- **GIVEN** an expired or definitively failed order released its reservation
- **WHEN** the user performs a later eligible checkout
- **THEN** the released quantity SHALL no longer count against the user's effective quota
