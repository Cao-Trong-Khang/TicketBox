## 1. Data Contracts and Local State

- [x] 1.1 Audit existing `mobile-checkin` API models, Room entities, DAO queries, and backend check-in DTOs for required UI fields: event status, attendee name, ticket type, zone/seat, gate, VIP count, previous check-in time, previous gate, and staff name. Covers AC: Dashboard supports gate readiness, QR scan produces correct result state, Duplicate ticket cannot be checked in again.
- [x] 1.2 Add or verify backend preload/sync response support for any missing validation-display fields needed by the mobile result screens while preserving assignment-scoped Check-in Staff access. Covers AC: Staff completes assigned-event login flow, Dashboard supports gate readiness, Duplicate ticket cannot be checked in again.
- [x] 1.3 Add or verify Room entities, migrations, DAO queries, and repository mappings for assigned event status, dashboard counters, VIP list, scan history, sync status, and previous check-in metadata. Covers AC: Dashboard supports gate readiness, Duplicate ticket cannot be checked in again.
- [x] 1.4 Add repository/view-state models for selected event, selected gate, network state, sync state, pending offline count, manual ticket-code lookup, and ticket validation result states. Covers AC: Dashboard supports gate readiness, QR scan produces correct result state, Manual ticket input produces correct result state.

## 2. Authentication and Event Selection

- [x] 2.1 Replace access-token prototype entry with a Login screen that accepts email or phone and password and stores authenticated staff session data securely enough for local development. Covers AC: Staff completes assigned-event login flow.
- [x] 2.2 Handle invalid credential errors with an invalid-login message and no access to assigned events or check-in navigation. Covers AC: Staff completes assigned-event login flow.
- [x] 2.3 Handle non-Check-in-Staff or missing-permission responses with a permission error and no access to preload, scanning, manual input, VIP, or sync actions. Covers AC: Staff completes assigned-event login flow.
- [x] 2.4 Build the Assigned Events screen with event cards showing event name, date, venue, assigned gate, and status, and require event selection before check-in starts. Covers AC: Staff completes assigned-event login flow.
- [x] 2.5 Add tests for successful login, invalid login, non-staff permission denial, assigned event rendering, and unassigned-event access prevention. Covers AC: Staff completes assigned-event login flow.

## 3. App Shell and Dashboard

- [x] 3.1 Implement a Compose app shell that keeps authenticated staff and selected assigned event as top-level state. Covers AC: Staff completes assigned-event login flow, Dashboard supports gate readiness.
- [x] 3.2 Add bottom navigation with Dashboard, Scan, VIP, History, and Profile tabs after event selection, with every tab scoped to the selected event and gate. Covers AC: Dashboard supports gate readiness.
- [x] 3.3 Build the Dashboard screen showing event name, venue, current gate, total tickets, checked-in count, remaining count, VIP guest count, Online/Offline network status, sync status, and pending offline record count. Covers AC: Dashboard supports gate readiness.
- [x] 3.4 Add Dashboard actions for Start QR Scan, VIP Guest List, and Scan History using large tap targets and short labels. Covers AC: Dashboard supports gate readiness.
- [x] 3.5 Add tests for bottom navigation visibility, tab scoping, dashboard counters, connectivity display, sync display, pending offline count, and primary dashboard actions. Covers AC: Dashboard supports gate readiness.

## 4. Scan and Manual Validation Flows

- [x] 4.1 Implement the QR Scanner screen with camera scan area, selected event/gate display, flash toggle, manual input button, and network indicator. Covers AC: QR scan produces correct result state.
- [x] 4.2 Connect scanner output to local validation against Room preload data, local duplicate history, selected event, and gate context. Covers AC: QR scan produces correct result state, Duplicate ticket cannot be checked in again.
- [x] 4.3 Implement Manual Ticket Input screen with ticket-code entry, validation action, input error handling, and routing to the same result-state model as QR scans. Covers AC: Manual ticket input produces correct result state.
- [x] 4.4 Ensure scan and manual attempts create or update durable local scan history according to offline check-in requirements before result workflows complete. Covers AC: QR scan produces correct result state, Manual ticket input produces correct result state.
- [x] 4.5 Add tests for QR scan routing, manual-code routing, empty or malformed manual input, offline validation, wrong event, wrong gate, and local duplicate detection. Covers AC: QR scan produces correct result state, Manual ticket input produces correct result state, Duplicate ticket cannot be checked in again.

## 5. Result Screens

- [x] 5.1 Implement Valid Ticket Result screen with green success state, ticket code, attendee name, ticket type, zone/seat, event name, gate, confirm check-in action, and scan-next action after confirmation. Covers AC: QR scan produces correct result state, Manual ticket input produces correct result state.
- [x] 5.2 Implement Invalid Ticket Result screen with red error state and distinct ticket not found, wrong event, wrong gate, canceled ticket, and refunded ticket cases. Covers AC: QR scan produces correct result state, Manual ticket input produces correct result state.
- [x] 5.3 Add Invalid Ticket Result actions for Scan Again and Manual Input. Covers AC: QR scan produces correct result state, Manual ticket input produces correct result state.
- [x] 5.4 Implement Duplicate Ticket Result screen with orange warning state, duplicate message, previous check-in time, previous gate, previous staff name when available, duplicate prevention, and Scan Next action. Covers AC: Duplicate ticket cannot be checked in again.
- [x] 5.5 Add UI/domain tests for valid confirmation, invalid reason mapping, duplicate prevention, previous check-in details, and fast next-scan recovery actions. Covers AC: QR scan produces correct result state, Manual ticket input produces correct result state, Duplicate ticket cannot be checked in again.

## 6. VIP, History, Profile, and Sync Feedback

- [x] 6.1 Implement the VIP tab showing VIP guests for the selected assigned event or gate without exposing unassigned event VIP entries. Covers AC: Dashboard supports gate readiness.
- [x] 6.2 Implement the History tab showing recent valid, invalid, duplicate, pending, synced, and failed scan outcomes scoped to the selected event and gate. Covers AC: Duplicate ticket cannot be checked in again.
- [x] 6.3 Implement the Profile tab showing staff identity, selected device or gate context, session/sync status, and logout that clears session credentials without deleting durable offline scan logs. Covers AC: Staff completes assigned-event login flow.
- [x] 6.4 Surface WorkManager sync state and retryable offline pending records consistently on Dashboard, History, and Profile. Covers AC: Dashboard supports gate readiness.
- [x] 6.5 Add tests for VIP scoping, history scoping, logout behavior, scan-log preservation after logout, and sync-status display. Covers AC: Dashboard supports gate readiness, Duplicate ticket cannot be checked in again.

## 7. Verification and Demo

- [x] 7.1 Add or update Android unit tests for repository/view-state mapping, manual validation, duplicate detection, result-state mapping, and dashboard counter derivation. Covers all acceptance criteria.
- [x] 7.2 Add or update Compose UI tests for Login, Assigned Events, Dashboard, Scan, Manual Input, Valid Result, Invalid Result, Duplicate Result, VIP, History, and Profile screens. Covers all acceptance criteria.
- [x] 7.3 Add a local mobile staff check-in demo sequence using seeded backend data that logs in as Check-in Staff, selects an assigned event, preloads data, scans a valid ticket, handles invalid/manual input, handles duplicate scan, reviews VIP list, and reviews history. Covers all acceptance criteria.
- [x] 7.4 Run available backend tests if DTO/API changes are made, Android unit tests, Android UI tests where supported, and a debug build for `mobile-checkin`. Covers all acceptance criteria.
