## Context

TicketBox already defines a native Android Check-in Mobile App built with Kotlin, Jetpack Compose, Room Database, and WorkManager. The existing offline check-in capability stores assignment-scoped preload snapshots and durable scan logs locally, then synchronizes them through the Backend API. The existing VIP CSV import capability stores accepted sponsor guests in PostgreSQL and makes them available to Check-in Staff through assignment-scoped preload data.

`refactor-mobile-01` establishes the staff app shell: login, assigned event selection, bottom navigation, dashboard, scan/manual input, basic ticket result states, VIP, history, and profile tabs. This follow-up deepens the operational screens for offline mode, sync review, conflict handling, VIP guest-list check-in, scan history, staff settings, and reusable UI state components.

The primary user is Check-in Staff assigned to a concert or gate. Audience users and Organizer users do not receive new mobile workflows. The change stays inside the existing Client-Server, Layered, and Event-driven architecture: the mobile app remains the staff client, the Backend API enforces authentication/RBAC/assignment, PostgreSQL remains authoritative, Redis may rate-limit sync/preload endpoints, and Kafka remains unrelated to the synchronous gate decision path except for optional downstream analytics.

## Goals / Non-Goals

**Goals:**

- Add offline mode notice, offline scan result, sync queue, and sync conflict screens.
- Add scan history with status filters and ticket-code search.
- Add VIP dashboard, VIP guest detail, VIP success, VIP duplicate, and VIP not-found screens using imported CSV guest data.
- Add staff profile/settings with app version, sync status, cache status, and logout.
- Define reusable mobile UI components and clear status colors for fast gate operation.
- Preserve assignment-scoped access, durable offline records, idempotent synchronization, and PostgreSQL conflict authority.

**Non-Goals:**

- No audience app, organizer web admin, payment, checkout, refund, or ticket issuance changes.
- No direct sponsor API, sponsor webhook, sponsor database, or real-time sponsor validation.
- No new database engine, message broker, managed service, or cloud-only dependency.
- No replacement of Room, WorkManager, Backend API, PostgreSQL, Redis, or Kafka.
- No guarantee that an offline device can know about a same-ticket scan on another device before synchronization.

## Decisions

### Decision 1: Derive operational UI state from Room plus connectivity signals

Offline notices, pending sync counts, dashboard sync state, scan history, and profile cache state will be derived from Room scan logs/preload records and a connectivity observer. The app will expose UI states such as Online, Offline, Pending Sync, Syncing, Synced, Conflict, and Failed through view models instead of scattering raw database values across screens.

**Rationale:** Room is already the offline-first boundary and survives app restarts. A normalized UI state model keeps Dashboard, Sync Queue, History, and Profile consistent.

**Alternatives considered:** Calling backend status endpoints for each screen would be less useful offline. Keeping UI-only counters in Compose state would lose data after process death.

### Decision 2: Treat the sync queue as a first-class view over local scan logs

The Sync Queue screen will list local offline check-in records with ticket or guest code, scan time, and sync status. Status values are Pending, Synced, Conflict, and Failed. Retry Sync will enqueue or trigger the existing WorkManager sync path for eligible records. Network status remains visible on the queue.

**Rationale:** Staff and supervisors need a concrete place to inspect pending work during unstable venue connectivity. Reusing local scan logs avoids creating a separate queue source of truth.

**Alternatives considered:** Hiding pending scans behind only a dashboard count would not give staff enough recovery context. Deleting failed rows after a retry would lose auditability.

### Decision 3: Map authoritative conflict outcomes into a dedicated conflict screen

When the Backend API returns a duplicate or conflict outcome that contradicts a local offline acceptance, the app will update the Room record and route from queue/history/result contexts to a Sync Conflict screen. The screen will show the conflict reason, local check-in time, server check-in time when returned, and actions for Mark as Conflict and Contact Supervisor.

**Rationale:** Cross-device offline conflicts are expected under the global design. A dedicated screen prevents staff from treating a locally accepted offline record as final after PostgreSQL rejects or conflicts it.

**Alternatives considered:** Showing conflict as a generic failed sync would hide the operational difference between retryable failures and authoritative duplicate/conflict decisions.

### Decision 4: Use scan history as an event log, not only successful check-ins

