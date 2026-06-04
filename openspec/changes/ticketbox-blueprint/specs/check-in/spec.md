## ADDED Requirements

### Requirement: Check-in staff can validate tickets online

The system SHALL allow Check-in Staff users with `checkin:scan` permission to validate ticket QR codes online through the backend before admitting an audience member.

#### Scenario: Online ticket scan is accepted

- **GIVEN** a valid issued ticket has not been checked in
- **AND** the Check-in Staff user has `checkin:scan` permission for the concert or gate
- **WHEN** the staff scans the ticket QR code while the device is online
- **THEN** the backend MUST validate the ticket signature, ticket status, concert assignment, and check-in status
- **AND** the backend MUST mark the ticket as checked in
- **AND** the app MUST show an accepted result

#### Scenario: Online duplicate ticket scan is rejected

- **GIVEN** a ticket has already been checked in
- **WHEN** Check-in Staff scans the same ticket QR code while online
- **THEN** the backend MUST reject the scan as duplicate
- **AND** the app MUST show a duplicate warning

### Requirement: Check-in staff can validate entries offline

The system SHALL allow Check-in Staff users with `checkin:scan` permission to validate ticket QR codes and VIP guest-list entries using a pre-downloaded local SQLite/WatermelonDB event package when network connectivity is weak or unavailable.

#### Scenario: Offline ticket scan is locally accepted

- **GIVEN** the mobile app has downloaded a valid event package and the device is offline
- **WHEN** Check-in Staff scans an unused ticket QR code
- **THEN** the app MUST mark the scan locally accepted and persist the scan log durably for later sync

#### Scenario: Same device scans duplicate ticket offline

- **GIVEN** a ticket QR code was already scanned on the same device
- **WHEN** Check-in Staff scans the same QR code again while offline
- **THEN** the app MUST show a duplicate warning and MUST NOT create a second accepted local entry

#### Scenario: Offline VIP guest-list entry is locally accepted

- **GIVEN** the mobile app has downloaded a valid event package containing VIP guest-list entries
- **AND** the device is offline
- **WHEN** Check-in Staff searches for and validates an unused VIP guest-list entry
- **THEN** the app MUST mark the VIP check-in locally accepted
- **AND** the app MUST persist the VIP scan or validation log durably for later sync

### Requirement: Offline scan synchronization resolves conflicts

The system SHALL allow Check-in Staff users with `checkin:sync` permission to upload offline scan logs and SHALL enforce one successful check-in per ticket in PostgreSQL.

#### Scenario: Two devices scanned the same ticket offline

- **GIVEN** two offline devices accepted the same ticket QR code locally
- **WHEN** both devices synchronize scan logs to `POST /check-in/sync`
- **THEN** the backend MUST accept the first valid scan, reject the later scan as duplicate, and return conflict status to the later device

#### Scenario: Sync request is interrupted

- **GIVEN** a device has pending offline scan logs
- **WHEN** network connectivity fails during synchronization
- **THEN** the app MUST keep unsynchronized logs locally and retry without losing accepted local scans
