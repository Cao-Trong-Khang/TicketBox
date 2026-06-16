## Purpose

Define the offline-capable venue gate check-in workflow for assigned Check-in Staff using the Android mobile app, Backend API, PostgreSQL, and Redis-backed API protection.

## Requirements

### Requirement: Offline gate check-in
TicketBox SHALL provide an offline-capable gate check-in workflow for Check-in Staff using the Check-in Mobile App, Backend API, PostgreSQL, and Redis-backed API protection.

#### Scenario: Staff preloads assigned event data
- **GIVEN** an authenticated Check-in Staff user is assigned to a concert or gate
- **WHEN** the Check-in Mobile App requests preload data for that assignment
- **THEN** the Backend API returns only validation data for that assigned concert or gate
- **THEN** the app stores the snapshot in Room Database with a version or generated timestamp

#### Scenario: Offline valid ticket scan is recorded locally
- **GIVEN** the app has a preload snapshot containing a valid issued ticket
- **AND** the device has no network connectivity
- **WHEN** staff scans that ticket QR code
- **THEN** the app validates it against local Room data
- **THEN** the app writes a pending local scan log before showing the accepted local result

#### Scenario: Pending scans synchronize when online
- **GIVEN** the app has pending local scan logs
- **WHEN** network connectivity is restored and the app calls the sync API
- **THEN** the Backend API validates RBAC, assignment, and scan payloads
- **THEN** accepted scans are persisted in PostgreSQL `check_ins`
- **THEN** the API returns one outcome per local scan
- **THEN** the app stores those outcomes and marks accepted or rejected logs as synchronized

### Requirement: Staff mobile authentication and assigned event selection
The Check-in Mobile App SHALL require Check-in Staff to log in with email or phone and password, show distinct invalid-login and non-staff permission errors, and require staff to select one assigned event before check-in actions are available.

#### Scenario: Staff logs in successfully
- **GIVEN** a Check-in Staff account with valid credentials
- **WHEN** the staff member submits email or phone and password on the mobile login screen
- **THEN** the app authenticates through the Backend API
- **THEN** the app stores the staff session locally for subsequent assignment, preload, scan, and sync requests

#### Scenario: Invalid login is rejected
- **GIVEN** a staff member enters invalid credentials
- **WHEN** the app receives an authentication failure from the Backend API
- **THEN** the app shows an invalid login error
- **THEN** the app does not show assigned events or check-in navigation

#### Scenario: Non-staff account is denied
- **GIVEN** an authenticated account does not have the Check-in Staff role or required check-in permissions
- **WHEN** the account attempts to use the mobile check-in app
- **THEN** the app shows a permission error stating that a Check-in Staff account is required
- **THEN** the app does not allow event preload, scanning, manual input, VIP lookup, or sync

#### Scenario: Assigned events are listed
- **GIVEN** a logged-in Check-in Staff user has one or more assigned concerts or gates
- **WHEN** the app loads assigned events
- **THEN** each event card shows event name, date, venue, assigned gate, and status
- **THEN** the staff member can select one assigned event before starting check-in

#### Scenario: Unassigned events are inaccessible
- **GIVEN** a logged-in Check-in Staff user is not assigned to a concert or gate
- **WHEN** the staff member attempts to access that event in the app
- **THEN** the app does not make check-in actions available for the unassigned event
- **THEN** Backend API preload and sync assignment checks still deny unauthorized access

### Requirement: Staff mobile bottom navigation and event dashboard
After an assigned event is selected, the Check-in Mobile App SHALL provide bottom navigation with Dashboard, Scan, VIP, History, and Profile tabs, and the Dashboard SHALL summarize the selected event and operational check-in status.

#### Scenario: Bottom navigation is shown after event selection
- **GIVEN** a Check-in Staff user has selected an assigned event
- **WHEN** the app enters the event check-in area
- **THEN** bottom navigation shows Dashboard, Scan, VIP, History, and Profile tabs
- **THEN** each tab remains scoped to the selected event and assigned gate

