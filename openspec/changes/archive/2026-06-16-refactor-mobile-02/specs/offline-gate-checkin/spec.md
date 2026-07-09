## ADDED Requirements

### Requirement: Offline mode notice and pending local scan result
The Check-in Mobile App SHALL show explicit offline operation screens when network connectivity is lost and SHALL distinguish locally recorded offline check-ins from authoritative synchronized check-ins.

#### Scenario: Offline mode notice appears after network loss
- **GIVEN** Check-in Staff has selected an assigned event and gate
- **WHEN** the device loses internet connectivity
- **THEN** the app shows an offline mode notice screen
- **THEN** the screen explains that check-ins will be stored locally and synchronized later
- **THEN** the screen shows the pending sync count
- **THEN** the screen provides Continue Offline and View Sync Queue actions

#### Scenario: Staff continues scanning offline
- **GIVEN** the offline mode notice is visible
- **WHEN** staff selects Continue Offline
- **THEN** the app returns to the selected event check-in workflow
- **THEN** QR scan and manual ticket-code input remain available using the latest assignment-scoped Room preload snapshot

#### Scenario: Offline scan result is recorded locally
- **GIVEN** the device is offline and has a preload snapshot for the selected event
- **WHEN** staff scans or manually enters a ticket code that can be locally matched
- **THEN** the app writes a durable local scan log before showing the result
- **THEN** the app shows an offline scan result screen with Status: Pending Sync
- **THEN** the screen displays the ticket code and attendee information when available
- **THEN** the screen warns that final validation happens when network returns
- **THEN** the screen provides a Scan Next action

### Requirement: Sync queue and conflict review
The Check-in Mobile App SHALL provide a Sync Queue screen for offline records and a Sync Conflict screen for authoritative server conflicts.

#### Scenario: Sync queue lists offline records
- **GIVEN** the selected event has local scan logs
- **WHEN** staff opens View Sync Queue
- **THEN** the app lists all offline check-in records for the selected event and gate
- **THEN** each record shows ticket code or scanned code, scan time, and sync status
- **THEN** sync status values are Pending, Synced, Conflict, or Failed
- **THEN** the screen shows the current network status
- **THEN** the screen provides a Retry Sync action

#### Scenario: Retry sync preserves pending records on failure
- **GIVEN** the Sync Queue contains Pending or Failed records
- **WHEN** staff selects Retry Sync and the Backend API is unavailable or rate-limited
- **THEN** the app keeps affected records in Room without deletion
- **THEN** retryable records remain Pending or Failed with retry information

#### Scenario: Server conflict opens conflict warning
- **GIVEN** a locally accepted offline scan synchronizes after another device already checked in the same ticket
- **WHEN** the Backend API returns a duplicate or conflict outcome from PostgreSQL
- **THEN** the app marks the local record as Conflict
- **THEN** the app shows a Sync Conflict screen with a clear conflict warning
- **THEN** the screen displays local check-in time and server check-in time when available
- **THEN** the screen provides Mark as Conflict and Contact Supervisor actions

### Requirement: Scan history search and filters
The Check-in Mobile App SHALL show recent scan and check-in records for the selected event and gate with status filters and ticket-code search.

#### Scenario: History shows recent records with filters
- **GIVEN** the selected event has local scan logs or synchronized outcomes
- **WHEN** staff opens Scan History
- **THEN** the app shows recent scan and check-in records scoped to the selected event and gate
- **THEN** each item shows ticket code or scanned code, status, time, and gate
- **THEN** the app provides filters for All, Success, Invalid, Duplicate, Offline, and Conflict
- **THEN** selecting a filter shows only matching records

#### Scenario: History searches by ticket code
- **GIVEN** Scan History contains records for multiple ticket codes
- **WHEN** staff enters a ticket code in the search bar
- **THEN** the app shows records matching that ticket code or scanned code
- **THEN** the filter selection remains applied to the search results

### Requirement: Staff profile and settings
The Check-in Mobile App SHALL provide a staff profile and settings screen with identity, assignment, sync, cache, version, and logout information.

