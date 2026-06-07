## Specification: AI Artist Bio Generator

## Description

The AI Artist Bio Generator extracts text from uploaded artist press kits (PDF format) and calls Google Gemini API (`gemini-1.5-flash`) to generate structured, 2-3 paragraph biographies. Organizers can review and refine this content before it is displayed on the public concert detail view.

---

## Main Flow

### 1. Generating Biography (Organizer)
1. **Organizer** selects a PDF document (e.g. `presskit.pdf`) in `AdminConcertFormPage`.
2. Web Application automatically triggers an upload to Backend API (`POST /api/admin/concerts/:id/generate-bio`).
3. Backend API validates the file constraints (under 10MB, PDF format).
4. Backend API saves the document temporarily to `/tmp` and extracts raw content using `pdf-parse`.
5. Backend API executes text cleaning algorithms:
   * Strips excessive carriage returns and line endings.
   * Strips page numbers (numeric lines matching `/^\d+$/`).
   * Truncates the total string length to 4000 characters.
6. Backend API formats the copywriting prompt with the cleaned context and sends it to the Gemini API (`gemini-1.5-flash`).
7. Gemini API generates and returns a 2-3 paragraph artist biography.
8. Backend API deletes the temporary file in `/tmp`, updates `artistBio` and `artistBioSource` inside PostgreSQL, and returns the generated bio content.
9. Web Application receives the text response, renders it in the editable bio input container, and displays an "AI Generated" badge.

### 2. Manual Update (Organizer)
1. **Organizer** reviews the text inside the bio input container.
2. **Organizer** manually edits words or formatting.
3. **Organizer** clicks Save.
4. Web Application updates the concert record in the database.

### 3. Display Biography (Audience)
1. **Audience** user navigates to `/concerts/:id`.
2. Web Application retrieves the concert detail from the backend.
3. If `artistBio` contains text, the Web Application renders the "Artist Biography" section directly below the main artist description list.

---

## Failure Scenarios

### 1. Uploaded File Size Exceeds Limit
* **Given** an Organizer attempts to upload a PDF file larger than 10MB.
* **When** the file is submitted.
* **Then** the Backend API halts processing and returns HTTP `400 Bad Request` ("File size limit exceeded").

### 2. Scanned Image PDF (Non-OCR text)
* **Given** an Organizer uploads a scanned image PDF containing zero extractable text content.
* **When** `pdf-parse` extracts text.
* **Then** the extracted text resolves to empty, and the Backend API returns HTTP `400 Bad Request` ("Cannot extract text from scanned PDF").

### 3. Gemini API Connection Timeout or Outage
* **Given** the Gemini API service is unreachable or rate-limited.
* **When** the backend initiates the request.
* **Then** the Backend API catches the exception, logs the details, and returns HTTP `503 Service Unavailable` with a warning message. The frontend displays a warning toast, and leaves the bio text area empty and manually editable.

### 4. Direct Unauthorized Execution
* **Given** a user is logged in with `AUDIENCE` role.
* **When** they request `POST /api/admin/concerts/:id/generate-bio`.
* **Then** the endpoint filters reject execution, returning HTTP `403 Forbidden`.

---

## Constraints

1. **Temporary Storage Isolation**: Uploaded files must not persist long-term on the disk and must be discarded in a `finally` block to protect system memory/storage.
2. **Data Integrity**: Saving other concert attributes must remain independent of bio generation failures (graceful degradation).
3. **Authorization Scope**: Upload and generation routes are strictly guarded to `ORGANIZER` roles.

---

## Acceptance Criteria

### 1. Automated PDF Hashing and Extraction
* **Given** a valid text-based PDF under 10MB.
* **When** the Organizer uploads it inside the form.
* **Then** the backend extracts text successfully, cleans page numbers and headers, and triggers the Gemini SDK helper.

### 2. Copywriter Bio Production
* **Given** cleaned press kit text.
* **When** calling the Gemini API.
* **Then** the output returns a 2-3 paragraph biography (max 300 tokens) focusing on musical styles and achievements.

### 3. Interactive Review and Override
* **Given** successful bio generation from Gemini.
* **When** the text box updates in the form.
* **Then** the text area remains completely editable by the Organizer.

### 4. Graceful Degradation on LLM Failures
* **Given** a Gemini API rate-limit error or network failure.
* **When** processing an upload.
* **Then** the API returns a `503` error, the UI displays a warning message to write manually, and the rest of the concert creation page saves correctly.
