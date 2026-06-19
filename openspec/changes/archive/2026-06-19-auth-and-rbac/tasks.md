## 1. Database and Seed Data

- [x] 1.1 Update the Prisma user model to include `full_name`, `phone`, `status`, timestamps, and no direct role column.
- [x] 1.2 Add Prisma models and migration coverage for `refresh_tokens`, `audit_logs`, and `gate_staff_assignments`.
- [x] 1.3 Enforce uniqueness for role codes, permission codes, user-role pairs, role-permission pairs, refresh token IDs, and `(concert_id, user_id)` gate-staff assignments.
- [x] 1.4 Update RBAC seed data for fixed roles `AUDIENCE`, `ORGANIZER`, and `GATE_STAFF`.
- [x] 1.5 Seed permissions `concert:read`, `concert:create`, `concert:update`, `concert:cancel`, `concert:stats`, `ticket:purchase`, `ticket:read-own`, `document:upload`, `aibio:read`, `checkin:scan`, and `checkin:sync`.
- [x] 1.6 Map seeded permissions to fixed roles and verify the seed remains idempotent under repeated local runs.

## 2. Backend Authentication

- [x] 2.1 Implement `POST /auth/register` with email normalization, bcrypt password hashing, default `AUDIENCE` role assignment, duplicate-email `409`, and password-safe profile response.
- [x] 2.2 Implement `POST /auth/login` with credential validation, active-user check, server-loaded roles, 1 hour JWT access token, bcrypt-hashed refresh token persistence, and profile response.
- [x] 2.3 Implement JWT strategy and guard support for payload `{ user_id, roles, exp }`, mapping `user_id` to the request user context.
- [x] 2.4 Implement `POST /auth/refresh` with revoked/expired token rejection, bcrypt hash verification, transactional rotation, and new token-pair issuance.
- [x] 2.5 Implement `POST /auth/logout` with Bearer authentication, refresh-token ownership verification, `revoked_at` update, and `204 No Content`.
- [x] 2.6 Implement `GET /auth/me` to load the current user and roles from PostgreSQL and omit `password_hash`.
- [x] 2.7 Standardize authentication error responses as `{ error, message, status_code }`.

## 3. Backend RBAC and Admin APIs

- [x] 3.1 Implement reusable role metadata and guards for endpoints requiring any authenticated role, `ORGANIZER`, or `GATE_STAFF`.
- [x] 3.2 Ensure Layer 1 guard behavior returns `401` for missing or invalid tokens and `403` for missing endpoint roles.
- [x] 3.3 Implement server-side role and permission lookup services backed by PostgreSQL, without trusting token claims for final authorization.
- [x] 3.4 Implement `GET /roles` for any authenticated role, returning roles with permission code arrays.
- [x] 3.5 Implement `GET /admin/users/:userId/roles` requiring `ORGANIZER`.
- [x] 3.6 Implement `POST /admin/users/:userId/roles` requiring `ORGANIZER`, validating `{ role_code }`, returning `409` for duplicates, and writing `audit_logs`.
- [x] 3.7 Implement `DELETE /admin/users/:userId/roles/:roleCode` requiring `ORGANIZER`, writing `audit_logs`, and returning `204 No Content`.
- [x] 3.8 Standardize RBAC and admin API error responses as `{ error, message, status_code }`.

## 4. Gate Staff Assignment

- [x] 4.1 Implement organizer ownership checks that verify `concert.organizer_id = current_user` in the domain service.
- [x] 4.2 Implement `POST /admin/concerts/:concertId/gate-staff` requiring `ORGANIZER`, validating `{ user_id, gate_label }`, enforcing ownership, writing `audit_logs`, and returning `201 Created`.
- [x] 4.3 Implement `GET /admin/concerts/:concertId/gate-staff` requiring `ORGANIZER` and returning assignments only after ownership passes.
- [x] 4.4 Implement `DELETE /admin/concerts/:concertId/gate-staff/:assignmentId` requiring `ORGANIZER`, enforcing ownership, writing `audit_logs`, and returning `204 No Content`.
- [x] 4.5 Implement a reusable Gate Staff assignment check for future scan and offline sync services, scoped by concert ID and gate label.

## 5. Frontend Auth and Routing

- [x] 5.1 Update frontend auth client types and API calls for register, login, refresh, logout, me, roles, role admin, and gate-staff assignment endpoints.
- [x] 5.2 Store authenticated session state using the existing frontend pattern, including access token, refresh token, and server-returned profile roles.
- [x] 5.3 Implement post-login redirects with priority `ORGANIZER` to `/admin/dashboard`, `GATE_STAFF` to `/checkin`, and `AUDIENCE` to `/concerts`.
- [x] 5.4 Implement frontend route guards for `/admin/*`, `/checkin/*`, and `/tickets/my`.
- [x] 5.5 Render role-specific navigation for Organizer, Gate Staff, and Audience roles.
- [x] 5.6 Handle backend `401` and `403` responses by clearing invalid sessions or redirecting away from unauthorized protected screens.

## 6. Tests and Local Verification

- [x] 6.1 Add backend tests for registration, duplicate email, login token shape, invalid credentials, current user lookup, refresh rotation, revoked refresh rejection, and logout.
- [x] 6.2 Add backend tests for missing token `401`, missing role `403`, roles listing, role assignment, duplicate role conflict, role removal, and audit-log writes.
- [x] 6.3 Add backend tests for organizer-owned gate-staff assignment creation/list/deletion and cross-organizer `403` ownership denial.
- [x] 6.4 Add frontend tests for role-based login redirects, route guards, navigation rendering, and handling of backend `401` or `403`.
- [x] 6.5 Run local migrations, seed data, backend tests, frontend tests, and Docker Compose startup verification.
- [x] 6.6 Demo the acceptance paths for Audience login, Organizer admin role/gate-staff management, and Gate Staff route access using local services.