#### Scenario: Profile shows staff and app status
- **GIVEN** Check-in Staff is logged in and has selected an assigned event
- **WHEN** staff opens Profile
- **THEN** the app shows staff name, role, assigned event, current gate, app version, sync status, and local cache status
- **THEN** the app provides a logout action

#### Scenario: Logout preserves durable offline records
- **GIVEN** the device has pending or synchronized local scan logs
- **WHEN** staff logs out
- **THEN** the app clears authenticated session credentials
- **THEN** the app does not delete durable offline scan logs, sync queue records, conflict records, or preload cache
- **THEN** future sync attempts require a valid authenticated Check-in Staff session and assignment

### Requirement: Mobile staff UI state system
The Check-in Mobile App SHALL use mobile-first, high-contrast, large-tap-target UI patterns with clear status colors and reusable components for fast gate operation.

#### Scenario: Shared UI components present consistent gate states
- **GIVEN** staff uses Dashboard, Scan, Sync Queue, History, VIP, or Profile screens
- **WHEN** the app presents event context, status, search, actions, results, or sync state
- **THEN** the app uses reusable Event Card, Status Badge, Ticket Result Card, Search Bar, Primary Button, Secondary Button, and Sync Status Banner components where applicable
- **THEN** primary actions use large tap targets suitable for one-handed mobile use
- **THEN** text is minimal and optimized for fast gate decisions

#### Scenario: Status colors are consistent
- **GIVEN** the app shows ticket, VIP, history, queue, or sync outcomes
- **WHEN** the outcome is success, invalid/error, duplicate/conflict, or offline/pending sync
- **THEN** success is shown in green
- **THEN** invalid or error is shown in red
- **THEN** duplicate or conflict is shown in orange
- **THEN** offline and pending sync are shown in blue or gray

### Requirement: Ticket validation outcomes are fully classified
The Check-in Mobile App SHALL classify ticket scan and manual input outcomes as valid, invalid, duplicate, wrong event, wrong gate, canceled, refunded, offline pending, failed sync, or conflict according to local preload and authoritative sync results.

#### Scenario: QR and manual ticket input classify detailed outcomes
- **GIVEN** Check-in Staff has selected an assigned event and gate
- **WHEN** staff scans a QR ticket or manually enters a ticket code
- **THEN** the app validates the attempt against selected event, assigned gate, local preload, local history, and available sync outcomes
- **THEN** the app distinguishes valid, invalid, duplicate, wrong event, wrong gate, canceled, and refunded tickets
- **THEN** offline accepted records are shown as Pending Sync until authoritative sync completes

## Specification: Mobile Offline Staff Check-in UX

## Description

The Check-in Mobile App SHALL provide Check-in Staff with offline-aware ticket validation, sync queue review, conflict handling, scan history, staff profile/settings, and consistent mobile-first UI states. The feature is used only by authenticated Check-in Staff with assignment to the selected concert or gate. It depends on the Android mobile app, Room Database, WorkManager, Backend API, PostgreSQL, and Redis-backed endpoint protection.

## Main Flow

1. Check-in Staff logs in, selects an assigned event and gate, and enters the mobile check-in shell.
2. The app observes connectivity and Room scan-log state to calculate network status, sync status, local cache status, and pending sync count.
3. If connectivity is lost, the app shows the offline mode notice and lets staff continue offline or inspect the sync queue.
4. Staff scans QR tickets or manually enters ticket codes using the latest assignment-scoped preload snapshot stored in Room.
5. The app writes every scan attempt to durable Room storage before showing success, invalid, duplicate, offline pending, failed, or conflict states.
6. Offline accepted scans show Status: Pending Sync until WorkManager uploads them to the Backend API.
7. The Backend API enforces Check-in Staff RBAC and assignment checks, applies authoritative PostgreSQL rules, and returns per-scan outcomes.
8. The app stores outcomes in Room, updates history and queue state, and routes conflicts to the Sync Conflict screen when staff opens the conflicted record.
9. Staff uses Scan History to search and filter recent records by status and ticket code.
10. Staff uses Profile to inspect identity, role, assigned event, gate, app version, sync status, local cache status, and logout.

