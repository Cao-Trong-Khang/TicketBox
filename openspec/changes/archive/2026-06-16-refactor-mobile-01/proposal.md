## Why

The current mobile check-in prototype exposes the core offline sync mechanics, but it is not yet organized as a mobile-first gate workflow for event staff. Check-in Staff need a fast, role-scoped Android app that makes assigned event selection, ticket scanning, manual fallback, clear validation results, VIP lookup, history, and profile/session actions easy to use under gate pressure.

## What Changes

- Refactor the native Android Check-in Mobile App into a staff-only gate application with bottom navigation: Dashboard, Scan, VIP, History, and Profile.
- Add a staff login flow using email or phone and password, with distinct invalid-credential and non-check-in-staff permission errors.
- Add assigned-event selection before check-in, showing event name, date, venue, assigned gate, and event status.
- Add an event check-in dashboard with event/gate context, total ticket count, checked-in count, remaining count, VIP guest count, online/offline status, sync status, and pending offline record count.
- Add QR scanning and manual ticket-code entry flows that route to valid, invalid, or duplicate result states.
- Add mobile result screens optimized for fast gate operation: green valid success, red invalid error, and orange duplicate warning.
- Add VIP and History bottom-tab destinations for VIP guest-list access and recent scan review.
- Keep the app scoped to Check-in Staff assigned to concerts or gates; do not add web admin screens or organizer-facing UI.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `offline-gate-checkin`: Add mobile-first staff app navigation, login, assigned-event selection, QR/manual validation flows, ticket result states, VIP/history/profile tabs, and fast gate-operation UI requirements.

## Impact

- **Roles impacted**: Check-in Staff are the direct users. Audience users and Organizer users must not gain access to the mobile staff workflow unless they also have the required Check-in Staff role and assignment.
- **External systems**: No direct interaction with VNPAY/MoMo, Email Provider, AI Model, or Sponsor CSV Files. The mobile app uses existing TicketBox Backend API check-in endpoints and preloaded VIP guest-list data already imported into PostgreSQL.
- **Components impacted**: `mobile-checkin` Android/Kotlin app, Jetpack Compose navigation and screens, local Room-backed preload/history state, QR scanner integration, repository/view-model orchestration, authentication/session handling, and existing check-in API models as needed.
- **Global goals supported**: Supports the global offline-capable venue check-in goal, role-based access control, assignment-scoped check-in access, durable offline scan logs, fast ticket validation, VIP guest-list validation, and PostgreSQL as final authority through synchronization.
- **Risks and constraints**: The refactor must preserve offline scan durability, idempotent synchronization, assignment-scoped preload access, and local duplicate detection. It must not introduce web admin screens, direct sponsor integrations, new databases, cloud-only services, or changes to payment/checkout behavior.
- **Open questions**: None.
