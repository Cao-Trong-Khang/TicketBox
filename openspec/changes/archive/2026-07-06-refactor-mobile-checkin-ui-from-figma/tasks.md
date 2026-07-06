## 1. Audit Figma Resources And Map Current App States

- [x] 1.1 Reopen the Figma Make resources, including `App.tsx`, `ticketbox-checkin-ui.md`, and `theme.css`, and capture the native Compose target tokens, screen hierarchy, component inventory, status colors, spacing, and interaction states. (Spec: Figma-aligned native screen coverage; Reusable native Compose design system)
- [x] 1.2 Reinspect `MainActivity.kt`, `QrCameraPreview.kt`, `MobileScreensComposeTest.kt`, `build.gradle.kts`, and related `mobile-checkin/app/src/main`, `src/test`, and `src/androidTest` files before editing production UI. (Spec: Business behavior is preserved; Real camera and QR scanning are preserved)
- [x] 1.3 Create an implementation state map that identifies existing screens retained, screens only visually refactored, screens extracted from `MainActivity`, reusable components, Figma demo-only states, and existing app states absent from Figma. (Spec: Figma-aligned native screen coverage; Compose screen extraction from MainActivity)
- [x] 1.4 Confirm and document in the implementation notes that no Backend API, PostgreSQL, Redis, Kafka, Room schema, WorkManager contract, API model, external integration, database migration, or seed-data change is required. (Spec: Business behavior is preserved)

## 2. Introduce Theme Tokens And Reusable UI Components

- [x] 2.1 Add `ui/theme/` with `TicketBoxTheme`, dark color tokens, typography, spacing, shapes, and status color roles derived from the Figma reference. (Spec: Reusable native Compose design system)
- [x] 2.2 Add reusable buttons, text fields, search fields, filter chips, status badges, banners, statistic cards, and event header/card components with Material 3 and TicketBox tokens. (Spec: Reusable native Compose design system; Responsive and accessible gate-operation layouts)
- [x] 2.3 Add reusable ticket result, VIP guest, scan history, sync queue, empty, loading, and error state components. (Spec: Reusable native Compose design system; Figma-aligned native screen coverage)
- [x] 2.4 Add accessibility semantics and content descriptions for actionable icon-only or icon-enhanced controls introduced by shared components. (Spec: Responsive and accessible gate-operation layouts)

## 3. Refactor Application Shell And Bottom Navigation

- [x] 3.1 Move top-level app composable state, `AppStep`, `StaffTab`, `VipResultState`, and event-shell presentation into `ui/navigation/` or an equivalent focused package. (Spec: Compose screen extraction from MainActivity)
- [x] 3.2 Restyle the event shell and five-tab bottom navigation for Dashboard, Scan, VIP, History, and Profile using the TicketBox theme while keeping tab routing behavior unchanged. (Spec: Figma-aligned native screen coverage; Compose screen extraction from MainActivity)
- [x] 3.3 Preserve non-tab flow routing for Manual Ticket Input, Ticket Result, Offline Mode, Sync Queue, Sync Conflict, VIP Detail, and VIP Result. (Spec: Compose screen extraction from MainActivity; Business behavior is preserved)
- [x] 3.4 Keep `MainActivity` limited to activity setup, dependency construction, theme application, top-level app invocation, and WorkManager enqueue wiring. (Spec: Compose screen extraction from MainActivity)

## 4. Refactor Login And Assigned Events

- [x] 4.1 Extract and visually refactor Login into `ui/screens/auth/`, preserving email-or-phone login, password behavior, disabled/enabled Log In state, invalid-login message, non-staff permission message, and generic failure message. (Spec: Figma-aligned native screen coverage; Business behavior is preserved)
- [x] 4.2 Extract and visually refactor Assigned Events into `ui/screens/events/`, preserving assignment refresh, status messages, empty state, event card fields, preload on selection, and assigned-gate scoping. (Spec: Figma-aligned native screen coverage; Business behavior is preserved)
- [x] 4.3 Verify login and assignments handle keyboard visibility, small phone scrolling, and readable dark-theme contrast. (Spec: Responsive and accessible gate-operation layouts)

## 5. Refactor Dashboard

