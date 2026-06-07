# Tasks: AI Artist Bio Generator Implementation

This list details the required execution steps to implement the AI Artist Bio Generator feature using NestJS backend and React/Vite frontend.

---

## 1. Database

- [ ] **Task DB-1**: Add `artistBio` (String?) and `artistBioSource` (String?) properties to the `Concert` model in the Prisma schema. (Maps to: *Interactive Review and Override*)
- [ ] **Task DB-2**: Generate and run the database migration. (Maps to: *Interactive Review and Override*)

---

## 2. Backend (NestJS)

- [ ] **Task BE-1**: Create `ArtistBioModule` containing `ArtistBioController` and `ArtistBioService`. (Maps to: *Automated PDF Hashing and Extraction*)
- [ ] **Task BE-2**: Register endpoint `POST /api/admin/concerts/:id/generate-bio` protected by `JwtAuthGuard` and `RolesGuard(UserRole.ORGANIZER)`. (Maps to: *Automated PDF Hashing and Extraction*)
- [ ] **Task BE-3**: Implement file size and mime-type checks within the controller (limit: 10MB, mime: application/pdf). (Maps to: *Automated PDF Hashing and Extraction*)
- [ ] **Task BE-4**: Implement the extraction pipeline using the `pdf-parse` package. Clean output strings (strip whitespaces, exclude numeric page numbers, truncate to 4000 characters). Return a warning if extracted string length is 0. (Maps to: *Automated PDF Hashing and Extraction*)
- [ ] **Task BE-5**: Implement the Google Gemini API connector using `@google/generative-ai`. Parse credentials using `process.env.GEMINI_API_KEY`. (Maps to: *Copywriter Bio Production*)
- [ ] **Task BE-6**: Implement Prompt Template logic with `gemini-1.5-flash` model mapping max output tokens to 300. (Maps to: *Copywriter Bio Production*)
- [ ] **Task BE-7**: Wrap temporary file storage in `/tmp` inside a `finally` block to ensure deletions occur on completion or error. (Maps to: *Automated PDF Hashing and Extraction*)
- [ ] **Task BE-8**: Handle Gemini exceptions safely, returning a `503` status to allow manual override. (Maps to: *Graceful Degradation on LLM Failures*)

---

## 3. Frontend (React + Vite)

- [ ] **Task FE-1**: Integrate a PDF file input widget inside `AdminConcertFormPage` with a 10MB cap constraint. (Maps to: *Automated PDF Hashing and Extraction*)
- [ ] **Task FE-2**: Implement automatic submit dispatch triggering `POST /api/admin/concerts/:id/generate-bio` when a PDF is selected. (Maps to: *Automated PDF Hashing and Extraction*)
- [ ] **Task FE-3**: Implement spinner loading state indicators for the text area while request processing occurs. (Maps to: *Interactive Review and Override*)
- [ ] **Task FE-4**: Display the "AI Generated" badge and auto-fill the form bio input field on successful response. (Maps to: *Interactive Review and Override*)
- [ ] **Task FE-5**: Implement toast exception handling for failure scenarios (timeout, large files, API outages) keeping inputs editable. (Maps to: *Graceful Degradation on LLM Failures*)
- [ ] **Task FE-6**: Add a rendering block for the biography in `ConcertDetailPage` checking if `concert.artistBio` is defined. (Maps to: *Interactive Review and Override*)