#### Scenario: Dashboard shows event and gate summary
- **GIVEN** a selected assigned event has a preload snapshot or cached event metadata
- **WHEN** the staff member opens Dashboard
- **THEN** the app shows event name, venue, and current gate
- **THEN** the app shows total tickets, checked-in count, remaining count, and VIP guest count

#### Scenario: Dashboard shows connectivity and sync state
- **GIVEN** the app has local scan logs and network status information
- **WHEN** the staff member opens Dashboard
- **THEN** the app shows network status as Online or Offline
- **THEN** the app shows sync status and pending offline record count

#### Scenario: Dashboard exposes primary gate actions
- **GIVEN** a selected assigned event is ready for check-in
- **WHEN** the staff member opens Dashboard
- **THEN** the app shows large-tap-target actions for Start QR Scan, VIP Guest List, and Scan History
- **THEN** each action navigates to the corresponding bottom-tab destination or flow

### Requirement: Staff ticket scanning and manual input
The Check-in Mobile App SHALL let Check-in Staff scan QR tickets, toggle flash, manually enter ticket codes when QR scan fails, and validate each attempt against the selected event and assigned gate context.

#### Scenario: QR scanner shows selected event context
- **GIVEN** a Check-in Staff user has selected an assigned event
- **WHEN** the staff member opens the Scan tab
- **THEN** the scanner screen shows the camera QR scan area
- **THEN** the scanner screen displays the current event and gate
- **THEN** the scanner screen includes flash toggle, manual input button, and network indicator

#### Scenario: QR scan routes to validation result
- **GIVEN** the scanner reads a QR payload for the selected event
- **WHEN** the app validates the payload against local preload data and local scan history
- **THEN** the app navigates to a valid, invalid, or duplicate ticket result state
- **THEN** the app records the scan attempt in durable local storage according to offline check-in rules

#### Scenario: Manual ticket code can be validated
- **GIVEN** QR scanning fails or cannot read the ticket
- **WHEN** the staff member opens manual input and enters a ticket code
- **THEN** the app validates the ticket code for the selected event and assigned gate context
- **THEN** the app navigates to a valid, invalid, or duplicate ticket result state

#### Scenario: Scan and manual validation are optimized for fast gate operation
- **GIVEN** staff are processing attendees at a concert gate
- **WHEN** they use Scan, Manual Input, or result actions
- **THEN** the app presents large tap targets, short labels, and minimal explanatory text
- **THEN** the app keeps next-scan recovery actions visible without requiring deep navigation

### Requirement: Ticket validation result states are explicit
The Check-in Mobile App SHALL clearly separate valid, invalid, and duplicate ticket result states and SHALL prevent duplicate check-in confirmation.

#### Scenario: Valid ticket result shows success details
- **GIVEN** a scanned or manually entered ticket is valid for the selected event and assigned gate
- **WHEN** the app shows the valid ticket result screen
- **THEN** the app shows a green success state
- **THEN** the app displays ticket code, attendee name, ticket type, zone or seat, event name, and gate
- **THEN** the staff member can confirm check-in
- **THEN** after confirmation the app allows scanning the next ticket

#### Scenario: Invalid ticket result shows specific reason
- **GIVEN** a scanned or manually entered ticket is not valid for check-in
- **WHEN** the app shows the invalid ticket result screen
- **THEN** the app shows a red error state
- **THEN** the app distinguishes ticket not found, wrong event, wrong gate, canceled ticket, and refunded ticket cases
- **THEN** the app offers Scan Again and Manual Input actions

#### Scenario: Duplicate ticket result prevents second check-in
- **GIVEN** a scanned or manually entered ticket has already been checked in
- **WHEN** the app shows the duplicate ticket result screen
- **THEN** the app shows an orange warning state
- **THEN** the app displays that the ticket has already been checked in
- **THEN** the app shows previous check-in time, gate, and staff name when available
- **THEN** the app prevents duplicate check-in confirmation
- **THEN** the app offers Scan Next

### Requirement: Staff VIP, history, and profile tabs support gate operations
The Check-in Mobile App SHALL provide VIP, History, and Profile tabs that remain scoped to the selected assigned event and support fast staff gate operation.

