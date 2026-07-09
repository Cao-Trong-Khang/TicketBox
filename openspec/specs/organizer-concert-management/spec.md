# organizer-concert-management Specification

## Purpose
TBD - created by archiving change backend-organizer-concert-management. Update Purpose after archive.
## Requirements
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

### Requirement: Organizer can upload concert banner via dedicated endpoint

The system SHALL provide `POST /organizer/concerts/banners` endpoint that allows authenticated organizers to upload a banner image file. The endpoint SHALL validate file type, size, and extension, store the image in MinIO, and return a stable backend URL.

#### Scenario: Successful banner upload

- **WHEN** an authenticated organizer submits multipart POST to `/organizer/concerts/banners` with a valid JPEG file (5 MB or less)
- **THEN** the backend stores the image in MinIO bucket `concert-banners` and returns `{ bannerUrl: "/uploads/banners/{uuid}.jpg" }`

#### Scenario: Banner upload rejects non-organizer

- **WHEN** an authenticated user without organizer role attempts `POST /organizer/concerts/banners`
- **THEN** the backend returns `403 Forbidden`

#### Scenario: Banner upload rejects invalid file type

- **WHEN** an organizer submits `POST /organizer/concerts/banners` with an SVG or non-image file
- **THEN** the backend returns `400 Bad Request` with error message indicating allowed types

#### Scenario: Banner upload rejects oversized file

- **WHEN** an organizer submits `POST /organizer/concerts/banners` with a file larger than 5 MB
- **THEN** the backend returns `413 Payload Too Large`

### Requirement: Concert create includes optional banner URL

The system SHALL accept `bannerUrl` (optional string field) in `POST /organizer/concerts` payload. If provided, the bannerUrl is stored in the Concert record. The JSON endpoint itself SHALL remain unchanged (not multipart).

#### Scenario: Create concert with banner URL

- **WHEN** an organizer submits `POST /organizer/concerts` with `bannerUrl: "/uploads/banners/{uuid}.jpg"` (from prior upload)
- **THEN** the backend creates concert with bannerUrl field set

#### Scenario: Create concert without banner

- **WHEN** an organizer submits `POST /organizer/concerts` without bannerUrl field
- **THEN** the backend creates concert with bannerUrl = null

#### Scenario: Create endpoint remains JSON only

- **WHEN** an organizer submits `POST /organizer/concerts`
- **THEN** the endpoint accepts JSON payload, not multipart/form-data

### Requirement: Concert update includes optional banner URL change

The system SHALL accept `bannerUrl` (optional string field) in `PATCH /organizer/concerts/:id` payload. If provided, the bannerUrl is updated. The JSON endpoint itself SHALL remain unchanged (not multipart).

#### Scenario: Update concert banner

- **WHEN** an organizer submits `PATCH /organizer/concerts/:id` with `bannerUrl: "/uploads/banners/{new-uuid}.jpg"`
- **THEN** the backend updates the concert's bannerUrl field

#### Scenario: Update concert preserves banner

- **WHEN** an organizer submits `PATCH /organizer/concerts/:id` without bannerUrl field
- **THEN** the backend preserves the existing bannerUrl value

#### Scenario: Update endpoint remains JSON only

- **WHEN** an organizer submits `PATCH /organizer/concerts/:id`
- **THEN** the endpoint accepts JSON payload, not multipart/form-data

### Requirement: Organizer concert response includes bannerUrl field

The system SHALL include `bannerUrl` (nullable string) in all organizer concert responses: list, detail, create, update, and publish.

#### Scenario: Organizer concert detail includes bannerUrl

- **WHEN** an organizer retrieves `GET /organizer/concerts/:id`
- **THEN** the response includes field `bannerUrl: "/uploads/banners/{uuid}.jpg"` or `bannerUrl: null`

#### Scenario: Organizer concert list includes bannerUrl for each concert

- **WHEN** an organizer retrieves `GET /organizer/concerts`
- **THEN** each concert in the list includes `bannerUrl` field

### Requirement: Optional Artist Bio setup in Create Concert
The Organizer Create Concert page SHALL accept an optional valid press-kit PDF as client-side form state without changing the concert creation API payload. After successful concert creation, it SHALL upload the PDF using the returned concert ID and SHALL NOT wait for AI extraction or generation to complete.

#### Scenario: Concert is created without a press kit
- **WHEN** an Organizer submits valid concert data without selecting a PDF
- **THEN** the existing concert and ticket setup flow proceeds without an artist-document upload request

#### Scenario: AI processing is asynchronous after creation
- **WHEN** the post-create PDF upload returns HTTP 202
- **THEN** the Web Application treats the biography as queued and navigates without waiting for a terminal generation status

### Requirement: Independent post-create outcomes
After the concert is created, the Web Application MUST attempt ticket-type setup and optional press-kit upload as independent post-create branches. Failure in either branch MUST NOT roll back the concert, MUST NOT prevent the other branch from being attempted, and MUST be represented in recovery feedback.

#### Scenario: Ticket setup fails but press kit is queued
- **WHEN** the concert is created, ticket setup fails, and the press-kit upload succeeds
- **THEN** the concert remains created and the Edit Concert page reports the ticket recovery need while Artist Bio processing continues

#### Scenario: Press-kit upload fails but ticket setup succeeds
- **WHEN** the concert and ticket setup succeed but the press-kit upload fails
- **THEN** the concert remains created and the Edit Concert page reports that the press kit can be uploaded again

#### Scenario: Both post-create branches fail
- **WHEN** the concert is created but ticket setup and press-kit upload both fail
- **THEN** the concert remains created and the Edit Concert page reports both recovery needs

### Requirement: Post-create navigation to Edit Concert
The Organizer Web Application SHALL navigate to `/organizer/concerts/:id/edit` after successful concert creation regardless of post-create branch outcomes and SHALL carry non-secret feedback describing queued work and recoverable failures.

#### Scenario: Successful creation opens the editor
- **WHEN** the Backend API returns a created concert ID
- **THEN** the Web Application navigates to that concert's Edit Concert page where the Organizer can continue ticket management and monitor or retry Artist Bio setup