- [x] 5.1 Extract and visually refactor Dashboard into `ui/screens/dashboard/`, preserving event summary, total tickets, checked-in count, remaining count, VIP count, and pending sync count. (Spec: Figma-aligned native screen coverage; Business behavior is preserved)
- [x] 5.2 Restyle Dashboard actions for Start QR Scan, VIP Guest List, Scan History, Sync Queue, and Sync Now while preserving navigation and `enqueueSync` behavior. (Spec: Business behavior is preserved; Reusable native Compose design system)
- [x] 5.3 Preserve online/offline and synced/pending status banner semantics with text labels in addition to color. (Spec: Reusable native Compose design system; Responsive and accessible gate-operation layouts)

## 6. Refactor Scan And Manual Input Without Changing CameraX Or ML Kit Behavior

- [x] 6.1 Extract and visually refactor Scan into `ui/screens/scan/`, preserving payload state, scanned-code text field, validation button enablement, validation progress, manual navigation, and error banner behavior. (Spec: Figma-aligned native screen coverage; Business behavior is preserved)
- [x] 6.2 Restyle the camera area around `QrCameraPreview` while continuing to use the real CameraX `PreviewView` and ML Kit analyzer. (Spec: Real camera and QR scanning are preserved)
- [x] 6.3 Preserve camera permission handling, camera start errors, QR read errors, tap-to-focus, pinch-to-zoom, analyzer lifecycle, torch shutdown, and flash toggle behavior. (Spec: Real camera and QR scanning are preserved)
- [x] 6.4 Extract and visually refactor Manual Ticket Input, preserving required-code validation, Back to Scan, and route to the same ticket validation flow. (Spec: Business behavior is preserved; Responsive and accessible gate-operation layouts)

## 7. Refactor All Ticket Result States

- [x] 7.1 Extract and visually refactor Ticket Result into `ui/screens/ticketresult/` with reusable result cards for valid, invalid, duplicate, and offline pending outcomes. (Spec: Figma-aligned native screen coverage; Reusable native Compose design system)
- [x] 7.2 Preserve valid-ticket Confirm Check-in and Scan Next behavior for online accepted scans. (Spec: Business behavior is preserved)
- [x] 7.3 Preserve offline pending result behavior, Pending Sync label, final-validation warning, and Scan Next-only recovery. (Spec: Business behavior is preserved)
- [x] 7.4 Preserve duplicate and invalid behavior, including previous check-in details, no duplicate confirmation, Scan Again, and Manual Input recovery where applicable. (Spec: Business behavior is preserved; Responsive and accessible gate-operation layouts)

## 8. Refactor VIP List, VIP Detail, And VIP Result

- [x] 8.1 Extract and visually refactor VIP Guest List, preserving event scope, total/checked-in/remaining counts, name/phone/email/invite search, status filters, sponsor filters, type filters, empty state, and not-found recovery. (Spec: Figma-aligned native screen coverage; Business behavior is preserved)
- [x] 8.2 Extract and visually refactor VIP Guest Detail, preserving full guest details, allowed gate, notes fallback, Back, and Confirm VIP Check-in behavior. (Spec: Business behavior is preserved; Reusable native Compose design system)
- [x] 8.3 Extract and visually refactor VIP Result, preserving success, already checked-in, and not-found states with Search Again, Contact Supervisor, and next-guest actions. (Spec: Figma-aligned native screen coverage; Business behavior is preserved)
- [x] 8.4 Keep VIP visibility and wrong-gate rules based on existing Room/repository/domain behavior. (Spec: Business behavior is preserved)

## 9. Refactor History, Offline Mode, Sync Queue, And Sync Conflict

- [x] 9.1 Extract and visually refactor Scan History, preserving ticket-code search, All/Success/Invalid/Duplicate/Offline/Conflict filters, scoped history rows, and conflict-row navigation. (Spec: Figma-aligned native screen coverage; Business behavior is preserved)
- [x] 9.2 Extract and visually refactor Offline Mode notice, preserving Continue Offline, View Sync Queue, pending count, and one-notice-per-event dismissal behavior. (Spec: Figma-aligned native screen coverage; Business behavior is preserved)
- [x] 9.3 Extract and visually refactor Sync Queue, preserving Pending/Synced/Conflict/Failed statuses, Retry Sync, Back, pending/failed retry visibility, and conflict row opening. (Spec: Business behavior is preserved; Reusable native Compose design system)
- [x] 9.4 Extract and visually refactor Sync Conflict, preserving local/server time details, conflict message, Mark as Conflict, Contact Supervisor, and Back behavior. (Spec: Figma-aligned native screen coverage; Business behavior is preserved)

## 10. Refactor Profile And Event-Changing Flows

