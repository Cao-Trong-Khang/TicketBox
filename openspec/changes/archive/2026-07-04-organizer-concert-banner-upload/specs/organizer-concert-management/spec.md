## ADDED Requirements

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
