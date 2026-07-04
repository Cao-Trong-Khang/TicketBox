## Specification: Organizer Concert Banner Upload

## Description

Organizers can upload banner images (JPEG, PNG, WebP) for their concerts via a native file upload endpoint. The system validates file type, size (max 5 MB), and extension, stores the image in MinIO, and returns a stable backend URL. Images are persisted in the database's Concert.bannerUrl field as relative paths.

User role: **Organizer**

## ADDED Requirements

### Requirement: Organizer concert banner upload endpoint
The system SHALL provide `POST /organizer/concerts/banners` endpoint that allows authenticated organizers to upload a banner image file. The endpoint SHALL validate file type, size, and extension, store the image in MinIO, and return a stable backend URL.

#### Scenario: Successful banner upload

- **WHEN** an authenticated organizer submits multipart POST to `/organizer/concerts/banners` with a valid JPEG file (5 MB or less)
- **THEN** the backend stores the image in MinIO bucket `concert-banners` and returns `{ bannerUrl: "/uploads/banners/{uuid}.jpg" }`

## Main Flow

1. Organizer authenticates and navigates to concert create/edit form
2. Organizer selects a banner image file (JPEG, PNG, or WebP, max 5 MB)
3. Frontend validates file type and size; shows local image preview
4. On form submit:
   - Frontend sends multipart POST request to `/organizer/concerts/banners` with file
   - Backend validates authentication (JWT) and organizer role (DB check)
   - Backend validates file MIME type, extension, and size
   - Backend generates UUID filename, uploads to MinIO bucket `concert-banners` with key `banners/{uuid}.{ext}`
   - Backend returns response: `{ bannerUrl: "/uploads/banners/{uuid}.{ext}" }`
5. Frontend receives bannerUrl and includes it in the concert create/update JSON payload
6. Concert is saved with bannerUrl pointing to backend proxy endpoint

## Failure Scenarios

- **Unauthenticated request**: Request lacks valid JWT token → Return 401 Unauthorized
- **Non-organizer user**: User is authenticated but lacks organizer role → Return 403 Forbidden
- **Missing file**: Request lacks file in multipart form → Return 400 Bad Request
- **Invalid MIME type**: File is not image/jpeg, image/png, or image/webp → Return 400 Bad Request with message "Invalid file type"
- **Invalid extension**: File extension is not .jpg, .jpeg, .png, or .webp → Return 400 Bad Request
- **Oversized file**: File exceeds 5 MB limit → Return 413 Payload Too Large
- **MinIO unavailable**: Upload to MinIO fails (timeout, connection error) → Return 503 Service Unavailable
- **Form submit with upload error**: Frontend cannot upload file, shows error to user, allows retry without losing form state

## Constraints

**Security**:

- Endpoint requires JwtAuthGuard: unauthenticated users blocked
- Endpoint requires organizer role (via ensureOrganizerRole service check): role-based access control enforced
- Uploaded files are stored in private MinIO bucket (no public policy)
- Backend controls all access to images via proxy endpoint; organizers cannot access other organizers' uploads directly

**File Validation**:

- MIME whitelist: image/jpeg, image/png, image/webp only (SVG explicitly rejected)
- Extension whitelist: .jpg, .jpeg, .png, .webp (case-insensitive)
- Magic byte validation: Optional for MVP (MIME type sufficient); may add later for security
- Max file size: 5 MB (enforced by multer + service-level check)

**Storage**:

- Bucket: `concert-banners` (private, created during docker-compose startup)
- Object key pattern: `banners/{uuid}.{extension}` (UUID v4, lowercase extension)
- Filename: Generated server-side (no user-supplied filenames)

**Performance**:

- Upload timeout: Configurable (e.g., 30 seconds)
- Response time: Typically < 2 seconds for 5 MB file over local docker network
- No thumbnail generation or image optimization in MVP

**Data Integrity**:

- UUID collision: Statistically negligible (1 in 10^36)
- Concurrent uploads: Each generates unique UUID; no race conditions
- Database: Concert.bannerUrl remains nullable string; no schema changes

## Acceptance Criteria

### Organizer can upload a valid banner

- **GIVEN** Organizer is authenticated and has organizer role
- **WHEN** Organizer selects a valid JPEG image (5 MB or less) via file input
- **AND** Submits concert create/edit form
- **THEN** Backend accepts upload, stores image in MinIO, returns `/uploads/banners/{uuid}.jpg`
- **AND** Frontend includes URL in concert JSON payload
- **AND** Concert is created/updated with bannerUrl set to returned URL

### Frontend validates file type before upload

- **GIVEN** Organizer is on concert form
- **WHEN** Organizer selects an SVG file or non-image file
- **THEN** Frontend shows error message (e.g., "Only JPEG, PNG, WebP allowed")
- **AND** Upload does not occur

### Frontend validates file size before upload

- **GIVEN** Organizer is on concert form
- **WHEN** Organizer selects an image larger than 5 MB
- **THEN** Frontend shows error message (e.g., "File must be 5 MB or smaller")
- **AND** Upload does not occur

### Backend rejects unauthenticated upload

- **GIVEN** Request to POST /organizer/concerts/banners lacks valid JWT
- **WHEN** Request is sent
- **THEN** Backend returns 401 Unauthorized

### Backend rejects non-organizer upload

- **GIVEN** Authenticated user without organizer role
- **WHEN** User attempts to POST /organizer/concerts/banners
- **THEN** Backend returns 403 Forbidden

### Backend rejects invalid file type

- **GIVEN** Valid file upload but MIME type is not image/jpeg, image/png, or image/webp
- **WHEN** Request is sent
- **THEN** Backend returns 400 Bad Request with error message

### Backend handles MinIO failure gracefully

- **GIVEN** MinIO is unavailable
- **WHEN** Organizer attempts to upload
- **THEN** Backend returns 503 Service Unavailable
- **AND** Frontend shows error; allows retry

### Form state preserved during upload failure

- **GIVEN** Organizer has filled concert form fields (name, date, etc.) and selected banner
- **WHEN** File upload fails
- **THEN** Form fields remain populated
- **AND** Organizer can retry upload without re-entering data
