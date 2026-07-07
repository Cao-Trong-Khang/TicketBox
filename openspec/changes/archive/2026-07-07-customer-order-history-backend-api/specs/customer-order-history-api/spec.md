## Specification: Customer Order History API

## Description

The Backend API SHALL allow an authenticated Audience-capable user to read a bounded, newest-first summary of only their own orders for the existing Web Application Order History page. PostgreSQL supplies authoritative Order, Concert, OrderItem, and TicketType data; no external system participates.

## Main Flow

1. The Web Application calls `GET /orders/history` with its JWT.
2. `JwtAuthGuard` authenticates the request and supplies the user identity.
3. `OrdersController` passes only the authenticated user ID to `OrdersService`.
4. `OrdersService` queries PostgreSQL for at most 100 matching orders using an explicit Prisma projection and deterministic ordering.
5. The service maps database rows to the exact frontend `OrderHistoryItem[]` contract.
6. The Backend API returns HTTP 200 without changing any order, inventory, payment, or ticket state.

## Failure Scenarios

- Missing or invalid authentication MUST return 401 through the existing auth/error format.
- PostgreSQL read failure MUST use the existing backend exception/error filter and MUST NOT return partial fabricated history.
- A user with no orders MUST receive HTTP 200 with `[]`.
- Null venue address or banner URL MUST be returned as null and MUST NOT fail mapping.
- Redis, Kafka, or payment-provider outages MUST NOT affect this PostgreSQL-only read.

## Constraints

- JWT authentication is required; ownership identity MUST come only from the verified JWT.
- The endpoint MUST NOT accept a user ID from query parameters, path parameters, or request body.
- PostgreSQL MUST remain authoritative.
- The query MUST filter by `userId`, order by `createdAt DESC` then `id DESC`, and return at most 100 rows.
- Prisma access MUST use explicit `select` projections.
- The response MUST NOT expose idempotency keys, users, payments, provider data, QR hashes, Ticket entities, inventory counters, or foreign orders.
- `tickets` MUST contain only `{ ticketTypeName, quantity }` summaries derived from OrderItems.
- The operation MUST be read-only and MUST NOT publish Kafka events, invalidate Redis, or write audit/domain records.
- `POST /orders`, order expiration, and `/orders/:orderId` behavior MUST remain unchanged.
- Required permission is authenticated ownership read; Organizer accounts may read only orders they personally own, while Check-in Staff gains no cross-user access.

## Acceptance Criteria

## ADDED Requirements

### Requirement: Authenticated users can read only owned order history
The system SHALL expose `GET /orders/history` and SHALL filter results by the authenticated JWT user before returning any row.

#### Scenario: Audience reads owned history
- **GIVEN** an authenticated Audience user owns orders
- **WHEN** the user requests `GET /orders/history`
- **THEN** the API MUST return HTTP 200 with only that user's orders

#### Scenario: Unauthenticated request
- **WHEN** a request without a valid JWT calls `GET /orders/history`
- **THEN** the API MUST return 401 using the existing error format

#### Scenario: Foreign orders exist
- **GIVEN** another user owns orders in PostgreSQL
- **WHEN** the authenticated user requests history
- **THEN** no foreign order identifier or field MUST appear in the response

### Requirement: History matches the frontend contract
Every response item SHALL contain exactly the fields required by the frontend `OrderHistoryItem` contract and SHALL derive ticket summaries from stored OrderItems.

#### Scenario: Complete order mapping
- **GIVEN** an owned order has a concert and multiple OrderItems
- **WHEN** history is returned
- **THEN** its item MUST contain `orderId`, `orderCode`, `status`, ISO `createdAt`, ISO `performanceStartAt`, `concertTitle`, `venueName`, nullable `venueAddress`, nullable `bannerUrl`, `totalAmountVnd`, and `tickets`
- **AND** every `tickets` entry MUST contain only `ticketTypeName` and `quantity`

#### Scenario: Nullable concert fields
- **GIVEN** an owned order's concert has null venue address or banner URL
- **WHEN** history is returned
- **THEN** the corresponding response fields MUST be null

#### Scenario: Sensitive fields remain absent
- **WHEN** any order-history response is serialized
- **THEN** it MUST NOT contain payment data, provider data, idempotency keys, QR hashes, Ticket records, inventory counters, or user records

### Requirement: History is deterministic and bounded
The system MUST order history by `createdAt DESC` then `id DESC` and MUST return no more than 100 orders in the temporary unpaginated contract.

#### Scenario: Multiple orders have different creation times
- **GIVEN** the authenticated user owns multiple orders
- **WHEN** history is requested
- **THEN** newer orders MUST appear before older orders

#### Scenario: Orders share a creation timestamp
- **GIVEN** two owned orders have the same `createdAt`
- **WHEN** history is requested
- **THEN** descending order ID MUST provide deterministic tie-breaking

#### Scenario: User owns more than the hard cap
- **GIVEN** the authenticated user owns more than 100 orders
- **WHEN** history is requested
- **THEN** the API MUST return only the newest 100 orders

### Requirement: History reads never mutate domain state
The order-history operation SHALL execute as a PostgreSQL read and MUST NOT modify orders, inventory, payments, tickets, reservations, caches, or events.

#### Scenario: Successful history read
- **GIVEN** existing order and ticket-type state
- **WHEN** the user requests history
- **THEN** all database domain values MUST remain unchanged
- **AND** no Redis invalidation or Kafka publication MUST occur

### Requirement: Demo history seed is deterministic and idempotent
The local seed SHALL create representative PENDING, PAID, FAILED, EXPIRED, and CANCELLED Order/OrderItem rows for `audience@ticketbox.local` by reusing existing concerts and ticket types.

#### Scenario: Seed runs for the first time
- **WHEN** the Prisma seed runs against initialized local data
- **THEN** five reserved `DEMO-HISTORY-*` orders with valid OrderItems and fixed timestamps MUST exist for the demo Audience user
- **AND** all five statuses MUST be represented

#### Scenario: Seed runs repeatedly
- **WHEN** the same seed runs more than once
- **THEN** the number of `DEMO-HISTORY-*` orders and their OrderItems MUST remain stable

#### Scenario: Demo history avoids unsupported domains
- **WHEN** history fixtures are created
- **THEN** the seed MUST NOT create PaymentTransaction or Ticket records for those fixtures
- **AND** MUST NOT modify or remove existing demo check-in data
