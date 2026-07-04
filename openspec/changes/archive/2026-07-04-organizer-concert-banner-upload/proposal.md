## Why

Currently, organizers can specify a banner URL as text input, but there is no built-in image upload capability. This requires organizers to upload images externally and paste URLs manually, creating friction and limiting discoverability. Adding a native banner upload feature improves the organizer experience and ensures all public concert images are reliably hosted and accessible.

## What Changes

- **New upload endpoint** `POST /organizer/concerts/banners` accepts organizer-only image uploads (JPEG, PNG, WebP) with 5 MB limit
- **New image-serving endpoint** `GET /uploads/banners/:filename` streams banner images to public concert pages (no authentication required)
- **Updated frontend organizer form** replaces banner URL text input with file upload + local preview + upload-on-submit flow
- **New MinIO bucket** `concert-banners` stores banner image objects with stable backend URL references (not presigned URLs)
- **Stable banner URL storage** Concert.bannerUrl stores relative backend URL `/uploads/banners/{filename}` (not expiring presigned URLs)
- **Create concert flow** supports banner upload: select file, preview locally, submit with JSON payload
- **Edit concert flow** supports optional banner replacement: reuse existing or upload new
- **Public concert display** continues rendering `<img src={concert.bannerUrl}>` unchanged; images now load from backend endpoint

## Capabilities

### New Capabilities

- `organizer-concert-banner-upload`: Organizer-only image upload endpoint with MIME/size validation, MinIO storage, and stable public serving via backend proxy
- `concert-banner-display`: Public-facing image-serving endpoint that streams banner images from MinIO to browser with cache headers

### Modified Capabilities

- `organizer-concert-management`: Concert create/edit flows now support optional banner file upload during submission (upload-on-submit pattern; concert JSON endpoints unchanged)
- `concert-listing`: Public concert list/detail continue rendering bannerUrl field; implementation now guaranteed stable backend URL instead of expiring presigned URLs

## Impact

**Affected roles**: Organizer (primary), Audience (public display)

**Affected APIs**:

- New: `POST /organizer/concerts/banners`
- New: `GET /uploads/banners/:filename`
- Modified (frontend only): Organizer concert create/edit forms
- Unchanged: Concert JSON endpoints (POST/PATCH organizer/concerts), public concert endpoints

**Affected systems**:

- Backend: NestJS ConcertsModule gains banner upload/download services
- Frontend: OrganizerConcertForm gains file input and upload-on-submit logic
- Storage: New MinIO bucket `concert-banners` (private bucket, backend-managed)

**External integrations**: None. No VNPAY, email, AI model, or sponsor CSV involvement.

**Database changes**: None. Concert.bannerUrl remains nullable string field.

**Constraints adhered to**:

- Maintains organizer-only RBAC pattern (ensureOrganizerRole check)
- Keeps MinIO private (no public bucket policy)
- Uses stable backend URLs (no expiring presigned URLs)
- Does not change concert create/update endpoints to multipart
- Does not redesign organizer form layout
- Does not affect payment, orders, or check-in flows
