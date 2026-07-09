## Context

The global TicketBox architecture defines the Check-in Mobile App as a native Android/Kotlin client using Jetpack Compose, Room Database, WorkManager, CameraX, and ML Kit. It supports Check-in Staff at venue gates, including assigned-event selection, offline local validation, durable scan logs, pending synchronization, and server conflict review. PostgreSQL remains authoritative after synchronization, and Redis/Kafka/backend behavior are outside this visual refactor.

The Figma Make reference inspected through the Figma MCP server describes a compact, dark, operations-focused mobile UI with TicketBox orange primary actions, rounded cards, event context at the top of most screens, a five-tab bottom navigation, large gate-operation buttons, clear status colors, and reusable UI primitives. The Figma source is React/Tailwind demo code with mock data and simulated scanning; it is design-time reference only and must not be copied into the Android runtime.

The current Android implementation already contains the required state model and screens, but most Compose implementation is concentrated in `mobile-checkin/app/src/main/java/com/ticketbox/checkin/MainActivity.kt`. The only already-separated UI module is `ui/scan/QrCameraPreview.kt`, which uses CameraX `LifecycleCameraController`, real `PreviewView`, ML Kit QR analysis, permission handling, tap-to-focus, pinch-to-zoom, and torch control. Current UI tests in `MobileScreensComposeTest.kt` cover the main screen states and should be preserved and expanded during the refactor.

### Current Screen Mapping

| Figma Make screen or state | Current Android implementation | Proposed treatment |
| --- | --- | --- |
| Login | `LoginScreen` in `MainActivity.kt` | Retain behavior; visually refactor and extract to `ui/screens/auth/`. |
| Assigned Events | `AssignedEventsScreen` and `EventCard` | Retain behavior; visually refactor and extract to `ui/screens/events/`. |
| Dashboard | `DashboardScreen`, `StatCard`, `SyncStatusBanner` | Retain behavior; visually refactor and extract to `ui/screens/dashboard/`. |
| Bottom Navigation | `EventShell`, `StaffTab`, Material `NavigationBar` | Retain five-tab model; restyle and extract shell/navigation to `ui/navigation/`. |
| QR Scan | `ScanScreen` plus `QrCameraPreview` | Retain CameraX/ML Kit behavior; visually refactor screen and camera overlay. |
| Manual Ticket Input | `ManualInputScreen` | Retain behavior; visually refactor and extract to `ui/screens/scan/`. |
| Valid Ticket Result | `TicketResultScreen` when accepted online | Retain behavior; visually refactor as a reusable result card. |
| Invalid Ticket Result | `TicketResultScreen` when invalid | Retain behavior and detailed reasons; visually refactor. |
| Duplicate Ticket Result | `TicketResultScreen` when duplicate | Retain no-confirm behavior; visually refactor. |
| Offline Ticket Result | `TicketResultScreen` when accepted offline | Retain pending-sync semantics; visually refactor. |
| VIP Guest List | `VipScreen` with search, sponsor/type/status filters | Retain behavior; visually refactor and extract. |
| VIP Guest Detail | `VipGuestDetailScreen` | Retain behavior; visually refactor and extract. |
| VIP Check-in Result | `VipResultScreen` | Retain success, duplicate, and not-found states; visually refactor. |
| Scan History | `HistoryScreen` with search and status filters | Retain behavior; visually refactor and extract. |
| Offline Mode | `OfflineModeNoticeScreen` | Retain as an offline notice flow, not a bottom tab; visually refactor. |
| Sync Queue | `SyncQueueScreen` | Retain retry and conflict-opening behavior; visually refactor. |
| Sync Conflict | `SyncConflictScreen` | Retain conflict review actions; visually refactor. |
| Profile | `ProfileScreen` | Retain status, Change Event, and Logout behavior; visually refactor. |

### Figma Gaps And Existing State Gaps

Figma states that do not map to an exact production implementation:

- The Figma QR area is simulated; Android must continue using the real `QrCameraPreview` camera feed and ML Kit analyzer.
- The Figma phone shell, status bar, home indicator, and demo legend are presentation wrappers and must not become production UI.
- Figma randomizes demo validation results; Android must keep repository/domain-driven validation.
- Figma uses mock event, scan, VIP, and sync data; Android must continue reading Room, API, and session state.
- Figma "Contact Supervisor" is a visible recovery action. The current app records a status message only; no new backend supervisor workflow should be introduced by this change.

Existing application states not fully represented by Figma and still required:

