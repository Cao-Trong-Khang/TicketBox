## ADDED Requirements

### Requirement: Scheduled sponsor VIP CSV files are imported asynchronously
TicketBox SHALL import sponsor VIP guest lists from scheduled CSV files through the Backend API, Kafka, Background Workers, and PostgreSQL without requiring a sponsor API or manual upload flow.

#### Scenario: Scheduled import completes without blocking live APIs
- **GIVEN** a scheduled sponsor CSV file exists for a concert
- **WHEN** the scheduler enqueues the import and the worker processes the file
- **THEN** valid unique VIP guests are stored in PostgreSQL
- **THEN** public browsing, checkout, payment, and check-in APIs remain available

## Specification: VIP CSV Import

## Description

The system SHALL provide a scheduled, one-way import workflow for sponsor VIP guest-list CSV files. Organizer users review import status and results for concerts they own, while Check-in Staff use the imported VIP guest entries indirectly through assignment-scoped check-in preload data at VIP gates. Audience users SHALL NOT interact with this feature.

## Main Flow

1. A sponsor provides a scheduled CSV file before the concert date in the configured Sponsor CSV Files source.
2. The Import Scheduler detects the file and creates a `vip_guest_imports` record in PostgreSQL for the target concert, source, file name, and initial status.
3. The Import Scheduler publishes a CSV import job to Kafka.
4. A Background Worker consumes the job and reads the CSV file.
5. The Background Worker validates the file header, required columns, row shape, guest identity fields, and supported file format.
6. The Background Worker deduplicates guests using external guest key when available, otherwise normalized email, phone, and full name.
7. The Background Worker writes valid unique guests to `vip_guests` in PostgreSQL and records invalid rows, duplicate rows, counters, status, and audit information in PostgreSQL.
8. The Backend API exposes import status and report endpoints to Organizer users for owned concerts.
9. The existing check-in preload workflow reads accepted active VIP guests from PostgreSQL for assigned Check-in Staff and VIP gates.

## Failure Scenarios

- If a CSV file is unreadable, missing required columns, has an unsupported format, or cannot be parsed, the import SHALL be marked failed with file-level error details and SHALL NOT remove existing valid VIP guest records.
- If individual rows are malformed or missing required guest identity data, the worker SHALL skip those rows, import valid unique rows, and record row-level errors.
- If duplicate guests appear in the same file or across repeated imports for the same concert and sponsor source, the worker SHALL deduplicate them, count duplicate rows, and avoid creating multiple active guest records for the same guest identity.
- If Kafka is unavailable when the scheduler detects a file, the system SHALL record the import as pending or failed-to-enqueue and SHALL NOT disrupt public concert APIs, checkout, payment, or check-in APIs.
- If the worker fails after partially processing a file, retrying the same import SHALL NOT create duplicate accepted VIP guests.
- If an Organizer requests an import report for a concert they do not own, the Backend API SHALL deny access.

## Constraints

- The workflow MUST be scheduled and one-way from Sponsor CSV Files into TicketBox.
- The workflow MUST NOT call sponsor APIs, sponsor webhooks, or sponsor databases.
- PostgreSQL MUST remain the authoritative source for import status, accepted VIP guests, duplicate decisions, and final check-in validity.
- Redis MUST NOT be used as authoritative guest-list state.
- Kafka and Background Workers MUST be used for asynchronous processing so import work does not block public browsing, checkout, payment, or check-in request paths.
- Organizer review endpoints MUST require authenticated Organizer role, concert management permission, and ownership of the target concert.
- Check-in Staff MUST only receive imported VIP guest data through assignment-scoped check-in preload for assigned concerts or gates.
- The feature MUST run in the local Docker Compose development stack with Backend API, PostgreSQL, Redis, and Kafka.

## Acceptance Criteria

#### Scenario: Valid scheduled CSV is imported
- **GIVEN** a scheduled sponsor CSV file exists for a concert
- **WHEN** the scheduler enqueues the import and the worker processes the file
- **THEN** valid unique VIP guests are stored in PostgreSQL
- **THEN** the import status is marked completed with accepted, duplicate, and rejected row counts

#### Scenario: CSV has file-level errors
- **GIVEN** a scheduled CSV file is missing required columns or has an unsupported format
- **WHEN** the worker processes the file
- **THEN** the import is marked failed with file-level error details
- **THEN** existing accepted VIP guest records remain available for check-in

#### Scenario: CSV has malformed and duplicate rows
- **GIVEN** a CSV file contains valid rows, malformed rows, and duplicate guests
- **WHEN** the worker processes the file
- **THEN** valid unique guests are imported
- **THEN** malformed rows and duplicate rows are skipped and recorded in the import report

#### Scenario: Kafka outage does not disrupt live system
- **GIVEN** Kafka is unavailable when the scheduler detects a sponsor CSV file
- **WHEN** the scheduler attempts to enqueue the import job
- **THEN** the import is recorded as pending or failed-to-enqueue
- **THEN** public browsing, checkout, payment, and check-in APIs remain available

#### Scenario: Worker retry is idempotent
- **GIVEN** a worker fails after partially processing a CSV import
- **WHEN** the same import job is retried
- **THEN** PostgreSQL uniqueness and import tracking prevent duplicate active VIP guest records
- **THEN** the final import report reflects accepted, duplicate, rejected, or failed state consistently

#### Scenario: Organizer reviews import report
- **GIVEN** an authenticated Organizer owns the concert
- **WHEN** the Organizer requests an import report for that concert
- **THEN** the Backend API returns import status, accepted count, duplicate count, rejected count, file-level errors, and row-level error details

#### Scenario: Unauthorized user cannot review import report
- **GIVEN** an Audience user, Check-in Staff user, or Organizer who does not own the concert
- **WHEN** the user requests a VIP import report
- **THEN** the Backend API denies access

#### Scenario: Imported guests are available for VIP gate preload
- **GIVEN** a CSV import completed successfully for a concert
- **WHEN** assigned Check-in Staff preload validation data for the VIP gate
- **THEN** accepted active VIP guest records from the import are included in the assignment-scoped preload data
