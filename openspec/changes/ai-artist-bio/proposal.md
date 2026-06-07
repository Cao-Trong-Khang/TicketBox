# Proposal: AI Artist Bio Generator

## Problem

Organizers setting up music concerts often have to write or copy-paste long bio summaries for featured performers. The manual process is tedious, inconsistent, and error-prone. Organizers usually have a PDF press kit or profile of the artist containing raw details (discography, achievements, genre descriptions, history).

An automated, intelligent system that parses an uploaded press kit PDF and leverages Generative AI to compile a concise, engaging summary saves time and guarantees standardized high-quality output for display on the ticket booking interface.

## Goals

1. Allow **Organizers** to upload a PDF press kit inside the create/edit concert views, triggering automated text extraction and bio generation.
2. Automate clean text extraction from uploaded PDF documents using `pdf-parse`.
3. Leverage the Google Gemini API (`gemini-1.5-flash`) to generate structured, marketing-ready 2-3 paragraph biographies.
4. Support manual edits by **Organizers** on the generated bio before/after final database persistence.
5. Render the bios on the public-facing concert detail pages for **Audience** users to discover more about the performers.

## Users and Needs

* **Organizer**: Needs a simple PDF upload field that automatically fills in a text bio container with structured content, which is previewable and editable.
* **Audience**: Needs to view high-quality artist descriptions on the public concert page to enhance their ticket booking experience.

## Scope

### In Scope
* **Backend (NestJS)**:
  * Database changes to `Concert` in Prisma: nullable `artistBio` (text) and `artistBioSource` (name of file).
  * Secure endpoint: `POST /api/admin/concerts/:id/generate-bio` (restricted to `ORGANIZER` role, accepts file uploads up to 10MB).
  * PDF parser execution using `pdf-parse`.
  * Clean-up filters (page numbers, headers/footers, excess lines, truncating to 4000 characters).
  * Google Gemini API connector executing the prompt template using the `gemini-1.5-flash` model.
  * Temporary file cleanup (deleting uploads from `/tmp` after text extraction).
* **Frontend (React)**:
  * PDF input component in `AdminConcertFormPage` (accepting `.pdf` files under 10MB).
  * Spinner and loading indicators during background extraction and LLM processing.
  * Preview text box populating on success with an "AI Generated" visual indicator, fully editable by the user.
  * Rendering block on `ConcertDetailPage` displaying the bio section.

### Out of Scope
* Long-term document storage (e.g. S3 buckets, local file vaults) for uploaded PDFs; PDFs are deleted immediately after text extraction.
* Support for multiple artists or complex co-headlining bios.
* Translation or multilingual generation features.
* Tracking bio generation history, revision rollbacks, or comparisons.

## External Systems
* Google Gemini API (`gemini-1.5-flash` via the `@google/generative-ai` package).

## Risks and Constraints
* **Gemini Availability**: If Gemini services are offline or run out of free-tier quotas, the system must degrade gracefully (log exceptions, display error alerts, keep fields editable for manual entries, and save other concert data without issues).
* **PDF File Limits**: Large or scanned files (images) may lead to timeout issues or fail text extraction entirely. The system must enforce a 10MB file ceiling and reject scanned non-OCR documents.
