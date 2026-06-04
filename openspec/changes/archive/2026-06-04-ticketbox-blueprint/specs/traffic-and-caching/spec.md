## ADDED Requirements

### Requirement: API gateway protects traffic spikes
The system SHALL apply Redis-backed token bucket or fixed-window rate limiting before expensive application logic for public, checkout, payment, admin, and mobile sync endpoint families.

#### Scenario: Sale start traffic exceeds checkout rate limit
- **GIVEN** many users send checkout requests during the first minute of ticket sales
- **WHEN** a user, IP, or device exceeds the configured checkout limit
- **THEN** the system MUST return `429 Too Many Requests` with retry metadata before opening database transactions

#### Scenario: Redis rate-limit store times out
- **GIVEN** Redis is timing out for rate-limit checks
- **WHEN** a user calls a checkout or payment initiation endpoint
- **THEN** the system MUST fail closed for protected mutation endpoints and MUST NOT create orders or payment transactions

### Requirement: Public concert reads use cache-aside Redis caching
The system SHALL cache concert lists, concert details, SVG seating maps, and approximate ticket availability in Redis while keeping PostgreSQL authoritative for checkout decisions.

#### Scenario: Concert detail is served from cache
- **GIVEN** a published concert detail cache entry exists
- **WHEN** an Audience user requests `GET /concerts/{concertId}`
- **THEN** the system MUST return the cached concert detail and availability projection without querying PostgreSQL for every request

#### Scenario: Inventory changes invalidate availability cache
- **GIVEN** a paid order changes remaining ticket availability
- **WHEN** the order is confirmed and tickets are issued
- **THEN** the system MUST update or invalidate Redis availability keys for the affected concert and ticket types

#### Scenario: Cache is stale during checkout
- **GIVEN** the public availability cache shows remaining tickets
- **WHEN** an Audience user submits checkout
- **THEN** the system MUST validate final availability using PostgreSQL row locks before accepting the order
