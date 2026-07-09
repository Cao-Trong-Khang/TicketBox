## ADDED Requirements

### Requirement: Public concert ticket types

The system SHALL provide a public `GET /concerts/:id/ticket-types` endpoint that returns the ticket types for a single published concert.

#### Scenario: Published concert ticket types are returned

- **WHEN** a client requests `GET /concerts/:id/ticket-types` for an existing published concert
- **THEN** the system returns the active ticket types for that concert

#### Scenario: Unpublished concert is not exposed

- **WHEN** a client requests `GET /concerts/:id/ticket-types` for a concert that exists but is not published
- **THEN** the system returns `404 Not Found`

### Requirement: Route parameter validation

The system SHALL validate the `:id` route parameter as a UUID before processing the request.

#### Scenario: Invalid UUID is rejected

- **WHEN** a client sends a non-UUID value to `GET /concerts/:id/ticket-types`
- **THEN** the system rejects the request with a validation error before querying PostgreSQL

### Requirement: Ticket type response shape

The system SHALL return only the following fields for each ticket type: `id`, `code`, `name`, `priceVnd`, `totalQuantity`, `availableQuantity`, `perUserLimit`, `saleStartAt`, and `saleEndAt`.

#### Scenario: Internal fields are excluded

- **WHEN** the system returns the ticket-type list
- **THEN** the response does not include `reservedQuantity`, `soldQuantity`, `concertId`, `createdAt`, or `updatedAt`

#### Scenario: Date values are serialized

- **WHEN** the system returns the ticket-type list
- **THEN** `saleStartAt` and `saleEndAt` are ISO string values

### Requirement: Available quantity calculation

The system SHALL compute `availableQuantity` as `Math.max(0, totalQuantity - reservedQuantity - soldQuantity)` for each ticket type.

#### Scenario: Available quantity reflects remaining inventory

- **WHEN** a ticket type has a positive remaining quantity after subtracting reserved and sold counts
- **THEN** the system returns that remaining quantity as `availableQuantity`

#### Scenario: Negative inventory is clamped

- **WHEN** the subtraction result is negative because of inconsistent data
- **THEN** the system returns `availableQuantity` as `0`

### Requirement: Ticket type sorting

The system SHALL sort ticket types by `priceVnd` ascending and then by `code` ascending.

#### Scenario: Lower price appears first

- **WHEN** multiple active ticket types have different prices
- **THEN** the system returns the lower-priced ticket type before the higher-priced one

#### Scenario: Equal prices use code ordering

- **WHEN** multiple active ticket types have the same price
- **THEN** the system returns them in ascending `code` order

### Requirement: Ticket type caching

The system SHALL use Redis cache-aside for the ticket-type list with the cache key `concerts:{concertId}:ticket-types` and a TTL of 5 seconds.

#### Scenario: Cache hit returns stored DTO list

- **WHEN** a valid cached DTO list exists for the concert
- **THEN** the system returns the cached DTO list without querying PostgreSQL

#### Scenario: Cache miss populates Redis

- **WHEN** the cache entry is missing for the concert ticket types
- **THEN** the system queries PostgreSQL, maps the response, stores the mapped DTO list in Redis, and returns the response

### Requirement: Corrupted cache recovery

The system SHALL treat invalid cached JSON as a cache miss and SHALL attempt to delete the corrupted key when Redis deletion is available.

#### Scenario: Invalid JSON is recovered

- **WHEN** a cached ticket-type value cannot be parsed as JSON
- **THEN** the system treats the entry as a miss, deletes the corrupted key if possible, and falls back to PostgreSQL
