## ADDED Requirements

### Requirement: Figma-aligned native screen coverage
The Check-in Mobile App SHALL provide native Android Jetpack Compose screens for the existing Check-in Staff workflow that visually align with the inspected Figma Make reference while preserving the current offline-gate-checkin capability.

#### Scenario: Existing check-in screens remain available
- **GIVEN** an authenticated Check-in Staff user is operating an assigned event or gate
- **WHEN** the user navigates through the mobile check-in app
- **THEN** the app provides Login, Assigned Events, Dashboard, Bottom Navigation, QR Scan, Manual Ticket Input, Valid Ticket Result, Invalid Ticket Result, Duplicate Ticket Result, Offline Ticket Result, VIP Guest List, VIP Guest Detail, VIP Check-in Result, Scan History, Offline Mode, Sync Queue, Sync Conflict, and Profile screens or states
- **THEN** each screen remains scoped to the selected assignment where an assignment is required

#### Scenario: Screens are visually refactored rather than replaced by web UI
- **GIVEN** the Figma Make file provides React, TypeScript, Tailwind, HTML, CSS, mock data, and simulated scan behavior as design reference
- **WHEN** the Android app implements the refactored screens
- **THEN** the production UI uses native Android, Kotlin, Jetpack Compose, and Material 3
- **THEN** the production UI MUST NOT use React, TypeScript, Tailwind CSS, HTML, WebView, Flutter, JavaScript UI, or another mobile framework

#### Scenario: Figma demo-only elements are excluded from runtime UI
- **GIVEN** the Figma Make reference includes a phone shell, fake status bar, home indicator, demo legend, mock event data, random validation results, and simulated camera graphics
- **WHEN** the Android implementation is built
- **THEN** those demo-only elements are not used as production screen backgrounds or runtime behavior
- **THEN** the app uses real Android system bars, real app state, and the existing camera scanner behavior

#### Scenario: Existing app states absent from Figma remain represented
- **GIVEN** current application behavior includes invalid login, non-staff permission denial, assignment refresh failure, preload failure, no assigned events, camera permission denial, camera start failure, flash unavailable, stale snapshot, wrong event, wrong gate, canceled ticket, refunded ticket, failed sync retry, rate-limited sync, session restore, Change Event, and Logout states
- **WHEN** the UI is refactored to match Figma
- **THEN** those states remain visible, testable, and understandable to Check-in Staff
- **THEN** no state is removed merely because the Figma reference does not show it

### Requirement: Reusable native Compose design system
The Check-in Mobile App SHALL use reusable native Compose design-system components for the Figma-aligned check-in UI instead of duplicating hardcoded visual values across screens.

#### Scenario: Shared theme tokens are used consistently
- **GIVEN** staff use any refactored check-in screen
- **WHEN** the screen renders background, surface, primary action, text, border, shape, spacing, or typography values
- **THEN** the values come from shared TicketBox Compose theme tokens or component defaults
- **THEN** status colors remain consistent for success, invalid or error, duplicate or conflict, offline, pending, synced, failed, and neutral states

#### Scenario: Shared components cover common check-in UI patterns
- **GIVEN** screens show event context, actions, form input, status, search, filters, statistics, results, guests, scan history, sync records, empty states, loading states, or error states
- **WHEN** those UI patterns are displayed
- **THEN** the app uses reusable Compose components such as TicketBox theme, primary and secondary buttons, text fields, top app bars or event headers, bottom navigation, status badges, connectivity and sync banners, statistic cards, search fields, filter chips, ticket result cards, VIP guest cards, scan history cards, sync queue cards, empty states, loading states, and error states

#### Scenario: Status language does not rely only on color
- **GIVEN** the app shows a valid, invalid, duplicate, offline, pending, conflict, failed, checked-in, or synced state
- **WHEN** Check-in Staff view the state
- **THEN** the UI shows a readable text label or message in addition to the status color

