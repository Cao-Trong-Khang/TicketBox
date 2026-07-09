## Purpose
Define the authenticated, ownership-scoped, bounded backend read contract and deterministic demo data for customer order history.

## Requirements

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
