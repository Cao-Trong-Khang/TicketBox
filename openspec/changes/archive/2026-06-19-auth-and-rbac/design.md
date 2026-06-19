## Context

TicketBox already has backend authentication and RBAC foundation specs, and the archived design establishes ADR 7: clients authenticate with tokens while final authorization is evaluated server-side. The current foundations define identity, roles, permissions, and a permission guard, but the requested feature needs production-shaped behavior for access tokens, refresh-token rotation, role administration, gate-staff assignment, audit logs, and role-driven frontend routing.

This design stays inside the existing Client-Server, Layered, and Event-driven architecture. The Web Application consumes auth responses and applies client-side route guards for UX. The Backend API remains the enforcement point for JWT validation, role checks, ownership checks, assignment checks, and audit writes. PostgreSQL remains the source of truth for users, roles, permissions, refresh tokens, assignments, and audit logs. Redis, Kafka, Background Workers, payment gateways, email, AI, and sponsor CSV integrations are not required for this change.

## Goals / Non-Goals

**Goals:**

- Provide JWT stateless authentication with 1 hour access-token TTL and refresh-token rotation.
- Keep role hints in access tokens for frontend routing while requiring server-side checks for all final authorization.
- Enforce two authorization layers: API guard role checks and domain service ownership or assignment checks.
- Add database persistence for refresh tokens, audit logs, and gate-staff assignments.
- Expose public auth endpoints, authenticated profile and role endpoints, role administration APIs, and organizer-owned gate-staff assignment APIs.
- Add frontend login redirects, route guards, and role-specific navigation.
- Return errors in `{ error, message, status_code }` format.

**Non-Goals:**

- No payment, notification, AI, CSV import, traffic-spike, or checkout behavior is implemented by this change.
- No new databases, message brokers, managed infrastructure, or external services are introduced.
- No seat-level authorization model or dynamic custom-role management is introduced; the role set is fixed to `AUDIENCE`, `ORGANIZER`, and `GATE_STAFF`.
- No offline check-in conflict resolution is implemented here beyond assignment scoping needed by later check-in sync APIs.

## Decisions

1. **JWT carries `user_id` and role hints, but guards and services re-check server-side state.**

   The access token payload will be `{ user_id: string, roles: string[], exp: number }` and expire after 1 hour. API guards use the token to authenticate the request and can check whether a required endpoint role is present, but domain services load authoritative state from PostgreSQL before allowing ownership-sensitive or assignment-sensitive actions. This aligns with ADR 7 while still allowing fast frontend routing. Alternative considered: identity-only JWTs. That is stricter, but the requested UI needs role hints after login.

2. **Use refresh-token rows with bcrypt hashes and rotation.**

   Refresh tokens are opaque random values returned only to the client. PostgreSQL stores a bcrypt hash in `refresh_tokens.token_hash`; refresh rotates by revoking the old row and inserting a new one. Logout sets `revoked_at`. Alternative considered: signed refresh JWTs without persistence. That would be simpler, but it cannot reliably revoke individual sessions or detect reuse.

3. **Prefer role guards for endpoint access and domain services for resource scope.**

   Controllers declare role requirements for broad endpoint access, such as `ORGANIZER` for admin endpoints or any authenticated role for `/auth/me`. Services then enforce `concert.organizer_id = current_user` or `gate_staff_assignments` scoping. Alternative considered: centralizing all checks in guards. That makes ownership and assignment checks harder to keep close to business state and risks duplicating domain queries.

4. **Keep permissions seeded and listed, but expose requested endpoints through fixed roles.**

   The RBAC tables continue to seed role-permission mappings for future permission checks and `/roles` visibility. The requested API layer explicitly checks roles for endpoint access because the product has three fixed roles. Alternative considered: permission-only route declarations. That matches the older foundation, but the requested endpoint contract is role-based and should be represented directly.

5. **Write audit logs synchronously with administrative mutations.**

   Role assignment/removal and gate-staff assignment/removal write `audit_logs` in the same successful service flow as the mutation. This keeps sensitive authorization changes traceable in PostgreSQL without adding Kafka or workers. Alternative considered: publishing async audit events. That adds delivery complexity and is unnecessary for this local modular monolith feature.

## Risks / Trade-offs

- [Risk] Role hints in JWT can become stale before the 1 hour TTL expires -> Mitigation: role hints are only used for UI routing and first-pass endpoint role checks; services must load server-side ownership, assignment, and role data before sensitive changes.
- [Risk] Refresh-token rotation can leave multiple valid tokens during concurrent refresh attempts -> Mitigation: update the old row with `revoked_at` inside a transaction and reject refresh attempts for already revoked or expired rows.
- [Risk] Gate labels are free-form and may be mistyped -> Mitigation: store `gate_label` as provided for this feature, validate non-empty length, and leave structured gate catalogs to future venue-management changes.
- [Risk] Organizer role-management endpoints could elevate arbitrary users -> Mitigation: require `ORGANIZER` at the API layer, write audit logs, and keep the fixed role set explicit in seed data and validation.
- [Risk] Existing specs use `CHECKIN_STAFF` while the requested role is `GATE_STAFF` -> Mitigation: migrate the canonical fixed role to `GATE_STAFF` in this change and treat old `CHECKIN_STAFF` references as superseded by the updated RBAC spec.

## Migration Plan

1. Add Prisma schema models and migrations for `refresh_tokens`, `audit_logs`, and `gate_staff_assignments`, plus any missing user fields required by the auth contract.
2. Update seed data to create roles `AUDIENCE`, `ORGANIZER`, and `GATE_STAFF`, the requested permission codes, and role-permission mappings.
3. Update auth services/controllers for register, login, refresh, logout, and me endpoints.
4. Update RBAC guards/decorators/services for fixed role checks, role loading, role administration, roles listing, and standardized errors.
5. Add gate-staff assignment service/controller with organizer ownership checks and audit logging.
6. Update frontend auth state, login redirects, protected routes, and role-specific navigation.
7. Add backend and frontend tests for happy paths, forbidden paths, duplicate conflicts, token rotation, and role routing.

Rollback is straightforward during local development: revert the migration and code changes, then reseed the previous RBAC data. If data already exists, preserve users and remove only refresh-token, audit, and gate-staff assignment rows created during testing.

## Open Questions

- Should `ORGANIZER` users be allowed to administer roles globally, or should this eventually become a separate platform-admin role? The requested contract gives `ORGANIZER` access, so this proposal follows it.
