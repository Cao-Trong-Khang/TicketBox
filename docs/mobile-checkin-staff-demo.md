# Mobile Staff Check-in Demo

This demo verifies the staff gate workflow against the local TicketBox stack, including the `refactor-mobile-02` offline sync, history, VIP guest list, and profile flows.

## Prerequisites

- Backend dependencies installed.
- Docker Compose services running for PostgreSQL, Redis, Kafka, and Backend API.
- Backend migrations and seed data applied.
- Android emulator or device available for `mobile-checkin`.

## Demo Flow

1. Start the local stack from the repository root:

   ```bash
   docker compose up -d
   ```

2. Prepare backend data:

   ```bash
   cd backend
   npm run prisma:deploy
   npm run prisma:seed
   npm run start:dev
   ```

3. Open `mobile-checkin` in Android Studio or run a debug build:

   ```bash
   cd mobile-checkin
   .\gradlew.bat assembleDebug
   ```

4. Launch the app and log in with a seeded Check-in Staff account.

5. Confirm the Assigned Events screen shows only the staff user's assigned concerts or gates.

6. Select an assigned event. The app preloads assignment-scoped tickets and VIP guest data.

7. On Dashboard, verify event name, venue, gate, total tickets, checked-in count, remaining count, VIP count, network state, sync state, and pending offline count.

8. Open Scan and validate:

   - A valid seeded QR hash or ticket code routes to the green Valid Ticket result.
   - Confirm Check-in or the saved local scan queues the record for sync.
   - Scan Next returns to the scan workflow.

9. Open Manual Input and validate:

   - Empty input shows an input error.
   - Unknown input routes to the red Invalid Ticket result.
   - A canceled or refunded fixture routes to the red Invalid Ticket result.

10. Scan or enter the same accepted code again. The app shows the orange Duplicate Ticket result and prevents a second confirmation.

11. Turn off network connectivity. Verify the Offline Mode notice explains local storage, shows the pending sync count, and offers Continue Offline and View Sync Queue.

12. Continue offline, scan or manually enter a valid code, and verify the Offline Scan Result shows Pending Sync, ticket or attendee details when available, the final-validation warning, and Scan Next.

13. Open Sync Queue. Verify records show ticket code, scan time, status, gate, network state, and Retry Sync. Restore connectivity and retry sync.

14. Reproduce a conflict by syncing the same accepted ticket from another device first. Verify the conflict row routes to Sync Conflict and shows local time, server time when available, Mark as Conflict, and Contact Supervisor.

15. Open History. Search by ticket code and verify filters for All, Success, Invalid, Duplicate, Offline, and Conflict remain scoped to the selected assignment.

16. Open VIP. Verify summary cards for total, checked-in, and remaining VIP guests. Search by guest name, phone, email, or invite code, and filter by sponsor, guest type, and check-in status.

17. Open a VIP guest detail. Verify phone/email, sponsor or invited-by, guest type, allowed gate, status, and notes. Confirm VIP check-in and verify the green success screen shows guest name, guest type, check-in time, gate, and Check in next VIP guest.

18. Try an already checked-in VIP guest and a search with no matching guest. Verify duplicate and not-found warning states offer Search Again and Contact Supervisor.

19. Open Profile. Verify staff identity, role, event, gate, device, app version, sync status, cache status, and logout.

20. Log out and relaunch the app. Pending, synced, failed, and conflict scan logs remain in local Room storage, but sync requires a new authenticated staff session.

## Expected Result

The mobile app behaves as a staff-only gate workflow: login is required, assigned event selection gates all check-in actions, ticket scans and manual input produce explicit result states, offline scans sync later, sync conflicts are visible, VIP CSV guest check-in is searchable and filterable, history data stays scoped to the assignment, and logout clears session credentials without deleting durable offline records.
