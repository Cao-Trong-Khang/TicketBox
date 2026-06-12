## Why

TicketBox now has JWT authentication, but protected APIs still need server-side authorization so Audience, Organizer, and Check-in Staff users can only access the capabilities allowed by their assigned roles. This change adds the RBAC foundation required by the blueprint while keeping JWTs identity-only.

## What Changes

- Add RBAC persistence with `roles`, `permissions`, `user_roles`, and `role_permissions` tables in PostgreSQL through Prisma.
- Seed blueprint roles `AUDIENCE`, `ORGANIZER`, and `CHECKIN_STAFF`.
- Seed granular TicketBox permissions for concert reading, concert management operations, ticket purchasing, own-ticket reading, analytics, and check-in workflows.
- Implement a `PermissionService`, `@Permissions()` decorator, and `PermissionsGuard` that evaluates permissions from database records using `req.user.id`.
- Add RBAC test endpoints or sample protected endpoints to verify `401 Unauthorized`, `403 Forbidden`, and successful permission checks.
- Update registration so new users are assigned the `AUDIENCE` role after RBAC tables exist.
- Keep JWT payloads unchanged: tokens MUST NOT contain role or permission claims.

## Capabilities

### New Capabilities

- `rbac-foundation`: Covers RBAC schema, seed data, permission lookup, permission decorator, permissions guard, and protected endpoint verification.

### Modified Capabilities

- `authentication-foundation`: Registration assigns the `AUDIENCE` role by default after creating a user.

## Impact

- Affected roles: Audience, Organizer, and Check-in Staff.
- Affected backend areas: Prisma schema/migrations, seed scripts, authentication registration flow, NestJS guards/decorators/services, and backend tests.
- Affected APIs: adds sample RBAC-protected endpoints for verification and changes registration side effects to create a `user_roles` assignment.
- Dependencies: uses existing PostgreSQL and Prisma; no new database, message broker, or external service is introduced.
- External systems: no interaction with VNPAY/MoMo, Email Provider, AI Model, or Sponsor CSV Files.
- Supported blueprint constraints: authorization is evaluated server-side from role and permission records, avoiding stale JWT role claims and supporting users with multiple roles.
