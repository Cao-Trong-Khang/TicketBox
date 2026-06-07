## Context

TicketBox already defines sponsor VIP guest-list integration as scheduled CSV import only. The global design includes Sponsor CSV Files as an external data source, Kafka-backed Background Workers for asynchronous CSV import, PostgreSQL tables for `vip_guest_imports` and `vip_guests`, organizer review permissions, and check-in preload support for VIP guest-list entries.

This change turns that blueprint into a concrete feature design for the import side of the workflow. The primary stakeholder is the Organizer who reviews import results for owned concerts. Check-in Staff are downstream users because imported guests become part of VIP gate validation data. Audience users should not experience any behavior change.

The integration is intentionally one-way. TicketBox reads scheduled files delivered by the sponsor and must not call a sponsor API, webhook, or external database.

## Goals / Non-Goals

**Goals:**
- Detect scheduled sponsor CSV files and enqueue import jobs without blocking public APIs.
- Validate CSV structure, required columns, malformed rows, and duplicate guest identities.
- Store accepted VIP guests and import reports in PostgreSQL as authoritative state.
- Allow Organizer users to view import lifecycle status, accepted counts, duplicate counts, invalid row counts, and row-level errors for owned concerts.
- Make accepted VIP guests available to Check-in Staff through the existing assignment-scoped preload workflow.
- Isolate file, Kafka, validation, and worker failures from checkout, public browsing, payment, and regular ticket check-in.

**Non-Goals:**
- Manual CSV upload UI.
- Direct sponsor API, webhook, or database integration.
- Real-time sponsor-side validation at the VIP gate.
- Changes to ticket purchase, payment processing, e-ticket issuance, or inventory locking.
- New database engines, message brokers, cloud-only storage, or managed external services.

## Decisions

### Decision 1: Model the source as scheduled files plus import metadata

The system will scan a configured local-development file source for scheduled sponsor CSV files. Each detected file creates or updates a `vip_guest_imports` record with concert ID, source name, file name, source fingerprint, status, counters, timestamps, and failure metadata.

**Rationale:** This matches the course constraint that sponsors provide files before the show and do not provide APIs. Tracking metadata in PostgreSQL gives organizers visibility and makes scheduler retries idempotent.

**Alternatives considered:** A manual upload endpoint would be simpler to demo but would not match the required scheduled import flow. Direct API integration is out of scope and contradicts the global proposal.

### Decision 2: Use Kafka to decouple detection from import processing

The scheduler will enqueue a `vip-guest-import.requested` job through Kafka after recording the import attempt. A Background Worker consumes the job, reads the CSV, validates rows, deduplicates guests, writes accepted guests, and marks the import complete or failed.

**Rationale:** CSV import is slow and failure-prone. Kafka keeps it outside the synchronous browsing, checkout, payment, and check-in request paths and aligns with the existing event-driven architecture.

**Alternatives considered:** Running parsing inside the scheduler would reduce moving parts but would make scheduling responsible for long-running work and retry behavior. Processing through the Backend API request path would risk user-facing latency.

### Decision 3: Make PostgreSQL authoritative for imports and VIP guests

The worker will write import state, accepted guest rows, duplicate outcomes, invalid-row summaries, and audit logs to PostgreSQL. Redis may be used only for short-lived scheduler coordination, rate limits, or retry cooldowns. Redis must not determine final guest validity.

**Rationale:** PostgreSQL is already the global source of truth for guest lists and check-in validity. Database uniqueness and transactions provide the right guardrails for duplicate import attempts and duplicate guest identities.

**Alternatives considered:** Keeping import reports only in worker logs would not give organizers reliable review data. Using Redis as final guest state would contradict the global data model.

### Decision 4: Deduplicate using external key first, then normalized identity

When the CSV includes an external guest key, accepted guests are unique by `(concert_id, sponsor_source, external_guest_key)`. When no external key is present, the worker uses normalized email, phone, and full name according to the available fields. Duplicate rows are counted and reported instead of creating multiple active VIP guests.

**Rationale:** Sponsor files may contain stable IDs, but the workflow must still handle CSVs that only include human identity fields. Reporting duplicates lets organizers inspect data quality without interrupting valid guest import.

**Alternatives considered:** Rejecting an entire file on any duplicate would make one bad row block VIP gate preparation. Always inserting duplicates would create ambiguous check-in outcomes.

### Decision 5: Process valid rows even when some rows fail

The worker will reject the entire file only for file-level errors such as unreadable file, unsupported delimiter or encoding, missing required header row, or missing required columns. For row-level errors, it imports valid unique guests and records rejected row details in the import report.

**Rationale:** Sponsor files may arrive shortly before the event. Partial acceptance preserves operational readiness while still making data problems visible.

**Alternatives considered:** All-or-nothing import is simpler but too brittle for late sponsor files. Silent skipping would hide data loss from organizers.

### Decision 6: Expose review through organizer-owned concert APIs

The Backend API will expose organizer review endpoints such as:

- `GET /admin/concerts/:concertId/vip-imports`
- `GET /admin/concerts/:concertId/vip-imports/:importId`

Both endpoints require authenticated Organizer role, the relevant concert management permission, and ownership of the concert.

**Rationale:** The global RBAC design allows organizers to review VIP CSV import results for owned concerts and denies that capability to Audience and Check-in Staff roles.

**Alternatives considered:** Exposing import reports to Check-in Staff would overexpose sponsor data. Public import status would leak operational information.

## Risks / Trade-offs

- **Late or missing sponsor file** -> The scheduler records no detected import or a failed import status, and organizer review makes the absence visible before gate operations.
- **Kafka unavailable during detection** -> The scheduler records a pending or failed-to-enqueue import and retries later without disrupting public APIs.
- **Worker crashes mid-import** -> Import state remains processing or retryable failure; idempotent import IDs and guest uniqueness prevent duplicate accepted guests on retry.
- **Malformed CSV blocks file-level parsing** -> The import is marked failed with file-level error metadata; existing VIP guest data remains unchanged.
- **Duplicate identity rules may merge legitimate guests with similar data** -> Prefer external guest keys when available, normalize identity fields consistently, and report duplicate decisions for organizer review.
- **Large CSV files can increase database load** -> Process rows in bounded batches and keep writes scoped to VIP guest tables and import reports, not checkout or payment tables.

## Migration Plan

1. Add or verify schema support for `vip_guest_imports`, `vip_guests`, import error details, uniqueness constraints, indexes, and audit logging.
2. Add local-development configuration for the scheduled sponsor CSV file source.
3. Implement scheduler job detection and Kafka publishing.
4. Implement worker validation, deduplication, persistence, retry behavior, and audit logging.
5. Implement organizer review APIs and ensure check-in preload reads accepted VIP guests.
6. Seed demo sponsor files and local concerts for Docker Compose verification.

Rollback strategy: disable the scheduler and worker configuration. Existing accepted `vip_guests` remain in PostgreSQL for check-in use, while no new imports are detected or processed.

## Open Questions

None.