### Requirement: Compose screen extraction from MainActivity
The Check-in Mobile App SHALL extract screen and reusable component implementations from `MainActivity` into focused Compose modules while preserving top-level application behavior.

#### Scenario: MainActivity retains only activity-level responsibilities
- **GIVEN** the UI refactor has been implemented
- **WHEN** developers inspect `MainActivity`
- **THEN** `MainActivity` is limited to activity setup, dependency construction, theme application, top-level app invocation, and navigation coordination
- **THEN** screen bodies and shared UI components are located in focused UI packages rather than remaining as one large activity file

#### Scenario: Screen modules align with existing workflow boundaries
- **GIVEN** developers inspect the Android UI package structure
- **WHEN** they locate check-in screen implementations
- **THEN** auth, assigned events, dashboard, scan, manual input, ticket results, VIP, history, sync, profile, reusable components, theme, and navigation shell code are grouped by responsibility
- **THEN** the package structure does not require changes to repository APIs, Room entities, WorkManager contracts, backend API models, or validation rules

#### Scenario: Navigation presentation preserves the five-tab event shell
- **GIVEN** Check-in Staff have selected an assigned event
- **WHEN** the refactored app enters the event check-in area
- **THEN** bottom navigation presents Dashboard, Scan, VIP, History, and Profile
- **THEN** non-tab flows such as Manual Ticket Input, Ticket Result, Offline Mode, Sync Queue, Sync Conflict, VIP Detail, and VIP Result remain reachable from the appropriate tab or action

### Requirement: Business behavior is preserved during the visual refactor
The Check-in Mobile App SHALL preserve all current check-in business behavior while changing visual structure and presentation.

#### Scenario: Authentication and assignment behavior is unchanged
- **GIVEN** staff enter email or phone and password
- **WHEN** the app authenticates and loads assignments
- **THEN** successful login, invalid-login error, non-staff permission error, assignment refresh, assigned-event selection, and event preload behavior match the existing offline-gate-checkin behavior
- **THEN** protected actions continue to require Check-in Staff role, check-in permission, and the relevant concert or gate assignment

#### Scenario: Ticket scanning and validation behavior is unchanged
- **GIVEN** Check-in Staff scan a QR ticket or manually enter a ticket code
- **WHEN** the app validates the attempt
- **THEN** validation still uses selected event context, assigned gate context, local Room preload data, local scan history, and backend sync outcomes
- **THEN** valid, invalid, duplicate, offline pending, failed sync, and conflict states remain classified according to existing domain rules

#### Scenario: Offline persistence and synchronization behavior is unchanged
- **GIVEN** the device is offline or backend sync is temporarily unavailable
- **WHEN** staff scan tickets, view the offline notice, open Sync Queue, retry sync, or review Sync Conflict
- **THEN** durable local scan logs, pending retry behavior, WorkManager synchronization, and conflict review semantics remain unchanged
- **THEN** pending or failed logs are not deleted by the visual refactor

#### Scenario: VIP, history, profile, event change, and logout behavior is unchanged
- **GIVEN** Check-in Staff use VIP, History, Profile, Change Event, or Logout flows
- **WHEN** the UI refactor is applied
- **THEN** VIP search and filtering, VIP detail, VIP check-in, VIP duplicate and not-found states, scan history search and filters, profile status, Change Event, and Logout continue to behave as before
- **THEN** Logout clears authenticated session credentials without deleting durable offline scan logs, sync records, conflict records, or preload cache

#### Scenario: External systems and backend architecture are unchanged
- **GIVEN** this change is a mobile UI refactor
- **WHEN** the implementation is reviewed
- **THEN** it does not add or modify VNPAY, MoMo, Email Provider, AI Model, Sponsor API, Sponsor CSV import, PostgreSQL schema, Redis usage, Kafka events, Backend API contracts, or external infrastructure

### Requirement: Responsive and accessible gate-operation layouts
The Check-in Mobile App SHALL provide responsive, accessible layouts suitable for fast gate operations on Android phones.

