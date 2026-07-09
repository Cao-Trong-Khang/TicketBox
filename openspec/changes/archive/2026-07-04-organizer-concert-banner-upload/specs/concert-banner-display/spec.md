## Specification: Concert Banner Display (Public Image Serving)

## Description

The system provides a public HTTP endpoint that streams banner images from MinIO storage to browsers. This endpoint serves images referenced by Concert.bannerUrl in public concert listings and detail pages. Responses include cache headers to reduce backend load.

User roles: **Audience** (consumers), **Public** (unauthenticated)

## ADDED Requirements

### Requirement: Public banner image serving endpoint
The system SHALL provide a public `GET /uploads/banners/:filename` endpoint that streams banner images from MinIO to browsers and returns cache headers (e.g., `Cache-Control: public, max-age=86400`).

#### Scenario: Public user views banner

- **WHEN** a public user loads a concert detail page referencing `/uploads/banners/{uuid}.jpg`
- **THEN** the browser's GET request to `/uploads/banners/{uuid}.jpg` succeeds and returns 200 with appropriate `Content-Type` and `Cache-Control` headers

## Main Flow

1. Public concert list or detail page loads in browser
2. Frontend renders `<img src={concert.bannerUrl}>` with bannerUrl like `/uploads/banners/{uuid}.jpg`
3. Browser sends GET request to `/uploads/banners/{uuid}.jpg`
4. Backend (no authentication required) receives request
5. Backend retrieves object from MinIO bucket `concert-banners` with key `banners/{uuid}.jpg`
6. Backend streams image data to browser with headers:
   - `Content-Type: image/jpeg` (or detected MIME)
   - `Content-Length: {size}`
   - `Cache-Control: public, max-age=86400` (1-day cache)
   - Optional: `ETag` or `Last-Modified` for client-side caching
7. Browser displays image

## Failure Scenarios

- **Image not found**: Requested filename does not exist in MinIO → Return 404 Not Found
- **Invalid filename**: Filename contains path traversal attempt (e.g., `../../../etc/passwd`) → Return 400 Bad Request or 404
- **MinIO unavailable**: MinIO is down or unreachable → Return 503 Service Unavailable
- **Corrupted or unreadable object**: MinIO returns error reading object → Return 500 Internal Server Error
- **Concurrent deletes**: Banner deleted from database/MinIO after Concert.bannerUrl is loaded but before GET → Return 404 Not Found
- **Network timeout**: Client disconnects during stream → Gracefully close stream

## Constraints

**Access Control**:

- Endpoint is public (no authentication required)
- Any user or unauthenticated browser can request banners
- MinIO bucket is private; backend controls all access
- No permission checks beyond "image exists"

**Performance**:

- Response time: Typically < 500 ms for cached reads
- Caching: 1-day max-age (86400 seconds) reduces repeated requests
- Browser caching: ETag/Last-Modified support for client-side 304 Not Modified responses
- No range request support in MVP (simpler implementation)

**Reliability**:

- Idempotent: GET is safe; multiple requests return same image
- Cacheable: Response is cacheable by browser and proxy layers
- Timeout: Configurable (e.g., 30 seconds for MinIO read)
- No rate limiting in MVP (images are cached, not expensive)

**Data Integrity**:

- Immutable: Banner images are never overwritten (new UUID on each upload)
- Consistency: Image reflects Concert.bannerUrl at render time; no sync issues
- No partial responses: Full image returned or error

## Acceptance Criteria

### Public user can view banner image

- **GIVEN** Concert has a bannerUrl like `/uploads/banners/{uuid}.jpg`
- **AND** Image exists in MinIO bucket concert-banners
- **WHEN** Public user loads concert detail page
- **THEN** Browser GET request to `/uploads/banners/{uuid}.jpg` succeeds
- **AND** Response status is 200 OK
- **AND** Image displays in browser

### Response includes cache headers

- **GIVEN** Successful GET request to `/uploads/banners/{uuid}.jpg`
- **WHEN** Response is returned
- **THEN** Response includes `Content-Type: image/jpeg` (or appropriate MIME)
- **AND** Response includes `Cache-Control: public, max-age=86400`
- **AND** Response includes `Content-Length: {size}`

### Missing image returns 404

- **GIVEN** Concert.bannerUrl references `/uploads/banners/nonexistent.jpg`
- **WHEN** Public user loads page
- **THEN** Browser GET request returns 404 Not Found
- **AND** Page gracefully handles missing image (no broken `<img>` tag, or falls back to default)

### Backend streams image from MinIO

- **GIVEN** Banner object exists in MinIO at key `banners/{uuid}.jpg`
- **WHEN** GET request is sent to `/uploads/banners/{uuid}.jpg`
- **THEN** Backend retrieves object from MinIO
- **AND** Entire object is streamed to client

### Endpoint is public (no auth required)

- **GIVEN** Unauthenticated client
- **WHEN** GET request is sent to `/uploads/banners/{uuid}.jpg`
- **THEN** Request succeeds (no 401 or 403)
- **AND** Image is returned

### MinIO failure returns 503

- **GIVEN** MinIO is unavailable or returns error
- **WHEN** GET request is sent to `/uploads/banners/{uuid}.jpg`
- **THEN** Backend returns 503 Service Unavailable
- **AND** Page shows generic error or fallback image

### Multiple requests reuse cache

- **GIVEN** Browser caches image with 1-day max-age
- **WHEN** Same page is reloaded within 24 hours
- **THEN** Browser does not send GET request (uses cached image)
- **AND** Page loads faster (no network request)

### Filename validation prevents traversal

- **GIVEN** Request with suspicious filename like `/uploads/banners/../../../etc/passwd`
- **WHEN** Request is sent
- **THEN** Backend validates filename (no path separators allowed)
- **AND** Returns 404 or 400 Bad Request (not 200 with file contents)
