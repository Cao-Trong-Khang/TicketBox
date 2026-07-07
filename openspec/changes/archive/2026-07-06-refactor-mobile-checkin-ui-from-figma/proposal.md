## Why

The existing Android check-in app already covers the required gate-operation workflows, but most Compose screens and shared UI helpers are concentrated in `MainActivity.kt` and use the default Material presentation rather than the Figma Make visual direction. This change improves speed, consistency, accessibility, and maintainability for Check-in Staff by aligning the native UI with the Figma reference while preserving current authentication, offline validation, camera scanning, Room persistence, and sync behavior.

## What Changes

- Refactor the Check-in Mobile App's Jetpack Compose UI to closely match the inspected Figma Make design for TicketBox staff check-in: dark operations-focused layout, TicketBox orange primary actions, compact rounded cards, consistent status colors, bottom navigation, and screen-specific loading, empty, error, offline, duplicate, and conflict states.
- Introduce reusable native Compose design-system components for theme tokens, typography, spacing, shapes, buttons, text fields, top/event headers, bottom navigation, status badges, banners, statistic cards, search fields, filter chips, result cards, VIP cards, history cards, empty states, loading states, and error states.
- Extract screen and component implementations from the large `MainActivity.kt` into focused UI packages while keeping `MainActivity` responsible for activity setup, top-level state wiring, and navigation coordination.
- Visually refactor the existing Login, Assigned Events, Dashboard, Scan, Manual Ticket Input, Ticket Result, VIP, History, Offline Mode, Sync Queue, Sync Conflict, and Profile flows without changing business rules.
- Preserve the current CameraX and ML Kit QR scanner, camera permission handling, tap-to-focus, pinch-to-zoom, flash toggle, Room Database scan logs, WorkManager sync, local validation, VIP filtering, and conflict review semantics.
- Add or update UI test coverage and manual visual verification expectations so the implemented native screens can be compared against the Figma Make reference on normal and small Android phone viewports.
- Do not introduce React, TypeScript, Tailwind CSS, HTML, WebView, Flutter, JavaScript UI, a second mobile framework, new backend services, new databases, or new external infrastructure.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `offline-gate-checkin`: extend the existing mobile check-in capability with Figma-aligned native Android UI coverage, reusable Compose design-system requirements, screen extraction expectations, responsive and accessible layout requirements, and visual verification criteria while preserving existing check-in behavior.

## Impact

- Impacted role: Check-in Staff.
- Not impacted: Audience and Organizer user flows.
- Affected code: `mobile-checkin/app/src/main/java/com/ticketbox/checkin/MainActivity.kt`, `mobile-checkin/app/src/main/java/com/ticketbox/checkin/ui/scan/QrCameraPreview.kt`, new or reorganized Compose files under `mobile-checkin/app/src/main/java/com/ticketbox/checkin/ui/`, Android UI tests under `mobile-checkin/app/src/androidTest/`, and focused domain/UI tests where view-state behavior is currently asserted.
- Affected runtime components: Check-in Mobile App only. Backend API, PostgreSQL, Redis, Kafka, Room schema, WorkManager sync contracts, API models, repository behavior, RBAC, authentication semantics, and validation rules remain unchanged unless an actual defect is separately documented.
- External systems: this visual refactor does not add or modify integrations with VNPAY/MoMo, Email Provider, AI Model, Sponsor APIs, or Sponsor CSV import. Existing sponsor VIP data remains based on the scheduled CSV import flow. Figma MCP is a design-time inspection tool only and is not part of the TicketBox runtime architecture.
- Supported global goals and constraints: improves the Check-in Staff mobile scanning workflow, preserves offline-capable venue operations, keeps local scan logs durable, keeps PostgreSQL authoritative after sync, avoids new databases or infrastructure, and stays within the native Android/Kotlin/Jetpack Compose stack defined by the global architecture.
