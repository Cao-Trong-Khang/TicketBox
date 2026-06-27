## Why

Phase 1 gives TicketBox identity-only JWT authentication, server-side permission checks, seeded roles, and default Audience registration, but it does not yet provide session refresh, operator role administration, organizer-managed check-in assignments, or audit trails for sensitive access changes. Phase 2 completes the missing authentication and RBAC workflows needed for organizer administration and mobile Check-in Staff operations while preserving ADR 7: final authorization remains server-side.

## What Changes

- Add refresh-token persistence and APIs so login returns both an access token and refresh token, refresh rotates stored hashed tokens, and logout revokes a refresh token.
- Add organizer-facing role management APIs for listing, assigning, and removing user roles, with duplicate protection and audit logging.
- Add organizer-facing Check-in Staff assignment APIs scoped by concert ownership, using the existing `CHECKIN_STAFF` role for mobile-only staff access.
- Add audit logging for role assignment, role removal, Check-in Staff assignment, and Check-in Staff assignment removal.
- Add `GET /roles` so authenticated clients can read roles with permission codes and descriptions.
- Extend check-in domain authorization with a reusable `assertCheckInStaffAssigned(userId, concertId)` helper backed by assignment data.
- Keep PostgreSQL as the source of truth for refresh tokens, role assignments, audit logs, and Check-in Staff assignments.
- This feature does not interact with VNPAY/MoMo, Email Provider, AI Model, Sponsor CSV Files, Redis, Kafka, or Background Workers.

## Capabilities

### New Capabilities
- `refresh-token-session`: Persisted refresh-token rotation and logout for authenticated sessions.
- `audit-log-foundation`: Audit logging for sensitive RBAC and Check-in Staff assignment changes.

### Modified Capabilities
- `authentication-foundation`: Login response gains a refresh token, and public refresh/logout session flows are added.
- `rbac-foundation`: Organizer role-management APIs and authenticated role catalog lookup are added.
- `offline-gate-checkin`: Organizer-managed Check-in Staff assignments and backend assignment helper are added for mobile Check-in Staff scoping.

## Impact

- Backend Prisma schema and migrations: add `refresh_tokens`, `audit_logs`, and `check_in_staff_assignments` only.
- Backend modules: update Auth, RBAC/Permissions, and Check-in Staff assignment boundaries.
- Backend APIs: add `/auth/refresh`, `/auth/logout`, `/admin/users/:userId/roles`, `/admin/concerts/:concertId/check-in-staff`, and `/roles`.
- Authorization: continue using `JwtAuthGuard` and `PermissionsGuard` for Layer 1, plus domain ownership or assignment checks for Layer 2.
- Roles impacted: Audience can continue registering and logging in; Organizer can manage roles and mobile Check-in Staff assignments for owned concerts; Check-in Staff remains mobile-scoped through assignment checks.