- Invalid-login and non-staff permission responses.
- Assignment refresh failure, preload failure, and no assigned events.
- Camera permission denied, camera start failure, flash unavailable, and QR read/validation errors.
- Stale preload snapshot local result and backend override after sync.
- Wrong event, wrong gate, canceled, refunded, not active, and missing snapshot invalid outcomes.
- Sync rate limiting, failed retry state, WorkManager retry behavior, and conflict outcomes returned after cross-device offline scans.
- Session restore into assignments, Change Event, and Logout while preserving durable offline records.

## Goals / Non-Goals

**Goals:**

- Match the Figma Make visual hierarchy, typography scale, color roles, spacing rhythm, rounded shapes, bottom navigation presentation, and status language using native Jetpack Compose and Material 3.
- Preserve all current business behavior for Check-in Staff: authentication, RBAC error handling, assignment selection, preload, dashboard counts, QR scan, manual input, validation results, VIP operations, scan history, offline notice, sync queue, conflict review, event change, and logout.
- Introduce reusable Compose design-system elements so colors, shapes, spacing, typography, status badges, buttons, banners, cards, search fields, chips, and result layouts are not duplicated across screens.
- Extract screen implementations and shared components out of `MainActivity.kt` into focused packages while keeping the current repository/domain/state behavior intact.
- Keep UI layouts safe on small Android screens with scrollable content, appropriate system bar handling, keyboard-safe forms, readable contrast, large touch targets, content descriptions, and non-color-only status labels.
- Preserve and expand Compose UI tests and manual visual verification against the Figma reference.

**Non-Goals:**

- No backend, API, database, Room schema, WorkManager contract, sync semantic, RBAC, payment, notification, AI, sponsor import, or external infrastructure changes.
- No React, TypeScript, Tailwind CSS, HTML, WebView, Flutter, JavaScript UI, or second mobile framework.
- No copying Figma Make generated web code into Android runtime.
- No fake screenshot background for production UI.
- No redesign of ticket validation, VIP validation, offline conflict resolution, repository logic, API models, or domain rules unless a separate defect is documented.
- No new direct integration with sponsor APIs; existing VIP data remains based on scheduled CSV import.

## Decisions

### Decision 1: Use Figma Make As Visual Reference Only

The Android implementation will interpret Figma tokens and layout intent in native Compose instead of translating React/Tailwind code directly. The Figma colors map to Compose tokens such as dark background `#0c0c12`, card surface `#17171f`, raised/input surface `#1e1e28`/`#23232e`, primary orange `#ff6b35`, success green, error red, duplicate/conflict orange, and offline/pending blue.

Alternative considered: embed or port the Figma web implementation. This is rejected because it would violate the native Android constraint, add a second UI stack, and risk replacing the real CameraX scanner with a fake demo surface.

### Decision 2: Add A TicketBox Compose Design System

Create `ui/theme/` and `ui/components/` primitives before refactoring individual screens. The design system should include:

- `TicketBoxTheme`, color tokens, typography, spacing, and shapes.
- `TicketBoxPrimaryButton`, `TicketBoxSecondaryButton`, and compact action-button variants.
- `TicketBoxTextField`, search fields, and horizontal filter chips.
- `TicketBoxStatusBadge`, `StatusBanner`, `ConnectivitySyncBanner`, and conflict/error banners.
- `EventHeader`, `EventCard`, `StatisticCard`, `TicketResultCard`, `VipGuestCard`, `ScanHistoryCard`, `SyncQueueCard`, empty, loading, and error states.
- Icon wrappers or Material/lucide-equivalent vector icons where appropriate, with content descriptions for actionable icons.

Alternative considered: restyle each screen locally. This is rejected because the current issue is duplication and concentration in `MainActivity.kt`; local restyling would make future state changes harder and would risk inconsistent status colors.

### Decision 3: Extract Screens, Keep Behavior Wiring Stable

Move the large `MainActivity.kt` composables into a structure similar to:

- `ui/theme/`
- `ui/components/`
- `ui/navigation/`
- `ui/screens/auth/`
- `ui/screens/events/`
- `ui/screens/dashboard/`
- `ui/screens/scan/`
- `ui/screens/ticketresult/`
- `ui/screens/vip/`
- `ui/screens/history/`
- `ui/screens/sync/`
- `ui/screens/profile/`

