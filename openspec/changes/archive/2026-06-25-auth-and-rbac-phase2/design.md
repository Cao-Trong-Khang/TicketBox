## Context

TicketBox already has identity-only JWT authentication, `JwtAuthGuard`, `PermissionsGuard`, seeded RBAC tables, and server-side permission lookup. The current gap is that longer-lived sessions, role administration, organizer-managed mobile staff assignment, and audit trails are not yet represented in backend APIs.

This design stays inside the NestJS modular monolith and PostgreSQL-backed authorization model described by the global blueprint. The Web Application uses the new organizer admin APIs for role and assignment administration. The Check-in Mobile App continues to use the existing `CHECKIN_STAFF` role and receives access only for assigned concerts or gates. No new external systems, message brokers, databases, Redis caches, Kafka jobs, or background workers are introduced.

## Goals / Non-Goals

**Goals:**
- Store refresh tokens as bcrypt hashes and rotate them on refresh.
- Revoke refresh tokens on logout.
- Allow Organizer users to list, assign, and remove roles through backend APIs.
- Allow Organizer users to assign and remove mobile Check-in Staff for owned concerts.
- Write audit logs for role and Check-in Staff assignment changes.
- Expose a protected role catalog with permission codes and descriptions.
- Keep JWT access tokens identity-only and keep final authorization server-side.

**Non-Goals:**
- Use the existing `CHECKIN_STAFF` role for mobile staff; do not introduce another staff role name.
- Do not add staff web navigation or web check-in pages.
- Do not add Redis-backed permission caching in this phase.
- Do not change payment, checkout, AI bio, CSV import, or notification workflows.
- Do not add database tables beyond `refresh_tokens`, `audit_logs`, and `check_in_staff_assignments`.

## Decisions

### Store refresh tokens as hashed database records

Refresh tokens will be generated as opaque random values, stored only as bcrypt hashes in `refresh_tokens`, and returned to the client once. `POST /auth/refresh` will find a matching non-revoked, non-expired token for the user, revoke the old token, create a new refresh token, and issue a new one-hour access token.

Alternative considered: stateless refresh JWTs. This was rejected because logout and rotation need server-side revocation, and PostgreSQL is already the authoritative state store for identity and security-sensitive records.

### Keep access tokens identity-only

Login and refresh will continue signing access tokens with identity claims only. Role hints are not added to JWTs in this phase because the existing ADR 7 model requires server-side permission, ownership, and assignment checks.

Alternative considered: embed roles in access tokens for UI routing. This was rejected for the backend contract because role claims can become stale and must not become an authorization source.

### Split Layer 1 and Layer 2 checks

Admin APIs will use `JwtAuthGuard` plus permission checks for Layer 1. Concert-scoped assignment APIs will additionally load the concert and require `concert.organizerId === currentUserId` before changing or listing assignments.

Alternative considered: rely only on organizer permissions. This was rejected because any Organizer permission alone is too broad for concert ownership.

### Use the existing Check-in Staff role and a dedicated assignment table

The assignment table will be named `check_in_staff_assignments` and will reference `concert_id`, `user_id`, and `gate_label`. The helper `assertCheckInStaffAssigned(userId, concertId)` will use this table to scope check-in module access. The existing `CHECKIN_STAFF` role remains the role code for mobile staff.

Alternative considered: reuse the existing check-in assignment table shape. This phase follows the requested design table name and fields, but implementation should map it carefully against any existing check-in assignment model to avoid duplicate semantics.

### Write audit logs synchronously with admin mutations

Role changes and Check-in Staff assignment changes will write `audit_logs` in the same service flow as the mutation, ideally in the same Prisma transaction. `metadata_json` will contain compact JSON text with role code, concert ID, gate label, and affected user where applicable.

Alternative considered: publish audit events to Kafka. This was rejected because the global design treats PostgreSQL audit logs as authoritative and this phase does not need asynchronous audit fan-out.

## Risks / Trade-offs

- Refresh-token lookup can be expensive if every candidate hash is checked with bcrypt -> Mitigation: query only active tokens for the expected user when possible, index `user_id`, `expires_at`, and `revoked_at`, and keep refresh-token lifetimes bounded.
- Role management by any Organizer may be too broad operationally -> Mitigation: this phase follows the requested API contract, writes audit logs, and can later introduce a narrower admin permission without changing the core model.
- A user can have multiple roles by schema design -> Mitigation: APIs must prevent duplicate role rows but must not assume single-role users; UI can still present primary-role flows separately.
- Check-in Staff assignment semantics may overlap with existing mobile check-in assignment records -> Mitigation: implementation must inspect the current Prisma schema and either align service reads to `check_in_staff_assignments` or deliberately migrate existing assignment usage.
- Synchronous audit writes can fail an admin mutation -> Mitigation: perform admin mutation and audit write in one transaction so sensitive changes are not applied without an audit trail.

## Migration Plan

1. Add Prisma models and migration for `refresh_tokens`, `audit_logs`, and `check_in_staff_assignments`.
2. Generate Prisma client and update seed or fixtures only if needed for local testing.
3. Implement refresh-token service logic and update login response.
4. Implement role-management and role-catalog APIs with permission guards and audit logs.
5. Implement Check-in Staff assignment APIs with organizer ownership checks and audit logs.
6. Update check-in assignment helper usage for `assertCheckInStaffAssigned(userId, concertId)`.
7. Add focused tests for rotation, logout revocation, role duplicate handling, ownership denial, assignment denial, and audit log creation.

Rollback: remove the new endpoints from routing, roll back the Prisma migration in local environments, and invalidate any issued refresh tokens by deleting or revoking `refresh_tokens`.

## Open Questions

- Should `POST /auth/logout` require the refresh token in the request body, or revoke all active refresh tokens for the current user? The requested contract says set `revoked_at` on refresh token, so the proposed default is body-based revocation for the supplied refresh token.
- Should Organizer role management eventually be restricted to a separate platform admin role? This phase follows the requested `Bearer ORGANIZER` contract.
