## ADDED Requirements

### Requirement: Public concert detail

The system SHALL provide a public `GET /concerts/:id` endpoint that returns the detail view for a single published concert.

#### Scenario: Published concert detail is returned

- **WHEN** a client requests `GET /concerts/:id` for an existing published concert
- **THEN** the system returns the concert detail response with metadata and `seatingSvg`

#### Scenario: Unpublished concert is not exposed

- **WHEN** a client requests `GET /concerts/:id` for a concert that exists but is not published
- **THEN** the system returns `404 Not Found`

### Requirement: Public concert detail response shape

The system SHALL return only the following fields in the public concert detail response: `id`, `title`, `artistName`, `description`, `venueName`, `venueAddress`, `bannerUrl`, `seatingSvg`, `startsAt`, and `endsAt`.

#### Scenario: Internal fields are excluded

- **WHEN** the system returns a concert detail response
- **THEN** the response does not include `status`, `organizerId`, `ticketTypes`, `orders`, `tickets`, `payments`, or audit log data

#### Scenario: Date values are serialized

- **WHEN** the system returns a concert detail response
- **THEN** the `startsAt` and `endsAt` values are ISO string representations

### Requirement: Public concert detail caching

The system SHALL use Redis cache-aside for the public concert detail response with the cache key `concerts:detail:{concertId}` and a TTL of 300 seconds.

#### Scenario: Cache hit returns stored DTO

- **WHEN** a valid cached detail DTO exists for the concert
- **THEN** the system returns the cached DTO without querying PostgreSQL

#### Scenario: Cache miss populates Redis

- **WHEN** the cache entry is missing for the concert detail
- **THEN** the system queries PostgreSQL, maps the response, stores the mapped DTO in Redis, and returns the response

### Requirement: Corrupted cache entry recovery

The system SHALL treat invalid cached JSON as a cache miss and SHALL attempt to delete the corrupted key when Redis deletion is available.

#### Scenario: Invalid JSON is recovered

- **WHEN** a cached detail value cannot be parsed as JSON
- **THEN** the system treats the entry as a miss, deletes the corrupted key if possible, and falls back to PostgreSQL

### Requirement: UUID route parameter validation

The system SHALL validate the `:id` route parameter as a UUID before processing the concert detail request.

#### Scenario: Invalid UUID is rejected

- **WHEN** a client sends a non-UUID value to `GET /concerts/:id`
- **THEN** the system rejects the request before the service queries PostgreSQL
