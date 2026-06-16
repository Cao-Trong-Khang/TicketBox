## ADDED Requirements

### Requirement: Mobile VIP guest dashboard uses imported CSV guests
The Check-in Mobile App SHALL provide a VIP Guest List dashboard for Check-in Staff using accepted VIP guests imported from scheduled CSV files and delivered through assignment-scoped preload data.

#### Scenario: VIP dashboard shows summary and guest rows
- **GIVEN** accepted VIP guests from scheduled CSV import are included in the selected assignment preload
- **WHEN** Check-in Staff opens the VIP dashboard
- **THEN** the app shows summary cards for Total VIP guests, Checked-in VIP guests, and Remaining VIP guests
- **THEN** guest rows show name, sponsor or company, guest type, and check-in status
- **THEN** the list is scoped to the selected assigned event and gate

#### Scenario: VIP dashboard supports search and filters
- **GIVEN** the VIP dashboard contains imported guest records
- **WHEN** staff searches or filters the list
- **THEN** the app supports search by guest name, phone, email, or invite code
- **THEN** the app supports filters by sponsor, guest type, and check-in status
- **THEN** search and filters operate on locally preloaded Room data when offline

### Requirement: Mobile VIP guest metadata is available for check-in
TicketBox SHALL preserve the VIP guest metadata needed for mobile check-in from accepted CSV import data through PostgreSQL, assignment-scoped preload, and Room storage.

#### Scenario: Preload includes VIP display and search metadata
- **GIVEN** a scheduled CSV import accepted VIP guests with display and search metadata
- **WHEN** assigned Check-in Staff preloads the selected event or gate
- **THEN** the Backend API includes guest name, phone, email, sponsor or invited-by value, sponsor or company value, guest type, allowed gate, invite code, check-in status, and notes when available
- **THEN** the mobile app stores those fields in Room for offline search, filters, and detail display

#### Scenario: Optional VIP metadata can be absent
- **GIVEN** a CSV guest row lacks optional metadata such as notes, guest type, or allowed gate
- **WHEN** the guest appears in the mobile VIP flow
- **THEN** the app still allows lookup by available identity fields
- **THEN** missing optional metadata does not block check-in if the guest is otherwise valid for the selected assignment

### Requirement: VIP guest detail and confirmation
The Check-in Mobile App SHALL show a VIP guest detail screen and require staff confirmation before recording a VIP check-in.

#### Scenario: VIP detail shows guest and assignment information
- **GIVEN** staff selects a guest from the VIP dashboard or search results
- **WHEN** the VIP guest detail screen opens
- **THEN** the app displays guest name, phone or email, sponsor or invited-by value, guest type, allowed gate, check-in status, and notes
- **THEN** staff can confirm VIP check-in when the guest is valid for the selected assignment

#### Scenario: VIP check-in confirmation records a local scan
- **GIVEN** a VIP guest is valid for the selected event and gate
- **WHEN** staff confirms VIP check-in
- **THEN** the app writes a durable local scan log for the VIP guest
- **THEN** the record is synchronized through the existing offline check-in sync workflow when online

### Requirement: VIP check-in result states
The Check-in Mobile App SHALL provide explicit success, duplicate, and not-found result screens for VIP guest check-in.

#### Scenario: VIP check-in success is shown
- **GIVEN** staff confirms a VIP guest who is valid and not already checked in
- **WHEN** the app records the VIP check-in
- **THEN** the app shows a green success state
- **THEN** the screen displays guest name, guest type, check-in time, and gate
- **THEN** the screen provides a Check in next VIP guest action

#### Scenario: Already checked-in VIP guest shows duplicate warning
- **GIVEN** a VIP guest has already been checked in locally or according to synchronized server state
- **WHEN** staff searches for or attempts to check in that guest again
- **THEN** the app shows a duplicate warning state
- **THEN** the app explains that the guest was already checked in
- **THEN** the screen provides Search Again and Contact Supervisor actions

#### Scenario: Unknown VIP guest shows not-found warning
- **GIVEN** staff searches for a name, phone, email, or invite code that is not in the assignment-scoped VIP preload
- **WHEN** no matching VIP guest is found
- **THEN** the app shows a guest not found warning state
- **THEN** the screen provides Search Again and Contact Supervisor actions

## Specification: Mobile VIP CSV Guest Check-in

## Description

