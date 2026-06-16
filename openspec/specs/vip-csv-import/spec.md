# vip-csv-import Specification

## Purpose
Define the scheduled one-way sponsor VIP CSV import workflow, reporting, and check-in availability rules.
## Requirements
### Requirement: Scheduled sponsor VIP CSV files are imported asynchronously
TicketBox SHALL import sponsor VIP guest lists from scheduled CSV files through the Backend API, Kafka, Background Workers, and PostgreSQL without requiring a sponsor API or manual upload flow.

#### Scenario: Scheduled import completes without blocking live APIs
- **GIVEN** a scheduled sponsor CSV file exists for a concert
- **WHEN** the scheduler enqueues the import and the worker processes the file
- **THEN** valid unique VIP guests are stored in PostgreSQL
- **THEN** public browsing, checkout, payment, and check-in APIs remain available

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
