## 1. Data and API Contracts

- [x] 1.1 Audit existing `mobile-checkin` Room entities, DAOs, repository models, and check-in API DTOs for fields needed by offline notice, sync queue, scan history, conflict review, VIP detail, and profile status. Covers AC: Staff accesses only assigned check-in features, Sync conflicts are shown clearly, Staff searches imported VIP guests.
- [x] 1.2 Extend local Room models and migrations for missing display/search fields such as ticket code, gate, sync status, backend conflict message, server check-in time, VIP phone/email, sponsor/company, invited-by, guest type, allowed gate, invite code, and notes. Covers AC: Staff views and filters scan history, VIP detail shows guest and assignment information, VIP check-in works offline.
- [x] 1.3 Extend Backend API preload DTOs and mobile DTO mapping to return only assignment-scoped ticket display data and accepted VIP metadata needed by the mobile screens. Covers AC: Staff accesses only assigned check-in features, Staff searches imported VIP guests, Staff filters VIP guests.
- [x] 1.4 Extend sync outcome DTO mapping and local persistence for Pending, Synced, Conflict, and Failed states, including backend result code, message, synced time, and server check-in time when available. Covers AC: Pending records sync when network returns, Sync conflicts are shown clearly.
- [x] 1.5 Add or update local Docker Compose seed/demo data for assigned staff, gates, valid tickets, invalid statuses, duplicate tickets, canceled/refunded tickets, VIP guests with metadata, already checked-in VIP guests, and cross-device conflict examples. Covers AC: App distinguishes ticket states, VIP duplicate is blocked, VIP guest not found is handled.

## 2. Mobile State and Repository

- [x] 2.1 Add connectivity and sync-state models that expose Online, Offline, Pending Sync, Syncing, Synced, Conflict, and Failed states to view models. Covers AC: Offline check-in stores pending records locally, Pending records sync when network returns.
- [x] 2.2 Add repository methods and DAO queries for pending sync count, sync queue records, retryable records, conflict records, and selected assignment network/cache status. Covers AC: Offline check-in stores pending records locally, Sync conflicts are shown clearly.
- [x] 2.3 Add repository methods and DAO queries for scan history filtering by All, Success, Invalid, Duplicate, Offline, and Conflict, plus ticket-code search scoped to event and gate. Covers AC: Staff views and filters scan history.
- [x] 2.4 Add repository methods and DAO queries for VIP dashboard counts, VIP search by name/phone/email/invite code, and VIP filters by sponsor, guest type, and check-in status. Covers AC: Staff searches imported VIP guests, Staff filters VIP guests.
- [x] 2.5 Wire Retry Sync to the existing WorkManager sync path with retry/backoff handling that preserves records on timeout, backend failure, or Redis `429`. Covers AC: Pending records sync when network returns.
- [x] 2.6 Ensure logout clears session credentials without deleting Room scan logs, queue records, conflict records, or preload cache. Covers AC: Staff logs out.

## 3. Shared UI Components and Status Styling

- [x] 3.1 Build reusable Compose components for Event Card, Status Badge, Ticket Result Card, Search Bar, Primary Button, Secondary Button, and Sync Status Banner. Covers AC: Staff accesses only assigned check-in features.
- [x] 3.2 Apply the status color system across ticket, VIP, queue, history, and sync surfaces: green success, red invalid/error, orange duplicate/conflict, blue or gray offline/pending. Covers AC: App distinguishes ticket states, VIP duplicate is blocked.
- [x] 3.3 Verify mobile-first layout rules for high contrast, large tap targets, short labels, and minimal explanatory text on all new screens. Covers AC: Staff scans QR tickets, Staff manually inputs ticket codes.

## 4. Offline and Sync Screens

