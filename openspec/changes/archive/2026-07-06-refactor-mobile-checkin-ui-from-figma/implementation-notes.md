## Audit Notes

### Figma Make reference

- Runtime target remains native Android, Kotlin, Jetpack Compose, and Material 3.
- Figma theme tokens mapped to Compose:
  - Background: `#0c0c12`
  - App chrome / bottom bar: `#0f0f16`
  - Card surface: `#17171f`
  - Muted surface: `#1e1e28`
  - Input / raised surface: `#23232e`
  - Primary action: `#ff6b35`
  - Foreground: `#f0f0f5`
  - Secondary foreground: `#c8c8d8`
  - Muted foreground: `#7878a0`
- Status roles:
  - Success, active, valid, checked-in, synced, online: green.
  - Invalid, failed, error, canceled, not found: red.
  - Duplicate, already checked-in, conflict: orange.
  - Offline, recorded offline, pending sync: blue.
  - Neutral or empty information: gray.
- Shared components required by the Figma reference: event card/header, status badge, status/sync banner, primary and secondary buttons, compact split actions, search fields, filter chips, statistic cards, ticket result cards, VIP guest cards, history cards, sync queue cards, empty/loading/error states, and bottom navigation.

### Current Android mapping

- `MainActivity.kt` currently owns top-level state, `EventShell`, all screen composables, and most shared UI helpers.
- `QrCameraPreview.kt` is already separated and must remain the real CameraX/ML Kit camera surface.
- Existing screens retained and visually refactored: Login, Assigned Events, Dashboard, QR Scan, Manual Ticket Input, Ticket Result states, VIP list/detail/result, Scan History, Offline Mode, Sync Queue, Sync Conflict, and Profile.
- Existing app states not shown exactly in Figma but preserved: invalid login, non-staff permission, assignment refresh failure, preload failure, empty assignments, camera permission denial, camera start failure, flash unavailable, stale snapshot, wrong event, wrong gate, canceled/refunded/not-active invalid outcomes, sync retry/rate limit, session restore, Change Event, and Logout.

### Runtime boundary

- No Backend API, PostgreSQL, Redis, Kafka, Room schema, WorkManager contract, API model, external integration, migration, or seed-data change is required.
- Figma phone shell, fake status bar, home indicator, demo legend, mock data, random validation, and simulated camera graphics are excluded from production UI.

### Verification

- `adb devices`: passed via `C:\Users\ADMIN\AppData\Local\Android\Sdk\platform-tools\adb.exe`; connected device `10AF3M0TD1002CN`.
- Device used for manual verification: Vivo V2440, Android 16, physical size `1080x2392`, density `440`.
- `assembleDebug`: passed from `mobile-checkin` with `JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot`.
- `testDebugUnitTest`: passed from `mobile-checkin` with the same JDK.
- `installDebug`: passed on `V2440 - 16`.
- `connectedDebugAndroidTest`: passed on `V2440 - 16`; 14 tests completed, 0 skipped, 0 failed.
- Production code search found no React, TypeScript, Tailwind CSS, HTML, WebView, Flutter, JavaScript UI runtime, Figma screenshot, fake camera, mock validation, random result logic, or phone-shell production UI.
- Device fixes applied during verification:
  - Added safe drawing insets at the activity root so login, assignments, and event screens do not overlap the status or navigation bars.
  - Set dark status and navigation bar colors in the app theme so system bar areas match the Figma-aligned dark UI.
  - Added IME padding at the activity root so login and scan/manual inputs remain reachable with the keyboard open.
  - Fixed instrumentation test harness state changes so `connectedDebugAndroidTest` covers the extracted screens without multiple `setContent` calls in one test.
- Manual visual verification compared the native screens against the Figma Make reference:
  - Login, Assigned Events, Dashboard, Scan, Manual Ticket Input, valid/invalid/duplicate/offline ticket results, VIP list/detail/result, History, Offline Mode, Sync Queue, Sync Conflict, and Profile use the expected dark surfaces, orange primary actions, compact cards, readable status labels, and bottom navigation.
  - Figma demo-only phone chrome, fake camera imagery, random validation, and mock web runtime remain excluded.
- Small-screen and accessibility verification:
  - Login keyboard, Scan keyboard, Assigned Events, Dashboard, VIP, History, Profile, Offline Mode, Sync Queue, and Sync Conflict were checked on the connected 1080x2392/440 dpi phone.
  - Screens scroll where needed; primary actions and bottom tabs remain reachable; dark-theme text contrast and status labels are readable; no critical horizontal overflow or system bar overlap remained after the fixes.
- Camera verification:
  - Android camera permission prompt was displayed.
  - Real CameraX `PreviewView`/`TextureView` preview was visible on the Scan screen.
  - Flash toggle changed between `Flash Off` and `Flash On`.
  - Tap-to-focus and pinch-style zoom gestures were exercised without crashes, and leaving/returning to the Scan tab restored the preview.
  - Physical ML Kit QR decoding was not completed because no QR target was placed in front of the connected device camera during this session; task 13.5 remains unchecked.
- Manual ticket and offline/sync verification:
  - Manual input produced valid (`TICKET-VALID`), invalid canceled (`TICKET-CANCEL`), duplicate (`TICKET-DUP`), and recorded-offline (`PEND1`) result states.
  - Device airplane mode produced Offline Mode with pending count and Continue Offline/View Sync Queue actions.
  - Offline scan `PEND1` persisted in Room as `accepted|pending|ticket|Local scan accepted` before and after force-stop.
  - After reconnecting, WorkManager/API retry marked `PEND1` as failed with retry count and next retry timestamp because the local backend was unavailable at `127.0.0.1:3000`.
  - Sync Queue showed Failed, Conflict, and Synced rows; Sync Conflict showed ticket, local time, server time, gate, Mark as Conflict, Contact Supervisor, and Back.
  - Logout returned to Login and durable local logs/assignments remained in Room (`local_scan_logs` count 13, `assignments` count 1).
- Manual API-backed sync verification did not require starting Docker Compose for this refactor because no backend API, sync contract, WorkManager contract, Room schema, repository, or API model changed.