#### Scenario: VIP tab shows assigned event VIP guests
- **GIVEN** the selected event preload includes VIP guest-list entries
- **WHEN** the staff member opens the VIP tab
- **THEN** the app shows VIP guests available to the assigned event or gate
- **THEN** the app does not expose VIP guests from unassigned events

#### Scenario: History tab shows recent scan outcomes
- **GIVEN** the app has local scan logs or synchronized outcomes for the selected event
- **WHEN** the staff member opens the History tab
- **THEN** the app shows recent valid, invalid, duplicate, pending, and synced scan outcomes
- **THEN** the app keeps history scoped to the selected event and gate

#### Scenario: Profile tab shows staff and session actions
- **GIVEN** a Check-in Staff user is logged in
- **WHEN** the staff member opens the Profile tab
- **THEN** the app shows staff identity, selected device or gate context, and session status
- **THEN** the app provides a logout action that clears local session credentials without deleting durable offline scan logs

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

## Specification: Offline Gate Check-in

## Description

Check-in Staff use the native Android Check-in Mobile App to scan QR-code e-tickets and VIP guest-list entries at assigned concert gates. The app SHALL work when online, under unstable connectivity, or fully offline by using preloaded validation data and durable Room Database scan logs. PostgreSQL SHALL remain the authoritative source for final ticket, VIP guest, and check-in status after synchronization.

Protected actions require the Check-in Staff role and check-in permissions for the assigned concert or gate. Audience users and Organizer users SHALL NOT be allowed to preload check-in data, scan as staff, or synchronize check-in logs unless they also have the required Check-in Staff assignment.

## Main Flow

1. A Check-in Staff user authenticates in the Check-in Mobile App.
2. The app calls the Backend API to fetch the staff user's assigned concerts or gates.
3. The app downloads a preload snapshot for an assigned concert or gate, including validation-minimal ticket records, VIP guest-list records, event metadata, and snapshot version or generated timestamp.
4. The app stores the preload snapshot in Room Database for offline lookup.
5. The staff user scans a QR-code e-ticket or VIP guest-list code at the gate.
6. The app validates the scanned payload against local Room data and local duplicate-scan history.
7. The app writes a durable local scan log before showing the local scan result.
8. If the device is online, the app attempts to synchronize pending scan logs to the Backend API.
9. The Backend API authenticates the staff user, enforces RBAC and assignment checks, validates the scan batch, and applies authoritative check-in rules in PostgreSQL.
10. PostgreSQL records accepted check-ins and preserves duplicate, invalid, expired, unauthorized, or conflict outcomes.
11. Redis may rate-limit preload and sync endpoints, but Redis SHALL NOT determine final check-in validity.
12. The Backend API returns one sync outcome per local scan, and the mobile app stores the outcome in Room for staff review and retry handling.

## Failure Scenarios

- If the device has no network, the app SHALL continue scanning with the latest valid preload snapshot and keep scan logs pending in Room.
- If the Backend API times out during synchronization, the app SHALL keep unsynchronized logs and retry later without creating duplicate authoritative check-ins.
- If Redis rate limiting returns `429` for sync, the app SHALL keep local logs pending and retry after the indicated delay.
- If the authenticated user lacks the Check-in Staff role, required permission, or assignment for the target concert or gate, the Backend API SHALL deny preload and sync requests.
- If a QR payload is malformed, unsigned, unknown, cancelled, expired, or not part of the assigned event snapshot, the app SHALL record the scan attempt and show an invalid local result.
- If two devices scan the same valid ticket or VIP guest offline, the backend SHALL accept only the first valid synchronized scan and mark later synchronized scans as duplicate or conflict outcomes.
- If the same device uploads the same local scan more than once because of retry, the backend SHALL return the original outcome idempotently.
- If Kafka is unavailable, the sync API SHALL still accept or reject scans based on PostgreSQL; asynchronous analytics or projections may be delayed.
- If the preload snapshot is stale, the mobile app MAY show a local result from the snapshot, but final sync outcome from PostgreSQL SHALL override the local result.

