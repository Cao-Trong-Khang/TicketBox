## 1. Backend Configuration & MinIO Setup

- [x] 1.1 Add BANNERS_MAX_FILE_SIZE env var to backend .env (default: 5242880 bytes, 5 MB)
- [x] 1.2 Add BANNERS_BUCKET env var to backend .env (default: "concert-banners")
- [x] 1.3 Add BANNERS_CACHE_MAX_AGE env var to backend .env (default: 86400 seconds, 1 day)
- [x] 1.4 Update docker-compose.yml minio-init service to create concert-banners bucket with `mc mb --ignore-existing ticketbox/concert-banners`
- [x] 1.5 Update docker-compose.yml minio-init service to set bucket policy to private: `mc anonymous set none ticketbox/concert-banners`
- [x] 1.6 Verify minio-init waits for minio service health check before creating bucket
- [x] 1.7 Test: docker-compose down && docker-compose up; verify minio-init creates bucket successfully

## 2. Backend Banner Upload Service

- [x] 2.1 Create backend/src/modules/concerts/banner-upload.service.ts with:
  - Method: `upload(organizerId: string, file: UploadedFile): Promise<{ bannerUrl: string }>`
  - Organizer role check: Verify user has organizer role (database-backed check using ROLE_CODES.organizer, same pattern as organizer concert endpoints). Either:
    - Reuse existing OrganizerConcertsService.ensureOrganizerRole() if no circular dependency, OR
    - Extract role check to shared helper/service, OR
    - Implement inline database lookup in BannerUploadService
  - Validates MIME type (whitelist: image/jpeg, image/png, image/webp)
  - Validates file extension (.jpg, .jpeg, .png, .webp only, case-insensitive)
  - Validates file size ≤ 5 MB
  - Generates UUID v4 filename with original extension preserved
  - Uploads to MinIO bucket concert-banners with key `banners/{uuid}.{ext}`
  - Returns response with stable URL: `/uploads/banners/{uuid}.{ext}`
  - Throws HttpException with appropriate status code and message for errors

- [x] 2.2 Update backend/src/config/app.config.ts:
  - Export BannersConfig type with fields: maxFileSize, bucket, cacheMaxAge
  - Add getBannersConfig() function to read from env

- [x] 2.3 Create unit tests for BannerUploadService:
  - Test: Valid image upload returns /uploads/banners/{uuid}.jpg (maps to AC "Organizer can upload a valid banner")
  - Test: Oversized file throws 413 error (maps to AC "Backend rejects file > 5 MB")
  - Test: Non-image MIME type throws 400 error (maps to AC "Backend rejects invalid file type")
  - Test: SVG file throws 400 error (maps to AC "SVG explicitly rejected")
  - Test: Missing file throws 400 error (maps to AC "missing file -> 400")
  - Test: Non-organizer throws 403 error (maps to AC "Backend rejects non-organizer upload")
  - Test: MinIO upload failure throws 503 error (maps to AC "Backend handles MinIO failure gracefully")

## 3. Backend Banner Upload Controller & Endpoint

- [x] 3.1 Create backend/src/modules/concerts/banners.controller.ts:
  - Controller decorator: @Controller("organizer/concerts/banners")
  - Guard decorator: @UseGuards(JwtAuthGuard)
  - POST endpoint: @Post() uploadBanner()
  - Interceptor: @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5242880 } })) - use 5 MB constant for multer limit
  - Extract userId from request.user
  - Call BannerUploadService.upload(userId, file)
  - Return response: { bannerUrl: string }
  - HTTP status: 201 Created on success
  - Error responses: 400, 401, 403, 413, 503 with descriptive error messages

- [x] 3.2 Register BannersController in ConcertsModule (add to imports/controllers)

- [x] 3.3 Integration test for upload endpoint:
  - Test: Authenticated organizer POST /organizer/concerts/banners with valid file returns 201 { bannerUrl: "/uploads/banners/..." } (maps to AC "Organizer can upload a valid banner")
  - Test: Unauthenticated POST returns 401 (maps to AC "Backend rejects unauthenticated upload")
  - Test: Non-organizer POST returns 403 (maps to AC "Backend rejects non-organizer upload")
  - Test: Invalid file POST returns 400 (maps to AC "Backend rejects invalid file type")

## 4. Backend Banner Download Service & Endpoint

- [x] 4.1 Create backend/src/modules/concerts/banner-download.service.ts:
  - Method: `getPublicBanner(filename: string): Promise<{ buffer: Buffer; mimeType: string }>` OR streaming-compatible implementation
  - Validate filename: no path traversal (no ../, no absolute paths)
  - Retrieve object from MinIO bucket concert-banners with key `banners/{filename}`
  - Return buffer and detected MIME type (or streaming handle)
  - Throws NotFoundException if file not found
  - Throws error if MinIO unavailable

