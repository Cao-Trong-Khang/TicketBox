## 1. Database Schema

- [x] 1.1 Add Prisma models and migration for `refresh_tokens`, `audit_logs`, and `check_in_staff_assignments` only.
- [x] 1.2 Add indexes and uniqueness constraints for refresh-token lookup and `(concert_id, user_id)` Check-in Staff assignments.
- [x] 1.3 Run Prisma generation and verify the backend compiles against the new client.

## 2. Refresh Token Session Flow

- [x] 2.1 Add DTOs and validation for refresh and logout requests.
- [x] 2.2 Update login to generate an opaque refresh token, store only its bcrypt hash, and return `{ accessToken, refreshToken }`.
- [x] 2.3 Implement `POST /auth/refresh` with hash verification, revoked/expired checks, old-token revocation, new-token creation, and one-hour identity-only access-token issuance.
- [x] 2.4 Implement `POST /auth/logout` with Bearer authentication, current-user ownership verification for the submitted refresh token, `revoked_at` update, and `204 No Content`.
- [x] 2.5 Add unit or integration tests for successful login token persistence, refresh rotation, revoked token rejection, expired token rejection, and logout revocation.

## 3. Audit Logging

- [x] 3.1 Add an audit logging service that writes `actor_user_id`, `action`, `target_type`, `target_id`, compact JSON metadata, and `created_at`.
- [x] 3.2 Ensure role and Check-in Staff assignment mutations write audit logs in the same service flow or transaction as the mutation.
- [x] 3.3 Add tests proving successful mutations write audit logs and denied mutations do not write success audit logs.

## 4. Role Management API

- [x] 4.1 Add protected `GET /roles` returning role codes, names, and permission codes with descriptions.
- [x] 4.2 Add protected `GET /admin/users/:userId/roles` for Organizer role lookup.
- [x] 4.3 Add protected `POST /admin/users/:userId/roles` with `{ role_code }`, duplicate `409 Conflict`, PostgreSQL `user_roles` persistence, and audit logging.
- [x] 4.4 Add protected `DELETE /admin/users/:userId/roles/:roleCode` with audit logging and `204 No Content`.
- [x] 4.5 Add tests for role catalog lookup, role listing, role assignment, duplicate assignment rejection, role removal, and missing-permission denial.

## 5. Check-in Staff Assignment API

- [x] 5.1 Add protected `POST /admin/concerts/:concertId/check-in-staff` with Organizer authorization, concert ownership check, assignment creation, audit logging, and `201 Created`.
- [x] 5.2 Add protected `GET /admin/concerts/:concertId/check-in-staff` with Organizer authorization and concert ownership check.
- [x] 5.3 Add protected `DELETE /admin/concerts/:concertId/check-in-staff/:assignmentId` with Organizer authorization, concert ownership check, audit logging, and `204 No Content`.
- [x] 5.4 Ensure the implementation uses the existing `CHECKIN_STAFF` role semantics and does not add any other staff role name.
- [x] 5.5 Add tests for successful assignment, duplicate assignment rejection, non-owner denial, listing assignments, removal, and audit logging.

## 6. Check-in Assignment Helper

- [x] 6.1 Implement `assertCheckInStaffAssigned(userId, concertId)` backed by PostgreSQL `check_in_staff_assignments`.
- [x] 6.2 Integrate the helper into check-in preload and sync authorization without trusting JWT role claims for assignment scope.
- [x] 6.3 Add tests proving assigned staff can continue and unassigned staff receives an authorization failure.

## 7. Verification

- [x] 7.1 Run backend tests covering auth, RBAC, audit logs, and check-in assignment behavior.
- [x] 7.2 Run backend build or typecheck to catch Prisma and NestJS wiring issues.
- [x] 7.3 Run a local Docker Compose demo path for login, refresh, logout, role assignment, Check-in Staff assignment, and assignment-scoped check-in denial.
- [x] 7.4 Confirm all API errors use `{ error, message, status_code }` format where the existing project error layer supports it.