The Check-in Mobile App SHALL let authenticated Check-in Staff search, filter, review, and check in VIP guests that were imported from scheduled sponsor CSV files and delivered through assignment-scoped preload data. Organizer users remain responsible for import review in the web/admin workflow, while Check-in Staff only use accepted active guest records for gate operation. Audience users do not interact with this feature.

## Main Flow

1. Sponsor VIP guest data is imported through the existing scheduled CSV import workflow into PostgreSQL.
2. Check-in Staff logs into the Android mobile app and selects an assigned event and gate.
3. The Backend API returns assignment-scoped preload data containing accepted active VIP guests for that event or gate.
4. The mobile app stores VIP guest records and metadata in Room for offline search, filtering, and check-in.
5. Staff opens the VIP dashboard and reviews Total, Checked-in, and Remaining VIP counts.
6. Staff searches by guest name, phone, email, or invite code and filters by sponsor, guest type, or check-in status.
7. Staff opens VIP guest detail, verifies guest identity and assignment information, and confirms check-in.
8. The app records the VIP check-in as a durable local scan log and synchronizes through the existing Backend API sync workflow.
9. The app shows success, duplicate, or not-found result states and stores outcomes in history.

## Failure Scenarios

- If the device is offline, VIP search, filters, detail display, and local check-in SHALL use the latest assignment-scoped Room preload.
- If a guest is not present in the assignment-scoped preload, the app SHALL show the VIP not-found state rather than querying sponsor systems.
- If a guest was already checked in locally or by a synchronized server outcome, the app SHALL show the duplicate warning state and SHALL NOT create another successful VIP check-in.
- If PostgreSQL later reports a cross-device duplicate or conflict for an offline VIP check-in, the app SHALL update the local record to Conflict through the offline sync workflow.
- If the Check-in Staff user is not assigned to the event or gate, the Backend API SHALL deny preload and sync access to those VIP guest records.
- If optional VIP metadata is missing from the CSV import, the app SHALL display available fields and SHALL NOT fail the guest list screen solely because optional metadata is absent.

## Constraints

- VIP guest data used by the mobile app MUST originate from the scheduled CSV import workflow and PostgreSQL, not from direct sponsor APIs, sponsor webhooks, or sponsor databases.
- Check-in Staff MUST receive VIP guest records only through assignment-scoped preload for assigned concerts or gates.
- Protected VIP preload and VIP check-in synchronization MUST require authenticated Check-in Staff role, check-in permission, and assignment.
- PostgreSQL MUST remain the authoritative source for VIP guest validity and final check-in state.
- Each successful VIP guest check-in MUST be unique per `vip_guest_id`.
- Room Database MUST preserve preloaded VIP guests and local VIP check-in logs for offline operation.
- The mobile app MUST NOT expose organizer import reports, row-level CSV errors, payment details, purchase details, or unassigned event VIP guests to Check-in Staff.

## Acceptance Criteria

#### Scenario: Staff searches imported VIP guests
- **GIVEN** accepted CSV-imported VIP guests are preloaded for the selected assignment
- **WHEN** staff searches by guest name, phone, email, or invite code
- **THEN** the app shows matching VIP guests from the local assignment-scoped guest list

#### Scenario: Staff filters VIP guests
- **GIVEN** the VIP guest list contains sponsors, guest types, and check-in statuses
- **WHEN** staff applies sponsor, guest type, or status filters
- **THEN** the app shows only matching VIP guest rows

#### Scenario: Staff confirms VIP check-in
- **GIVEN** a VIP guest is valid for the selected event and gate
- **WHEN** staff confirms check-in on the VIP detail screen
- **THEN** the app records the check-in locally and shows the green success state

#### Scenario: VIP duplicate is blocked
- **GIVEN** a VIP guest has already been checked in
- **WHEN** staff tries to check in that guest again
- **THEN** the app shows the duplicate warning state
- **THEN** no second successful VIP check-in is created

#### Scenario: VIP guest not found is handled
- **GIVEN** staff searches for a guest absent from the preloaded VIP list
- **WHEN** search returns no match
- **THEN** the app shows the not-found warning state with Search Again and Contact Supervisor actions

#### Scenario: VIP check-in works offline
- **GIVEN** the device is offline and has preloaded VIP guests
- **WHEN** staff confirms a valid VIP guest check-in
- **THEN** the app stores the VIP check-in as Pending Sync
- **THEN** the app synchronizes the record when network connectivity returns
