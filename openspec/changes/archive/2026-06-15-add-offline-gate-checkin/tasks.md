## 1. Backend Data and Access Foundation

- [x] 1.1 Add or verify PostgreSQL migration support for `check_ins` sync metadata, including `local_scan_id`, `source_device_id`, scan status/result fields, `scanned_at`, `synced_at`, and indexes for `(source_device_id, local_scan_id)`. Covers AC: sync retry is idempotent, pending scans synchronize when online.
- [x] 1.2 Add partial unique constraints or equivalent transactional guards so only one successful check-in exists per `ticket_id` and per `vip_guest_id`. Covers AC: cross-device offline conflict is resolved by backend.
- [x] 1.3 Add local seed/demo data for Check-in Staff role permissions, staff concert/gate assignments, issued tickets, VIP guests, and scan-ready QR hashes in the Docker Compose development setup. Covers AC: staff preloads assigned event data, offline valid ticket scan is recorded locally.
- [x] 1.4 Add backend permission constants and guards for check-in preload and sync actions, including role and assignment checks repeated in the domain service. Covers AC: unauthorized user cannot preload check-in data, pending scans synchronize when online.

## 2. Backend Check-in APIs

- [x] 2.1 Create a NestJS check-in module with assignment, preload, and sync controllers/services following the modular monolith layering. Covers AC: staff preloads assigned event data, pending scans synchronize when online.
- [x] 2.2 Implement `GET /check-in/assignments` for authenticated Check-in Staff users. Covers AC: staff preloads assigned event data.
- [x] 2.3 Implement `GET /check-in/events/:concertId/preload` returning assignment-scoped, validation-minimal ticket and VIP guest data with snapshot timestamp or version. Covers AC: staff preloads assigned event data, unauthorized user cannot preload check-in data.
- [x] 2.4 Implement `POST /check-in/events/:concertId/sync` with per-scan validation for accepted, duplicate, invalid, expired, unauthorized, and conflict outcomes. Covers AC: pending scans synchronize when online, cross-device offline conflict is resolved by backend.
- [x] 2.5 Make scan synchronization idempotent by `source_device_id` and `local_scan_id`, returning the original result for repeated uploads. Covers AC: sync retry is idempotent.
- [x] 2.6 Add Redis-backed rate limiting for preload and sync endpoints by staff user, source device, and concert where available. Covers AC: rate-limited sync remains retryable.
- [x] 2.7 Ensure Kafka publish failures for optional analytics/projection events do not change the authoritative sync response. Covers AC: Kafka outage does not block final check-in validation.
- [x] 2.8 Write backend unit/integration tests for preload authorization, valid sync, duplicate sync retry, cross-device conflict, Redis `429`, and Kafka-unavailable behavior. Covers all offline-gate-checkin acceptance criteria.

## 3. Android Check-in Mobile App

- [x] 3.1 Add a `/mobile-checkin` Android/Kotlin project foundation with Jetpack Compose, Room, WorkManager, QR scanning dependency or scanner abstraction, and environment-configured Backend API URL. Covers AC: staff preloads assigned event data.
- [x] 3.2 Implement authenticated staff session storage and API client calls for assignments, preload, and sync. Covers AC: staff preloads assigned event data, unauthorized user cannot preload check-in data.
- [x] 3.3 Implement Room entities and DAOs for assignment metadata, preloaded ticket records, preloaded VIP guest records, local scan logs, sync outcomes, snapshot version, and retry state. Covers AC: staff preloads assigned event data, offline valid ticket scan is recorded locally.
- [x] 3.4 Implement the preload screen and offline snapshot storage, including visible snapshot age/status. Covers AC: staff preloads assigned event data.
- [x] 3.5 Implement the QR scan flow so every scan is persisted locally before the app displays accepted, duplicate, invalid, or stale-snapshot local results. Covers AC: offline valid ticket scan is recorded locally, offline duplicate on same device is detected.
- [x] 3.6 Implement WorkManager synchronization for pending scan logs with retry handling for timeouts, network loss, and `429` responses. Covers AC: pending scans synchronize when online, rate-limited sync remains retryable.
- [x] 3.7 Store backend sync outcomes and update scan-log status without deleting rejected, duplicate, or conflict records. Covers AC: pending scans synchronize when online, cross-device offline conflict is resolved by backend.
- [x] 3.8 Add Android unit tests for local validation, same-device duplicate detection, durable pending log creation, and retry-state handling. Covers AC: offline valid ticket scan is recorded locally, offline duplicate on same device is detected, rate-limited sync remains retryable.

## 4. Local Demo and Verification

- [x] 4.1 Update README or local run documentation with Docker Compose backend setup plus mobile app configuration for the check-in demo. Covers AC: staff preloads assigned event data.
- [x] 4.2 Add a scripted or documented demo for online preload, offline valid scan, same-device duplicate scan, reconnect sync, and backend outcome review. Covers AC: staff preloads assigned event data, offline valid ticket scan is recorded locally, pending scans synchronize when online.
- [x] 4.3 Add a backend test/demo fixture where two devices scan the same ticket offline and synchronize in sequence to prove first-valid-sync-wins conflict behavior. Covers AC: cross-device offline conflict is resolved by backend.
- [x] 4.4 Add a retry demo or test where a sync response is lost and the same local scan ID is uploaded again without creating a duplicate successful check-in. Covers AC: sync retry is idempotent.
- [x] 4.5 Run the local Docker Compose stack and relevant backend/mobile tests, then record any known gaps before implementation is marked complete. Covers all offline-gate-checkin acceptance criteria.