`MainActivity` should retain activity-level setup: creating `StaffSessionStore`, `CheckInRepository`, `CheckInDatabase`, `CheckInApiClient`, applying `TicketBoxTheme`, and invoking a top-level app composable. Navigation state can remain a lightweight Compose state model using existing `AppStep` and `StaffTab` concepts, moved to `ui/navigation/`, rather than adding Navigation Compose if that would be an unnecessary dependency.

Alternative considered: introduce a full navigation framework as part of the refactor. This is not required by the current app shape; the existing step/tab model is small, testable, and avoids dependency churn.

### Decision 4: Preserve Scanner Boundary And Restyle Around It

`QrCameraPreview` remains the production camera surface and should continue owning permission prompts, `PreviewView`, ML Kit analysis, scanner lifecycle, torch, tap-to-focus, pinch-to-zoom, and camera error callbacks. The scan screen can provide a Figma-aligned container, rounded clipping, overlay frame, status copy, and action controls around the preview, but must not replace it with a mock camera or static bitmap.

Alternative considered: rebuild scanner UI inside `MainActivity` or a new screen file. This is rejected because the existing separation is correct and reduces lifecycle risk.

### Decision 5: Preserve Existing Data And Protection Boundaries

The refactor remains inside the Check-in Mobile App presentation layer. It continues depending on:

- Backend API for login, staff identity, assignments, preload, and sync.
- Room Database tables for assignments, snapshots, preloaded tickets, preloaded VIP guests, and local scan logs.
- WorkManager for pending scan synchronization.
- PostgreSQL as the authoritative backend store for final check-ins.
- Redis-backed API rate limiting and Kafka analytics/async behavior as existing backend concerns only.

No PostgreSQL table, Room entity, migration, API model, event, worker job, RBAC rule, or external system contract is added by this proposal.

Alternative considered: combine visual refactor with backend/domain cleanup. This is rejected to keep the change reviewable and to preserve proven offline check-in behavior.

### Decision 6: Test Through Stable User-Facing Semantics

Update `MobileScreensComposeTest.kt` and related tests to assert screen behavior and key visual/state semantics without overfitting to exact implementation paths. Existing tests should continue covering login, assignments, dashboard, scan/manual input, result states, VIP, history, profile, offline notice, sync queue, conflict review, and VIP detail/result. Add coverage for design-system components, extraction-safe screen entry points, content descriptions, empty/loading/error states, and small-screen scrolling where practical.

Alternative considered: delete or broadly rewrite UI tests during extraction. This is rejected because the refactor is high-blast-radius presentation work and the tests are the main guardrail for behavior preservation.

## Risks / Trade-offs

- Visual drift from Figma because Figma Make is a web demo rather than native Android design tokens -> Mitigation: map intent to explicit Compose tokens and perform manual screen-by-screen comparison after implementation.
- Behavior regressions while moving composables out of `MainActivity.kt` -> Mitigation: keep repository/domain APIs unchanged, move one screen family at a time, and preserve existing UI tests before broad restyling.
- Camera lifecycle regression from visual changes around the scanner -> Mitigation: keep `QrCameraPreview` as the real preview component and manually verify CameraX preview, QR detection, flash, focus, and zoom on device/emulator.
- Small-screen clipping due to denser dark card layout -> Mitigation: use `LazyColumn` or scroll containers per screen, avoid fixed heights except the camera preview, account for system bars and IME insets, and test at least one small phone viewport.
- Accessibility loss from icon-heavy bottom navigation or status colors -> Mitigation: keep text labels, content descriptions, adequate contrast, non-color status text, and touch targets at or above Android guidance.
- Test churn from file/package extraction -> Mitigation: move test fixtures deliberately, prefer user-visible assertions, and avoid renaming visible labels unless the Figma-aligned wording is intentional.

## Migration Plan

1. Introduce theme tokens and reusable components without changing behavior.
2. Extract `EventShell`, `StaffTab`, and top-level navigation/state presentation into `ui/navigation/`.
3. Move screen composables into package-specific files, preserving public/internal signatures needed by UI tests.
4. Refactor each screen family visually against the Figma reference while keeping repository/domain calls unchanged.
5. Remove obsolete duplicate helpers from `MainActivity.kt` only after all screens have migrated.
6. Update and expand unit/UI tests, then run local build and test verification.

Rollback is a normal code revert of the UI extraction/refactor files because no database migration, backend contract, or persistent data format change is proposed.

## Open Questions

None. The Figma Make file is sufficient as a design reference, and it does not require changes to the global TicketBox architecture.