- [x] 10.1 Extract and visually refactor Profile, preserving staff identity, role, event, gate, device, app, network, sync, cache, Change Event, and Logout information. (Spec: Figma-aligned native screen coverage; Business behavior is preserved)
- [x] 10.2 Preserve Change Event behavior so it returns to Assigned Events without clearing the authenticated staff session. (Spec: Business behavior is preserved)
- [x] 10.3 Preserve Logout behavior so it clears session credentials without deleting durable scan logs, sync records, conflict records, or preload cache. (Spec: Business behavior is preserved)
- [x] 10.4 Verify profile rows and action buttons remain readable and reachable on a small phone viewport. (Spec: Responsive and accessible gate-operation layouts)

## 11. Remove Obsolete Duplicated Compose Code

- [x] 11.1 Remove duplicated local UI helpers from `MainActivity.kt` after migrated screens compile against shared components. (Spec: Compose screen extraction from MainActivity; Reusable native Compose design system)
- [x] 11.2 Remove hardcoded duplicated color, radius, typography, and spacing values from screen files where shared tokens cover the same role. (Spec: Reusable native Compose design system)
- [x] 11.3 Confirm no production UI uses a Figma screenshot, fake camera background, Figma phone shell, mock validation data, or random result logic. (Spec: Figma-aligned native screen coverage; Real camera and QR scanning are preserved)
- [x] 11.4 Run a local code search to confirm no React, TypeScript, Tailwind CSS, HTML, WebView, Flutter, or JavaScript UI runtime was introduced. (Spec: Figma-aligned native screen coverage; Business behavior is preserved)

## 12. Update And Expand Compose UI Tests

- [x] 12.1 Update `MobileScreensComposeTest.kt` imports and fixtures for extracted screen packages without weakening existing behavior coverage. (Spec: UI tests and visual verification cover the refactor)
- [x] 12.2 Add or update tests for shared design-system components, status labels, empty states, loading/error states, and recovery actions. (Spec: Reusable native Compose design system; UI tests and visual verification cover the refactor)
- [x] 12.3 Add or update tests for accessibility semantics and content descriptions on actionable icon controls and bottom navigation. (Spec: Responsive and accessible gate-operation layouts; UI tests and visual verification cover the refactor)
- [x] 12.4 Preserve or expand tests for login errors, assignment/preload states, dashboard actions, scan/manual validation, all ticket results, VIP list/detail/results, history filters, offline notice, sync queue, conflict review, profile, Change Event, and Logout. (Spec: Business behavior is preserved; UI tests and visual verification cover the refactor)
- [x] 12.5 Keep domain, repository, Room, migration, and WorkManager-related tests unchanged unless package moves require mechanical import updates. (Spec: Business behavior is preserved)

## 13. Run Unit, Build, Instrumentation, And Visual Verification

- [x] 13.1 Run `./gradlew assembleDebug` from the Android project context and fix build errors without changing business behavior. (Spec: UI tests and visual verification cover the refactor)
- [x] 13.2 Run `./gradlew testDebugUnitTest` and fix failures without deleting or bypassing meaningful tests. (Spec: UI tests and visual verification cover the refactor)
- [x] 13.3 Run `./gradlew connectedDebugAndroidTest` when an emulator or device is available, including `MobileScreensComposeTest`, `MainActivitySmokeTest`, Room instrumentation tests, and migration tests. (Spec: UI tests and visual verification cover the refactor)
- [x] 13.4 If manual API-backed sync verification is needed, run the existing local backend stack with Docker Compose and do not add new services or infrastructure. (Spec: Business behavior is preserved)
- [ ] 13.5 Manually verify CameraX preview, QR detection, permission denial/regrant, tap-to-focus, pinch-to-zoom, flash toggle, and scanner error recovery on a device or emulator. (Spec: Real camera and QR scanning are preserved)
- [x] 13.6 Manually verify offline scan persistence, pending scan durability, WorkManager retry behavior, Sync Queue, failed retry, and Sync Conflict review. (Spec: Business behavior is preserved)
- [x] 13.7 Manually compare implemented Login, Assigned Events, Dashboard, Scan, Manual Input, Ticket Result, VIP, History, Offline Mode, Sync Queue, Sync Conflict, and Profile screens against the Figma Make reference. (Spec: Figma-aligned native screen coverage; UI tests and visual verification cover the refactor)
- [x] 13.8 Verify at least one small phone viewport for scrolling, keyboard behavior, system bars, touch targets, text contrast, label readability, and absence of overlap or clipping. (Spec: Responsive and accessible gate-operation layouts)