#### Scenario: Small phone screens remain usable
- **GIVEN** Check-in Staff use a small Android phone viewport
- **WHEN** they open each refactored screen
- **THEN** content does not overlap, clip critical labels, or hide required actions
- **THEN** screens with more content provide vertical scrolling or stable responsive constraints

#### Scenario: System bars and keyboard are respected
- **GIVEN** a device has Android status and navigation bars or the keyboard is visible
- **WHEN** staff use login, search, manual input, or any scrollable screen
- **THEN** important content and actions remain visible or reachable
- **THEN** the app does not rely on fake Figma phone chrome for spacing

#### Scenario: Gate actions have adequate touch targets and contrast
- **GIVEN** staff are operating in a busy venue environment
- **WHEN** they use primary actions, secondary actions, bottom navigation, scan controls, filters, and recovery actions
- **THEN** touch targets are large enough for mobile gate operation
- **THEN** text contrast is adequate for dark surfaces and status cards

#### Scenario: Actionable icons and controls are accessible
- **GIVEN** a refactored screen contains icon-only or icon-enhanced controls
- **WHEN** assistive technologies inspect those controls
- **THEN** actionable icons provide meaningful content descriptions
- **THEN** visual status differences are paired with readable labels

### Requirement: Real camera and QR scanning are preserved
The Check-in Mobile App SHALL preserve real CameraX camera preview and ML Kit QR detection during the Figma-aligned scan screen refactor.

#### Scenario: QR scan screen uses the real camera preview
- **GIVEN** camera permission is granted
- **WHEN** staff open the QR Scan screen
- **THEN** the screen displays the real CameraX camera preview
- **THEN** ML Kit QR detection remains active when scanning is enabled
- **THEN** the UI MUST NOT use a static screenshot or fake camera background as the production scanner

#### Scenario: Camera controls and lifecycle behavior remain available
- **GIVEN** staff use the scanner
- **WHEN** they tap to focus, pinch to zoom, toggle flash, grant camera permission, deny camera permission, leave the screen, or return to the screen
- **THEN** tap-to-focus, pinch-to-zoom, flash toggle, permission prompts, error messages, analyzer shutdown, torch shutdown, and lifecycle binding continue to behave safely

#### Scenario: Scanner error states remain visible
- **GIVEN** the camera cannot start, flash is unavailable, permission is denied, QR reading fails, or validation fails
- **WHEN** the error occurs
- **THEN** the app shows a readable error state without crashing
- **THEN** staff can recover through scan retry, permission grant, manual input, or navigation where applicable

### Requirement: UI tests and visual verification cover the refactor
The Check-in Mobile App SHALL preserve existing tests and add verification coverage for the Figma-aligned UI refactor.

#### Scenario: Existing Compose UI behavior tests are not weakened
- **GIVEN** the current Android UI tests cover login, assignments, dashboard, scan, manual input, ticket result, VIP, history, profile, offline notice, sync queue, conflict, and VIP result states
- **WHEN** the refactor is implemented
- **THEN** those behavioral assertions remain covered by Compose UI tests or equivalent tests
- **THEN** tests are not broadly deleted or bypassed merely to make the refactor pass

#### Scenario: Design-system and accessibility semantics are testable
- **GIVEN** shared components and refactored screens are implemented
- **WHEN** Compose UI tests inspect key screens
- **THEN** tests can verify primary labels, status labels, recovery actions, empty states, important content descriptions, and navigation destinations

#### Scenario: Manual visual verification compares native screens against Figma
- **GIVEN** a debug build of the refactored Android app is available
- **WHEN** reviewers manually inspect the implemented screens
- **THEN** each mapped screen is compared against the Figma Make reference for hierarchy, color roles, spacing, shape, typography, status treatment, and interaction state coverage
- **THEN** verification includes at least one small phone viewport and manual checks of CameraX preview, QR detection, offline scan persistence, Sync Queue, and Sync Conflict flows