- [x] 4.2 Create backend/src/modules/concerts/banners-download.controller.ts:
  - Controller decorator: @Controller("uploads/banners")
  - GET endpoint: @Get(":filename")
  - NO authentication guard (public endpoint)
  - Extract filename from path parameter
  - Call BannerDownloadService.getPublicBanner(filename)
  - Stream image to client with headers:
    - Content-Type: {mimeType} (from service)
    - Content-Length: {buffer.length}
    - Cache-Control: public, max-age=86400
  - Return 404 if file not found (maps to AC "Missing image returns 404")
  - Return 503 if MinIO unavailable (maps to AC "MinIO failure returns 503")

- [x] 4.3 Register BannersDownloadController in ConcertsModule

- [x] 4.4 Integration test for download endpoint:
  - Test: Upload file, then GET /uploads/banners/{uuid}.jpg returns 200 with image data (maps to AC "Public user can view banner image")
  - Test: GET /uploads/banners/{uuid}.jpg includes Cache-Control: public, max-age=86400 header (maps to AC "Response includes cache headers")
  - Test: GET /uploads/banners/nonexistent.jpg returns 404 (maps to AC "Missing image returns 404")
  - Test: GET response includes Content-Type header (maps to AC "Response includes cache headers")

## 5. Backend Authentication & Authorization

- [x] 5.1 Implement organizer role check in BannerUploadService:
  - Use database-backed role lookup (same pattern as organizer concert endpoints)
  - Query: SELECT \* FROM user_roles WHERE userId=? AND roleId=(SELECT id FROM roles WHERE code='ORGANIZER')
  - Throws ForbiddenException if user lacks role
  - No changes to existing role system (ROLE_CODES.organizer constant unchanged)
  - If reusing OrganizerConcertsService method, verify no circular dependency

- [x] 5.2 Verify JwtAuthGuard works on BannersController:
  - Only authenticated users can call POST /organizer/concerts/banners
  - Unauthenticated requests return 401 Unauthorized (maps to AC "Unauthenticated request returns 401")

- [x] 5.3 Test that BannersDownloadController has NO guards:
  - GET /uploads/banners/:filename accepts unauthenticated requests
  - No JwtAuthGuard on download endpoint

## 6. Backend File Validation

- [x] 6.1 Implement MIME type validation in BannerUploadService:
  - Whitelist: image/jpeg, image/png, image/webp
  - Reject: image/svg+xml, application/x-svg, etc.
  - Check file.mimetype field
  - Throw 400 Bad Request if not whitelisted (maps to AC "Backend rejects invalid file type")

- [x] 6.2 Implement extension validation in BannerUploadService:
  - Extract extension from file.originalname (e.g., file.jpg → jpg)
  - Whitelist: jpg, jpeg, png, webp (case-insensitive)
  - Throw 400 Bad Request if not whitelisted

- [x] 6.3 Implement size validation in BannerUploadService:
  - Check file.size ≤ 5 MB (5242880 bytes)
  - Throw 413 Payload Too Large if exceeds (maps to AC "Oversized file -> 413")
  - Also enforce in multer limits: { fileSize: 5242880 }

- [x] 6.4 Unit tests (required):
  - Test: image/jpeg with .jpg extension succeeds
  - Test: image/png with .png extension succeeds
  - Test: image/webp with .webp extension succeeds
  - Test: image/svg+xml rejected (SVG not allowed)
  - Test: File 5 MB exactly succeeds
  - Test: File 5 MB + 1 byte rejected with 413

- [x] 6.5 Unit tests (optional, if implementing extension/MIME validation):
  - Test: File with .jpeg extension but MIME=image/png rejected

## 7. Frontend API Client

- [x] 7.1 Add uploadConcertBanner(file: File) to frontend/src/features/organizer-concerts/api.ts:
  - POST to /organizer/concerts/banners
  - Content-Type: multipart/form-data
  - Field name: "file"
  - Returns: Promise<{ bannerUrl: string }>
  - Handles 401, 403, 400, 413, 503 errors with descriptive messages

- [x] 7.2 Add BannerUploadResponse type to frontend/src/features/organizer-concerts/types.ts:
  - Export type BannerUploadResponse = { bannerUrl: string }