History will read from local scan logs and stored sync outcomes for the selected event/gate. It will include Success, Invalid, Duplicate, Offline, and Conflict outcomes, with All as the default filter. Search by ticket code will match ticket codes or equivalent scanned codes stored in the local/preload data.

**Rationale:** Gate staff often need to answer what just happened, not only what was accepted. Invalid, duplicate, offline, and conflict records are part of the operational audit trail.

**Alternatives considered:** Showing only successful check-ins would make troubleshooting duplicate warnings and offline sync conflicts harder.

### Decision 5: Enrich assignment-scoped VIP preload only with needed imported metadata

The VIP dashboard and detail screens need guest name, phone/email, sponsor or invited-by, guest type, allowed gate, check-in status, notes, and invite code. The Backend API should include those fields in assignment-scoped preload and the mobile app should store them in Room for local search and filtering. If the current PostgreSQL or API model lacks required fields, add nullable metadata to the existing `vip_guests` record or equivalent import metadata, not a new VIP database.

**Rationale:** VIP check-in must work offline and must use the accepted sponsor CSV guest data already imported into PostgreSQL. Keeping the data in existing VIP guest records preserves the scheduled CSV constraint and avoids real-time sponsor dependencies.

**Alternatives considered:** Querying VIP guests from the backend on every search would fail offline. Adding a separate mobile-only VIP source would risk drifting from PostgreSQL and the CSV import result.

### Decision 6: Keep result screens explicit and action-oriented

Ticket and VIP result screens will use clear state models and color semantics: green for success, red for invalid/error, orange for duplicate/conflict, and blue or gray for offline/pending sync. The app will use reusable Compose components for Event Card, Status Badge, Ticket Result Card, Search Bar, Primary Button, Secondary Button, and Sync Status Banner.

**Rationale:** Gate operation needs fast decisions, high contrast, large tap targets, and minimal reading. Reusable components reduce inconsistent state presentation across screens.

**Alternatives considered:** Generic toast/snackbar messages are too easy to miss at a busy gate. Free-form screen-specific styling would make status semantics inconsistent.

### Decision 7: Logout clears session without deleting durable offline records

The Profile screen logout action will clear authenticated session credentials and return to login. It must not delete pending scan logs, synced history, preload cache, or conflict records unless a separate explicit cache-management action is specified later. Sync still requires a valid Check-in Staff session and assignment before uploading records.

**Rationale:** Offline records are operational data and must survive accidental logout or app restarts. Server-side RBAC and assignment checks still gate final synchronization.

**Alternatives considered:** Clearing all local data on logout would risk losing pending offline check-ins. Keeping the token after logout would be a security bug.

## Risks / Trade-offs

- **VIP CSV fields differ by sponsor file** -> Treat guest type, allowed gate, notes, sponsor/company, and invite code as nullable metadata while preserving required identity fields.
- **Offline search can show stale VIP or ticket status** -> Show sync/cache status clearly and let PostgreSQL outcomes override local state after sync.
- **Conflict screen depends on backend outcome detail** -> Store the backend result code/message and request server check-in time when available; fall back to a clear conflict message if details are missing.
- **Local history may grow during large events** -> Add Room indexes for event/gate, code/hash, status, and scan time where needed; keep history scoped to the selected event.
- **Network restoration can create sync bursts** -> Continue to rely on WorkManager retry/backoff and Redis-backed API rate limiting; keep records pending on `429`.
- **More screens increase navigation complexity** -> Keep selected event/gate state centralized and route every screen through the existing post-selection app shell.

## Migration Plan

1. Extend mobile domain/UI state models for connectivity, sync status, queue item, history item, ticket result, VIP guest, VIP result, and profile state.
2. Add or extend Room fields/indexes for ticket code/display code, gate, status filters, VIP metadata, backend conflict details, and server check-in time where required.
3. Extend check-in preload and sync DTO mapping only where the UI needs additional fields for VIP metadata, ticket attendee details, queue/history display, or conflict review.
4. Build Compose screens and reusable components for offline notice, offline result, sync queue, sync conflict, scan history, VIP dashboard/detail/results, and profile/settings.
5. Add tests and local demo flows for online scan, manual input, offline scan, sync retry, conflict outcome, VIP search/check-in, duplicate/not-found VIP states, history filters, and logout.
6. Roll back by disabling the new destinations and reverting DTO/local-model additions while keeping existing offline scan logging and sync behavior intact.

## Open Questions

None.
