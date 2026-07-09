## Context

Currently, organizers manage concert metadata (name, dates, capacity, etc.) through JSON-based create/update endpoints. Banner images are specified as text URLs, requiring external hosting and manual URL entry. The system has no native image upload capability. MinIO (S3-compatible storage) is already integrated for artist PDF documents, configured as a private bucket with backend-only access.

The public concert display renders banner URLs directly via `<img src={concert.bannerUrl}>`. With text URL input, images are unstable (external links can break) or require expiring presigned URLs (which expire and break public displays after 7 days).

This design adds a native, organizer-accessible image upload workflow with stable backend-controlled URLs.

## Goals / Non-Goals

**Goals:**

- Enable organizers to upload banner images natively (JPEG, PNG, WebP)
- Ensure stable, non-expiring public image URLs via backend proxy
- Maintain minimal friction: file upload + preview + upload-on-submit flow in organizer form
- Reuse existing organizer RBAC pattern (JwtAuthGuard + ensureOrganizerRole)
- Leverage existing MinIO infrastructure (new private bucket, backend-managed)
- Keep public concert display unchanged (bannerUrl remains simple string field)

**Non-Goals:**

- Crop/edit/transform images on upload
- Support multiple banners per concert or image galleries
- Real-time upload progress beyond basic loading state
- CDN integration or public bucket policy
- Asset management/deletion UI (uploaded images are permanent for MVP)
- Async background processing for image optimization
- Change concert create/update endpoints to multipart
- Redesign organizer form layout

## Decisions

### Decision 1: Backend Proxy URL (not Direct MinIO URL)

**Choice**: Store relative backend URL `/uploads/banners/{filename}` in database. Add public GET endpoint that streams from MinIO.

**Rationale**:

- Stable: URLs don't expire
- Controllable: Backend owns the download endpoint
- Secure: MinIO stays private; no bucket policy changes needed
- Cacheable: Backend can set Cache-Control headers
- Aligns with codebase: Artist PDFs are backend-managed (no presigned URLs exposed)

**Alternatives considered**:

- Direct MinIO presigned URL: Expires after 7 days, breaks public displays ✗
- Public MinIO bucket + direct URL: Requires bucket policy change, exposes MinIO to internet ✗

### Decision 2: Upload Endpoint Separate from Concert Create/Update

**Choice**: `POST /organizer/concerts/banners` (separate endpoint). Concert create/update endpoints remain JSON-only, not multipart.

**Rationale**:

- Organizers can upload and reuse banners across concerts
- Avoids multipart complexity in existing concert endpoints
- Cleaner separation: file upload vs. concert metadata
- Upload-on-submit flow: form can upload file first, then submit JSON with returned bannerUrl

**Alternatives considered**:

- Multipart concert create endpoint: Couples file and metadata, less flexible ✗
- Embed in existing endpoints: Requires refactor, breaks client compatibility ✗

### Decision 3: Upload-on-Submit Flow (not Upload-on-Change)

**Choice**: User selects file in form, sees local preview, upload happens during form submit.

**Rationale**:

- User can preview before upload
- Upload happens exactly once per submit (not multiple times while editing)
- Upload errors are form errors (show, allow retry)
- Matches typical form UX
- No premature network requests

**Alternatives considered**:

- Upload on file select: Can result in unnecessary uploads, orphaned files ✗
- Embed upload in concert update: Mixes concerns, requires multipart ✗

### Decision 4: New Private MinIO Bucket for Banners

**Choice**: Create `concert-banners` bucket, keep private (no public policy).

**Rationale**:

- Separate from artist-documents (different lifecycle, ownership)
- Keeps MinIO private (consistent with codebase design)
- Backend-controlled access via proxy endpoint
- No infrastructure changes needed

**Alternatives considered**:

- Reuse artist-documents bucket: Mixes concerns ✗
- Public bucket: Exposes MinIO, harder to secure ✗

### Decision 5: Stable Backend URL Storage (not Object Key)

**Choice**: Concert.bannerUrl stores `/uploads/banners/{filename}`, not object key `banners/{filename}`.

**Rationale**:

- Frontend constructs absolute URLs naturally (browser resolves relative to origin)
- Portable: can redirect `/uploads/banners/...` to CDN later without DB changes
- Matches existing bannerUrl string semantics
- No DB migration needed (bannerUrl remains string field)

**Alternatives considered**:

- Store object key only: Frontend must construct URL, couples frontend to storage layer ✗
- Store full URL including domain: Not portable across dev/prod ✗

## Risks / Trade-offs

| Risk                                                 | Impact                            | Mitigation                                                                                     |
| ---------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Orphaned files in MinIO** if concert is deleted    | Old banners remain in bucket      | MVP: Accept (manual cleanup via mc). Future: Add CASCADE delete or scheduled cleanup job.      |
| **File storage costs** if many large images uploaded | MinIO disk usage grows            | Enforce 5 MB limit per image. Monitor via docker-compose volume. Future: Add organizer quotas. |
| **Backend proxy I/O** on every public image request  | Slight latency vs. direct MinIO   | Mitigated by 1-day Cache-Control header. Browser caches 2nd+ views.                            |
| **No explicit permission model** for banners         | Organizer can upload any image    | MinIO objects are internal; bucket is private. Only backend can serve them. Safe MVP.          |
| **UUID collision** extremely unlikely but possible   | Duplicate filename overwrites old | Use v4 UUID (2^122 ≈ 5e36 possibilities). Collision probability negligible at any scale.       |

## Deployment & Rollback

**Deployment**:

1. Create `concert-banners` bucket via minio-init (add to docker-compose)
2. Deploy backend: BannerUploadService, BannerDownloadService, GET /uploads/banners/:filename
3. Deploy frontend: File input in OrganizerConcertForm, upload-on-submit logic
4. Manual test: Create concert with banner, verify image in public list/detail

**Rollback**:

- If backend fails: Remove new endpoints, revert frontend to text input
- If MinIO bucket issues: Delete bucket, restart minio-init
- No DB schema changes; bannerUrl field remains, values simply become null

## Open Questions

1. **Filename collision handling**: Use UUID + extension? Random hex string? Current plan: UUID v4 + original extension.
2. **Cache invalidation**: If organizer replaces a banner, should old URL become invalid? Current plan: Generate new UUID each upload; old URL remains valid (pointing to old image).
3. **Scheduled banner cleanup**: Should deleted/unused banners be cleaned up automatically? Current plan: MVP skip; future job if needed.
4. **Rate limiting on upload**: Should there be a per-organizer upload rate limit? Current plan: No explicit limit for MVP (rely on global rate limiting and 5 MB file limit).
5. **Image optimization**: Should images be compressed/resized on upload? Current plan: MVP skip; accept as-uploaded (users responsible for resizing).
