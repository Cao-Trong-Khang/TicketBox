## ADDED Requirements

### Requirement: Offline gate check-in
TicketBox SHALL provide an offline-capable gate check-in workflow for Check-in Staff using the Check-in Mobile App, Backend API, PostgreSQL, and Redis-backed API protection.

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
