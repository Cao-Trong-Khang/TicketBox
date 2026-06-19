## Why

TicketBox needs a complete authentication and RBAC layer so Audience, Organizer, and Gate Staff workflows can be protected before concert management, ticket purchase, and check-in features depend on them. This change turns the existing identity and RBAC foundations into enforceable API, database, audit, and frontend routing behavior aligned with ADR 7: token-based authentication with server-side authorization checks.

## What Changes

- Update authentication to issue stateless JWT access tokens with a 1 hour TTL and payload `{ user_id, roles, exp }`, where roles are only UI routing hints.
- Add refresh-token lifecycle support with bcrypt-hashed refresh tokens, rotation on refresh, revocation on logout, and `401` responses for expired or revoked tokens.
- Return authenticated user profiles without `password_hash`, including server-loaded roles.
- Seed the three fixed roles and the requested permission codes, and expose `GET /roles` for authenticated users.
- Add role-management APIs for assigning and removing user roles, including duplicate detection and audit logs.
- Add gate-staff assignment APIs scoped to organizer-owned concerts, including audit logs.
- Enforce two-layer authorization: API guards verify JWT validity and endpoint roles; domain services enforce server-side ownership or gate assignment.
- Add frontend role-driven redirects, route guards, and navigation for Audience, Organizer, and Gate Staff areas.
- Standardize API errors as `{ error, message, status_code }`.

## Capabilities

### New Capabilities

- `gate-staff-assignment`: Organizer-managed assignment of Gate Staff users to owned concerts and gates for server-side check-in scoping.
- `auth-rbac-frontend-routing`: Role-driven login redirects, protected frontend route guards, and role-specific navigation.

### Modified Capabilities

- `authentication-foundation`: Replace identity-only login behavior with access and refresh token flows, user profile responses with roles, logout, refresh rotation, and the required JWT payload shape.
- `rbac-foundation`: Extend RBAC persistence, seed data, guards, role administration, audit logging, roles listing, and the two-layer authorization contract.

## Impact

- Affected users: Audience, Organizer, and Gate Staff.
- Affected backend areas: NestJS auth module, RBAC module, guards/decorators, domain service authorization checks, Prisma schema/migrations/seeds, audit logging, and admin controllers.
- Affected frontend areas: login handling, route guards, role-specific navigation, Audience tickets route, Organizer admin area, and Gate Staff check-in area.
- Affected database tables: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `refresh_tokens`, `audit_logs`, and `gate_staff_assignments`.
- External systems: no direct interaction with VNPAY/MoMo, Email Provider, AI Model, Sponsor CSV Files, Redis, Kafka, or Background Workers is introduced by this change.
- Supported global goals and risks: enforces role-based access control, protects organizer and check-in operations, keeps PostgreSQL as authorization source of truth, and supports ADR 7 by never trusting token claims for final authorization.