- [x] 7.3 Implement banner upload state management in OrganizerConcertForm:
  - State: selectedFile?: File, isUploading: boolean, uploadError?: string, previewUrl?: string
  - Function to validate file: Check MIME type, size, extension before upload
  - Function to generate preview URL: Use FileReader to convert File to data URL
  - On file select: Validate, generate preview, clear errors
  - On form submit: If selectedFile exists, upload first; if upload fails, show error and don't submit concert
  - (Optional: Extract to custom hook if matches project patterns; can also inline in form component)

## 8. Frontend Form Component Enhancement

- [x] 8.1 Update frontend/src/features/organizer-concerts/components/OrganizerConcertForm.tsx:
  - Add file input element (accept="image/jpeg,image/png,image/webp")
  - Replace text input for "Banner URL" with file input
  - Add image preview: render <img> if selectedFile converted to data URL via FileReader
  - Show label "Select concert banner (JPEG, PNG, WebP, max 5 MB)"
  - On file select: validate MIME/size/extension, set selectedFile state, generate preview
  - Show upload error message if validation fails
  - Include selectedFile in form state (not database field, internal state only)

- [x] 8.2 Create banner file validation helper in frontend/src/features/organizer-concerts/form-helpers.ts (or local in component):
  - Function: validateBannerFile(file: File): { valid: boolean; error?: string }
  - Check MIME type (image/jpeg, image/png, image/webp only)
  - Check size ≤ 5 MB (5242880 bytes)
  - Check extension (.jpg, .jpeg, .png, .webp case-insensitive)
  - Return error message if validation fails
  - Reject SVG files

- [x] 8.3 Add upload state management to form:
  - State: isUploading: boolean, uploadError?: string
  - Disable submit button while isUploading = true
  - Show loading spinner during upload
  - Display uploadError if upload fails
  - Allow user to retry without losing form fields

- [x] 8.4 Component test:
  - Test: Select valid image file → preview shows (maps to AC "UI shows local image preview")
  - Test: Select oversized file → error message shown (maps to AC "Frontend validates file size before upload")
  - Test: Select SVG → error message shown (maps to AC "Frontend validates file type before upload")

## 9. Concert Create Flow

- [x] 9.1 Update OrganizerConcertCreatePage form submission (upload-on-submit flow):
  - On submit:
    - If selectedFile exists:
      - Call uploadConcertBanner(selectedFile)
      - If upload succeeds: get bannerUrl, include in concert payload
      - If upload fails: show error, do NOT submit concert, preserve form state
    - If no selectedFile: proceed with concert payload (bannerUrl omitted/null)
    - Disable submit button while isUploading = true

- [x] 9.2 Submit concert JSON payload (unchanged):
  - POST /organizer/concerts with JSON body including optional bannerUrl
  - Endpoint remains JSON-only (not multipart)

- [x] 9.3 End-to-end test for create:
  - Test: Create concert without banner → succeeds with bannerUrl=null (maps to AC "Create concert without banner")
  - Test: Create concert with banner → uploads file first, then creates concert with bannerUrl (maps to AC "Organizer can upload a valid banner")
  - Test: Banner upload fails → concert not created, error shown (maps to AC "Backend handles MinIO failure gracefully")

## 10. Concert Edit Flow

- [x] 10.1 Load concert detail and display current banner:
  - Fetch organizer concert detail: GET /organizer/concerts/{id}
  - If concert.bannerUrl exists: render current banner thumbnail

- [x] 10.2 Add file input in edit form (labeled "Replace banner"):
  - Similar to create form, but optional (can keep existing banner)
  - Show current banner with option to change

- [x] 10.3 Update OrganizerConcertEditPage form submission:
  - If new file selected:
    - Upload new file
    - If upload succeeds: include new bannerUrl in update payload
    - If upload fails: show error, don't submit
  - If no new file selected:
    - Preserve existing concert.bannerUrl
    - Include in update payload as-is
  - Endpoint remains JSON-only

- [x] 10.4 End-to-end test for edit:
  - Test: Edit concert without changing banner → bannerUrl unchanged (maps to AC "Edit concert preserves banner")
  - Test: Edit concert with new banner → uploads new file, updates bannerUrl (maps to AC "Edit concert banner")
  - Test: New upload fails → error shown, concert not updated

## 11. Frontend Image URL Resolution

- [x] 11.1 Verify banner image URLs resolve correctly from frontend:
  - Backend returns: `/uploads/banners/{uuid}.jpg` (relative path)
  - Frontend needs to resolve this to full URL: `http://localhost:3000/uploads/banners/{uuid}.jpg`
  - Check if Vite dev server has proxy for /uploads → backend (if yes, relative URLs work as-is)
  - If no proxy configured:
    - Option A: Add Vite proxy in vite.config.ts for /uploads path
    - Option B: Create helper function to resolve banner URLs using API_BASE_URL from config.ts
    - Update ConcertCard and ConcertDetailPage to use resolved URLs if needed

