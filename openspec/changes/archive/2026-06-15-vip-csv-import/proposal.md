## Why

Some concerts include sponsor-provided VIP guest lists, but sponsor systems do not expose an API that TicketBox can call. TicketBox needs a scheduled, one-way CSV import workflow so VIP guests can be validated at the VIP gate without disrupting ticket purchase, public browsing, or regular check-in operations.

## What Changes

- Add a scheduled VIP guest-list CSV import flow backed by Sponsor CSV Files, Kafka worker processing, validation, deduplication, PostgreSQL persistence, and import reports.
- Track import job lifecycle states such as detected, queued, processing, completed, failed, and retryable failure.
- Validate CSV file format, required columns, malformed rows, and duplicate guest identities before writing accepted VIP guest records.
- Upsert valid unique guests into the authoritative guest-list database while preserving row-level errors, duplicate counts, and audit details.
- Expose organizer-facing APIs for owned concerts to review import status and results.
- Make VIP guest records available to the existing check-in preload and synchronization workflow for Check-in Staff assigned to VIP gates.
- Keep failed or delayed imports isolated from audience checkout, public concert browsing, payment handling, and regular ticket check-in.

## Capabilities

### New Capabilities
- `vip-csv-import`: Scheduled one-way import of sponsor VIP guest-list CSV files with validation, deduplication, retryable background processing, organizer review, and check-in availability.

### Modified Capabilities
- None.

## Impact

- **Roles impacted**: Organizers can review import status and row-level results for concerts they own. Check-in Staff are affected because imported VIP guests become available in assignment-scoped preload data for VIP gate validation. Audience users are not direct users of this feature.
- **External systems**: Interacts only with Sponsor CSV Files as a scheduled file source. It does not call VNPAY/MoMo, Email Provider, AI Model, sponsor APIs, sponsor webhooks, or sponsor databases.
- **Components impacted**: Backend API, Background Workers, Kafka, PostgreSQL, Redis for optional rate limiting or temporary retry coordination, organizer admin API surface, check-in preload data, and audit logging.
- **Global goals supported**: Supports scheduled sponsor VIP guest-list import, offline-capable VIP gate validation, role-based access control, failure isolation for live ticketing, and the constraint that PostgreSQL remains the source of truth for VIP guests and check-in validity.
- **Data impact**: Uses or extends the planned `vip_guest_imports`, `vip_guests`, `check_ins`, `concerts`, role/permission tables, and `audit_logs` records from the global design.
- **Open questions**: None.
