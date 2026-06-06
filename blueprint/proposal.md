# Proposal: Check-in + VIP CSV Import

## Problem Statement

TicketBox must support high-volume concert entry for events in Vietnam where venue connectivity can be weak or unavailable. Audience tickets are delivered as QR codes and must be scanned by gate staff using a mobile check-in app. The system must preserve check-in records, reduce double-entry risk, and reconcile all offline activity with the backend as the final source of truth.

Some concerts also include sponsor VIP guest lists. Sponsor systems do not expose APIs, so TicketBox must import CSV files sent shortly before the event or uploaded by organizers. Imports must tolerate invalid files, invalid rows, duplicate data, repeated file submissions, and job failures without interrupting existing platform services, check-in, or VIP lookup.

## Goals

- Allow gate staff to validate and check in audience tickets online.
- Allow temporary offline check-in recording on scanner devices.
- Sync offline records back to the backend without losing data.
- Make the backend database the authoritative record for final check-in state.
- Prevent duplicate ticket use as much as technically possible under offline conditions.
- Import sponsor VIP guest lists from CSV through scheduled ingestion or admin upload.
- Validate, normalize, deduplicate, and audit VIP import data.
- Let VIP gate staff search and verify VIP guests for assigned events, including limited offline support where feasible.
- Provide traceable audit logs, import batch status, per-row errors, and operational monitoring.

## Dependencies vs Owned Scope

This package owns only feature cluster #4: online ticket check-in, offline ticket check-in, offline sync/reconciliation, scanner device authorization for check-in, VIP CSV import, VIP guest lookup/check-in, and related audit/import records.

It depends on existing platform capabilities for event data, issued ticket data, final ticket status values, user identity, role assignment, staff authentication, organizer authorization, and file storage. Check-in consumes final ticket status values such as `ACTIVE`, `CANCELLED`, `REFUNDED`, and `VOIDED`; it does not create tickets, sell tickets, perform financial transaction handling, change refund state, create concerts/events, or implement a global RBAC framework.

## Stakeholders

### Audience

- Presents an e-ticket QR code issued by the existing ticket platform.
- Expects quick venue entry and clear rejection reasons when a ticket is invalid.
- Must not have sensitive ticket or identity data exposed through the QR payload.

### Gate Staff

- Uses the mobile check-in app to scan tickets and verify VIP guests.
- Needs fast, simple scan results under pressure at crowded gates.
- Needs offline mode when venue network connectivity is unavailable.
- Needs clear sync status and warnings when a device has been offline too long.

### Organizer

- Uses existing event and staff administration capabilities to configure gate assignments, scanner devices, and staff access needed by check-in.
- Uploads VIP CSV files and reviews import batches and row-level errors.
- Needs reliable check-in counts, duplicate detection, and post-event audit trails.

### Sponsor Providing VIP CSV Files

- Sends guest lists as CSV files, often the night before the event.
- May send corrected lists, partial updates, repeated files, or files with inconsistent formatting.
- Requires TicketBox to import valid guests without blocking the running event system.

## Feature Scope

- Online event ticket check-in through mobile scanner app and backend API.
- Offline ticket QR verification using signed QR tokens or a preloaded offline manifest.
- Local mobile persistence of pending offline records.
- Batch sync from mobile devices to backend with per-record results.
- Scanner device registration, authorization, and event/gate assignment checks.
- Backend check-in service with transactional single-successful-check-in enforcement.
- VIP CSV ingestion through scheduled storage polling and admin upload.
- CSV header validation, row validation, normalization, deduplication, and idempotent import behavior.
- VIP guest search and VIP check-in for gate staff.
- Feature permissions for gate staff, organizer, admin, and audience boundaries, enforced through the existing RBAC/auth platform.
- Auditability through check-in records, sync batches, import batches, import errors, logs, and metrics.

## Out of Scope

- Ticket creation, ticket sale flow, financial transaction handling, ticket lifecycle changes, and ticket delivery.
- Concert/event creation and event catalog management.
- Global RBAC framework design; this feature only defines permission needs consumed by existing auth/RBAC.
- Global traffic, cache, and message-broker strategy beyond optional supporting infrastructure for this feature.
- Full admin web UI design; this package defines admin-facing capabilities and APIs for CSV upload, import review, and scanner device management only.
- Native mobile UI implementation details beyond required behaviors and local storage needs.
- Sponsor API integrations.
- Real-time cross-gate duplicate prevention while all gates are offline.
- Biometric verification or government ID verification.
- Seat map rendering and audience-facing event discovery.
- Production cloud deployment topology beyond the components needed for this feature cluster.
- Data warehouse, BI dashboards, and post-event analytics beyond operational audit records.
- Artist profile content generation or other unrelated content features.

## Risks and Constraints

### Poor or Unavailable Network at the Venue

Offline mode is required because gate devices may lose connectivity. Devices must download manifests before the event, record local scans durably, and retry sync until acknowledged by the server. The app must surface stale-manifest and long-offline warnings.

### Double Check-in

The database must enforce only one successful check-in per ticket. Online duplicate prevention is strong. Offline duplicate prevention is limited to each device's local cache and gate partitioning. If multiple devices are offline at different gates, the server can only detect conflicts after sync and must mark later conflicting records as rejected.

### Scanner Device Battery Loss or Local Data Loss

The mobile app must store pending records in a durable local database such as SQLite immediately after scan acceptance. It should sync frequently when online, warn at low battery, and show unsynced counts. Device loss before sync remains a residual risk mitigated by operational procedures and shorter offline windows.

### Invalid CSV Format

CSV files may have missing or unexpected headers, wrong encodings, malformed rows, or invalid values. Header-level failures fail the whole batch. Row-level failures are stored in `vip_import_errors` while valid rows continue.

### Duplicate CSV Rows

Duplicates within one file must be detected using `event_id + external_guest_id` when present, otherwise normalized email or phone. Duplicate rows should not create duplicate VIP guests and should be reported as skipped, updated, or row errors depending on policy.

### Import Job Failure Halfway Through

Imports must run in batches with clear status transitions. Already committed valid rows must remain consistent. The batch must be marked `FAILED` or retryable, and the worker must be able to resume or rerun idempotently.

### Sponsor Sending the Same File Multiple Times

The import service must compute a file hash and use it with event context to detect repeated submissions. Repeated files should be marked duplicate or processed idempotently without creating duplicate guests.

### VIP Guest List Changes Shortly Before the Event

The import model must support repeated imports and upserts. Gate staff should see the latest server state when online. Offline VIP subsets must have expiry metadata because late changes cannot be guaranteed to reach devices that remain offline.
