## ADDED Requirements

### Requirement: Organizer can generate artist bio from uploaded documents

The system SHALL allow Organizer users with `concert:manage` permission for the concert to upload artist profile PDFs or press kits and generate a short artist bio through an asynchronous AI workflow.

#### Scenario: PDF upload starts AI processing

- **GIVEN** an Organizer owns the concert
- **WHEN** the Organizer uploads a PDF to `POST /admin/concerts/{concertId}/artist-documents`
- **THEN** the system MUST store the document metadata and enqueue text extraction and AI bio generation jobs

#### Scenario: AI model is unavailable

- **GIVEN** extracted document text exists but the AI model call fails
- **WHEN** the AI bio worker processes the job
- **THEN** the system MUST mark generation failed, preserve extracted text status, and keep the concert detail page using fallback artist text

### Requirement: Organizer can review and edit generated artist bio

The system SHALL store AI-generated bios with review status and allow Organizer users to approve, edit, replace, or hide the generated content before it is shown on the concert detail page.

#### Scenario: Organizer edits generated bio before publishing

- **GIVEN** an AI-generated bio is awaiting review
- **WHEN** the Organizer edits the generated bio text and saves it
- **THEN** the system MUST store the edited bio as the current display version and mark it as approved or ready for publication
