# concert-banner-display Specification

## Purpose
TBD - created by archiving change organizer-concert-banner-upload. Update Purpose after archive.
## Requirements
### Requirement: Public banner image serving endpoint
The system SHALL provide a public `GET /uploads/banners/:filename` endpoint that streams banner images from MinIO to browsers and returns cache headers (e.g., `Cache-Control: public, max-age=86400`).

#### Scenario: Public user views banner

- **WHEN** a public user loads a concert detail page referencing `/uploads/banners/{uuid}.jpg`
- **THEN** the browser's GET request to `/uploads/banners/{uuid}.jpg` succeeds and returns 200 with appropriate `Content-Type` and `Cache-Control` headers