## Failure Scenarios

- If the device loses internet, the app SHALL show Offline status, keep scanning from Room preload when possible, and retain pending records locally.
- If the preload snapshot is missing or too stale for a ticket or gate decision, the app SHALL show a clear invalid or refresh-required state rather than claiming authoritative success.
- If the Backend API times out, fails, or returns Redis rate limit `429`, the app SHALL keep local records pending or failed and allow retry.
- If PostgreSQL reports that another device already checked in the ticket or VIP guest, the app SHALL mark the local record Conflict and show local and server check-in times when available.
- If an Audience or Organizer account without Check-in Staff assignment attempts to use the app, Backend API preload and sync calls SHALL be denied.
- If staff logs out with pending records, the app SHALL preserve records locally but SHALL require a valid Check-in Staff session before future synchronization.

## Constraints

- Protected preload, scan synchronization, history sync, and assignment data access MUST require authenticated Check-in Staff role, check-in permission, and concert or gate assignment.
- Room Database MUST remain the local source for offline preload, pending records, queue records, and recent history.
- WorkManager MUST be used for retryable synchronization and MUST preserve idempotent local scan IDs.
- PostgreSQL MUST remain the authoritative source for final ticket status, VIP guest status, and check-in outcome.
- Redis MUST NOT be treated as final check-in authority.
- The app MUST not expose unassigned event data, purchase details, payment details, organizer reports, or revenue data.
- The UI MUST be mobile-first, high contrast, large tap target, minimal text, and color-coded by outcome state.

## Acceptance Criteria

#### Scenario: Staff accesses only assigned check-in features
- **GIVEN** an authenticated Check-in Staff user has assigned events or gates
- **WHEN** the staff member logs in
- **THEN** the app shows only assigned event and gate options
- **THEN** scan, manual input, VIP, history, sync, and profile views remain scoped to the selected assignment

#### Scenario: Staff selects an assigned event and gate
- **GIVEN** staff has at least one assignment
- **WHEN** staff selects an assigned event and gate
- **THEN** Dashboard, Scan, VIP, History, and Profile become available for that assignment

#### Scenario: Staff scans QR tickets
- **GIVEN** staff is on the Scan screen for the selected assignment
- **WHEN** a QR ticket is scanned
- **THEN** the app records the attempt locally and shows the correct result state

#### Scenario: Staff manually inputs ticket codes
- **GIVEN** QR scanning is unavailable or unreadable
- **WHEN** staff enters a ticket code manually
- **THEN** the app validates the code in the same selected event and gate context

#### Scenario: App distinguishes ticket states
- **GIVEN** local preload and sync outcome data include different ticket states
- **WHEN** staff scans or manually enters those tickets
- **THEN** the app distinguishes valid, invalid, duplicate, wrong event, wrong gate, canceled, and refunded tickets

#### Scenario: Offline check-in stores pending records locally
- **GIVEN** the device is offline with a usable preload snapshot
- **WHEN** staff accepts a locally valid ticket
- **THEN** the app stores a pending local record in Room and shows Pending Sync

#### Scenario: Pending records sync when network returns
- **GIVEN** pending offline records exist
- **WHEN** network connectivity returns and WorkManager sync runs
- **THEN** the app uploads pending records to the Backend API and updates each record to Synced, Conflict, or Failed according to the server outcome

#### Scenario: Sync conflicts are shown clearly
- **GIVEN** PostgreSQL rejects a local offline acceptance because another device already checked in the ticket
- **WHEN** staff opens the affected queue or history record
- **THEN** the app shows the Sync Conflict screen with local time, server time when available, Mark as Conflict, and Contact Supervisor

#### Scenario: Staff views and filters scan history
- **GIVEN** the selected assignment has scan records
- **WHEN** staff opens Scan History
- **THEN** staff can filter by All, Success, Invalid, Duplicate, Offline, and Conflict
- **THEN** staff can search by ticket code

#### Scenario: Staff logs out
- **GIVEN** staff is logged in
- **WHEN** staff selects Logout on Profile
- **THEN** the app clears the session and returns to login without deleting durable offline records
