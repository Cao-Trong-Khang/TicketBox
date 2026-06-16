## Context

TicketBox already has an Android/Kotlin `mobile-checkin` app with Room storage, a repository for assignment/preload/sync APIs, local scan validation, durable scan logs, and WorkManager synchronization. The current UI is a prototype screen that asks for an access token and device ID, lists assignments, preloads data, and records a typed QR payload.

This change refactors that prototype into a mobile-first gate workflow for Check-in Staff. It fits the global architecture by keeping the mobile app as the staff client, using the Backend API for authentication, assigned event preload, and sync, using Room for offline snapshots and history, and preserving PostgreSQL as the final authority after synchronization. It does not introduce web admin screens, new external systems, new databases, or direct sponsor integrations.

## Goals / Non-Goals

**Goals:**
- Provide a staff login and assignment-gated event selection flow.
- Introduce bottom navigation with Dashboard, Scan, VIP, History, and Profile destinations after an event is selected.
- Provide a fast Dashboard with event, gate, check-in counters, VIP count, network status, sync status, and primary actions.
- Provide QR scanner and manual ticket-code validation flows that route to valid, invalid, or duplicate result screens.
- Preserve durable offline scan logs, local duplicate detection, WorkManager sync, and assignment-scoped preload behavior.
- Optimize UI for gate operation with large tap targets, short labels, clear color states, and minimal text.

**Non-Goals:**
- Web admin, organizer, or audience screens.
- Manual ticket purchase, payment, refund, or order-management behavior.
- New sponsor API, webhook, or sponsor database integration.
- Replacing PostgreSQL, Room, WorkManager, Redis, Kafka, or the Backend API architecture.
- Real-time external ticket validation outside TicketBox's existing backend and preload data.

## Decisions

### Decision 1: Use Compose navigation with a single selected-event session

The app will keep an authenticated staff session and a selected assigned event as top-level app state. Before event selection, staff see login and assigned-events flows. After event selection, the app shows the bottom navigation destinations: Dashboard, Scan, VIP, History, and Profile.

**Rationale:** Gate staff should not scan without event and gate context. Keeping the selected event at the app shell level prevents accidental cross-event scanning and keeps every tab scoped to the same assignment.

**Alternatives considered:** A single long screen is simpler but does not match the required navigation or fast gate workflow. Allowing scan before event selection would increase wrong-event and wrong-gate risk.

### Decision 2: Preserve Room as the offline-first read/write boundary

Assignments, event preload snapshots, ticket records, VIP guest records, local scan logs, and sync outcomes remain in Room. Dashboard counters, VIP list, and History derive from Room so they remain useful offline. The repository remains the boundary between Compose UI and API/local storage.

**Rationale:** The global design requires weak-network/offline check-in, durable local scan logs, and safe synchronization. Room is already the app's local persistence layer and should remain the source for offline UI.

**Alternatives considered:** Keeping counters only in Compose state would be faster to implement but would lose state after process death and would not support offline history reliably.

### Decision 3: Route every validation attempt to an explicit result state

QR scans and manual ticket-code entry both produce a `TicketValidationResult` style state: valid, invalid, or duplicate. Valid results show ticket/attendee details and require staff confirmation before recording check-in. Invalid results show the specific error reason and recovery actions. Duplicate results show previous check-in metadata when available and prevent another successful check-in.

**Rationale:** Staff need an unambiguous decision at the gate. Separating result states reduces accidental admissions and makes duplicate prevention visible.

**Alternatives considered:** Showing scan messages inline on the scanner would require staff to parse small transient text under time pressure. A single generic result screen would hide important differences between invalid and duplicate outcomes.

### Decision 4: Keep result confirmation tied to durable scan logging

For scan/manual validation, the app should resolve the local/preloaded entity, show the result, and write or update a durable local scan log according to the existing offline check-in contract. Valid check-in confirmation records the accepted check-in attempt before allowing the next scan. Invalid and duplicate attempts are also retained in History for audit and staff review.

**Rationale:** The existing spec requires scan attempts to be durable before results are presented, while the requested UI needs a confirmation action for valid tickets. The implementation should avoid losing attempts and should remain idempotent during sync.

**Alternatives considered:** Recording only confirmed valid tickets would omit invalid/duplicate attempts from history. Recording success before staff confirmation would make accidental scans harder to cancel operationally.

### Decision 5: Add UI-level status models without changing authoritative backend rules

The Dashboard will show online/offline state, sync status, and pending offline count from local connectivity and Room/WorkManager state. Ticket counts, VIP count, checked-in count, and remaining count are derived from the selected preload snapshot and local/synced scan logs, then reconciled when sync outcomes arrive.

**Rationale:** Staff need operational visibility without waiting for backend round trips. PostgreSQL remains authoritative after synchronization, and the mobile app displays local state as a gate workflow aid.

**Alternatives considered:** Querying backend counts on every Dashboard visit would be less useful offline and would increase network dependency at the gate.

### Decision 6: Use existing backend permissions and assignment checks

Login must authenticate against the Backend API and the app must surface a permission error when the account is not a Check-in Staff account. Assignment, preload, and sync operations continue to rely on Backend API checks for Check-in Staff role, check-in permissions, and concert or gate assignment.

**Rationale:** Server-side authorization is required by the global design. The mobile app may improve error presentation, but it must not decide final authorization by itself.

**Alternatives considered:** Storing role claims only in local session state would be fragile because stale client data could show unauthorized workflows.

## Risks / Trade-offs

- **Camera/scanner integration can vary by device** -> Keep scanner behind the existing `QrScanner` abstraction and provide manual ticket-code input as a fallback.
- **Offline counts can temporarily differ from PostgreSQL** -> Label sync state clearly and reconcile Room records with backend sync outcomes.
- **More screens increase navigation complexity** -> Use a small typed route model and keep selected event/gate state centralized.
- **Valid confirmation may conflict with the existing immediate-record prototype** -> Keep durable attempt logging and make the implementation explicit about when a scan becomes an accepted local check-in.
- **Permission errors can be ambiguous if backend returns generic 403** -> Map auth failures to invalid login, non-staff permission denial, and assignment denial based on endpoint and response where available.

## Migration Plan

1. Introduce app/session state for authenticated staff and selected event.
2. Replace the prototype `MainActivity` screen with Compose navigation and bottom navigation.
3. Add login and assigned-events flows before the bottom-navigation shell.
4. Build Dashboard, Scan, Manual Input, Result, VIP, History, and Profile screens on top of the existing repository.
5. Extend local models and repository methods only where the UI needs additional fields or derived counters.
6. Add unit and UI tests for login errors, event selection, navigation, result states, assignment scoping, offline pending counts, and manual input.
7. Roll back by keeping the existing repository/domain APIs stable and reverting the Compose screen shell if the UI refactor fails.

## Open Questions

None.