## Constraints

- PostgreSQL MUST remain the source of truth for ticket ownership, VIP guest validity, and final check-in status.
- Redis MUST only be used for endpoint protection or temporary coordination, not as authoritative check-in state.
- Each successful ticket check-in MUST be unique per `ticket_id`.
- Each successful VIP guest check-in MUST be unique per `vip_guest_id`.
- Scan synchronization MUST be idempotent by mobile-generated local scan ID and source device ID.
- The mobile app MUST write a scan log to durable local storage before presenting a local scan result.
- Preload data MUST be scoped to the authenticated staff user's assigned concerts or gates and MUST avoid exposing payment, order, or organizer-only details.
- Sync APIs MUST enforce authentication, Check-in Staff role, check-in permission, and concert or gate assignment at the API boundary and in domain logic.
- The feature MUST run in the local Docker Compose development stack for the Backend API, PostgreSQL, Redis, and Kafka.
- The feature MUST NOT interact with VNPAY/MoMo, Email Provider, AI Model, or Sponsor CSV Files.

## Acceptance Criteria

#### Scenario: Staff preloads assigned event data
- **GIVEN** an authenticated Check-in Staff user is assigned to a concert or gate
- **WHEN** the Check-in Mobile App requests preload data for that assignment
- **THEN** the Backend API returns only validation data for that assigned concert or gate
- **THEN** the app stores the snapshot in Room Database with a version or generated timestamp

#### Scenario: Unauthorized user cannot preload check-in data
- **GIVEN** an authenticated Audience or Organizer user without Check-in Staff assignment
- **WHEN** the user requests check-in preload data
- **THEN** the Backend API rejects the request with an authorization failure

#### Scenario: Offline valid ticket scan is recorded locally
- **GIVEN** the app has a preload snapshot containing a valid issued ticket
- **AND** the device has no network connectivity
- **WHEN** staff scans that ticket QR code
- **THEN** the app validates it against local Room data
- **THEN** the app writes a pending local scan log before showing the accepted local result

#### Scenario: Offline duplicate on same device is detected
- **GIVEN** the app has already recorded a local scan for a ticket
- **WHEN** staff scans the same ticket again on the same device
- **THEN** the app records the scan attempt
- **THEN** the app shows a duplicate local result without deleting the original scan log

#### Scenario: Pending scans synchronize when online
- **GIVEN** the app has pending local scan logs
- **WHEN** network connectivity is restored and the app calls the sync API
- **THEN** the Backend API validates RBAC, assignment, and scan payloads
- **THEN** accepted scans are persisted in PostgreSQL `check_ins`
- **THEN** the API returns one outcome per local scan
- **THEN** the app stores those outcomes and marks accepted or rejected logs as synchronized

#### Scenario: Cross-device offline conflict is resolved by backend
- **GIVEN** two assigned devices scanned the same valid ticket while offline
- **WHEN** both devices later synchronize their scan logs
- **THEN** PostgreSQL allows only one successful check-in for the ticket
- **THEN** the later scan receives a duplicate or conflict outcome

#### Scenario: Sync retry is idempotent
- **GIVEN** a device synchronized a local scan but did not receive the response because the network failed
- **WHEN** the device retries the same local scan ID from the same source device ID
- **THEN** the Backend API returns the original outcome
- **THEN** no duplicate successful check-in is created

#### Scenario: Rate-limited sync remains retryable
- **GIVEN** Redis rate limiting rejects a sync request with `429`
- **WHEN** the app receives the rate-limit response
- **THEN** the app keeps all affected scan logs pending
- **THEN** the app retries synchronization later without losing scans

#### Scenario: Kafka outage does not block final check-in validation
- **GIVEN** Kafka is unavailable during sync
- **WHEN** the app uploads pending scan logs
- **THEN** the Backend API still persists accepted or rejected scan outcomes in PostgreSQL
- **THEN** any asynchronous analytics or projection event can be retried later without changing the check-in result
