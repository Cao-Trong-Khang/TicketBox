## ADDED Requirements

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

## Specification: Mobile Staff Check-in App Refactor

## Description

The Check-in Mobile App SHALL be a native Android app for Check-in Staff working at concert gates. It SHALL support staff login, assignment-scoped event selection, QR ticket scanning, manual ticket-code fallback, VIP guest access, scan history, profile/session actions, offline operation, and explicit valid/invalid/duplicate result states. Audience users and Organizer users SHALL NOT use this mobile staff workflow unless they also hold the required Check-in Staff role and assignment.

## Main Flow

1. A Check-in Staff user opens the Android mobile app and logs in with email or phone and password.
2. The app authenticates with the Backend API and stores the staff session locally.
3. The app fetches assigned events and gates from the Backend API.
4. Staff select one assigned event before entering the bottom-navigation shell.
5. The app downloads or reuses a Room Database preload snapshot for the selected event.
6. Staff use Dashboard to review event/gate status, check-in counts, VIP count, network state, sync state, and pending offline records.
7. Staff scan QR tickets through the Scan tab or enter ticket codes through Manual Input.
8. The app validates the attempt against local Room data, local scan history, selected event, and gate context.
9. The app shows a valid, invalid, or duplicate result screen with the required state color and actions.
10. Valid confirmations, invalid attempts, and duplicate attempts are stored in durable local scan history.
11. WorkManager synchronizes pending scan logs with the Backend API when online.
12. The Backend API enforces Check-in Staff permissions and assignment scope, then PostgreSQL determines final check-in validity.

## Failure Scenarios

- Invalid credentials produce an invalid-login error and do not expose assigned events.
- Authenticated users without Check-in Staff role, check-in permissions, or assignment see a permission error and cannot scan or sync.
- Network loss shows Offline status, preserves local scanning using the latest preload snapshot, and retains pending records in Room.
- Missing or stale preload data prevents unsupported validation and prompts staff to refresh when network is available.
- QR camera failure or unreadable QR payload allows manual ticket-code input.
- Ticket not found, wrong event, wrong gate, canceled ticket, and refunded ticket route to invalid result states.
- Already checked-in tickets route to the duplicate result state and cannot be confirmed again.
- Backend sync conflicts or cross-device duplicates update local history with authoritative duplicate or conflict outcomes.

## Constraints

- The app MUST be for Check-in Staff at concert gates and MUST NOT include web admin screens.
- The app MUST use bottom navigation with Dashboard, Scan, VIP, History, and Profile after event selection.
- Staff MUST select an assigned event before scanning, manual input, VIP list access, or event history access.
- Protected Backend API calls MUST use authenticated staff credentials and MUST remain scoped by Check-in Staff role, check-in permissions, and concert or gate assignment.
- Room Database MUST preserve preload snapshots and local scan logs for offline operation.
- PostgreSQL MUST remain the authoritative source after sync for ticket status, VIP guest status, and final check-in status.
- Redis MUST NOT be treated as final check-in authority.
- The mobile UI MUST prioritize fast gate operation with large tap targets, minimal text, and clear valid/invalid/duplicate state colors.

## Acceptance Criteria

#### Scenario: Staff completes assigned-event login flow
- **GIVEN** valid Check-in Staff credentials and at least one assigned event
- **WHEN** staff logs in and assigned events load
- **THEN** the app shows event cards with event name, date, venue, assigned gate, and status
- **THEN** staff can select one event and enter the bottom-navigation check-in area

#### Scenario: Dashboard supports gate readiness
- **GIVEN** staff selected an assigned event with a preload snapshot
- **WHEN** staff opens Dashboard
- **THEN** event name, venue, current gate, total tickets, checked-in count, remaining count, VIP guest count, network status, sync status, and pending offline count are visible

#### Scenario: QR scan produces correct result state
- **GIVEN** staff scans a QR ticket in the selected event
- **WHEN** local validation completes
- **THEN** the app routes to valid, invalid, or duplicate result according to ticket validity and local scan history

#### Scenario: Manual ticket input produces correct result state
- **GIVEN** QR scanning fails
- **WHEN** staff enters a ticket code manually
- **THEN** the app validates the code and routes to valid, invalid, or duplicate result

#### Scenario: Duplicate ticket cannot be checked in again
- **GIVEN** a ticket was already checked in
- **WHEN** staff scans or manually enters the same ticket
- **THEN** the app shows the duplicate warning state with previous check-in details when available
- **THEN** the app prevents duplicate check-in confirmation
