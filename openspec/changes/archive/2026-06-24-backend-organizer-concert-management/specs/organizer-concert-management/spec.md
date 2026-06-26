## ADDED Requirements

### Requirement: Organizer concert management API exists

The system SHALL provide a dedicated organizer API under `/organizer/concerts` for managing concerts owned by the authenticated organizer.

#### Scenario: Organizer accesses own concert endpoints

- **WHEN** an authenticated user with role `organizer` calls a `/organizer/concerts` endpoint
- **THEN** the backend allows the request to proceed if the concert belongs to that organizer or if the action is a valid organizer operation

#### Scenario: Non-organizer is denied

- **WHEN** an authenticated user without the `organizer` role calls a `/organizer/concerts` endpoint
- **THEN** the backend returns `403 Forbidden`

### Requirement: Organizer may list only owned concerts

The system SHALL return only concerts where `concert.organizerId === request.user.id` for `GET /organizer/concerts`, sorted by `createdAt DESC`.

#### Scenario: List returns owned concerts

- **WHEN** an organizer requests `GET /organizer/concerts`
- **THEN** the response contains only concerts owned by that organizer and is ordered by `createdAt DESC`

#### Scenario: List excludes other organizers concerts

- **WHEN** an organizer requests `GET /organizer/concerts`
- **THEN** concerts owned by other organizers are not included in the response

### Requirement: Organizer can create draft concerts

The system SHALL allow organizers to create a draft concert via `POST /organizer/concerts` using required fields: `title`, `artistName`, `venueName`, `venueAddress`, `startsAt`, and `endsAt`. The created concert SHALL have `status = DRAFT` and `organizerId = currentUser.id`.

#### Scenario: Successful draft creation

- **WHEN** an organizer submits `POST /organizer/concerts` with valid required fields and `startsAt < endsAt`
- **THEN** the backend creates a draft concert owned by that organizer and returns the created concert data

#### Scenario: Create rejects invalid dates

- **WHEN** an organizer submits `POST /organizer/concerts` with `startsAt >= endsAt`
- **THEN** the backend returns `400 Bad Request`

### Requirement: Organizer can retrieve own concert detail

The system SHALL allow organizers to retrieve concert detail only for concerts they own via `GET /organizer/concerts/:id`.

#### Scenario: Organizer retrieves owned detail

- **WHEN** an organizer requests `GET /organizer/concerts/:id` for a concert they own
- **THEN** the backend returns the concert detail with fields including `id`, `status`, `title`, `artistName`, `description`, `venueName`, `venueAddress`, `bannerUrl`, `seatingSvg`, `startsAt`, `endsAt`, `createdAt`, and `updatedAt`

#### Scenario: Not-owned concert returns 404

- **WHEN** an organizer requests `GET /organizer/concerts/:id` for a concert they do not own
- **THEN** the backend returns `404 Not Found`

### Requirement: Organizer can update draft concerts only

The system SHALL allow only DRAFT concerts to be updated through `PATCH /organizer/concerts/:id` and SHALL return `409 Conflict` if the concert is already PUBLISHED.

#### Scenario: Update draft concert

- **WHEN** an organizer submits valid patch data to `PATCH /organizer/concerts/:id` for a DRAFT concert they own
- **THEN** the backend updates the permitted fields and returns the updated concert

#### Scenario: Update published concert is rejected

- **WHEN** an organizer submits `PATCH /organizer/concerts/:id` for a PUBLISHED concert
- **THEN** the backend returns `409 Conflict`

#### Scenario: Update rejects invalid date range

- **WHEN** an organizer submits `PATCH /organizer/concerts/:id` with `startsAt >= endsAt`
- **THEN** the backend returns `400 Bad Request`

### Requirement: Organizer can publish draft concerts

The system SHALL allow an organizer to publish a DRAFT concert via `POST /organizer/concerts/:id/publish` only if the concert has valid required fields, `startsAt < endsAt`, and `startsAt` is in the future.

#### Scenario: Publish draft concert successfully

- **WHEN** an organizer publishes a DRAFT concert that has all required fields and valid dates
- **THEN** the backend updates the concert status to `PUBLISHED` and invalidates public cache keys `concerts:list:published` and `concerts:detail:{id}`

#### Scenario: Publish existing published concert

- **WHEN** an organizer publishes a concert that is already `PUBLISHED`
- **THEN** the backend returns `409 Conflict`

#### Scenario: Publish rejects incomplete concert

- **WHEN** an organizer publishes a DRAFT concert missing any required publish fields or with invalid dates
- **THEN** the backend returns `400 Bad Request`

### Requirement: Ownership failure should not expose other organizers data

The system SHALL return `404 Not Found` for organizer concert detail, update, or publish actions when the concert does not exist or is not owned by the requesting organizer.

#### Scenario: Ownership check hides missing or foreign concert

- **WHEN** an organizer calls `GET`, `PATCH`, or `POST /publish` for a concert they do not own
- **THEN** the backend returns `404 Not Found`

### Requirement: Role check uses existing organizer role constant

The system SHALL check the organizer role using the existing role constant `ROLE_CODES.organizer` and SHALL NOT introduce a new role system.

#### Scenario: Role check is enforced from database lookup

- **WHEN** an authenticated user with a valid JWT calls an organizer endpoint
- **THEN** the backend verifies the user has the `organizer` role from the database before allowing access

### Requirement: Publish cache invalidation is resilient

The system SHALL invalidate public Redis cache keys after a successful publish but SHALL NOT fail the publish operation if Redis deletion is unavailable.

#### Scenario: Publish succeeds despite Redis failure

- **WHEN** a concert is published successfully and Redis cache delete fails
- **THEN** the backend still returns success and does not block the publish operation
