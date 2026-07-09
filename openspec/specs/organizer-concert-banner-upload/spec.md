# organizer-concert-banner-upload Specification

## Purpose
TBD - created by archiving change organizer-concert-banner-upload. Update Purpose after archive.
## Requirements
### Requirement: Organizer concert banner upload endpoint
The system SHALL provide `POST /organizer/concerts/banners` endpoint that allows authenticated organizers to upload a banner image file. The endpoint SHALL validate file type, size, and extension, store the image in MinIO, and return a stable backend URL.

#### Scenario: Successful banner upload

- **WHEN** an authenticated organizer submits multipart POST to `/organizer/concerts/banners` with a valid JPEG file (5 MB or less)
- **THEN** the backend stores the image in MinIO bucket `concert-banners` and returns `{ bannerUrl: "/uploads/banners/{uuid}.jpg" }`