- [x] 11.2 Verify frontend/src/features/concerts/components/ConcertCard.tsx renders bannerUrl:
  - Use a helper such as resolveAssetUrl(concert.bannerUrl) where:
    - null/empty bannerUrl returns null
    - Absolute URLs (http://..., https://...) are unchanged
    - Backend-relative URLs like /uploads/banners/... are resolved using VITE_API_BASE_URL if no Vite proxy exists
    - Existing placeholder/fallback image renders when bannerUrl is null
  - Include error handling for broken images

- [x] 11.3 Verify frontend/src/features/concerts/pages/ConcertDetailPage.tsx renders banner:
  - `<img src={resolvedBannerUrl} alt="Concert banner" />`
  - Add error handling for broken images (show placeholder if 404)

- [x] 11.4 Verify bannerUrl is returned in public API responses:
  - GET /concerts returns bannerUrl field
  - GET /concerts/{id} returns bannerUrl field

- [ ] 11.5 End-to-end test for public display:
  - Test: Create concert with banner → GET /concerts returns bannerUrl (maps to AC "GET /concerts returns bannerUrl")
  - Test: Load public concert list → images display correctly from /uploads/banners/... URL (maps to AC "Public user can view banner image")
  - Test: Load public concert detail → banner displays (maps to AC "Public user can view banner image")
  - Test: Verify GET /uploads/banners/{uuid}.jpg serves image with Cache-Control header (maps to AC "Response includes cache headers")

## 12. Build & Lint Verification

- [x] 12.1 Backend: npm run build (no TypeScript errors)
- [x] 12.2 Backend: npm run lint (no ESLint errors)
- [x] 12.3 Frontend: npm run build (no TypeScript errors)
- [x] 12.4 Frontend: npm run lint (no ESLint errors)

## 13. Integration Testing

- [x] 13.1 docker-compose down && docker-compose up (full stack starts without errors)
- [x] 13.2 Test organizer flow end-to-end:
  - Log in as organizer
  - Create concert with banner file
  - Verify backend logs show upload and storage
  - Verify SELECT bannerUrl FROM concerts shows /uploads/banners/...

- [x] 13.3 Test MinIO storage:
  - Verify object exists in concert-banners bucket: `mc ls ticketbox/concert-banners`
  - Verify bucket is private: `mc anonymous list ticketbox/concert-banners` should show "Access Denied"

- [x] 13.4 Test public access:
  - Log out (no auth)
  - Browse to public concert list
  - Verify banners load correctly
  - Inspect browser Network tab: GET /uploads/banners/{uuid} returns 200, includes Cache-Control header

## 14. Manual Verification

- [x] 14.1 Organizer create concert flow:
  - Navigate to create concert
  - Select JPEG banner
  - Verify preview shows image
  - Submit form
  - Verify concert created in database with bannerUrl

- [x] 14.2 Organizer edit concert flow:
  - Navigate to edit existing concert
  - Verify current banner displays
  - Select new PNG banner
  - Submit form
  - Verify concert updated with new bannerUrl

- [x] 14.3 Public concert display:
  - Log out
  - Browse concert list
  - Verify banners display
  - Click concert detail
  - Verify banner displays on detail page

- [x] 14.4 Error handling:
  - Try upload SVG file → verify error message shown
  - Try upload 10 MB file → verify error message shown
  - Try request /uploads/banners/nonexistent.jpg → verify 404

## 15. Out-of-Scope Constraints

**NOT implementing (verified out-of-scope):**

- [x] 15.1 Do NOT change concert create/update endpoints to multipart (JSON-only)
- [x] 15.2 Do NOT change public concert DTO shape (bannerUrl remains string field)
- [x] 15.3 Do NOT remove existing bannerUrl support (remain backward compatible)
- [x] 15.4 Do NOT touch payment/order/check-in flows (independent feature)
- [x] 15.5 Do NOT make MinIO public (bucket policy remains private)
- [x] 15.6 Do NOT store expiring presigned URLs (use stable backend URLs only)
- [x] 15.7 Do NOT redesign organizer form layout (minimal changes to form)
- [x] 15.8 Do NOT implement image cropping/editing on upload (accept as-uploaded)
- [x] 15.9 Do NOT implement background image optimization (MVP accepts files as-is)
- [x] 15.10 Do NOT add manual banner deletion UI (uploaded images permanent for MVP)
