## ADDED Requirements

### Requirement: Sponsor VIP guests are imported asynchronously from CSV
The system SHALL process scheduled sponsor VIP guest CSV files through Kafka workers without blocking checkout, concert browsing, or check-in APIs.

#### Scenario: Valid CSV is imported
- **GIVEN** a scheduled CSV file is available for a concert
- **WHEN** the CSV import worker processes the file
- **THEN** the system MUST create or update VIP guest records and mark the import completed

#### Scenario: Kafka broker is unavailable
- **GIVEN** Kafka is unavailable when a CSV file is detected
- **WHEN** the scheduler attempts to enqueue the import job
- **THEN** the system MUST record the import as pending or failed-to-enqueue and MUST NOT disrupt public APIs

### Requirement: CSV import validates invalid and duplicate rows
The system SHALL validate CSV shape, required fields, duplicate guests, and malformed rows while producing an import report.

#### Scenario: CSV contains invalid and duplicate rows
- **GIVEN** a CSV file includes missing required fields and duplicate guest entries
- **WHEN** the import worker processes the file
- **THEN** the system MUST import valid unique guests, skip invalid rows, deduplicate duplicates, and expose row-level errors in the import report

### Requirement: Organizer can review import results
The system SHALL allow Organizer users with `concert:manage` permission for the concert to view CSV import status and results.

#### Scenario: Organizer views import report
- **GIVEN** an Organizer owns the concert
- **WHEN** the Organizer requests `GET /admin/concerts/{concertId}/vip-imports/{importId}`
- **THEN** the system MUST return import status, accepted count, duplicate count, invalid row count, and error details