- [x] 4.1 Implement the Offline Mode Notice screen with pending sync count, Continue Offline, and View Sync Queue actions triggered by connectivity loss. Covers AC: Offline check-in stores pending records locally.
- [x] 4.2 Implement the Offline Scan Result screen with Pending Sync status, ticket code, attendee details when available, final-validation warning, and Scan Next action. Covers AC: Staff scans QR tickets, Staff manually inputs ticket codes, Offline check-in stores pending records locally.
- [x] 4.3 Implement the Sync Queue screen listing offline records with code, scan time, Pending/Synced/Conflict/Failed status, network status, and Retry Sync action. Covers AC: Pending records sync when network returns.
- [x] 4.4 Implement the Sync Conflict screen with conflict warning, local check-in time, server check-in time when available, Mark as Conflict, and Contact Supervisor actions. Covers AC: Sync conflicts are shown clearly.
- [x] 4.5 Route queue and history conflict records to the Sync Conflict screen and keep non-conflict failed records retryable. Covers AC: Sync conflicts are shown clearly, Pending records sync when network returns.

## 5. Ticket History and Profile

- [x] 5.1 Implement Scan History with All, Success, Invalid, Duplicate, Offline, and Conflict filters scoped to the selected event and gate. Covers AC: Staff views and filters scan history.
- [x] 5.2 Add ticket-code search to Scan History while preserving the active filter selection. Covers AC: Staff views and filters scan history.
- [x] 5.3 Ensure QR scan and manual ticket-code flows classify valid, invalid, duplicate, wrong event, wrong gate, canceled, refunded, offline pending, failed sync, and conflict outcomes. Covers AC: Staff scans QR tickets, Staff manually inputs ticket codes, App distinguishes ticket states.
- [x] 5.4 Implement Staff Profile and Settings with staff name, role, assigned event, current gate, app version, sync status, local cache status, and logout. Covers AC: Staff logs out.

## 6. VIP Guest Check-in

- [x] 6.1 Implement the VIP Guest List dashboard with Total VIP guests, Checked-in VIP guests, Remaining VIP guests, and rows showing name, sponsor/company, guest type, and status. Covers AC: Staff searches imported VIP guests, Staff filters VIP guests.
- [x] 6.2 Implement VIP search by guest name, phone, email, or invite code using local preloaded Room data. Covers AC: Staff searches imported VIP guests.
- [x] 6.3 Implement VIP filters by sponsor, guest type, and check-in status, including offline operation from Room. Covers AC: Staff filters VIP guests.
- [x] 6.4 Implement VIP Guest Detail with name, phone/email, sponsor or invited-by, guest type, allowed gate, check-in status, notes, and confirm check-in action. Covers AC: Staff confirms VIP check-in.
- [x] 6.5 Implement VIP check-in success screen with green state, guest name, guest type, check-in time, gate, and Check in next VIP guest action. Covers AC: Staff confirms VIP check-in.
- [x] 6.6 Implement VIP duplicate and not-found result states with Search Again and Contact Supervisor actions. Covers AC: VIP duplicate is blocked, VIP guest not found is handled.
- [x] 6.7 Ensure VIP confirmation writes a durable local scan log and syncs through the existing offline check-in sync workflow. Covers AC: VIP check-in works offline.

## 7. Tests and Local Verification

- [x] 7.1 Add unit tests for ticket outcome classification, sync status mapping, pending count calculation, conflict mapping, and logout preservation of local records. Covers AC: App distinguishes ticket states, Offline check-in stores pending records locally, Staff logs out.
- [x] 7.2 Add DAO/repository tests for sync queue queries, history filters/search, VIP dashboard counts, VIP search, and VIP filters. Covers AC: Staff views and filters scan history, Staff searches imported VIP guests, Staff filters VIP guests.
- [x] 7.3 Add Compose/UI tests or screenshot-level checks for Offline Notice, Offline Result, Sync Queue, Sync Conflict, History, VIP Dashboard, VIP Detail, VIP Results, and Profile screens. Covers AC: Sync conflicts are shown clearly, Staff confirms VIP check-in, Staff logs out.
- [x] 7.4 Add an Android/local demo path using Docker Compose seed data that logs in as Check-in Staff, selects an assigned event/gate, scans QR, enters manual ticket code, records offline pending sync, retries sync, reviews conflict, searches history, checks in VIP, handles duplicate/not-found VIP, and logs out. Covers all acceptance criteria.
- [x] 7.5 Run the mobile build/tests and any backend/API tests touched by preload or sync DTO changes in the local Docker Compose-compatible setup. Covers all acceptance criteria.
