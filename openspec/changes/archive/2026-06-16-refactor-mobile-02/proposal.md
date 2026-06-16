## Why

The first mobile refactor establishes the staff check-in shell, but gate operations still need detailed offline recovery, VIP CSV guest check-in, searchable history, staff settings, and explicit UI state contracts. This follow-up closes those operational gaps so Check-in Staff can keep admitting attendees quickly during weak connectivity while preserving PostgreSQL as the final authority after synchronization.

## What Changes

- Add offline mode UX for network loss, pending local records, and access to the sync queue.
- Add offline scan result UX that clearly records local check-ins as Pending Sync and warns that final validation occurs when network returns.
- Add a sync queue and sync conflict flow showing Pending, Synced, Conflict, and Failed records with Retry Sync and supervisor escalation actions.
- Expand scan history with status filters, ticket-code search, gate metadata, and offline/conflict outcomes.
- Expand VIP CSV guest-list workflow in the mobile app with a VIP dashboard, guest search, sponsor/type/status filters, guest detail confirmation, success, duplicate, and not-found states.
- Expand staff profile/settings with staff identity, role, assigned event, current gate, app version, sync status, local cache status, and logout.
- Add mobile-first UI requirements for high contrast, large tap targets, minimal text, status colors, and reusable components.
- Add end-to-end acceptance criteria covering login, assigned event/gate selection, QR scan, manual ticket input, detailed ticket outcomes, offline storage/sync/conflicts, VIP guest check-in, scan history filtering, and logout.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `offline-gate-checkin`: Extend the mobile staff app requirements with offline notices, local pending result states, sync queue/conflict handling, scan history filtering/search, staff profile/settings, UI components, UI states, and detailed ticket outcome acceptance criteria.
- `vip-csv-import`: Extend mobile Check-in Staff use of imported VIP CSV guest data with dashboard, search/filter, guest detail confirmation, success, duplicate, and not-found check-in states.

## Impact

- **Roles impacted**: Check-in Staff are the direct users. Audience users and Organizer users must not gain access to mobile staff check-in workflows unless they also have the required Check-in Staff role and assignment.
- **External systems**: The mobile app does not call VNPAY/MoMo, Email Provider, AI Model, or Sponsor CSV Files. VIP data comes from the existing scheduled sponsor CSV import pipeline through PostgreSQL and assignment-scoped check-in preload data.
- **Components impacted**: `mobile-checkin` Android/Kotlin app, Jetpack Compose screens/navigation, Room entities/DAOs for scan logs and sync state, WorkManager sync orchestration, repository/view-model state models, check-in API DTO mapping, and local demo/test fixtures.
- **Data impact**: Uses existing `tickets`, `vip_guests`, `check_ins`, staff assignment data, and local Room tables. Add only narrowly scoped nullable VIP metadata or check-in sync fields if the implementation does not already expose the required fields for mobile display, search, and conflict review.
- **Global goals supported**: Supports offline-capable venue check-in, VIP guest-list validation, role-based access control, assignment-scoped access, durable local scan logs, idempotent synchronization, conflict resolution, and PostgreSQL as final authority for tickets, VIP guests, and check-ins.
- **Risks and constraints**: The change must preserve offline durability, local duplicate detection, assignment-scoped preloads, idempotent sync, and first-valid-sync-wins backend conflict handling. It must not introduce direct sponsor APIs, new databases, cloud-only services, payment behavior changes, organizer web admin changes, or audience-facing features.
- **Open questions**: None.
