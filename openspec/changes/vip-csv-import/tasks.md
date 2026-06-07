## 1. Data Model and Local Setup

- [ ] 1.1 Add or verify PostgreSQL migration support for `vip_guest_imports` fields needed by scheduled imports, including source name, file name, source fingerprint, status, row counters, failure metadata, queued/started/imported timestamps, and indexes by concert and status. Covers AC: valid scheduled CSV is imported, CSV has file-level errors, Kafka outage does not disrupt live system.
- [ ] 1.2 Add or verify PostgreSQL migration support for `vip_guests`, including concert ID, import ID, sponsor source, external guest key, normalized identity fields, status, checked-in timestamp, and indexes for check-in preload. Covers AC: valid scheduled CSV is imported, imported guests are available for VIP gate preload.
- [ ] 1.3 Add uniqueness constraints or transactional guards for duplicate VIP guests by `(concert_id, sponsor_source, external_guest_key)` when present and normalized identity fallback when no external key is available. Covers AC: CSV has malformed and duplicate rows, worker retry is idempotent.
- [ ] 1.4 Add import error storage and audit logging for file-level errors, row-level errors, duplicate decisions, job status changes, and organizer-visible report metadata. Covers AC: CSV has file-level errors, CSV has malformed and duplicate rows, Organizer reviews import report.
- [ ] 1.5 Add Docker Compose/local environment configuration and seed demo data for sponsor CSV source path, sample concerts, organizer ownership, check-in staff assignments, valid CSV, malformed CSV, duplicate CSV, and missing-column CSV. Covers all acceptance criteria.

## 2. Scheduler and Kafka Integration

- [ ] 2.1 Implement the import scheduler that scans the configured Sponsor CSV Files source, resolves target concert/source metadata, and creates idempotent `vip_guest_imports` records. Covers AC: valid scheduled CSV is imported.
- [ ] 2.2 Publish `vip-guest-import.requested` jobs to Kafka with import ID and file metadata after recording the import attempt in PostgreSQL. Covers AC: valid scheduled CSV is imported.
- [ ] 2.3 Handle Kafka publish failures by marking imports as pending or failed-to-enqueue and preserving retry eligibility without impacting public APIs. Covers AC: Kafka outage does not disrupt live system.
- [ ] 2.4 Add scheduler tests for new file detection, repeated detection idempotency, and Kafka-unavailable behavior. Covers AC: valid scheduled CSV is imported, Kafka outage does not disrupt live system.

## 3. CSV Worker and Domain Logic

- [ ] 3.1 Implement CSV file loading and file-level validation for readable file, supported format, header row, and required columns. Covers AC: CSV has file-level errors.
- [ ] 3.2 Implement row-level validation for required guest identity fields, malformed values, and normalized email/phone/full-name extraction. Covers AC: CSV has malformed and duplicate rows.
- [ ] 3.3 Implement deduplication using external guest key first and normalized identity fallback when no external key is present. Covers AC: CSV has malformed and duplicate rows, worker retry is idempotent.
- [ ] 3.4 Persist accepted VIP guests, skipped duplicate rows, rejected row details, counters, and final import status inside bounded database batches. Covers AC: valid scheduled CSV is imported, CSV has malformed and duplicate rows.
- [ ] 3.5 Make worker retry idempotent by using import IDs, source fingerprints, database uniqueness, and safe status transitions. Covers AC: worker retry is idempotent.
- [ ] 3.6 Ensure worker failures mark import status and failure details without deleting or deactivating existing valid VIP guest records. Covers AC: CSV has file-level errors, worker retry is idempotent.
- [ ] 3.7 Add worker unit/integration tests for valid import, missing required columns, malformed rows, duplicate rows, repeated import retry, and partial failure recovery. Covers AC: valid scheduled CSV is imported, CSV has file-level errors, CSV has malformed and duplicate rows, worker retry is idempotent.

## 4. Organizer Review APIs

- [ ] 4.1 Implement `GET /admin/concerts/:concertId/vip-imports` for authenticated Organizer users with concert management permission and concert ownership checks. Covers AC: Organizer reviews import report, unauthorized user cannot review import report.
- [ ] 4.2 Implement `GET /admin/concerts/:concertId/vip-imports/:importId` returning status, counters, file-level errors, row-level errors, duplicate details, timestamps, and source metadata. Covers AC: Organizer reviews import report.
- [ ] 4.3 Add backend authorization tests for owning Organizer access, non-owning Organizer denial, Audience denial, and Check-in Staff denial. Covers AC: unauthorized user cannot review import report.
- [ ] 4.4 Add API tests for list/detail report shape after successful, failed, and partially accepted imports. Covers AC: Organizer reviews import report.

## 5. Check-in Availability

- [ ] 5.1 Ensure check-in preload queries include accepted active VIP guest records imported from sponsor CSV files for the assigned concert or VIP gate. Covers AC: imported guests are available for VIP gate preload.
- [ ] 5.2 Ensure check-in preload remains assignment-scoped and does not expose VIP guests to unassigned staff or organizer/audience users. Covers AC: unauthorized user cannot review import report, imported guests are available for VIP gate preload.
- [ ] 5.3 Add preload integration tests proving imported guests appear for assigned Check-in Staff and are excluded for unauthorized or unassigned users. Covers AC: imported guests are available for VIP gate preload.

## 6. End-to-End Verification

- [ ] 6.1 Add a local Docker Compose demo script or documented command sequence that runs the scheduler, processes a valid sponsor CSV, and verifies organizer report output. Covers AC: valid scheduled CSV is imported, Organizer reviews import report.
- [ ] 6.2 Add a local failure demo for missing-column CSV, duplicate rows, malformed rows, and Kafka unavailable behavior. Covers AC: CSV has file-level errors, CSV has malformed and duplicate rows, Kafka outage does not disrupt live system.
- [ ] 6.3 Run backend tests and any available Docker Compose smoke checks for the import scheduler, worker, organizer APIs, and check-in preload path. Covers all acceptance criteria.
